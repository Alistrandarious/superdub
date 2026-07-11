// The persisted per-day habit status and the tap cycle between the four states.
// In its own module so it's unit-testable without importing the whole Habits screen.
//
// 'na' = the user marked the day "not applicable" (a deliberate skip): neutral, it
// never counts as a miss or breaks a streak. null = blank/unset.
export type HabitState = 'done' | 'failed' | 'na' | null;

export function cycleState(current: HabitState): HabitState {
  if (current === null || current === undefined) return 'done';
  if (current === 'done') return 'failed';
  if (current === 'failed') return 'na';
  return null; // na → blank
}
