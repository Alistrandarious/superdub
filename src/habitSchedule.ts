// Optional scheduling anchor for a non-daily habit: the specific day it "runs on".
// Encoded as a small string, interpreted by the habit's cadence:
//   weekly  → "<dow>"        day of week, Mon=0 … Sun=6        e.g. "1" = Tuesday
//   monthly → "<dom>"        day of month, 1-31 (clamped)      e.g. "15"
//   yearly  → "<month>-<day>" month 1-12 and day 1-31          e.g. "6-21" = 21 Jun
// null/'' = unset → the habit keeps its old "any day in the period" behaviour.
//
// Pure + framework-free so both the Habits screen and the Progress feed can share it.
import type { Cadence } from './Habits';

export const WEEKDAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Mon=0 index for a JS Date (getDay is Sun=0).
const dowMon0 = (d: Date) => (d.getDay() + 6) % 7;
const daysInMonth = (year: number, monthIdx0: number) => new Date(year, monthIdx0 + 1, 0).getDate();

// Human label for the card, e.g. "Every Tuesday" / "Day 15" / "21 Jun". null if unset/invalid.
export function scheduleLabel(cadence: Cadence | undefined, schedule: string | null | undefined): string | null {
  if (!schedule) return null;
  if (cadence === 'weekly') {
    const dow = parseInt(schedule, 10);
    return dow >= 0 && dow <= 6 ? `Every ${WEEKDAYS_FULL[dow]}` : null;
  }
  if (cadence === 'monthly') {
    const dom = parseInt(schedule, 10);
    return dom >= 1 && dom <= 31 ? `Day ${dom}` : null;
  }
  if (cadence === 'yearly') {
    const [m, day] = schedule.split('-').map(n => parseInt(n, 10));
    return m >= 1 && m <= 12 && day >= 1 && day <= 31 ? `${day} ${MONTHS_SHORT[m - 1]}` : null;
  }
  return null;
}

// The date within the current period that the habit is scheduled for (may be past,
// today, or future within that period). null if no valid schedule for the cadence.
export function scheduledDateInPeriod(cadence: Cadence | undefined, schedule: string | null | undefined, ref: Date): Date | null {
  if (!schedule) return null;
  if (cadence === 'weekly') {
    const dow = parseInt(schedule, 10);
    if (!(dow >= 0 && dow <= 6)) return null;
    const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - dowMon0(ref));
    return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + dow);
  }
  if (cadence === 'monthly') {
    const dom = parseInt(schedule, 10);
    if (!(dom >= 1 && dom <= 31)) return null;
    return new Date(ref.getFullYear(), ref.getMonth(), Math.min(dom, daysInMonth(ref.getFullYear(), ref.getMonth())));
  }
  if (cadence === 'yearly') {
    const [m, day] = schedule.split('-').map(n => parseInt(n, 10));
    if (!(m >= 1 && m <= 12 && day >= 1 && day <= 31)) return null;
    return new Date(ref.getFullYear(), m - 1, Math.min(day, daysInMonth(ref.getFullYear(), m - 1)));
  }
  return null;
}

// DD/MM key (the tracker's day-key format) for a date.
export const scheduleDdmm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
