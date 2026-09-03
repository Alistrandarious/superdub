// Self-check for the offline write outbox (run: npx tsx src/outbox.check.ts).
// The queue exists so a habit tick made offline is kept and replayed; these are the
// properties that have to hold for that replay to be correct rather than merely
// eventual.
import assert from 'assert';

const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};
// The module dispatches change events; give it somewhere to send them.
const listeners: Record<string, (() => void)[]> = {};
(globalThis as any).window = {
  addEventListener: (t: string, fn: () => void) => { (listeners[t] ??= []).push(fn); },
  dispatchEvent: (e: { type: string }) => { (listeners[e.type] ?? []).forEach(fn => fn()); return true; },
};
(globalThis as any).CustomEvent = class { type: string; constructor(t: string) { this.type = t; } };
// node's own `navigator` has no onLine, which the flush guard reads as "proceed".

import {
  coalesce, entryKey, shouldQueue, enqueue, outboxCount, flush, initOutbox,
  MAX_ATTEMPTS, MAX_ENTRIES, type OutboxEntry,
} from './outbox';

const mk = (kind: 'habit' | 'day' | 'steps', day: string, payload: Record<string, unknown>, habitName?: string): OutboxEntry => ({
  key: entryKey(kind, day, habitName), kind, day, habitName, payload, attempts: 0, queuedAt: Date.now(),
});
const reset = () => { delete store['superdub.outbox']; };

// ── What to keep, and what to give up on ──────────────────────────────────────
// Never reached the server, or the server fell over: the write is still good.
assert(shouldQueue({ kind: 'offline' }), 'offline is queued');
assert(shouldQueue({ kind: 'timeout' }), 'timeout is queued');
assert(shouldQueue({ kind: 'server', status: 500 }), 'a 500 is queued');
assert(shouldQueue({ kind: 'server', status: 503 }), 'a 503 is queued');
// The server gave a verdict. Replaying it just gets the same answer.
assert(!shouldQueue({ kind: 'server', status: 400 }), 'a 400 is NOT queued');
assert(!shouldQueue({ kind: 'server', status: 404 }), 'a 404 is NOT queued');
assert(!shouldQueue({ kind: 'auth', status: 401 }), 'a 401 is NOT queued');
assert(!shouldQueue(new Error('boom')), 'a plain Error is NOT queued');
assert(!shouldQueue(null), 'null is NOT queued');
// This is the trap: ApiError.retryable is `kind !== 'auth'`, so it says true here.
assert(!shouldQueue({ kind: 'server', status: 400 }), 'retryable is not the predicate');

// ── Coalescing: one entry per cell, newest state wins ─────────────────────────
{
  let q: OutboxEntry[] = [];
  q = coalesce(q, mk('habit', '02/09', { state: 'done' }, 'Walking'));
  q = coalesce(q, mk('habit', '02/09', { state: 'failed' }, 'Walking'));
  q = coalesce(q, mk('habit', '02/09', { state: null }, 'Walking'));
  assert(q.length === 1, 'cycling one habit offline collapses to a single write');
  assert(q[0].payload.state === null, 'the last state the user chose is the one that replays');

  // A different habit, and the same habit on another day, are separate cells.
  q = coalesce(q, mk('habit', '02/09', { state: 'done' }, 'Reading'));
  q = coalesce(q, mk('habit', '03/09', { state: 'done' }, 'Walking'));
  assert(q.length === 3, 'each habit-day is its own entry');
}

// ── Coalescing: day writes merge fields, they do not replace ──────────────────
{
  let q: OutboxEntry[] = [];
  q = coalesce(q, mk('day', '02/09', { weight: '82.4' }));
  q = coalesce(q, mk('day', '02/09', { steps: '9021' }));
  assert(q.length === 1, 'one entry per tracker day');
  assert(q[0].payload.weight === '82.4', 'an earlier weigh-in survives a later step write');
  assert(q[0].payload.steps === '9021', 'and the step count is there too');
  // Same field twice: the newer value wins.
  q = coalesce(q, mk('day', '02/09', { weight: '82.1' }));
  assert(q[0].payload.weight === '82.1', 'a corrected weight replaces the old one');
}

