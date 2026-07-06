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
