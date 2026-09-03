// A durable outbox for tracker writes, so a tick made offline is kept and replayed
// instead of silently dropped.
//
// The bug this exists for: Habits.tsx set its optimistic state, fired the haptic,
// called the API and ended in `.catch(() => {})`. Nothing retried, nothing told the
// user, and nothing reconciled — so the cell stayed green until a reload, then the
// tick was gone. The same shape sat on the Progress grid (App.tsx handleCheck) and on
// every weight/step/macro write.
//
// Why a plain localStorage queue and not Background Sync: index.html skips the
// service worker under Capacitor, so a `sync`-based fix would only cover the web PWA
// and not the native app.
//
// Replay is safe because both tracker endpoints are idempotent absolute-state
// upserts: PATCH /tracker/habit does `SET done = $4, state = $5` (not a toggle), and
// PATCH /tracker sets each column via `CASE WHEN $n IS NOT NULL`. Replaying a write
// that already landed is a no-op, so no dedup token is needed.
//
// This module deliberately has no runtime import from api.ts — api.ts calls
// initOutbox() with a sender. That keeps the dependency one-way and lets
// outbox.check.ts exercise the whole thing under node with a fake sender.
import type { ApiErrorKind } from './api';

const STORAGE_KEY = 'superdub.outbox';

/** Past this, a write is never going to land; drop it rather than retry forever. */
export const MAX_ATTEMPTS = 5;
/** A long offline stretch must not grow localStorage without bound. */
export const MAX_ENTRIES = 200;

export type OutboxKind = 'habit' | 'day';

export interface OutboxEntry {
  /** Coalescing identity: one entry per habit-cell, or per tracker day. */
  key: string;
  kind: OutboxKind;
  day: string;
  habitName?: string;
  payload: Record<string, unknown>;
  attempts: number;
  queuedAt: number;
}

/** Sends one entry for real. Must hit the network directly, never the queueing
 *  wrapper in api.ts — otherwise a failed replay would enqueue itself again. */
export type OutboxSender = (entry: OutboxEntry) => Promise<unknown>;

export const entryKey = (kind: OutboxKind, day: string, habitName?: string): string =>
  kind === 'habit' ? `habit:${day}:${habitName}` : `day:${day}`;

/**
 * Is this failure worth keeping the write for?
 *
 * NOT `ApiError.retryable` — that is `kind !== 'auth'`, so it is true for a 400, and
 * queueing on it would replay a malformed write until the attempt cap. We keep a
 * write only when we never got a verdict from the server (offline, timeout) or the
 * server itself fell over (5xx). A 4xx is the server saying no, and it will say no
 * again. Duck-typed rather than `instanceof ApiError` so this module stays free of a
 * runtime import from api.ts; only ApiError carries these two fields.
 */
export function shouldQueue(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { kind?: ApiErrorKind; status?: number };
  if (e.kind === 'offline' || e.kind === 'timeout') return true;
  return e.kind === 'server' && (e.status ?? 0) >= 500;
}

/**
 * Fold a new write into the queue.
 *
 * Coalescing is what makes replay correct rather than merely eventual. Both endpoints
 * take absolute state, so for any one key only the newest write matters: offline
 * tri-state cycling on a habit collapses to a single write and can never replay out
 * of order. Day entries MERGE their payload, so a queued weight and a later queued
 * step count for the same day both survive.
 *
 * An existing entry keeps its queue position and its original queuedAt (it is still
 * the same pending change, so it stays fair against the size cap), but its attempt
 * count resets — this is new data that deserves a fresh run.
 */
export function coalesce(queue: OutboxEntry[], entry: OutboxEntry, cap = MAX_ENTRIES): OutboxEntry[] {
  const at = queue.findIndex(e => e.key === entry.key);
  let next: OutboxEntry[];
  if (at >= 0) {
    const prev = queue[at];
    next = queue.slice();
    next[at] = {
      ...entry,
      payload: { ...prev.payload, ...entry.payload },
      queuedAt: prev.queuedAt,
      attempts: 0,
    };
  } else {
    next = [...queue, entry];
  }
  // Oldest out first: the newest changes are the ones the user still cares about.
  return next.length > cap ? next.slice(next.length - cap) : next;
}

