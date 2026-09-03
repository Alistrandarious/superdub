// =====================================================================
// SUPERDUB — Dub's insight engine (pure, on-device)
// Turns the user's own tracker into per-habit findings Dub can talk about:
//  · which weekday a habit gets skipped most
//  · whether a habit goes with more steps / a better mood
//  · whether keeping a habit up tracks with the weight trend
// Pure functions, no network, no LLM. Same honesty bar as coach.ts: only
// speak when there's enough data to mean something.
// =====================================================================

// Pearson correlation over paired samples; null if too few points or no variance.
// (Single source — PatternsCard imports this too.)
export function pearson(pairs: [number, number][]): number | null {
  const n = pairs.length;
  if (n < 6) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pairs) { sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
  const cov = sxy - (sx * sy) / n;
  const vx = sxx - (sx * sx) / n;
  const vy = syy - (sy * sy) / n;
  if (vx <= 0 || vy <= 0) return null;
  return cov / Math.sqrt(vx * vy);
}

// How sure the numbers are, in words. ponytail: fixed cut-offs per finding kind
// rather than one shared statistic, because each kind's raw strength sits on its
// own scale (a miss rate, a % step gap, a mood-point gap, a correlation).
export type InsightSignal = 'slight' | 'clear' | 'strong';
function band(x: number, clear: number, strong: number): InsightSignal {
  return x >= strong ? 'strong' : x >= clear ? 'clear' : 'slight';
}
export function strengthWord(r: number): InsightSignal {
  return band(Math.abs(r), 0.3, 0.5);
}

export interface InsightInput {
  habits: string[];                                                   // real habits (exclude the mandatory check-in)
  trackerHabits: { day: string; habit_name: string; state: string | null }[]; // day = 'DD/MM'
  stepsByDay: Record<string, number>;                                 // 'DD/MM' -> steps
  weightByDay: Record<string, number>;                                // 'DD/MM' -> weight (kg)
  moodByDay: Record<string, number>;                                  // 'DD/MM' -> mood 1..5
  allDays: string[];                                                  // ordered 'DD/MM' for the year
  today: string;                                                      // 'DD/MM'
  goalType?: string | null;                                           // 'lose' | 'gain' | 'maintain'; decides whether a weight link is good news
}

// What a finding is about. The page groups on this; the chat picks its question from it.
export type InsightTheme = 'steps' | 'mood' | 'weight' | 'rhythm';
export type InsightTone = 'good' | 'warn' | 'neutral';

export interface DubInsight {
  habit: string;
  theme: InsightTheme;
  tone: InsightTone;                 // good news, a heads up, or just a fact (weight with no goal)
  direction: 'up' | 'down' | null;   // which way the number goes on habit days; null for rhythm
  signal: InsightSignal;
  text: string;
  strength: number;   // 0..1-ish, for ranking
}

// Insights arrive ranked strongest-first, so the first theme seen holds the
// strongest finding and Map insertion order gives strongest-theme-first for free.
export function groupInsights(list: DubInsight[]): { theme: InsightTheme; items: DubInsight[] }[] {
  const groups = new Map<InsightTheme, DubInsight[]>();
  for (const ins of list) groups.set(ins.theme, [...(groups.get(ins.theme) ?? []), ins]);
  return Array.from(groups, ([theme, items]) => ({ theme, items }));
}

const WEEKDAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const YEAR = new Date().getFullYear();

