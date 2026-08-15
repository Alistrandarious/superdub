// =====================================================================
// SUPERDUB — the Return Review
// The room behind the comeback screen's door. Four things someone coming back
// after a long gap actually wants to know, and one honest refusal.
//
// Nothing here is new maths. Adherence is coach.ts's analyseHabit, whose
// `elapsed` counts only days you were present, so a gap cannot dilute it.
// Habit levels are levels.ts's, built on days banked for good, so a gap cannot
// take one off you. That is the whole emotional claim of the first step, and it
// is a property of the existing code rather than a kindness invented for it.
//
// The refusal: a quit habit's clock is wall time off a single quit_started_at,
// so it kept ticking whether or not the person did. The app cannot know, so it
// asks rather than asserting. See quitAsk below.
//
// Pure functions, no network, no React — see returnReview.check.ts.
// =====================================================================
import { analyseHabit, type HabitMeta, type TrackerHabitRow, type WeighIn } from './coach';
import { habitLevelFromDays } from './levels';
import { isSystemHabit } from './systemHabits';
import { quitElapsed } from './quit';

export interface ReturnReviewInput {
  /** signals.lastGapDays — how long they were away. */
  gapDays: number;
  /** signals.daysSinceReturn — 0 on the day they came back, null if not returning. */
  daysSinceReturn: number | null;
  habits: HabitMeta[];
  trackerHabits: TrackerHabitRow[];
  /** Every DD/MM of the current year, in order. */
  allDays: string[];
  /** Today as DD/MM. */
  today: string;
  weights: WeighIn[];
  /** Check-in moods, ISO-dated, on the DB's 1 to 10 scale. */
  moods: { date: string; mood: number | null }[];
  /** Quit-habit start times, name -> epoch ms. */
  quitStarts: Record<string, number>;
  nowMs: number;
}

export interface HeldRow {
  name: string;
  level: number;
  doneDays: number;
  adherence: number;
  /** Kept at 80% or better of the days they were present. */
  held: boolean;
}
export interface BeforeAfter { before: number; after: number; delta: number }
export interface QuitRow { name: string; days: number }

export interface ReturnReview {
  held: HeldRow[];
  weight: BeforeAfter | null;
  mood: BeforeAfter | null;
  quit: QuitRow[];
  /** The gap runs off the start of the year. Tracker days are keyed DD/MM with
   *  no year, so "before the gap" cannot be read at all — the screen says so
   *  rather than joining this January to last January and inventing a number.
   *  ponytail: ceiling of the DD/MM key. Upgrade path is the ISO history
   *  HabitMatrix already uses (IsoHistory in HabitMatrix.tsx). */
  spansYearStart: boolean;
}

/** Mean of the numbers, or null when there is nothing to average. */
function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/** How many days either side of the gap to average mood over. A single day is
 *  noise; a fortnight is a mood. */
const MOOD_WINDOW = 14;

export function buildReturnReview(input: ReturnReviewInput): ReturnReview {
  const { allDays, today, gapDays, daysSinceReturn, habits, trackerHabits, weights, moods, quitStarts, nowMs } = input;

  const todayIdx = allDays.indexOf(today);
  const empty: ReturnReview = { held: [], weight: null, mood: null, quit: [], spansYearStart: false };
  if (todayIdx < 0) return empty;

  // Where the gap sat on the calendar. daysSinceReturn is 0 on the day back.
  const returnIdx = todayIdx - (daysSinceReturn ?? 0);
  const gapStartIdx = returnIdx - gapDays;
  const spansYearStart = gapStartIdx < 0;

  // day -> habit -> state, the shape analyseHabit wants.
  const map: Record<string, Record<string, string | null>> = {};
  for (const row of trackerHabits) (map[row.day] ??= {})[row.habit_name] = row.state ?? null;

  // ── What held ──────────────────────────────────────────────────────────────
  // Every real habit, not just the daily ones the coach report narrows to: after
  // a long gap someone wants the whole board back, including the weekly gym.
  const held: HeldRow[] = habits
    .filter(h => (h.cadence ?? 'daily') !== 'quit' && !isSystemHabit(h.name))
    .map(h => {
      const a = analyseHabit(h.name, h.startDate ?? null, map, allDays, todayIdx);
      return {
        name: h.name,
        level: habitLevelFromDays(a.doneDays),
        doneDays: a.doneDays,
        adherence: a.adherence,
        held: a.adherence >= 0.8,
      };
    })
    // A habit with nothing banked has nothing to say about what held.
    .filter(r => r.doneDays > 0)
    .sort((a, b) => b.level - a.level || b.doneDays - a.doneDays);

  // ── Weight, measured across the gap ────────────────────────────────────────
  // The last real weigh-in before they went quiet against the most recent one.
  // Two numbers they can both verify on the chart. Nothing in between is guessed.
  let weight: BeforeAfter | null = null;
  if (!spansYearStart) {
    const idxOf = (day: string) => allDays.indexOf(day);
    const dated = weights
      .filter(w => Number.isFinite(w.weight) && w.weight > 0)
      .map(w => ({ ...w, i: idxOf(w.day) }))
      .filter(w => w.i >= 0)
      .sort((a, b) => a.i - b.i);
    const before = [...dated].reverse().find(w => w.i <= gapStartIdx);
    const after = [...dated].reverse().find(w => w.i >= returnIdx);
    if (before && after) {
      weight = { before: before.weight, after: after.weight, delta: after.weight - before.weight };
    }
  }

  // ── Mood, either side of the gap ───────────────────────────────────────────
  // Days without a check-in are left out rather than counted as bad ones.
  let mood: BeforeAfter | null = null;
  if (!spansYearStart) {
    const scored = moods
      .filter(m => m.mood != null && m.date)
      .map(m => {
        const p = String(m.date).split('-');
        return { v: m.mood as number, i: p.length === 3 ? allDays.indexOf(`${p[2]}/${p[1]}`) : -1 };
      })
      .filter(m => m.i >= 0);
    const b = mean(scored.filter(m => m.i <= gapStartIdx && m.i > gapStartIdx - MOOD_WINDOW).map(m => m.v));
    const a = mean(scored.filter(m => m.i >= returnIdx).map(m => m.v));
    if (b != null && a != null) mood = { before: b, after: a, delta: a - b };
  }

  // ── The ones they were quitting ────────────────────────────────────────────
  const quit: QuitRow[] = habits
    .filter(h => h.cadence === 'quit' && quitStarts[h.name] > 0)
    .map(h => ({ name: h.name, days: quitElapsed(quitStarts[h.name], nowMs).days }))
    .sort((a, b) => b.days - a.days);

  return { held, weight, mood, quit, spansYearStart };
}

/** The line the quit step leads with. Deliberately a question: the clean-day
 *  clock is wall time, so it advanced through the gap on its own and the app has
 *  no evidence either way. Asserting "still clean" would be the quiet lie the
 *  re-plan work was named for avoiding. */
export function quitAsk(days: number): string {
  return `The clock says ${days} ${days === 1 ? 'day' : 'days'}. It kept running whether or not you did.`;
}
