// Pure week-range helpers for the Habits top strip (swipeable weeks). No React or
// CSS imports, so they stay unit-testable in isolation (weekRange.check.ts).

// Monday (floored to 00:00 local) of the week `offset` weeks from the one that
// contains `now`. offset 0 = this week, -1 = last week, etc.
export function weekMonday(now: Date, offset: number): Date {
  const dow = now.getDay(); // 0 = Sunday
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

// "14–20 Jul" when the week sits in one month, "30 Jun–6 Jul" across a boundary.
export function weekRangeLabel(mon: Date, sun: Date): string {
  const mo = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short' });
  return mon.getMonth() === sun.getMonth()
    ? `${mon.getDate()}–${sun.getDate()} ${mo(sun)}`
    : `${mon.getDate()} ${mo(mon)}–${sun.getDate()} ${mo(sun)}`;
}

export function weekTitle(offset: number): string {
  return offset === 0 ? 'This week' : offset === -1 ? 'Last week' : `${-offset} weeks ago`;
}