// ── Step entries coalesce per source ──────────────────────────────────────────
// A typed step count is not regenerable, so it is queued. The native health sync
// is not — it re-reads from the device on every launch.
{
  let q: OutboxEntry[] = [];
  q = coalesce(q, mk('steps', '02/09', { steps: 8000, source: 'manual' }, 'manual'));
  q = coalesce(q, mk('steps', '02/09', { steps: 9021, source: 'manual' }, 'manual'));
  assert(q.length === 1, 'correcting a typed step count stays one write');
  assert(q[0].payload.steps === 9021, 'and the number that replays is the last one typed');

  // A device row for the same day is a different entry — the server keeps both
  // sources and picks a winner.
  q = coalesce(q, mk('steps', '02/09', { steps: 8800, source: 'healthkit' }, 'healthkit'));
  assert(q.length === 2, 'each source is its own entry');
  // And a habit tick on the same day never collides with either.
  q = coalesce(q, mk('habit', '02/09', { state: 'done' }, 'Walking'));
  assert(q.length === 3, 'kinds do not share keys');
}

// ── Coalescing keeps position, resets attempts, keeps the original queue time ──
{
  const first = { ...mk('habit', '01/09', { state: 'done' }, 'A'), attempts: 3, queuedAt: 1000 };
  let q: OutboxEntry[] = [first, mk('habit', '01/09', { state: 'done' }, 'B')];
  q = coalesce(q, mk('habit', '01/09', { state: 'failed' }, 'A'));
  assert(q[0].habitName === 'A', 'an updated entry keeps its place in the queue');
  assert(q[0].attempts === 0, 'new data earns a fresh set of attempts');
  assert(q[0].queuedAt === 1000, 'but it is still the same pending change, for the size cap');
}

// ── The size cap drops the oldest, not the newest ─────────────────────────────
{
  let q: OutboxEntry[] = [];
  for (let i = 0; i < MAX_ENTRIES + 10; i++) q = coalesce(q, mk('habit', '01/09', { state: 'done' }, `H${i}`));
  assert(q.length === MAX_ENTRIES, 'the queue is bounded');
  assert(q[q.length - 1].habitName === `H${MAX_ENTRIES + 9}`, 'the newest write is kept');
  assert(!q.some(e => e.habitName === 'H0'), 'the oldest write is the one dropped');
}

// ── Flush: everything lands, in order, and the queue empties ──────────────────
void (async () => {
  reset();
  const sentOrder: string[] = [];
  initOutbox({ send: async e => { sentOrder.push(e.key); }, isReady: () => true });

  enqueue('habit', '02/09', { state: 'done' }, 'Walking');
  enqueue('day', '02/09', { weight: '82.4' });
  assert(outboxCount() === 2, 'two writes waiting');

  await flush();
  assert(outboxCount() === 0, 'a good flush empties the queue');
  assert.deepStrictEqual(sentOrder, ['habit:02/09:Walking', 'day:02/09'], 'oldest first');

  // ── Still offline: the write is kept, and one attempt is spent ──────────────
  reset();
  let attemptCount = 0;
  initOutbox({ send: async () => { attemptCount++; throw { kind: 'offline' }; }, isReady: () => true });
  enqueue('habit', '02/09', { state: 'done' }, 'Walking');
  await flush();
  assert(outboxCount() === 1, 'an offline failure keeps the write');
  assert(attemptCount === 1, 'and stops after the first entry rather than hammering');

  // Retried until the cap, then given up on — never retried forever.
  for (let i = 0; i < MAX_ATTEMPTS; i++) await flush();
  assert(outboxCount() === 0, 'a write that never lands is eventually dropped, not retried forever');

  // ── A refusal is dropped immediately and does not block the rest ────────────
  reset();
  const seen: string[] = [];
  initOutbox({
    send: async e => {
      seen.push(e.key);
      if (e.habitName === 'Poison') throw { kind: 'server', status: 400 };
    },
    isReady: () => true,
  });
  enqueue('habit', '02/09', { state: 'done' }, 'Poison');
  enqueue('habit', '02/09', { state: 'done' }, 'Walking');
  await flush();
  assert(outboxCount() === 0, 'a 400 does not wedge the queue behind it');
  assert(seen.includes('habit:02/09:Walking'), 'the good write still went out');

  // ── No session: hold everything, spend nothing ──────────────────────────────
  reset();
  let sendsWhileLoggedOut = 0;
  initOutbox({ send: async () => { sendsWhileLoggedOut++; }, isReady: () => false });
  enqueue('habit', '02/09', { state: 'done' }, 'Walking');
  await flush();
  assert(sendsWhileLoggedOut === 0, 'an expired session does not replay against a dead token');
  assert(outboxCount() === 1, 'and the write survives to be sent after signing back in');

  console.log('✓ outbox checks passed');
})();
