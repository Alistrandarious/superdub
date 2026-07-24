// ─────────────────────────────────────────────────────────────────────────────
// Re-plan — is the plan you're on still a true statement about your life?
//
// A plan goes stale quietly. You stop weighing in, you come back heavier, and
// the engine keeps solving for the old date: the pace it needs climbs every
// cycle until it's asking for something no body does and no calorie target can
// buy. Nothing breaks, so nothing tells you. This is the thing that tells you.
//
// The destination doesn't move. The date does. Falling off is a state, not a
// failure (see the lapse protocol) — the honest response to a gap is a later
// date, not a harder plan or a wiped journey.
//
// Pure: no DB, no clock beyond the `now` you pass in. Checked in replan.check.ts.
// ─────────────────────────────────────────────────────────────────────────────

const DAY = 86400000;
const KCAL_PER_KG = 7700;

/** Rate ceiling as a fraction of body weight per week. Sits below the 1.5%
 *  velocity that trips Metabolic Protection in the plan engine — a plan should
 *  never *prescribe* a pace the engine would flag as too fast. */
const MAX_RATE_PCT_BW = 0.01;

export interface ReplanInput {
  goalType: 'lose' | 'gain' | 'maintain';
  targetWeight: number;
  targetDate: Date;
  currentWeight: number;   // latest EMA, not a raw morning reading
  tdee: number;
  bmr: number;
  /** Quiet days before the most recent weigh-in. Explains the card, never gates it. */
  gapDays: number;
  now?: Date;
}

export interface ReplanProposal {
  /** Why the old plan stopped being true. */
  cause: 'unreachable' | 'date-passed';
  kgToGo: number;
  /** kg/week the old plan now demands — the number that got quietly absurd. */
  requiredRate: number;
  /** The fastest we're willing to ask for, given body size and the BMR floor. */
  safeRate: number;
  weeksNeeded: number;
  newTargetDate: string;   // YYYY-MM-DD
  gapDays: number;
  /** One plain sentence for the card. */
  headline: string;
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * The fastest weekly change we'd prescribe: capped both by body size and by the
 * BMR floor, because a rate you can only hit by eating below your resting need
 * isn't a rate, it's a promise the engine will refuse to keep.
 */
export function safeWeeklyRate(currentWeight: number, tdee: number, bmr: number): number {
  const byBody = currentWeight * MAX_RATE_PCT_BW;
  const byFloor = Math.max(0, tdee - bmr) * 7 / KCAL_PER_KG;
  return Math.max(0.05, Math.min(byBody, byFloor));
}

export function proposeReplan(input: ReplanInput): ReplanProposal | null {
  const { goalType, targetWeight, targetDate, currentWeight, tdee, bmr, gapDays } = input;
  const now = input.now ?? new Date();
  if (goalType === 'maintain') return null;

  const kgToGo = +(currentWeight - targetWeight).toFixed(2);
  // Already there (or past it) — that's the goal-reached path, not this one.
  if (goalType === 'lose' && kgToGo <= 0) return null;
  if (goalType === 'gain' && kgToGo >= 0) return null;

  const safeRate = +safeWeeklyRate(currentWeight, tdee, bmr).toFixed(2);
  const weeksLeft = (targetDate.getTime() - now.getTime()) / (7 * DAY);
  const datePassed = weeksLeft <= 0;
  const requiredRate = datePassed ? Infinity : +(Math.abs(kgToGo) / weeksLeft).toFixed(2);

  // Still doable at a rate we'd actually ask for — leave the plan alone.
  if (!datePassed && requiredRate <= safeRate) return null;

  const weeksNeeded = Math.ceil(Math.abs(kgToGo) / safeRate);
  const newDate = new Date(now.getTime() + weeksNeeded * 7 * DAY);
  const verb = goalType === 'lose' ? 'lose' : 'gain';
  const kg = Math.abs(kgToGo).toFixed(1);

  const headline = datePassed
    ? `Your target date has been and gone with ${kg} kg still to ${verb}. Same goal, new date.`
    : `Hitting your date now means ${requiredRate.toFixed(2)} kg a week, and that isn't a pace worth asking for. Same goal, ${weeksNeeded} weeks.`;

  return {
    cause: datePassed ? 'date-passed' : 'unreachable',
    kgToGo: +Math.abs(kgToGo).toFixed(1),
    requiredRate: datePassed ? 0 : requiredRate,
    safeRate,
    weeksNeeded,
    newTargetDate: ymd(newDate),
    gapDays,
    headline,
  };
}
