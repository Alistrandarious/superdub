// ─────────────────────────────────────────────────────────────────────────────
// Personal TDEE estimator — "revealed" maintenance from observed energy balance.
//
// The formula TDEE (BMR × activity multiplier) is a population guess. The real
// number can be ±300 kcal off for any individual. This module derives it from
// what actually happened to the user's weight:
//
//     intake − TDEE = Δstored_energy/day = (Δweight_kg/day) × 7700
//   ⇒ TDEE = intake − (weeklyWeightSlope / 7) × 7700
//
// If the user logs food, `intake` is their real average. If not, we fall back to
// their *prescribed* calories (assume adherence) at reduced confidence. The
// estimate is blended with the formula TDEE, leaning on observed data as the
// window of weigh-ins grows and as logged-intake coverage improves. This is an
// online, self-correcting estimate — exactly how MacroFactor-style apps work.
// ─────────────────────────────────────────────────────────────────────────────

const KCAL_PER_KG = 7700;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export interface TDEEEstimate {
  observedTDEE: number | null; // pure energy-balance estimate (null if no slope)
  blendedTDEE: number;         // observed blended with the formula prior
  formulaTDEE: number;         // BMR × activity (the prior)
  confidence: number;          // 0–1, how much we trust the observed estimate
  intakeUsed: number;          // the kcal/day intake figure used
  intakeIsLogged: boolean;     // true if from real food logs, false if assumed
}

export function estimatePersonalTDEE(params: {
  emaSlopePerWeek: number | null; // kg/week (negative = losing)
  avgDailyIntake: number | null;  // real logged kcal/day, or null
  prescribedCalories: number;     // fallback intake when nothing is logged
  formulaTDEE: number;            // BMR × activity
  dataDays: number;               // span of weigh-in history, in days
}): TDEEEstimate {
  const intakeIsLogged = params.avgDailyIntake != null && params.avgDailyIntake > 0;
  const intakeUsed = intakeIsLogged ? params.avgDailyIntake! : params.prescribedCalories;

  const observedTDEE = params.emaSlopePerWeek != null
    ? Math.round(intakeUsed - (params.emaSlopePerWeek / 7) * KCAL_PER_KG)
    : null;

  // Confidence: trust grows over ~4 weeks of data, and real logged intake is
  // trusted twice as much as an assumed-adherence intake.
  const dayWeight = clamp(params.dataDays / 28, 0, 1);
  const intakeWeight = intakeIsLogged ? 1 : 0.5;
  const confidence = +(dayWeight * intakeWeight).toFixed(2);

  // Sanity clamp: a personal estimate shouldn't run wild on noisy early data —
  // keep it within ±35% of the formula prior.
  const lo = params.formulaTDEE * 0.65;
  const hi = params.formulaTDEE * 1.35;
  const observedClamped = observedTDEE != null ? clamp(observedTDEE, lo, hi) : null;

  const blendedTDEE = observedClamped != null
    ? Math.round(confidence * observedClamped + (1 - confidence) * params.formulaTDEE)
    : params.formulaTDEE;

  return {
    observedTDEE: observedClamped != null ? Math.round(observedClamped) : null,
    blendedTDEE,
    formulaTDEE: params.formulaTDEE,
    confidence,
    intakeUsed: Math.round(intakeUsed),
    intakeIsLogged,
  };
}
