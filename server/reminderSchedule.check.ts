// Self-check for the reminder gate (run: npx tsx server/reminderSchedule.check.ts)
import assert from 'assert';
import { reminderDue, scheduleMatchesToday } from './reminderSchedule';

const TODAY = '2026-07-06';
const YESTERDAY = '2026-07-05';

// ── Fires: switched on, right hour, not yet sent today ──────────────────────────
assert.strictEqual(reminderDue(8, 8, null, TODAY), true, 'never fired → due');
assert.strictEqual(reminderDue(20, 20, YESTERDAY, TODAY), true, 'last fired yesterday → due again');
// DB may hand back a Date rather than an ISO string — must normalise, not throw.
assert.strictEqual(reminderDue(20, 20, new Date('2026-07-05T00:00:00Z'), TODAY), true, 'Date lastFired accepted');

// ── Suppressed: wrong hour ──────────────────────────────────────────────────────
assert.strictEqual(reminderDue(8, 7, null, TODAY), false, 'hour before target → not yet');
assert.strictEqual(reminderDue(8, 9, null, TODAY), false, 'hour after target → missed this tick');

// ── Suppressed: already fired today (idempotent within the day) ─────────────────
assert.strictEqual(reminderDue(8, 8, TODAY, TODAY), false, 'already fired today → skip');
// Guards against a clock/tz skew that would leave lastFired ahead of localDate.
assert.strictEqual(reminderDue(8, 8, '2026-07-07', TODAY), false, 'lastFired ahead of today → skip');

// ── Suppressed: switched off (workout prompt defaults to NULL/off) ──────────────
assert.strictEqual(reminderDue(null, 8, null, TODAY), false, 'null target → off');
assert.strictEqual(reminderDue(undefined, 8, null, TODAY), false, 'undefined target → off');

// ── scheduleMatchesToday: non-daily habits only nudge on their scheduled day ─────
// 2026-07-07 is a Tuesday (UTC). Mon=0 so Tuesday = dow 1.
const TUE = new Date('2026-07-07T12:00:00Z');
assert.strictEqual(scheduleMatchesToday('weekly', '1', TUE), true, 'weekly Tue matches a Tuesday');
assert.strictEqual(scheduleMatchesToday('weekly', '2', TUE), false, 'weekly Wed does not match a Tuesday');
assert.strictEqual(scheduleMatchesToday('monthly', '7', TUE), true, 'monthly day 7 matches the 7th');
assert.strictEqual(scheduleMatchesToday('monthly', '8', TUE), false, 'monthly day 8 does not match the 7th');
assert.strictEqual(scheduleMatchesToday('yearly', '7-7', TUE), true, 'yearly 7 Jul matches');
assert.strictEqual(scheduleMatchesToday('yearly', '6-7', TUE), false, 'yearly 7 Jun does not match July');
// Clamp: day 31 in a 28-day February fires on the 28th.
const FEB28 = new Date('2026-02-28T12:00:00Z');
assert.strictEqual(scheduleMatchesToday('monthly', '31', FEB28), true, 'monthly 31 clamps to last day of Feb');
// No schedule / daily → always matches.
assert.strictEqual(scheduleMatchesToday('daily', null, TUE), true, 'no schedule → every day');
assert.strictEqual(scheduleMatchesToday('weekly', '', TUE), true, 'empty schedule → every day');

console.log('reminderSchedule.check.ts — all assertions passed');
