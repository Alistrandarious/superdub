// The offline read model: the last good habits + tracker pair, kept on the device so
// the app is readable without a connection.
//
// The outbox (outbox.ts) stopped offline ticks being lost, but reads were still
// online-only: Habits.tsx does Promise.all([getHabits(), getTracker(2)]) and either
// rejection lands in the full-screen "Couldn't load your habits" branch. The service
// worker caches the app shell but never /api/, and does not run at all under
// Capacitor, so on iOS the app booted fine and then showed nothing.
//
// Two rules make this correct rather than merely present:
//
// 1. The pair is stored and served ATOMICALLY. Habits.tsx fails atomically on purpose
//    — its error branch exists because habits-without-tracker renders an empty week,
//    "indistinguishable from a wiped account". A half-restore would recreate exactly
//    that, so either both slices are served or neither is.
//
// 2. Server data is always overlaid with the writes still in the outbox, on FRESH
//    reads as well as cached ones. Without that, a tick that has not reached the
//    server yet is invisible the moment anything refetches, and the cell appears to
//    revert under the user.
import type { TrackerResponse, TrackerHabitRow, TrackerDayRow } from './api';
import { pendingWrites } from './outbox';

const CACHE_KEY = 'superdub.readCache';
const VERSION = 1;

/** Shape of one row from GET /habits. Structural, so api.ts needs no export. */
export interface HabitListRow {
  name: string;
  startDate: string | null;
  cadence?: string;
  quitStartedAt?: string | null;
  starred?: boolean;
  dueDate?: string | null;
  reminderHour?: number | null;
  schedule?: string | null;
  sharedWithFriends?: boolean;
}

interface CacheRecord {
  v: number;
  /** Calendar year the payload was fetched under. */
  year: number;
  /** How many years of habit rows the stored tracker covers. */
  span: number;
  tracker: TrackerResponse | null;
  habits: HabitListRow[] | null;
  savedAt: number;
}

const currentYear = () => new Date().getFullYear();

// ── Span arithmetic ────────────────────────────────────────────────────────────
//
// Verified against server/routes/tracker.ts GET: the carryByYear query has NO span
// filter, and `days` is current-year only. So `days`, `xpCarry`, `carryByYear` and
// `year` are all span-independent, and `habits` is the ONLY span-dependent field.
// A wider cache can therefore serve a narrower request exactly, by dropping rows.
//
// This matters more than it looks. computeXPFromRaw (XPContext) seeds from xpCarry,
// which counts prior years only, then adds every 'done' row. Serve a 2-year payload
// to a 1-year caller and last year is counted twice: every user's XP and level jump.

/** Rows belonging to the newest `span` calendar years. */
const withinSpan = (rows: TrackerHabitRow[], span: number, year: number): TrackerHabitRow[] =>
  rows.filter(r => (r.year ?? year) > year - span);

// ── Persistence ────────────────────────────────────────────────────────────────
//
// The two halves are written independently, because they are fetched by a
// Promise.all and either can resolve first. They are only ever SERVED together:
// readPair returns null unless both are present, so a half-filled cache can never
// render habits without a tracker — the empty-week state Habits.tsx's error branch
// calls "indistinguishable from a wiped account".

function readRecord(): CacheRecord | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as CacheRecord;
    if (!rec || rec.v !== VERSION) return null;
    // A payload cached on 31 December is keyed to a year that no longer matches the
    // day grid Habits.tsx builds, and `days` is now entirely last year's.
    if (rec.year !== currentYear()) return null;
    return rec;
  } catch {
    return null;
  }
}

function save(rec: CacheRecord): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rec));
  } catch {
    // Out of quota (or private mode). Drop the cache rather than leave a torn record
    // — and never touch the outbox to make room. The cache is a copy of data the
    // server already has; the queue is the only copy of what the user just did.
    try { localStorage.removeItem(CACHE_KEY); } catch { /* nothing more to try */ }
  }
}

const blank = (year: number): CacheRecord =>
  ({ v: VERSION, year, span: 0, tracker: null, habits: null, savedAt: Date.now() });

/**
 * Store the tracker half. Called with the RAW server response, never an overlaid one
 * — bake pending writes into the cache and they are counted twice once they flush.
 *
 * A narrower but fresher response merges into a wider stored one: current-year rows
 * and every span-independent field come from the fresh payload, older rows are kept.
 * So the cache holds the widest span ever seen AND the freshest data.
 */
