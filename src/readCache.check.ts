// Self-check for the offline read model (run: npx tsx src/readCache.check.ts).
// The app renders from this cache when there is no connection, so these are the
// properties that keep what it shows equal to what a real refetch would return.
import assert from 'assert';

const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};
const listeners: Record<string, (() => void)[]> = {};
(globalThis as any).window = {
  addEventListener: (t: string, fn: () => void) => { (listeners[t] ??= []).push(fn); },
  dispatchEvent: () => true,
};
(globalThis as any).CustomEvent = class { type: string; constructor(t: string) { this.type = t; } };

import { writeTracker, writeHabits, readPair, applyOutbox, clearReadCache, type HabitListRow } from './readCache';
import type { TrackerResponse } from './api';
import type { OutboxEntry } from './outbox';

const YEAR = new Date().getFullYear();
const LAST = YEAR - 1;

const habitRow = (day: string, name: string, state: string | null, year = YEAR) =>
  ({ day, year, habit_name: name, state: state as any });
const dayRow = (day: string, over: Partial<Record<string, string>> = {}) =>
  ({ day, weight: '', calories: '', protein: '', carbs: '', fats: '', steps: '', ...over }) as any;

const habitList: HabitListRow[] = [{ name: 'Walking', startDate: '2025-01-01', cadence: 'daily' }];

// A two-year payload: one row this year, one last year, and the carry maps the
// server sends with it.
const twoYear = (): TrackerResponse => ({
  days: [dayRow('02/09', { weight: '82.4' })],
  habits: [habitRow('02/09', 'Walking', 'done'), habitRow('14/06', 'Walking', 'done', LAST)],
  xpCarry: { Walking: 40 },                       // prior years ONLY
  carryByYear: { Walking: { [LAST]: 40, [YEAR]: 1 } },
  year: YEAR,
});

const pending = (over: Partial<OutboxEntry>): OutboxEntry =>
  ({ key: 'k', kind: 'habit', day: '03/09', payload: {}, attempts: 0, queuedAt: 0, ...over } as OutboxEntry);

// ── Span narrowing is exact, which is what keeps XP honest ────────────────────
// computeXPFromRaw seeds from xpCarry (prior years only) then counts every 'done'
// row. Serving a 2-year payload to a 1-year caller would count last year twice and
// every user's level would jump.
{
  clearReadCache();
  writeTracker(2, twoYear());
  writeHabits(habitList);

  const wide = readPair(2)!;
  assert(wide.tracker.habits.length === 2, 'the 2-year read keeps both years');

  const narrow = readPair(1)!;
  assert(narrow.tracker.habits.length === 1, 'the 1-year read drops last year');
  assert(narrow.tracker.habits.every(r => r.year === YEAR), 'and keeps only this year');
  assert.deepStrictEqual(narrow.tracker.xpCarry, { Walking: 40 },
    'xpCarry is span-independent, so narrowing must not touch it');
  assert.deepStrictEqual(narrow.tracker.days, wide.tracker.days, 'days is span-independent');
  assert.deepStrictEqual(narrow.tracker.carryByYear, wide.tracker.carryByYear, 'carryByYear is span-independent');
  assert.deepStrictEqual(narrow.habits, habitList, 'the habit list is unaffected by span');
}

// ── A narrow cache cannot serve a wide request ────────────────────────────────
{
  clearReadCache();
  writeTracker(1, { ...twoYear(), habits: [habitRow('02/09', 'Walking', 'done')] });
  writeHabits(habitList);
  assert(readPair(1) !== null, 'the 1-year read hits');
  assert(readPair(2) === null, 'a 2-year read misses rather than inventing rows');
}

// ── A fresher narrow response keeps the wider history ─────────────────────────
{
  clearReadCache();
  writeTracker(2, twoYear());
  writeHabits(habitList);
  // A 1-year refetch arrives with an extra tick this year.
  writeTracker(1, {
    ...twoYear(),
    habits: [habitRow('02/09', 'Walking', 'done'), habitRow('03/09', 'Walking', 'done')],
  });

  const wide = readPair(2)!;
  assert(wide.tracker.habits.length === 3, 'last year survives a narrower refetch');
  assert(wide.tracker.habits.some(r => r.year === LAST), 'the old row is still there');
  assert(wide.tracker.habits.some(r => r.day === '03/09'), 'and the fresh row landed');
}

