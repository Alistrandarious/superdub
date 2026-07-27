// Self-check for the lapse state machine. Run: npx tsx src/lapse.check.ts
import assert from 'assert';
import { computeLapseState, isSoftened, lapseHeadline, lapseStartKey, shouldShowComeback, LapseSignals } from './lapse';

const base: LapseSignals = {
  daysSinceLog: 0, hadPriorActivity: true, weekMarks: 10, weekDue: 14, daysSinceReturn: null,
};
const s = (o: Partial<LapseSignals>) => computeLapseState({ ...base, ...o });

// ── never-logged accounts are never lapsed ───────────────────────────────────
assert(s({ hadPriorActivity: false, daysSinceLog: Infinity }) === 'active', 'fresh signup is not lapsed');
assert(s({ hadPriorActivity: false, weekMarks: 0, weekDue: 7 }) === 'active', 'fresh signup is not drifting');

// ── the 3-day cliff ──────────────────────────────────────────────────────────
assert(s({ daysSinceLog: 1 }) === 'active', '1 quiet day is fine');
assert(s({ daysSinceLog: 2 }) === 'drifting', '2 quiet days is a drift');
assert(s({ daysSinceLog: 3 }) === 'lapsed', '3 quiet days is a lapse');
assert(s({ daysSinceLog: 40 }) === 'lapsed', 'long gone is still lapsed');

// ── the blank week catches someone the day-counter misses ────────────────────
assert(s({ daysSinceLog: 0, weekMarks: 1, weekDue: 14 }) === 'drifting', 'logging in but not marking is a drift');
assert(s({ daysSinceLog: 0, weekMarks: 0, weekDue: 3 }) === 'active', 'too little due yet to judge the week');
assert(s({ daysSinceLog: 0, weekMarks: 5, weekDue: 14 }) === 'active', 'a third of the week marked is fine');

// ── returning outranks drifting, and expires ─────────────────────────────────
assert(s({ daysSinceLog: 0, daysSinceReturn: 0, weekMarks: 0, weekDue: 14 }) === 'returning', 'day 0 back is returning');
assert(s({ daysSinceLog: 0, daysSinceReturn: 2, weekMarks: 0, weekDue: 14 }) === 'returning', 'day 2 back is still returning');
assert(s({ daysSinceLog: 0, daysSinceReturn: 3, weekMarks: 0, weekDue: 14 }) === 'drifting', 'day 3 back drops the kid gloves');
// A lapse in progress beats a stale return marker.
assert(s({ daysSinceLog: 5, daysSinceReturn: 1 }) === 'lapsed', 'lapsing again outranks returning');

// ── softening + copy ─────────────────────────────────────────────────────────
assert(!isSoftened('active') && isSoftened('drifting') && isSoftened('lapsed'), 'only active is unsoftened');
assert(lapseHeadline('active', 0) === null, 'active says nothing');
assert(lapseHeadline('lapsed', 4)!.includes('4'), 'a short lapse names the days');
assert(!lapseHeadline('lapsed', 30)!.includes('30'), 'a long lapse does not count days at you');

// ── the return screen opens once per lapse, not once ever ────────────────────
const TODAY = '2026-07-27';
// 21 quiet days means the lapse began on the 6th.
assert(lapseStartKey(21, TODAY) === '2026-07-06', 'the lapse is keyed by the day it began');

assert(shouldShowComeback('lapsed', 21, null, TODAY), 'never shown, so show it');
assert(!shouldShowComeback('lapsed', 21, '2026-07-06', TODAY), 'already shown for THIS lapse, stay quiet');
// Tomorrow, still lapsed: same lapse, same key, still quiet. This is the assert
// that stops the screen reopening on every refresh.
assert(!shouldShowComeback('lapsed', 22, '2026-07-06', '2026-07-28'), 'one more quiet day is the same lapse');
assert(shouldShowComeback('lapsed', 4, '2026-04-01', TODAY), 'a older lapse re-arms it');

assert(!shouldShowComeback('drifting', 2, null, TODAY), 'drifting gets the strip, not a takeover');
assert(!shouldShowComeback('returning', 1, null, TODAY), 'they are already back');
assert(!shouldShowComeback('active', 0, null, TODAY), 'nothing to come back from');
assert(!shouldShowComeback('lapsed', Infinity, null, TODAY), 'never logged is not a lapse');

console.log('lapse.check.ts OK');
