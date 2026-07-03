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
