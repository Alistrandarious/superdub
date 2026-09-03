// Self-check for the 75%-of-habits day streak.
// Run: npx tsx src/dayStreak.check.ts
import assert from 'assert';
import { computeDayStreak, dayWasMarked, judgeDay, todayProgress, DayStreakInput } from './dayStreak';

const allDays = ['01/01', '02/01', '03/01', '04/01', '05/01'];
const habits = ['a', 'b', 'c', 'd'];
/** Shorthand: 'dddd' = all four done, 'ddd.' = three done one blank, etc. */
const row = (s: string) => Object.fromEntries(
  habits.map((h, i) => [h, { d: 'done', f: 'failed', n: 'na', '.': undefined }[s[i]]]),
);
const input = (days: Record<string, string>, today = '05/01'): DayStreakInput => ({
  allDays, today, habits,
  states: Object.fromEntries(Object.entries(days).map(([k, v]) => [k, row(v)])),
});

// ── the threshold itself ─────────────────────────────────────────────────────
assert(judgeDay(input({ '05/01': 'dddd' }), '05/01').verdict === 'kept', '4/4 keeps it');
assert(judgeDay(input({ '05/01': 'ddd.' }), '05/01').verdict === 'kept', '3/4 is exactly 75% and keeps it');
assert(judgeDay(input({ '05/01': 'dd..' }), '05/01').verdict === 'broken', '2/4 is under and breaks it');
assert(judgeDay(input({ '05/01': 'dddf' }), '05/01').verdict === 'kept', 'an explicit miss still leaves 3/4');

// 'na' leaves the denominator, so 2 done + 2 skipped is 2/2, not 2/4.
assert(judgeDay(input({ '05/01': 'ddnn' }), '05/01').verdict === 'kept', 'na is not counted against you');
assert(judgeDay(input({ '05/01': 'nnnn' }), '05/01').verdict === 'neutral', 'a fully skipped day is neutral');
assert(judgeDay(input({}), '05/01').verdict === 'broken', 'a blank day with habits due is broken');

// ── counting the run ─────────────────────────────────────────────────────────
assert(computeDayStreak(input({
  '02/01': 'dddd', '03/01': 'ddd.', '04/01': 'dddd', '05/01': 'dddd',
})) === 4, 'four kept days running');

// Today not yet earned must not read as a break — the walk starts at yesterday.
assert(computeDayStreak(input({
  '03/01': 'dddd', '04/01': 'dddd', '05/01': 'd...',
})) === 2, 'a half-finished today does not break the run');

// No grace: one bad day is back to zero, exactly as asked.
assert(computeDayStreak(input({
  '02/01': 'dddd', '03/01': 'd...', '04/01': 'dddd', '05/01': 'dddd',
})) === 2, 'a broken day ends the run, no grace');
assert(computeDayStreak(input({ '05/01': 'd...' })) === 0, 'a bad today is zero, not a carried streak');

// Neutral days are stepped over and join the run either side of them.
assert(computeDayStreak(input({
  '02/01': 'dddd', '03/01': 'nnnn', '04/01': 'dddd', '05/01': 'dddd',
})) === 3, 'a rest day bridges rather than breaks');

// ── a habit that did not exist yet is not held against the day ───────────────
const withStart: DayStreakInput = {
  ...input({ '04/01': 'dd..', '05/01': 'dd..' }),
  startDay: { c: '05/01', d: '05/01' },
};
assert(judgeDay(withStart, '04/01').due === 2, 'habits added later are not due earlier');
assert(judgeDay(withStart, '04/01').verdict === 'kept', '2/2 before the new habits existed');
assert(judgeDay(withStart, '05/01').verdict === 'broken', '2/4 once they exist');

// ── the hero read-out ────────────────────────────────────────────────────────
const p = todayProgress(input({ '05/01': 'd...' }));
assert(p.done === 1 && p.due === 4 && p.needed === 2 && !p.kept, '1 of 4 needs 2 more to reach 3');
assert(todayProgress(input({ '05/01': 'dddd' })).needed === 0, 'nothing needed once it is kept');

// A brand-new account with no habits is not born broken.
assert(computeDayStreak({ allDays, today: '05/01', habits: [], states: {} }) === 0, 'no habits, no streak, no break');

// ── absence is not failure ───────────────────────────────────────────────────
// The predicate every "unmarked counts as missed" fix turns on. Habits pre-seeds
// its map with null for every day/habit, so a day nobody touched is present-but-
// all-null, not undefined: testing the values is what makes the guard real.
assert(dayWasMarked(undefined) === false, 'a day with no row at all is untouched');
assert(dayWasMarked({}) === false, 'an empty row is untouched');
assert(dayWasMarked({ a: null, b: null }) === false, 'a pre-seeded all-null day is untouched');
// App's tracker seeds every habit false rather than null, so falsy is the test,
// not nullish. Getting this wrong makes every empty day look attended.
assert(dayWasMarked({ a: false, b: false }) === false, 'a pre-seeded all-false day is untouched');
assert(dayWasMarked({ a: false, b: true }) === true, 'one done habit means they were here');
assert(dayWasMarked({ a: null, b: 'na' }) === true, 'a deliberate skip still means they were here');
assert(dayWasMarked({ a: 'failed' }) === true, 'an explicit miss means they were here');

console.log('dayStreak.check.ts OK');

// ── milestones ───────────────────────────────────────────────────────────────
import { milestoneProgress, STREAK_MILESTONES } from './dayStreak';
assert.deepStrictEqual(milestoneProgress(0), { prev: 0, next: 3 }, 'nothing yet: first landmark is 3');
assert.deepStrictEqual(milestoneProgress(3), { prev: 3, next: 7 }, 'on a landmark it counts as passed');
assert.deepStrictEqual(milestoneProgress(10), { prev: 7, next: 14 }, 'between 7 and 14');
assert.deepStrictEqual(milestoneProgress(400), { prev: 365, next: null }, 'past the last there is no next');
assert(STREAK_MILESTONES.every((m, i) => i === 0 || m > STREAK_MILESTONES[i - 1]), 'milestones ascend');
console.log('dayStreak milestones ok');