// ── Half a pair is never served ───────────────────────────────────────────────
// getHabits and getTracker resolve in either order, so the cache fills in two steps.
// Serving one half alone would render an empty week — the exact "wiped account" look
// Habits.tsx's error branch exists to avoid.
{
  clearReadCache();
  writeTracker(2, twoYear());
  assert(readPair(1) === null, 'a tracker with no habit list is not servable');

  clearReadCache();
  writeHabits(habitList);
  assert(readPair(1) === null, 'a habit list with no tracker is not servable');

  // Either arrival order completes the pair.
  writeTracker(2, twoYear());
  assert(readPair(1) !== null, 'habits first, then tracker, completes it');
  clearReadCache();
  writeTracker(2, twoYear());
  writeHabits(habitList);
  assert(readPair(1) !== null, 'tracker first, then habits, completes it too');
}

// ── Rollover and version guards ───────────────────────────────────────────────
{
  clearReadCache();
  writeTracker(2, twoYear());
  writeHabits(habitList);
  const rec = JSON.parse(store['superdub.readCache']);

  store['superdub.readCache'] = JSON.stringify({ ...rec, year: LAST });
  assert(readPair(1) === null, 'a payload from last year is a miss, not stale truth');

  store['superdub.readCache'] = JSON.stringify({ ...rec, v: 99 });
  assert(readPair(1) === null, 'an unknown schema version is a miss');

  store['superdub.readCache'] = 'not json';
  assert(readPair(1) === null, 'corrupt storage is a miss, not a crash');
}

// ── The overlay: a pending tick is what the user sees ─────────────────────────
{
  const base = twoYear();

  // A brand new cell.
  const added = applyOutbox(base, [pending({ day: '03/09', habitName: 'Walking', payload: { state: 'done' } })], YEAR);
  const row = added.habits.find(r => r.day === '03/09')!;
  assert(row && row.state === 'done', 'a queued tick appears in the read');
  assert(row.year === YEAR, 'and is tagged with the current year');
  assert(added.carryByYear!.Walking[YEAR] === 2, 'the yearly cell counts it');

  // An existing cell being cleared: a row with a null state, NOT a removed row —
  // that is how the server returns a cleared cell.
  const cleared = applyOutbox(base, [pending({ day: '02/09', habitName: 'Walking', payload: { state: null } })], YEAR);
  const kept = cleared.habits.find(r => r.day === '02/09' && r.year === YEAR);
  assert(kept !== undefined, 'clearing keeps the row');
  assert(kept!.state === null, 'with a null state');
  assert(cleared.carryByYear!.Walking[YEAR] === 0, 'and the yearly cell drops back');

  // Re-ticking something already done must not double-count.
  const again = applyOutbox(base, [pending({ day: '02/09', habitName: 'Walking', payload: { state: 'done' } })], YEAR);
  assert(again.carryByYear!.Walking[YEAR] === 1, 'a no-op tick does not inflate the count');
  assert.deepStrictEqual(again.xpCarry, { Walking: 40 }, 'xpCarry never moves — no pending write reaches a prior year');

  // The base object is not mutated.
  assert(base.habits.length === 2, 'the overlay does not mutate its input');
  assert(base.carryByYear!.Walking[YEAR] === 1, 'including the carry map');
}

// ── The overlay: day writes merge, coerced to the text the server stores ──────
{
  const base = twoYear();
  const merged = applyOutbox(base, [
    { key: 'day:02/09', kind: 'day', day: '02/09', payload: { steps: 9021 }, attempts: 0, queuedAt: 0 },
  ], YEAR);
  const d = merged.days.find(r => r.day === '02/09')!;
  assert(d.weight === '82.4', 'an untouched field is left alone');
  assert(d.steps === '9021', 'a numeric payload is stored as text, like the server does');

  // A day with no cached row is created with blanks, matching the server INSERT.
  const created = applyOutbox(base, [
    { key: 'day:05/09', kind: 'day', day: '05/09', payload: { weight: 80 }, attempts: 0, queuedAt: 0 },
  ], YEAR);
  const n = created.days.find(r => r.day === '05/09')!;
  assert(n.weight === '80' && n.calories === '' && n.steps === '', 'a new day row is blank except the write');
}

// An empty queue is the identity.
{
  const base = twoYear();
  assert(applyOutbox(base, [], YEAR) === base, 'no pending writes means no work');
}

console.log('✓ readCache checks passed');
