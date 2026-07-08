// Self-check for the intake estimator's clamps (run: npx tsx src/energy.check.ts)
import assert from 'assert';
import { estimateIntakeKcal } from './energy';

const MAINT = 2500; // typical maintenance (BMR × activity)

// ── Sane baseline: no weight trend, no step deviation ⇒ ≈ maintenance ───────────
assert.strictEqual(
  estimateIntakeKcal({ maintenance: MAINT, stepDev: 0, emaNow: 88, emaThen: 88, spanDays: 7 }),
  MAINT,
  'flat weight + no step dev → maintenance',
);

// ── The bug: an 11 kg jump read over a 1-day span must NOT return ~22k ──────────
// Unclamped this was maintenance + 11/1 × 7700 ≈ 87,200; now the slope clamps to
// ±0.3 kg/day, so the trend adds at most 0.3 × 7700 = 2,310.
const spike = estimateIntakeKcal({ maintenance: MAINT, stepDev: 0, emaNow: 99, emaThen: 88, spanDays: 1 })!;
assert.ok(spike <= MAINT * 2.5, `span-1 outlier clamped (got ${spike})`);
assert.ok(spike <= MAINT + 0.3 * 7700 + 1, `trend term capped to ±0.3 kg/day (got ${spike})`);

// ── A garbage step count can't blow it up either (ceiling catches stepDev) ──────
const megaSteps = estimateIntakeKcal({ maintenance: MAINT, stepDev: 21000, emaNow: 88, emaThen: 88, spanDays: 7 })!;
assert.ok(megaSteps <= MAINT * 2.5, `garbage stepDev capped at 2.5× maintenance (got ${megaSteps})`);

// ── Legit modest loss trend still flows through (−0.1 kg/day ⇒ lower intake) ────
const losing = estimateIntakeKcal({ maintenance: MAINT, stepDev: 0, emaNow: 87.3, emaThen: 88, spanDays: 7 })!;
assert.ok(losing < MAINT && losing > 600, `real loss trend lowers intake (got ${losing})`);

// ── Implausibly low ⇒ null, not a tiny number ──────────────────────────────────
assert.strictEqual(
  estimateIntakeKcal({ maintenance: 500, stepDev: 0, emaNow: 88, emaThen: 88, spanDays: 7 }),
  null,
  'below floor → no estimate',
);

console.log('energy.check.ts — all assertions passed');
