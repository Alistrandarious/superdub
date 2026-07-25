// Runnable self-check for entitlement resolution + the free habit cap.
// Run: npx tsx server/entitlement.check.ts
//
// This is the money logic: get it wrong one way and paying users lose features
// they bought, wrong the other way and the cap doesn't exist. It's also the one
// piece the client can never be trusted with, so it earns a check.
import assert from 'assert';
import {
  resolveEntitlement, habitListAllowed, habitLimitFor, trialEndsAt, countableHabits,
  EARLY_ADOPTER_BEFORE, TRIAL_DAYS, FREE_HABIT_LIMIT,
} from './entitlement';

const day = 86_400_000;
const at = (iso: string) => new Date(iso);
const launch = Date.parse(EARLY_ADOPTER_BEFORE);
const afterLaunch = (offsetDays: number) => new Date(launch + offsetDays * day);

// ── §1 Early adopters keep Pro free, forever ────────────────────────────────
const early = { createdAt: at('2026-07-01T12:00:00Z') };
assert.strictEqual(resolveEntitlement(early, afterLaunch(0)), 'pro', 'early adopter is Pro at launch');
assert.strictEqual(resolveEntitlement(early, afterLaunch(3650)), 'pro', 'early adopter is still Pro ten years on');

// The gift has a hard edge: joining after the cutoff is a normal account.
const joinedAtLaunch = { createdAt: afterLaunch(0) };
assert.strictEqual(resolveEntitlement(joinedAtLaunch, afterLaunch(0)), 'trial', 'a launch-day signup is on trial, not grandfathered');

// ── §2 The 25-day no-card trial, derived from created_at ────────────────────
assert.strictEqual(
  trialEndsAt(afterLaunch(0)).getTime(), launch + TRIAL_DAYS * day,
  'the trial runs TRIAL_DAYS from signup',
);
assert.strictEqual(resolveEntitlement(joinedAtLaunch, afterLaunch(TRIAL_DAYS - 0.5)), 'trial', 'still on trial on the last day');
assert.strictEqual(resolveEntitlement(joinedAtLaunch, afterLaunch(TRIAL_DAYS)), 'free', 'the trial ends, it does not silently continue');
assert.strictEqual(resolveEntitlement(joinedAtLaunch, afterLaunch(TRIAL_DAYS + 400)), 'free', 'and it stays ended');

// ── §6 Cancelling never revokes access mid-cycle ────────────────────────────
const subscriber = { createdAt: afterLaunch(1), plan: 'pro', proUntil: afterLaunch(60) };
assert.strictEqual(resolveEntitlement(subscriber, afterLaunch(59)), 'pro', 'paid-through date not reached: still Pro');
assert.strictEqual(resolveEntitlement(subscriber, afterLaunch(61)), 'free', 'past the paid-through date: back to Free');
assert.strictEqual(
  resolveEntitlement({ createdAt: afterLaunch(1), plan: 'pro', proUntil: null }, afterLaunch(9999)),
  'pro',
  'a Pro plan with no end date is forever (the grandfather grant)',
);
// A stale 'pro' flag with an expired date must not out-rank a live trial.
assert.strictEqual(
  resolveEntitlement({ createdAt: afterLaunch(1), plan: 'pro', proUntil: afterLaunch(2) }, afterLaunch(5)),
  'trial',
  'an expired subscription falls back to whatever else is live',
);

// ── §3 The free habit cap ───────────────────────────────────────────────────
assert.strictEqual(habitLimitFor('free'), FREE_HABIT_LIMIT, 'Free has a ceiling');
assert.strictEqual(habitLimitFor('trial'), null, 'the trial is full Pro, so no ceiling');
assert.strictEqual(habitLimitFor('pro'), null, 'Pro has no ceiling');

const five = ['Walk', 'Read', 'Water', 'Stretch', 'Sleep'];
const six = [...five, 'Journal'];
assert(habitListAllowed(five, five, 'free'), 'exactly five is allowed');
assert(!habitListAllowed(six, five, 'free'), 'the sixth habit is refused');
assert(habitListAllowed(six, five, 'trial'), 'the trial can pass the cap');
assert(habitListAllowed(six, five, 'pro'), 'Pro can pass the cap');

// The auto-managed check-in row lives in the same table and must not eat a slot.
assert.strictEqual(countableHabits(['Logging into Superdub', ...five]), 5, 'system habits do not count');
assert(
  habitListAllowed(['Logging into Superdub', ...five], ['Logging into Superdub', ...five], 'free'),
  'five real habits plus the system row is still five',
);

// A lapsed subscriber keeps everything they built — they just cannot grow it.
const eleven = Array.from({ length: 11 }, (_, i) => `Habit ${i}`);
assert(habitListAllowed(eleven, eleven, 'free'), 'an over-cap list can be re-saved (reorder, rename cadence)');
assert(habitListAllowed([...eleven].reverse(), eleven, 'free'), 'and reordered');
assert(!habitListAllowed([...eleven, 'One more'], eleven, 'free'), 'but not grown');
assert(habitListAllowed(eleven.slice(0, 10), eleven, 'free'), 'archiving one is always allowed');
assert(habitListAllowed([], eleven, 'free'), 'and archiving all of them is too — we never hold data hostage');

console.log('entitlement.check.ts — all assertions passed');
