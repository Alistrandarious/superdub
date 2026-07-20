// Self-check for the clear-out threshold (run: npx tsx server/emailJobs.check.ts)
import assert from 'assert';
import { shouldNudgeClearout } from './emailJobs';

// ── Below the floor: never nudge a tidy-up of one or two ────────────────────────
assert.strictEqual(shouldNudgeClearout(1, 10), false, '1 archived → never');
assert.strictEqual(shouldNudgeClearout(2, 0), false, '2 archived, none left → still below floor');

// ── Absolute batch: 5+ always fires regardless of what remains ──────────────────
assert.strictEqual(shouldNudgeClearout(5, 20), true, '5 archived → hard count');
assert.strictEqual(shouldNudgeClearout(9, 100), true, 'big batch off a huge list → fires');

// ── Proportional: 3–4 fires only when it is ≥ half of what they had ─────────────
assert.strictEqual(shouldNudgeClearout(3, 3), true, '3 of 6 = 50% → fires');
assert.strictEqual(shouldNudgeClearout(3, 2), true, '3 of 5 = 60% → fires');
assert.strictEqual(shouldNudgeClearout(3, 4), false, '3 of 7 ≈ 43% → below half, no fire');
assert.strictEqual(shouldNudgeClearout(4, 4), true, '4 of 8 = 50% → fires');
assert.strictEqual(shouldNudgeClearout(4, 5), false, '4 of 9 ≈ 44% → no fire');

// ── Boundary: cleared everything ────────────────────────────────────────────────
assert.strictEqual(shouldNudgeClearout(3, 0), true, 'cleared all 3 → fires');
assert.strictEqual(shouldNudgeClearout(0, 0), false, 'nothing archived → no fire');

console.log('emailJobs.check.ts — all assertions passed');