function dowMon(ddmm: string): number {
  const d = parseInt(ddmm.slice(0, 2), 10);
  const m = parseInt(ddmm.slice(3), 10);
  return (new Date(YEAR, m - 1, d).getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
}
function epochDay(ddmm: string): number {
  const d = parseInt(ddmm.slice(0, 2), 10);
  const m = parseInt(ddmm.slice(3), 10);
  return Math.round(new Date(YEAR, m - 1, d).getTime() / 86400000);
}
function fmtK(n: number): string {
  return `${(n / 1000).toFixed(1)}k`;
}
function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

// Build the full set of Dub insights, ranked strongest-first.
export function buildHabitInsights(input: InsightInput): DubInsight[] {
  const { habits, trackerHabits, stepsByDay, weightByDay, moodByDay, allDays, today, goalType } = input;
  const todayIdx = allDays.indexOf(today);
  if (todayIdx < 0) return [];

  // habit -> (DD/MM -> state)
  const byHabit = new Map<string, Map<string, string>>();
  for (const h of habits) byHabit.set(h, new Map());
  for (const row of trackerHabits) {
    const m = byHabit.get(row.habit_name);
    if (m && row.state) m.set(row.day, row.state);
  }

  const out: DubInsight[] = [];

  for (const habit of habits) {
    const states = byHabit.get(habit)!;
    // Active window: from the habit's first done day up to today (its life so far).
    const firstDoneIdx = allDays.findIndex(d => states.get(d) === 'done');
    if (firstDoneIdx < 0) continue; // never done — nothing honest to say yet

    // Days the habit was "live": on/after first done, strictly before today (today may
    // still be pending), where we can read done vs not.
    const active: string[] = [];
    for (let i = firstDoneIdx; i < todayIdx; i++) active.push(allDays[i]);
    if (active.length < 7) continue;

    const isDone = (d: string) => states.get(d) === 'done';

    // ── Weekday it's skipped most ──────────────────────────────────────────────
    const total = Array(7).fill(0);
    const miss = Array(7).fill(0);
    for (const d of active) { const k = dowMon(d); total[k]++; if (!isDone(d)) miss[k]++; }
    let worst = -1, worstRate = 0;
    for (let k = 0; k < 7; k++) {
      if (total[k] < 3 || miss[k] < 2) continue;
      const rate = miss[k] / total[k];
      if (rate > worstRate) { worstRate = rate; worst = k; }
    }
    const overallMissRate = miss.reduce((a, b) => a + b, 0) / active.length;
    // Only nag if this weekday is clearly worse than the habit's own average.
    if (worst >= 0 && worstRate >= 0.5 && worstRate - overallMissRate >= 0.15) {
      out.push({
        habit, theme: 'rhythm', tone: 'warn', direction: null, signal: band(worstRate, 0.65, 0.85), strength: worstRate,
        text: `You skip ${habit} most on ${WEEKDAY[worst]}s (missed ${miss[worst]} of ${total[worst]}). Worth a plan for that day.`,
      });
    }

    // ── Steps on done-days vs not ──────────────────────────────────────────────
    const doneSteps = active.filter(d => isDone(d) && stepsByDay[d] > 0).map(d => stepsByDay[d]);
    const offSteps = active.filter(d => !isDone(d) && stepsByDay[d] > 0).map(d => stepsByDay[d]);
    if (doneSteps.length >= 4 && offSteps.length >= 4) {
      const a = mean(doneSteps), b = mean(offSteps);
      const rel = (a - b) / b;
      if (Math.abs(rel) >= 0.12) {
        out.push({
          habit, theme: 'steps', tone: rel > 0 ? 'good' : 'warn', direction: rel > 0 ? 'up' : 'down',
          signal: band(Math.abs(rel), 0.2, 0.35), strength: Math.min(1, Math.abs(rel)),
          text: rel > 0
            ? `On days you do ${habit} you average ${fmtK(a)} steps, versus ${fmtK(b)} when you don't.`
            : `Your step count dips on ${habit} days (${fmtK(a)} vs ${fmtK(b)}).`,
        });
      }
    }

    // ── Mood on done-days vs not ───────────────────────────────────────────────
    const doneMood = active.filter(d => isDone(d) && moodByDay[d] != null).map(d => moodByDay[d]);
    const offMood = active.filter(d => !isDone(d) && moodByDay[d] != null).map(d => moodByDay[d]);
    if (doneMood.length >= 4 && offMood.length >= 4) {
      const a = mean(doneMood), b = mean(offMood);
      if (Math.abs(a - b) >= 0.4) {
        out.push({
          habit, theme: 'mood', tone: a > b ? 'good' : 'warn', direction: a > b ? 'up' : 'down',
          signal: band(Math.abs(a - b), 0.6, 1), strength: Math.min(1, Math.abs(a - b) / 4),
          text: a > b
            ? `You feel better on days you do ${habit} (${a.toFixed(1)}/5 vs ${b.toFixed(1)}/5).`
            : `Your mood runs lower on ${habit} days (${a.toFixed(1)}/5 vs ${b.toFixed(1)}/5).`,
        });
      }
    }

    // ── Weekly adherence vs weight change ──────────────────────────────────────
    // Group active days into 7-day buckets; per week pair (adherence, kg change).
    const weeks = new Map<number, { done: number; n: number; weights: { x: number; w: number }[] }>();
    for (const d of active) {
      const wk = Math.floor(epochDay(d) / 7);
      const e = weeks.get(wk) ?? { done: 0, n: 0, weights: [] };
      e.n++; if (isDone(d)) e.done++;
      if (weightByDay[d] > 0) e.weights.push({ x: epochDay(d), w: weightByDay[d] });
      weeks.set(wk, e);
    }
    const pairs: [number, number][] = [];
    for (const e of Array.from(weeks.values())) {
      if (e.n < 3 || e.weights.length < 2) continue;
      e.weights.sort((p, q) => p.x - q.x);
      const change = e.weights[e.weights.length - 1].w - e.weights[0].w;
      pairs.push([e.done / e.n, change]);
    }
    const r = pearson(pairs);
    if (r != null && Math.abs(r) >= 0.35) {
      // Dropping is good news on a lose goal, climbing on a gain goal; no goal, no verdict.
      const wants = goalType === 'lose' ? 'down' : goalType === 'gain' ? 'up' : null;
      const direction = r < 0 ? 'down' : 'up';
      out.push({
        habit, theme: 'weight', tone: wants ? (direction === wants ? 'good' : 'warn') : 'neutral', direction,
        signal: strengthWord(r), strength: Math.abs(r),
        text: r < 0
          ? `Weeks you keep ${habit} up, your weight tends to drop (${strengthWord(r)} link).`
          : `Weeks you keep ${habit} up, your weight tends to climb (${strengthWord(r)} link).`,
      });
    }
  }

  // Rank strongest first; keep the list tight and varied (max 2 per habit).
  out.sort((a, b) => b.strength - a.strength);
  const perHabit = new Map<string, number>();
  const kept: DubInsight[] = [];
  for (const ins of out) {
    const c = perHabit.get(ins.habit) ?? 0;
    if (c >= 2) continue;
    perHabit.set(ins.habit, c + 1);
    kept.push(ins);
    if (kept.length >= 6) break;
  }
  return kept;
}
