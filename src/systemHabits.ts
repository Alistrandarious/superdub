// System habits are auto-managed, XP-earning tracker rows that never appear in the
// user's own habit list/UI. "Logging into Superdub" (the daily check-in) was the
// first; the daily-log rewards below extend the same pattern so logging weight,
// steps, morning vitals, and the evening reflection — plus completing the full set —
// each earns XP through the derived XP model (XPContext sums every habit's done-days).
export const LOGIN_HABIT = 'Logging into Superdub';
export const WEIGHED_IN = 'Weighed in';
export const LOGGED_STEPS = 'Logged steps';
export const MORNING_VITALS = 'Morning vitals';
export const EVENING_REFLECTION = 'Evening reflection';
export const FULL_DAILY_LOG = 'Full daily log';

// The individual daily-log habits whose completion together makes a "full set".
export const DAILY_LOG_HABITS = [
  LOGIN_HABIT, WEIGHED_IN, LOGGED_STEPS, MORNING_VITALS, EVENING_REFLECTION,
] as const;

export const SYSTEM_HABITS: ReadonlySet<string> = new Set<string>([
  ...DAILY_LOG_HABITS,
  FULL_DAILY_LOG,
]);

// True for any auto-managed habit that must be hidden from the user's habit UI
// (lists, chart, heatmaps, cog filter, coach) while still counting toward XP.
export const isSystemHabit = (name: string): boolean => SYSTEM_HABITS.has(name);
