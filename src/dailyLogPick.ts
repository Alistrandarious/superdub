// Pure: pull a single day's logged weight/steps out of the tracker rows. Kept in
// its own dependency-free module so the day-mapping self-check can run without
// dragging in React (see dailyLogPick.selfcheck.ts).
export function pickDayLog(
  days: Array<{ day: string; weight?: string; steps?: string }>,
  dayKey: string,
): { weight: string | null; steps: number | null } {
  let weight: string | null = null;
  let steps: number | null = null;
  for (const row of days) {
    if (row.day !== dayKey) continue;
    const w = parseFloat(row.weight ?? '');
    const s = parseInt(row.steps ?? '', 10);
    if (w > 0) weight = row.weight ?? null;
    if (s > 0) steps = s;
  }
  return { weight, steps };
}