// ── Persistence ────────────────────────────────────────────────────────────────

function read(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // corrupt or unavailable storage must not break the app
  }
}

function write(queue: OutboxEntry[]): void {
  try {
    if (queue.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch { /* quota or private mode — the write is lost, same as before this existed */ }
  try {
    window.dispatchEvent(new CustomEvent('superdub:outbox-changed'));
  } catch { /* no window (node check) */ }
}

/** How many writes are waiting. Drives the pending pill. */
export const outboxCount = (): number => read().length;

export function enqueue(kind: OutboxKind, day: string, payload: Record<string, unknown>, habitName?: string): void {
  write(coalesce(read(), {
    key: entryKey(kind, day, habitName),
    kind,
    day,
    habitName,
    payload,
    attempts: 0,
    queuedAt: Date.now(),
  }));
}

// ── Flushing ───────────────────────────────────────────────────────────────────

let sender: OutboxSender | null = null;
let isReady: () => boolean = () => true;
let flushing = false;

export function initOutbox(opts: { send: OutboxSender; isReady: () => boolean }): void {
  sender = opts.send;
  isReady = opts.isReady;
  try {
    window.addEventListener('online', () => { void flush(); });
  } catch { /* no window (node check) */ }
}

/**
 * Replay the queue, oldest first and one at a time — the server's UPDATE-then-INSERT
 * assumes sequential single-user writes (see server/routes/tracker.ts).
 *
 * A still-offline failure stops the run and leaves everything queued. A refusal (4xx)
 * or an entry past MAX_ATTEMPTS is dropped and the run continues, so one poisoned
 * write can never wedge the rest of the queue behind it.
 *
 * ponytail: an entry queued on 31 December and flushed on 1 January lands under the
 * wrong year — the server derives it from its own clock (`trackerYear()`), and the
 * tracker_habits unique index excludes `year` while the UPDATE filters on it, so the
 * insert can collide and 500 forever. MAX_ATTEMPTS contains that to the one entry.
 * The real fix is year-keyed day keys (ROADMAP E3.1).
 */
export async function flush(): Promise<void> {
  // No token means the session expired and the app has dropped to the sign-in
  // screen. The writes must survive that, so hold them rather than burn attempts.
  if (flushing || !sender || !isReady()) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  flushing = true;
  let sent = 0;
  try {
    // Bounded by the queue length at entry: re-reading each pass picks up writes
    // enqueued while we work, but a storage write that silently fails (quota,
    // private mode) must not leave the same entry at the head forever.
    for (let guard = read().length; guard > 0; guard--) {
      const entry = read()[0];
      if (!entry) break;
      try {
        await sender(entry);
        sent++;
        write(read().filter(e => e.key !== entry.key));
      } catch (err) {
        if (shouldQueue(err) && entry.attempts + 1 < MAX_ATTEMPTS) {
          // Still no route to the server. Count the try and stop; the rest of the
          // queue would fail the same way.
          write(read().map(e => (e.key === entry.key ? { ...e, attempts: e.attempts + 1 } : e)));
          break;
        }
        // Refused, or out of attempts: drop this one and keep going.
        write(read().filter(e => e.key !== entry.key));
      }
    }
    // Landed writes change XP, so tell the XP provider — but only when something
    // actually went out, or every successful write would trigger a second fetch.
    // Deliberately NOT 'superdub:tracker-updated': five components listen to that
    // and it re-opens the daily check-in overlay, which would pop a full-screen
    // prompt out of a background sync.
    if (sent > 0) {
      try {
        window.dispatchEvent(new CustomEvent('superdub:outbox-flushed'));
      } catch { /* no window */ }
    }
  } finally {
    flushing = false;
  }
}
