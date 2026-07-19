// Level-up "at a glance" model — the snapshot shown on the level-up screen.
//
// Pure so it's testable (see levelGlance.check.ts). The component (LevelGlance.tsx)
// fetches tracker/habits/profile/weight-settings and hands the raw rows here. Every
// section is nullable/empty when there's no data, so the card hides what it can't fill.
//
// Weight is always kilograms in storage (see weightUnit.ts) — this module stays in kg
// and leaves unit conversion to the render boundary.

export interface GlanceStarred { name: string; done: boolean; }
export interface GlanceWeight {
  currentKg: number;
  goalKg: number | null;
  weekDeltaKg: number | null;         // >0 = lost since ~a week ago; null = not enough history
  goalType: 'lose' | 'gain' | 'maintain';
}
export interface GlanceModel {
  streak: number | null;              // null = hide
  steps: { today: number; target: number } | null;
  weight: GlanceWeight | null;
  starred: GlanceStarred[];           // [] = hide
}

export interface GlanceInput {
  streak: number;
  today: string;                      // 'DD/MM' logging day
  year: number;                       // tracker year, for DD/MM -> ordinal date math
  days: { day: string; weight: string; steps: string }[];
  habitStates: { day: string; habit_name: string; state: string | null }[];
  habits: { name: string; starred?: boolean }[];
  stepTarget: number;
  goalKg: number | null;
}

// 'DD/MM' -> day-of-year ordinal for chronological ordering + week gaps.
function ordinal(ddmm: string, year: number): number | null {
  const m = ddmm.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return null;
  const d = new Date(year, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  if (isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - new Date(year, 0, 0).getTime()) / 86400000);
}

export function computeGlance(inp: GlanceInput): GlanceModel {
  const streak = inp.streak > 0 ? inp.streak : null;

  const todayRow = inp.days.find(d => d.day === inp.today);
  const stepsToday = todayRow ? (parseInt(todayRow.steps, 10) || 0) : 0;
  const steps = inp.stepTarget > 0 ? { today: stepsToday, target: inp.stepTarget } : null;

  // Weights in chronological order (kg, positive only).
  const weights = inp.days
    .map(d => ({ idx: ordinal(d.day, inp.year), kg: parseFloat(d.weight) }))
    .filter((w): w is { idx: number; kg: number } => w.idx != null && w.kg > 0)
    .sort((a, b) => a.idx - b.idx);

  let weight: GlanceWeight | null = null;
  if (weights.length > 0) {
    const latest = weights[weights.length - 1];
    // Most recent sample at least ~5 days before the latest reads as "about a week ago".
    let weekAgo: { idx: number; kg: number } | null = null;
    for (let i = weights.length - 2; i >= 0; i--) {
      if (latest.idx - weights[i].idx >= 5) { weekAgo = weights[i]; break; }
    }
    const weekDeltaKg = weekAgo ? +(weekAgo.kg - latest.kg).toFixed(1) : null;
    const goalKg = inp.goalKg && inp.goalKg > 0 ? inp.goalKg : null;
    const goalType: GlanceWeight['goalType'] =
      goalKg == null ? 'maintain' : goalKg < latest.kg ? 'lose' : goalKg > latest.kg ? 'gain' : 'maintain';
    weight = { currentKg: latest.kg, goalKg, weekDeltaKg, goalType };
  }

  const doneToday = new Set(
    inp.habitStates.filter(h => h.day === inp.today && h.state === 'done').map(h => h.habit_name)
  );
  const starred = inp.habits
    .filter(h => h.starred)
    .map(h => ({ name: h.name, done: doneToday.has(h.name) }));

  return { streak, steps, weight, starred };
}
