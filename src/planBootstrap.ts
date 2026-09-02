// Turning the onboarding goal answers into a real Adaptive Weight Plan.
//
// Onboarding always collected a goal weight and a rate, wrote them to
// weight_settings, and stopped there. The plan engine never read that table:
// POST /plan/goal wants a target DATE and at least one logged weigh-in, and the
// morning weigh-in prompt stays off until a plan is active (promptPrefs.ts). So
// the answers sat inert until the user found cog → Log Weight and re-entered
// everything on /plan. This closes that loop at signup.

/** How many weeks the chosen rate needs to cover the distance. */
export function weeksToGoal(currentKg: number, goalKg: number, perWeekKg: number): number | null {
  if (!(currentKg > 0) || !(goalKg > 0) || !(perWeekKg > 0)) return null;
  const delta = Math.abs(goalKg - currentKg);
  if (delta === 0) return null; // already there — nothing to plan
  // At least a week: POST /plan/goal rejects a target date that isn't in the future.
  return Math.max(1, Math.ceil(delta / perWeekKg));
}

/**
 * The target date to open the plan with, as YYYY-MM-DD, or null when the answers
 * don't describe a journey (maintain, no goal weight, already at goal).
 */
export function planTargetDate(
  currentKg: number,
  goalKg: number,
  perWeekKg: number,
  today: Date = new Date(),
): string | null {
  const weeks = weeksToGoal(currentKg, goalKg, perWeekKg);
  if (weeks === null) return null;
  const target = new Date(today.getTime());
  target.setDate(target.getDate() + weeks * 7);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
}
