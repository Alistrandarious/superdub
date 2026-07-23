// =====================================================================
// SUPERDUB — the day streak
// Opening the app is not an achievement. The streak counts days you actually
// did the work: a day continues the run when at least 75% of the habits that
// were DUE that day are done. Anything less and it goes back to zero — no
// grace day, because a grace day is just a 6/7 rule wearing a disguise.
//
// Replaces the old rule, which counted consecutive days the 'Logging into
// Superdub' habit was ticked. That measured attendance, not effort.
//
// Pure math — see dayStreak.check.ts.
// =====================================================================

/** Share of the day's due habits that must be done for the day to count. */
export const STREAK_THRESHOLD = 0.75;

export interface DayStreakInput {
  /** Ordered 'DD/MM' keys for the year, oldest first (Habits' ALL_DAYS). */
  allDays: string[];
  /** today's 'DD/MM'. Must appear in allDays. */
  today: string;
  /** The habits that count: daily cadence, not archived, excluding the login habit. */
  habits: string[];
  /** day -> habit -> state ('done' | 'failed' | 'na' | undefined). */
  states: Record<string, Record<string, string | null | undefined>>;
  /** habit -> the 'DD/MM' it started; days before it don't count it as due. */
  startDay?: Record<string, string | undefined>;
}

export type DayVerdict = 'kept' | 'broken' | 'neutral';

/**
 * How one day scored. `neutral` means nothing was due (no habits yet, or every
 * due habit was marked 'na') — those days are skipped rather than counted, so a
 * deliberate rest day doesn't punish anyone and a brand-new account isn't
 * born with a broken streak.
 */
export function judgeDay(input: DayStreakInput, day: string): { verdict: DayVerdict; done: number; due: number } {
  const { habits, states, startDay = {}, allDays } = input;
  const dayIdx = allDays.indexOf(day);
  const row = states[day] ?? {};
  let done = 0, due = 0;

  for (const h of habits) {
    const start = startDay[h];
    if (start) {
      const startIdx = allDays.indexOf(start);
      if (startIdx >= 0 && dayIdx < startIdx) continue;   // habit didn't exist yet
    }
    const state = row[h];
    if (state === 'na') continue;                          // neutral skip, out of the denominator
    due++;
    if (state === 'done') done++;
  }

  if (due === 0) return { verdict: 'neutral', done, due };
  return { verdict: done / due >= STREAK_THRESHOLD ? 'kept' : 'broken', done, due };
}

/**
 * Consecutive kept days ending today. Today is only counted once it already
 * qualifies — a half-finished day must not read as a break at 9am, so the walk
 * starts at yesterday until today is earned.
 */
export function computeDayStreak(input: DayStreakInput): number {
  const { allDays, today } = input;
  const todayIdx = allDays.indexOf(today);
  if (todayIdx < 0) return 0;

  let streak = 0;
  let idx = judgeDay(input, today).verdict === 'kept' ? todayIdx : todayIdx - 1;
  while (idx >= 0) {
    const { verdict } = judgeDay(input, allDays[idx]);
    if (verdict === 'broken') break;
    if (verdict === 'kept') streak++;
    idx--;   // 'neutral' days are stepped over without counting
  }
  return streak;
}

/** Today's progress toward keeping the streak, for the hero at the top of Habits.
 *  `needed` is how many more habits would tip today over the line. */
export function todayProgress(input: DayStreakInput): { done: number; due: number; needed: number; kept: boolean } {
  const { done, due, verdict } = judgeDay(input, input.today);
  const target = Math.ceil(due * STREAK_THRESHOLD);
  return { done, due, needed: Math.max(0, target - done), kept: verdict === 'kept' };
}
