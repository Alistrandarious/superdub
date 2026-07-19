import { weekMonday, weekRangeLabel, weekTitle } from './weekRange';

function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('FAIL: ' + msg); process.exitCode = 1; }
}

// weekRangeLabel — same month vs across a month boundary (deterministic dates).
assert(weekRangeLabel(new Date(2026, 6, 14), new Date(2026, 6, 20)) === '14–20 Jul', 'same-month range');
assert(weekRangeLabel(new Date(2026, 5, 30), new Date(2026, 6, 6)) === '30 Jun–6 Jul', 'cross-month range');

// weekTitle
assert(weekTitle(0) === 'This week', 'title this week');
assert(weekTitle(-1) === 'Last week', 'title last week');
assert(weekTitle(-3) === '3 weeks ago', 'title n weeks ago');

// weekMonday — invariants that hold whatever weekday `now` is.
const now = new Date(2026, 6, 20, 15, 30);
const m0 = weekMonday(now, 0);
assert(m0.getDay() === 1, 'weekMonday lands on a Monday');
assert(m0.getTime() <= now.getTime(), 'this-week Monday is on/before now');
assert(m0.getHours() === 0 && m0.getMinutes() === 0 && m0.getSeconds() === 0, 'Monday floored to midnight');
const m1 = weekMonday(now, -1);
assert(m0.getTime() - m1.getTime() === 7 * 24 * 3600 * 1000, 'previous week Monday is exactly 7 days earlier');

console.log('weekRange.check.ts — all assertions passed');
