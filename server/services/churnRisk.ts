// Deterministic churn risk — no ML, pure threshold checks on rolling windows.
// All windows are recent-only: stale historical data doesn't suppress a real risk level.

export type ChurnRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CheckInRow {
  date: Date;
  energy: number;
  mood?: number; // 1-5; optional — not all rows will have it
}

export function computeChurnRisk(
  recentCheckins: CheckInRow[],  // any window, sorted newest-first or unsorted
  lastActivityAt: Date | null,
  hadPriorStreak: boolean,       // any check-in exists before the last-7-day window
): ChurnRisk {
  const now = Date.now();

  const daysSinceLastActivity = lastActivityAt
    ? (now - lastActivityAt.getTime()) / 86400000
    : Infinity;

  const last7 = recentCheckins.filter(c => (now - c.date.getTime()) / 86400000 <= 7);
  const count7 = last7.length;

  // CRITICAL: was engaged (had prior check-ins before the window), then hard drop
  if (hadPriorStreak && count7 === 0 && daysSinceLastActivity >= 7) return 'CRITICAL';

  // HIGH: barely present OR 3+ consecutive recent low-energy readings
  if (count7 <= 1) return 'HIGH';

  const sortedDesc = [...last7].sort((a, b) => b.date.getTime() - a.date.getTime());

  // Combined low-signal: a reading is "low" if energy ≤2 OR (mood present and mood ≤2)
  const isLowSignal = (c: CheckInRow) => c.energy <= 2 || (c.mood != null && c.mood <= 2);

  let consecutiveLow = 0;
  for (const c of sortedDesc) {
    if (isLowSignal(c)) consecutiveLow++;
    else break;
  }
  if (consecutiveLow >= 3) return 'HIGH';

  // MEDIUM: sporadic or recent energy/mood tanking
  if (count7 <= 4) {
    const last3 = sortedDesc.slice(0, 3);
    if (last3.length >= 3) {
      const avg3Energy = last3.reduce((s, c) => s + c.energy, 0) / 3;
      const moodRows = last3.filter(c => c.mood != null);
      const avg3Mood = moodRows.length > 0 ? moodRows.reduce((s, c) => s + c.mood!, 0) / moodRows.length : 5;
      if (avg3Energy < 2.5 || avg3Mood < 2.5) return 'MEDIUM';
    }
    return 'MEDIUM';
  }

  // 5+ check-ins — still MEDIUM if energy or mood is poor
  const last3 = sortedDesc.slice(0, 3);
  if (last3.length >= 3) {
    const avg3Energy = last3.reduce((s, c) => s + c.energy, 0) / 3;
    const moodRows3 = last3.filter(c => c.mood != null);
    const avg3Mood = moodRows3.length > 0 ? moodRows3.reduce((s, c) => s + c.mood!, 0) / moodRows3.length : 5;
    if (avg3Energy < 2.5 || avg3Mood < 2.5) return 'MEDIUM';
  }
  const avgAll = last7.reduce((s, c) => s + c.energy, 0) / count7;
  if (avgAll < 3) return 'MEDIUM';
  const allMoodRows = last7.filter(c => c.mood != null);
  if (allMoodRows.length > 0 && allMoodRows.reduce((s, c) => s + c.mood!, 0) / allMoodRows.length < 3) return 'MEDIUM';

  return 'LOW';
}
