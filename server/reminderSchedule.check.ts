// Self-check for the reminder gate (run: npx tsx server/reminderSchedule.check.ts)
import assert from 'assert';
import { reminderDue } from './reminderSchedule';

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

console.log('reminderSchedule.check.ts — all assertions passed');