export function writeTracker(span: number, tracker: TrackerResponse): void {
  const year = tracker.year ?? currentYear();
  const prev = readRecord();
  const base = prev && prev.year === year ? prev : blank(year);

  let merged = tracker;
  let keptSpan = span;
  if (base.tracker && base.span > span) {
    const older = base.tracker.habits.filter(r => (r.year ?? year) <= year - span);
    merged = { ...tracker, habits: [...tracker.habits, ...older] };
    keptSpan = base.span;
  }
  save({ ...base, year, span: keptSpan, tracker: merged, savedAt: Date.now() });
}

/** Store the habits half. */
export function writeHabits(habits: HabitListRow[]): void {
  const year = currentYear();
  const prev = readRecord();
  const base = prev && prev.year === year ? prev : blank(year);
  save({ ...base, year, habits, savedAt: Date.now() });
}

/** The stored pair, narrowed to `span`, or null when there is nothing usable. */
export function readPair(span: number): { tracker: TrackerResponse; habits: HabitListRow[]; savedAt: number } | null {
  const rec = readRecord();
  // Both halves or nothing — see the note above readRecord.
  if (!rec || !rec.tracker || !rec.habits) return null;
  if (rec.span < span) return null; // can't invent rows we never fetched
  return {
    tracker: { ...rec.tracker, habits: withinSpan(rec.tracker.habits, span, rec.year) },
    habits: rec.habits,
    savedAt: rec.savedAt,
  };
}

/** When the served data was last known good, for the sync pill. */
export const cacheSavedAt = (): number | null => readRecord()?.savedAt ?? null;

export function clearReadCache(): void {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* nothing to do */ }
}

// ── The outbox overlay ─────────────────────────────────────────────────────────

/**
 * Server truth plus the writes that have not been sent yet — what the user should
 * actually see. Pure, so readCache.check.ts can pin it.
 */
export function applyOutbox(
  tracker: TrackerResponse,
  pending = pendingWrites(),
  year = currentYear(),
): TrackerResponse {
  if (pending.length === 0) return tracker;

  const habits = tracker.habits.slice();
  const days = tracker.days.slice();
  const carryByYear: Record<string, Record<number, number>> = JSON.parse(
    JSON.stringify(tracker.carryByYear ?? {}),
  );

  for (const e of pending) {
    if (e.kind === 'habit') {
      const name = e.habitName;
      if (!name) continue;
      const state = (e.payload.state ?? null) as TrackerHabitRow['state'] | null;
      const at = habits.findIndex(r => r.day === e.day && r.habit_name === name && (r.year ?? year) === year);
      const was = at >= 0 ? habits[at].state : null;

      if (at >= 0) {
        // A cleared cell is a row with a null state, not a missing row — that is how
        // the server returns it, so removing the row here would diverge from a real
        // refetch.
        habits[at] = { ...habits[at], state: state as TrackerHabitRow['state'] };
      } else {
        habits.push({ day: e.day, year, habit_name: name, state: state as TrackerHabitRow['state'] });
      }

      // The yearly matrix's decade cells read carryByYear, so a pending tick has to
      // move it too or this year's cell lies until the flush.
      const delta = (state === 'done' ? 1 : 0) - (was === 'done' ? 1 : 0);
      if (delta !== 0) {
        const perYear = (carryByYear[name] ??= {});
        perYear[year] = Math.max(0, (perYear[year] ?? 0) + delta);
      }
      // xpCarry is deliberately untouched: it counts prior years only, and no pending
      // write can reach a prior year.
    } else {
      // Merge only the keys present — an absent field means "leave alone", matching
      // the server's `CASE WHEN $n IS NOT NULL`. Values are String()-coerced because
      // callers send mixed types and the server stores text.
      //
      // A queued step entry lands here too: the server mirrors the winning source
      // into tracker.steps (recomputeActive), and a step count typed just now is the
      // most recent entry, so it is the one that wins. `source` is routing, not a
      // tracker column, so it never reaches the row.
      const patch: Record<string, string> = {};
      for (const [k, v] of Object.entries(e.payload)) {
        if (v == null || k === 'source') continue;
        patch[k] = String(v);
      }
      const at = days.findIndex(r => r.day === e.day);
      if (at >= 0) {
        days[at] = { ...days[at], ...patch };
      } else {
        const blank: TrackerDayRow = { day: e.day, weight: '', calories: '', protein: '', carbs: '', fats: '', steps: '' };
        days.push({ ...blank, ...patch });
      }
    }
  }

  return { ...tracker, habits, days, carryByYear };
}
