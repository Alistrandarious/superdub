// Runnable self-check for the signup → plan bootstrap. Run: npx tsx src/planBootstrap.check.ts
import assert from 'assert';
import { weeksToGoal, planTargetDate } from './planBootstrap';

// A cut: 10 kg at 0.5 kg/week is 20 weeks.
assert(weeksToGoal(90, 80, 0.5) === 20, '10kg at 0.5/wk is 20 weeks');
// A bulk reads the same distance in the other direction.
assert(weeksToGoal(70, 75, 0.25) === 20, '5kg at 0.25/wk is 20 weeks');
// Partial weeks round up, never down — the date must not land short of the goal.
assert(weeksToGoal(90, 87, 0.5) === 6, '3kg at 0.5/wk rounds up to 6 weeks');
assert(weeksToGoal(90, 89.9, 0.5) === 1, 'a sliver still takes a whole week');

// No journey to plan.
assert(weeksToGoal(90, 90, 0.5) === null, 'already at goal is not a plan');
assert(weeksToGoal(90, 0, 0.5) === null, 'no goal weight is not a plan');
assert(weeksToGoal(0, 80, 0.5) === null, 'no current weight is not a plan');
assert(weeksToGoal(90, 80, 0) === null, 'no rate is not a plan');

// The date is the week count out from today, and always in the future — the
// server rejects a target date that is not.
const today = new Date('2026-09-02T10:00:00Z');
assert(planTargetDate(90, 80, 0.5, today) === '2027-01-20', '20 weeks out from 2 Sep 2026');
assert(planTargetDate(90, 89.9, 0.5, today) === '2026-09-09', 'minimum one week out');
assert(planTargetDate(90, 90, 0.5, today) === null, 'maintain gets no target date');

// Month and year boundaries survive the day arithmetic.
assert(planTargetDate(90, 89.5, 0.5, new Date('2026-12-28T10:00:00Z')) === '2027-01-04', 'crosses into the new year');

console.log('✓ planBootstrap checks passed');
