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

/** Plausible real tissue change per day, kg. Overnight scale moves beyond this
 *  are water/waste, not fat. Shared by the intake band and Dub's chat answers. */
export const FAT_CAP_KG_PER_DAY = 0.12;

/** kcal burned per step at a given body weight (≈0.033 at 88 kg). */
export function kcalPerStep(weightKg: number): number {
  const kg = weightKg > 0 ? weightKg : 75;
  return (STRIDE_M / 1000) * KCAL_PER_KG_KM * kg;
}

/** Steps → distance in km. */
export function stepsToKm(steps: number): number {
  return steps * STRIDE_M / 1000;
}

/** MET per workout intensity — kcal ≈ MET × kg × hours. Mirrors the server's
 *  WORKOUT_MET (server/routes/checkin.ts). ponytail: duplicated because server/ and
 *  src/ are separate builds and don't share modules; keep the two tables in sync. */
export const WORKOUT_MET: Record<string, number> = {
  light: 3.5,
  moderate: 5.5,
  intense: 8.0,
  very_intense: 10.0,
};

/** Calories burned by a logged gym session (0 when not enough info). */
export function workoutCalories(intensity: string | null | undefined, durationMin: number | null | undefined, weightKg: number): number {
  if (!intensity || !durationMin || durationMin <= 0) return 0;
  const met = WORKOUT_MET[intensity] ?? 5.5;
  const kg = weightKg > 0 ? weightKg : 75;
  return Math.round(met * kg * (durationMin / 60));
}

/** What each rung of the evening "eating vs target" answer (−2..+2) claims in kcal,
 *  relative to the day's target. Shared by the intake band and intakeTruth.ts, so
 *  the self-report is read the same way everywhere. */
export const ADHERENCE_OFFSET: Record<number, number> = { [-2]: -700, [-1]: -350, 0: 0, 1: 350, 2: 700 };

/**
 * Honest daily-intake RANGE. One day's true intake can't be recovered from one day's
 * weigh-in (day-to-day scale weight is mostly water/waste), so instead of a false-precise
 * number we return a band built from what we DO know:
 *   - expenditure  E = maintenance + step-deviation burn + gym burn
 *   - the next-day weight change ΔW (only the plausible-fat part shifts the estimate;
 *     the rest is water and only widens the band)
 *   - the evening "eating vs target" self-report (adherenceLevel −2..+2)
 * Width grows with the overnight swing and with disagreement between the two estimates,
 * so a steady day reads tight and a big jump reads honestly wide. Returns null only when
 * there's no usable signal at all.
 * ponytail: FAT_CAP and the width constants are crude but bounded; tune against real data.
 */
export function estimateIntakeRange(opts: {
  maintenance: number;                 // TDEE = BMR × activity
  stepBurn: number;                    // (steps − avg) × kcalPerStep, may be negative
  gymBurn: number;                     // workoutCalories(...), ≥ 0
  weightDeltaKg: number | null;        // next-day − day weight; null if either weigh-in missing
  adherenceLevel: number | null;       // −2..+2 self-report vs target; null if not logged
  targetCalories: number;
}): { low: number; central: number; high: number; wide: boolean } | null {
  const { maintenance, stepBurn, gymBurn, weightDeltaKg, adherenceLevel, targetCalories } = opts;
  if (!(maintenance > 0)) return null;

  const FAT_CAP = FAT_CAP_KG_PER_DAY;   // kg/day of plausible real tissue change
  const E = maintenance + stepBurn + gymBurn;

  // Energy-balance estimate: only the bounded (real-fat) part of ΔW shifts intake; the
  // overnight swing beyond FAT_CAP is water and instead feeds the band width below.
  let ebIntake: number | null = null;
  let waterK = 0;
  if (weightDeltaKg != null) {
    const realKg = Math.max(-FAT_CAP, Math.min(FAT_CAP, weightDeltaKg));
    ebIntake = E + realKg * KCAL_PER_KG;
    waterK = Math.max(0, Math.abs(weightDeltaKg) - FAT_CAP) * KCAL_PER_KG;
  }

  // Self-report estimate: target shifted by the −2..+2 "eating vs target" answer.
  const srIntake = adherenceLevel != null ? targetCalories + (ADHERENCE_OFFSET[adherenceLevel] ?? 0) : null;

  const signals = [ebIntake, srIntake].filter((v): v is number => v != null);
  if (signals.length === 0) return null;   // no weigh-in and no self-report → no honest estimate
  const central = signals.reduce((a, b) => a + b, 0) / signals.length;
  const disagree = (ebIntake != null && srIntake != null) ? Math.abs(ebIntake - srIntake) / 2 : 0;

  const half = Math.max(150, Math.min(650, 220 + 0.25 * waterK + 0.5 * disagree));
  const low = Math.max(Math.round(central - half), Math.round(0.6 * maintenance));
  const high = Math.round(central + half);
  return { low, central: Math.round(central), high, wide: half >= 500 };
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
