// When to show the "Add a habit" affordance on the Habits page. Kept pure (no React)
// so it stays runnable-checkable — see habitAdd.check.ts.

// Give a freshly added habit some breathing room before nudging the user to add
// another. Uses real `new Date()` (not the tracker's hardcoded-year day keys) because
// this is calendar recency, not a logging-day lookup.
export const RECENT_ADD_DAYS = 3; // ponytail: whole-day window; startDate is date-granularity

// Whole days between a habit's YYYY-MM-DD start date and now. Missing date → Infinity
// (treated as "not recent"), so a habit with no known start never suppresses the button.
export const daysSince = (iso: string | null | undefined): number =>
  iso ? Math.floor((Date.now() - new Date(iso + 'T00:00:00').getTime()) / 86_400_000) : Infinity;
