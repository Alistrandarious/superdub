// =====================================================================
// SUPERDUB — the lapse protocol
// One state machine for "has this person fallen off, and how far". Every
// falling-off surface hangs off this: the softened miss colour, the comeback
// push, the frozen streak, the no-guilt return screen.
//
// Deliberately separate from server/services/churnRisk.ts. Churn risk asks
// "how likely are they to leave" from check-in *quality* (energy, mood) and
// drives coaching tone. This asks "are they logging at all" from raw
// recency, and drives what the app does. Different question, different input.
//
// Pure math, no network — see lapse.check.ts.
// =====================================================================

export type LapseState =
  | 'active'      // logging normally
  | 'drifting'    // slipping: a couple of quiet days, or a blank week of habits
  | 'lapsed'      // gone: 3+ days with nothing logged
  | 'returning';  // first days back after a lapse — handle with care

export interface LapseSignals {
  /** Whole days since the most recent log of ANY kind (habit mark, weigh-in,
   *  check-in). Infinity when they have never logged. */
  daysSinceLog: number;
  /** Have they ever logged before the recent window? A brand-new account that
   *  hasn't logged yet is 'active', not 'lapsed' — you can't fall off a habit
   *  you never started. */
  hadPriorActivity: boolean;
  /** Habit marks made in the current week so far. */
  weekMarks: number;
  /** Habit-days that were due in the current week so far (0 = nothing due yet,
   *  e.g. a Monday morning) — guards against calling an empty week a drift. */
  weekDue: number;
  /** Whole days since the lapse ended (i.e. since the first log after a lapse),
   *  or null if they aren't coming back from one. */
  daysSinceReturn: number | null;
}

/** Days of silence before we call it a lapse. */
export const LAPSE_DAYS = 3;
/** How long the gentle re-entry treatment lasts after a lapse. */
export const RETURNING_DAYS = 3;
/** Below this share of the week's due habit-days, an otherwise-active week counts
 *  as drifting — they're opening the app but the habits are going unmarked. */
const DRIFT_WEEK_RATIO = 0.25;

export function computeLapseState({
  daysSinceLog,
  hadPriorActivity,
  weekMarks,
  weekDue,
  daysSinceReturn,
}: LapseSignals): LapseState {
  // Never logged anything → nothing to fall off. Onboarding's job, not ours.
  if (!hadPriorActivity) return 'active';

  if (daysSinceLog >= LAPSE_DAYS) return 'lapsed';

  // Fresh out of a lapse — soften everything for a few days.
  if (daysSinceReturn != null && daysSinceReturn < RETURNING_DAYS) return 'returning';

  // Still opening the app, but the week's habits are going unmarked. This is the
  // cheap save: catching someone here is worth more than any comeback push.
  if (weekDue >= 4 && weekMarks / weekDue < DRIFT_WEEK_RATIO) return 'drifting';

  // Two quiet days is the first tremor, not yet a lapse.
  if (daysSinceLog >= 2) return 'drifting';

  return 'active';
}

/** Should the app soften its judgement right now — mute misses, hide the streak
 *  cliff, skip the "you're behind" framing? True for everything but 'active'. */
export function isSoftened(state: LapseState): boolean {
  return state !== 'active';
}

/** A stable id for the lapse someone is currently in: the day it began, as
 *  YYYY-MM-DD. Lets the return screen show once per lapse instead of once ever,
 *  the same way the server rations the comeback push off last_lapse_push. */
export function lapseStartKey(daysSinceLog: number, todayISO: string): string {
  const t = new Date(`${todayISO}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - Math.floor(daysSinceLog));
  return t.toISOString().slice(0, 10);
}

/**
 * Should the full-screen return moment open? Only for a real lapse: 'drifting' is
 * served proportionately by the strip on Habits, and 'returning' means they have
 * already been here. `shownStamp` is the lapseStartKey last shown, if any, so a
 * refresh stays quiet while a genuinely new lapse re-arms it.
 */
export function shouldShowComeback(
  state: LapseState,
  daysSinceLog: number,
  shownStamp: string | null,
  todayISO: string,
): boolean {
  if (state !== 'lapsed' || !Number.isFinite(daysSinceLog)) return false;
  return shownStamp !== lapseStartKey(daysSinceLog, todayISO);
}

/** The one line the return screen leads with. Kept here so the tone is defined
 *  in one place rather than re-invented per surface. */
export function lapseHeadline(state: LapseState, daysSinceLog: number): string | null {
  switch (state) {
    case 'lapsed':
      return daysSinceLog >= 14
        ? 'Been a while. Nothing was lost.'
        : `${Math.floor(daysSinceLog)} quiet days. Still here.`;
    case 'returning':
      return 'Good to see you. Pick one thing for today.';
    case 'drifting':
      return 'This week has gone quiet. One mark restarts it.';
    default:
      return null;
  }
}
