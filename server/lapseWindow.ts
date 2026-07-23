// Pure date crunching behind GET /api/lapse. Given the days a user logged
// something, work out how long they've been quiet and whether they're fresh out
// of a gap. Side-effect free so it's testable without a DB — see
// lapseWindow.check.ts.
//
// The state machine itself lives in src/lapse.ts and runs on the CLIENT: this
// route hands back raw signals only, so there is exactly one copy of the
// thresholds (server/ and src/ are separate builds and can't share modules).

/** Days of silence before it counts as a lapse. Mirrors LAPSE_DAYS in src/lapse.ts.
 *  Only used here to find where a past gap ended, not to classify. */
const GAP_DAYS = 3;

export interface LapseWindow {
  daysSinceLog: number;        // Infinity when they have never logged
  hadPriorActivity: boolean;
  daysSinceReturn: number | null;
  /** Length of the most recent gap, in days — what a streak restore would cover. */
  lastGapDays: number;
}

const DAY = 86400000;
const toUTCDay = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY);

/**
 * @param logDates unique 'YYYY-MM-DD' strings, any order, any duplicates removed
 *                 by the caller's DISTINCT. Dates in the future are ignored.
 * @param todayISO the user's local 'YYYY-MM-DD'.
 */
export function deriveLapseWindow(logDates: string[], todayISO: string): LapseWindow {
  const today = toUTCDay(todayISO);
  const days = Array.from(new Set(logDates))
    .map(toUTCDay)
    .filter(d => Number.isFinite(d) && d <= today)
    .sort((a, b) => a - b);

  if (days.length === 0) {
    return { daysSinceLog: Infinity, hadPriorActivity: false, daysSinceReturn: null, lastGapDays: 0 };
  }

  const last = days[days.length - 1];
  const daysSinceLog = today - last;

  // Walk back for the most recent gap of GAP_DAYS or more. The log that ENDED it is
  // the return; if the gap is still open (it runs to today) there is no return yet.
  let daysSinceReturn: number | null = null;
  let lastGapDays = daysSinceLog >= GAP_DAYS ? daysSinceLog : 0;
  for (let i = days.length - 1; i > 0; i--) {
    const gap = days[i] - days[i - 1];
    if (gap >= GAP_DAYS) {
      // Only counts as a return if they aren't currently lapsed again.
      if (daysSinceLog < GAP_DAYS) {
        daysSinceReturn = today - days[i];
        lastGapDays = gap;
      }
      break;
    }
  }

  return { daysSinceLog, hadPriorActivity: true, daysSinceReturn, lastGapDays };
}

/** The 'DD/MM' keys for the days a restore would fill in: the quiet days between
 *  the last log and the return (both exclusive). Matches the tracker's day format. */
export function gapDayKeys(logDates: string[], todayISO: string): { day: string; year: number }[] {
  const days = Array.from(new Set(logDates)).map(toUTCDay).filter(Number.isFinite).sort((a, b) => a - b);
  const today = toUTCDay(todayISO);
  const out: { day: string; year: number }[] = [];
  if (days.length === 0) return out;

  // The gap to fill runs from the last log before the break up to today (or up to
  // the log that ended the break, whichever came first).
  let from = days[days.length - 1];
  let to = today;
  for (let i = days.length - 1; i > 0; i--) {
    if (days[i] - days[i - 1] >= GAP_DAYS) { from = days[i - 1]; to = days[i]; break; }
  }
  // ponytail: capped at 60 days so a dormant account can't ask us to write a year
  // of rows. Longer gaps simply aren't restorable, which is the right answer anyway.
  for (let d = from + 1; d < to && d - from <= 60; d++) {
    const dt = new Date(d * DAY);
    out.push({
      day: `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}`,
      year: dt.getUTCFullYear(),
    });
  }
  return out;
}
