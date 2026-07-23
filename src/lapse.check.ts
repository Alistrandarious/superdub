// Self-check for the lapse state machine. Run: npx tsx src/lapse.check.ts
import assert from 'assert';
import { computeLapseState, isSoftened, lapseHeadline, LapseSignals } from './lapse';

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

console.log('lapse.check.ts OK');
