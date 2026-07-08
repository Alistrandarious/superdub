// =====================================================================
// SUPERDUB — shared energy constants
// One source of truth for the step/walking math, so every page computes
// the same burn for the same person. Referenced by "The Maths" page.
// =====================================================================

/** 1 kg of body weight ≈ 7,700 kcal of stored energy. */
export const KCAL_PER_KG = 7700;

/** Average walking stride, metres. */
export const STRIDE_M = 0.75;

/** Walking costs ≈ 0.5 kcal per kg of body weight per km. */
export const KCAL_PER_KG_KM = 0.5;

/** kcal burned per step at a given body weight (≈0.033 at 88 kg). */
export function kcalPerStep(weightKg: number): number {
  const kg = weightKg > 0 ? weightKg : 75;
  return (STRIDE_M / 1000) * KCAL_PER_KG_KM * kg;
}

/** Steps → distance in km. */
export function stepsToKm(steps: number): number {
  return steps * STRIDE_M / 1000;
}

/**
 * Estimated daily intake, back-calculated from energy balance:
 *   intake ≈ maintenance (BMR×activity) + step-deviation burn + weight-trend energy.
 * The weight-trend term is `slope(kg/day) × 7700`. Both the slope and the final
 * figure are clamped so a single bad weigh-in, a short lookback span (slope ÷ 1),
 * or a garbage step count can't inflate the estimate to tens of thousands of kcal.
 * Returns null when the inputs are too thin to estimate (below a plausible floor).
 */
export function estimateIntakeKcal(opts: {
  maintenance: number;            // dayBmr × activity level
  stepDev: number;                // (steps − avg) × kcalPerStep, may be negative
  emaNow: number | null;          // smoothed weight at the day
  emaThen: number | null;         // smoothed weight `spanDays` earlier
  spanDays: number;               // days between the two EMA reads
}): number | null {
  const { maintenance, stepDev, emaNow, emaThen, spanDays } = opts;
  // ponytail: ±0.3 kg/day is a crude physiological ceiling (~2 kg/week). One clamp
  // here kills both the divide-by-small-span blowup and the outlier-weigh-in blowup.
  // Upgrade path: winsorize outlier weigh-ins at the EMA instead of clamping the slope.
  const MAX_SLOPE_KG_PER_DAY = 0.3;
  let slope = (spanDays > 0 && emaNow != null && emaThen != null)
    ? (emaNow - emaThen) / spanDays
    : 0;
  slope = Math.max(-MAX_SLOPE_KG_PER_DAY, Math.min(MAX_SLOPE_KG_PER_DAY, slope));
  const raw = maintenance + stepDev + slope * KCAL_PER_KG;
  // Belt-and-suspenders ceiling: never report more than 2.5× maintenance (guards a
  // garbage step count feeding stepDev). Floor: implausibly low ⇒ "no estimate".
  const intake = Math.round(Math.min(raw, maintenance * 2.5));
  return intake > 600 ? intake : null;
}
