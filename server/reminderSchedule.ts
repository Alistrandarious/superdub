// Pure gating decision shared by all three daily reminder pushes (morning
// weigh-in, evening nutrition, opt-in post-workout). Kept side-effect-free so
// it's testable without a DB — see reminderSchedule.check.ts.
//
// A reminder is due when: it's switched on (targetHour is a real 0–23), the
// user's local clock is in that hour, and it hasn't already fired for the
// user's local date. `lastFired` is whatever the DB stored (Date | ISO string |
// null); we normalise to a YYYY-MM-DD string before comparing.
export function reminderDue(
  targetHour: number | null | undefined,
  currentHour: number,
  lastFired: string | Date | null | undefined,
  localDate: string,
): boolean {
  if (!Number.isInteger(targetHour)) return false;   // off / unset (e.g. workout NULL)
  if (currentHour !== targetHour) return false;       // not this hour
  if (lastFired) {
    const last = new Date(lastFired).toISOString().slice(0, 10);
    if (last >= localDate) return false;              // already fired today (or ahead)
  }
  return true;
}

/** Quiet days before the daily reminders stand down. Mirrors LAPSE_DAYS in
 *  src/lapse.ts; the server does not import from src/ anywhere (see lapseWindow.ts,
 *  which mirrors the same way). */
export const PUSH_QUIET_DAYS = 3;

/**
 * Should the ordinary daily reminders fire at all? Someone who has been gone three
 * weeks was getting a weigh-in, an evening, a workout and a per-habit nudge every
 * single day of it, which buries the one comeback push that was actually written
 * for them under dozens that were not.
 *
 * ponytail: gates on last_active_at (did they OPEN the app) rather than on logging
 * activity. Someone who opens daily without logging keeps their reminders, which is
 * right — those reminders are the ones they need. The comeback push is deliberately
 * exempt from this and keeps its own once-per-lapse rationing.
 */
export function pushesAllowed(lastActiveAt: string | Date | null | undefined, now: Date): boolean {
  if (!lastActiveAt) return true;                  // no signal, never throttle
  const last = new Date(lastActiveAt).getTime();
  if (!Number.isFinite(last)) return true;
  return (now.getTime() - last) / 86400000 < PUSH_QUIET_DAYS;
}

// Does the user's local "today" fall on a non-daily habit's scheduled day? A daily
// (or quit, or unscheduled) habit matches every day. `local` is the Date whose UTC
// fields already represent the user's local time (as built in the reminder loop).
// Schedule encoding mirrors src/habitSchedule.ts: weekly "<dow 0-6, Mon=0>",
// monthly "<dom 1-31>", yearly "<month 1-12>-<day 1-31>". Out-of-range days clamp to
// the last day of the month so e.g. "31" still fires in February.
export function scheduleMatchesToday(
  cadence: string | null | undefined,
  schedule: string | null | undefined,
  local: Date,
): boolean {
  if (!schedule) return true;
  const lastDom = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  if (cadence === 'weekly') {
    const dow = parseInt(schedule, 10);
    if (!(dow >= 0 && dow <= 6)) return true;
    return ((local.getUTCDay() + 6) % 7) === dow;
  }
  if (cadence === 'monthly') {
    const dom = parseInt(schedule, 10);
    if (!(dom >= 1 && dom <= 31)) return true;
    return local.getUTCDate() === Math.min(dom, lastDom);
  }
  if (cadence === 'yearly') {
    const [m, day] = schedule.split('-').map(n => parseInt(n, 10));
    if (!(m >= 1 && m <= 12 && day >= 1 && day <= 31)) return true;
    if (local.getUTCMonth() + 1 !== m) return false;
    const lastOfM = new Date(Date.UTC(local.getUTCFullYear(), m, 0)).getUTCDate();
    return local.getUTCDate() === Math.min(day, lastOfM);
  }
  return true; // daily / quit / unknown → every day
}
