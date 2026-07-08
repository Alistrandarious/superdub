// =====================================================================
// SUPERDUB — the "logging day" (a.k.a. Superdub time)
// The app keeps recording against the previous calendar day until 2 AM, so a
// late night still logs to "yesterday". The user can jump forward early by
// tapping "move to today", which sets an override for the real calendar day.
// After 2 AM the grace window lapses on its own.
//
// IMPORTANT: only ever call these with the *real current moment* (the default).
// They must not be used to transform arbitrary/iterated dates — the 2 AM offset
// keys off wall-clock hours, and an iteration date at 00:00 would wrongly shift.
// =====================================================================

const RESET_HOUR = 2;                          // grace window: 00:00–01:59 local
const ADVANCED_KEY = 'superdub.day.advanced';  // ISO date the user jumped ahead on

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function manuallyAdvanced(now: Date): boolean {
  try { return localStorage.getItem(ADVANCED_KEY) === isoOf(now); } catch { return false; }
}

/** True while we're in the pre-2 AM grace window and the user hasn't jumped ahead. */
export function inGracePeriod(now: Date = new Date()): boolean {
  return now.getHours() < RESET_HOUR && !manuallyAdvanced(now);
}

/** The effective "now" for date math: real now, shifted back a day during grace.
 *  Wall-clock time (hours/minutes) is preserved — only the calendar date moves,
 *  so time-locked prompts still see the true hour. */
export function loggingNow(now: Date = new Date()): Date {
  const d = new Date(now);
  if (inGracePeriod(now)) d.setDate(d.getDate() - 1);
  return d;
}

/** Current logging day as a 'DD/MM' tracker key. */
export function getLoggingDay(now: Date = new Date()): string {
  const d = loggingNow(now);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** Current logging day as 'YYYY-MM-DD'. */
export function getLoggingISO(now: Date = new Date()): string {
  return isoOf(loggingNow(now));
}
// ponytail: cross-year edge — a 00:30 log on Jan 1 correctly rolls the DD/MM back
// to 31/12, but callers that stitch a separate `YEAR = getFullYear()` onto the key
// will pair it with the new year. Rare (one night/year); upgrade path is having
// those callers derive the year from loggingNow() too.

/** Jump the logging day forward to the real calendar day (the "move to today" tap). */
export function advanceToToday(now: Date = new Date()): void {
  try { localStorage.setItem(ADVANCED_KEY, isoOf(now)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('superdub:day-advanced'));
}
