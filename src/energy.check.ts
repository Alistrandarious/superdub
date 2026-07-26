// Self-check for the intake estimator's clamps (run: npx tsx src/energy.check.ts)
import assert from 'assert';
import { estimateIntakeKcal, estimateIntakeRange, workoutCalories } from './energy';

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

// ── workoutCalories = MET × kg × hours ──────────────────────────────────────────
assert.strictEqual(workoutCalories('moderate', 60, 80), 440);   // 5.5 × 80 × 1
assert.strictEqual(workoutCalories('intense', 30, 90), 360);    // 8.0 × 90 × 0.5
assert.strictEqual(workoutCalories(null, 60, 80), 0);           // no session
assert.strictEqual(workoutCalories('moderate', 0, 80), 0);      // zero duration

// ── Intake RANGE: a big overnight drop widens the band, never floors to ~600 ─────
// maintenance 2600, steps −150, gym +300, ΔW −0.4 kg, adherence −1, target 2200.
const big = estimateIntakeRange({ maintenance: 2600, stepBurn: -150, gymBurn: 300, weightDeltaKg: -0.4, adherenceLevel: -1, targetCalories: 2200 })!;
assert.strictEqual(big.central, 1838);
assert.strictEqual(big.low, 1560);      // floored at 0.6 × maintenance, not the old 600
assert.strictEqual(big.high, 2488);
assert.strictEqual(big.wide, true);

// ── A steady day reads tighter and not "wide" ───────────────────────────────────
const steady = estimateIntakeRange({ maintenance: 2600, stepBurn: -150, gymBurn: 300, weightDeltaKg: -0.1, adherenceLevel: -1, targetCalories: 2200 })!;
assert.strictEqual(steady.wide, false);
assert.ok((steady.high - steady.low) < (big.high - big.low), 'steady band is tighter than the big-swing band');

// ── No weigh-in AND no self-report ⇒ no honest estimate ─────────────────────────
assert.strictEqual(
  estimateIntakeRange({ maintenance: 2600, stepBurn: 0, gymBurn: 0, weightDeltaKg: null, adherenceLevel: null, targetCalories: 2200 }),
  null,
);

// ── Self-report only (no weigh-in) centres on target + offset ───────────────────
const srOnly = estimateIntakeRange({ maintenance: 2600, stepBurn: 0, gymBurn: 0, weightDeltaKg: null, adherenceLevel: 0, targetCalories: 2200 })!;
assert.strictEqual(srOnly.central, 2200);

// ── Chart mode: the Intake trend now calls estimateIntakeRange with a real weight
// slope and adherenceLevel: null (no per-day self-report). It MUST still return a
// band — if this went null the chart would blank days that used to show a value —
// and the band must bracket its own centre so the shaded area straddles the line.
const chart = estimateIntakeRange({ maintenance: 2500, stepBurn: 100, gymBurn: 0, weightDeltaKg: -0.07, adherenceLevel: null, targetCalories: 2000 });
assert.ok(chart !== null, 'chart mode (energy balance only) still yields a band');
assert.ok(chart!.low < chart!.central && chart!.central < chart!.high, 'band brackets its own centre');
// A flat day (no trend yet, e.g. the first charted day) rides on maintenance + steps,
// still a real band — the chart passes weightDeltaKg: 0 rather than null here.
const chartFlat = estimateIntakeRange({ maintenance: 2500, stepBurn: 100, gymBurn: 0, weightDeltaKg: 0, adherenceLevel: null, targetCalories: 2000 })!;
assert.strictEqual(chartFlat.central, 2600, 'flat day centres on expenditure (maintenance + step burn)');

console.log('energy.check.ts — all assertions passed');
