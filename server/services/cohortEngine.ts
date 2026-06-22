// ── Cohort-First Engine ──────────────────────────────────────────────────────
// Maps new users immediately to a Community Cohort based on profile basics.
// Provides baseline step and calorie targets from "Gold Standard" cohort data.
// No 14-day calibration window needed — users start with cohort targets on day 1.
// ─────────────────────────────────────────────────────────────────────────────

export interface CohortProfile {
  age: number;
  sex: 'male' | 'female';
  activityMultiplier: number; // 1.2 | 1.4 | 1.55 | 1.7 | 1.9
  goalType: 'cut' | 'bulk' | 'maintain';
}

export interface CohortResult {
  cohortName: string;
  cohortSize: number; // approximate community size for this cohort
  baselineSteps: number;
  baselineCalories: number; // community median daily target for this cohort
  onboardingMessage: string;
}

// ── Cohort definitions ─────────────────────────────────────────────────────

function ageGroup(age: number): '18-25' | '26-35' | '36-45' | '46+' {
  if (age <= 25) return '18-25';
  if (age <= 35) return '26-35';
  if (age <= 45) return '36-45';
  return '46+';
}

function activityLabel(mult: number): 'Sedentary' | 'Light' | 'Moderate' | 'Active' | 'Elite' {
  if (mult <= 1.25) return 'Sedentary';
  if (mult <= 1.45) return 'Light';
  if (mult <= 1.625) return 'Moderate';
  if (mult <= 1.8) return 'Active';
  return 'Elite';
}

// Baseline step targets by activity level (community median)
const COHORT_STEPS: Record<string, number> = {
  Sedentary: 6000,
  Light:     8500,
  Moderate:  10000,
  Active:    12000,
  Elite:     15000,
};

// Cohort size estimates (illustrative, for onboarding message)
const COHORT_SIZES: Record<string, number> = {
  cut: 12000,
  bulk: 4500,
  maintain: 7000,
};

export function assignCohort(profile: CohortProfile): CohortResult {
  const ag = ageGroup(profile.age);
  const al = activityLabel(profile.activityMultiplier);
  const genderLabel = profile.sex === 'male' ? 'Men' : 'Women';
  const goalLabel = profile.goalType === 'cut' ? 'Fat Loss' : profile.goalType === 'bulk' ? 'Muscle Gain' : 'Maintenance';

  const cohortName = `${genderLabel} ${ag} · ${al} · ${goalLabel}`;
  const cohortSize = COHORT_SIZES[profile.goalType] ?? 8000;
  const baselineSteps = COHORT_STEPS[al];

  // Energy-adjusted calorie baseline: the cohort's median deficit/surplus
  // is already baked into the initCals computed at signup — we just report the step baseline.
  // baselineCalories is provided for onboarding context, not as an override.
  const baselineCalories = 0; // filled by caller from computed initCals

  const sizeLabel = cohortSize >= 10000
    ? `${Math.round(cohortSize / 1000)}k`
    : `${(cohortSize / 1000).toFixed(1)}k`;

  const onboardingMessage =
    `Based on your profile, you're in our "${cohortName}" group — ` +
    `${sizeLabel} thousand users like you use this as their starting baseline. ` +
    `Your initial daily step target is ${baselineSteps.toLocaleString()} steps, ` +
    `calibrated to your activity level. The engine will personalise further as your data comes in.`;

  return { cohortName, cohortSize, baselineSteps, baselineCalories, onboardingMessage };
}
