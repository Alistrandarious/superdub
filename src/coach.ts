// =====================================================================
// SUPERDUB — On-device coaching engine
// Turns the user's own data (weight trend, habit adherence, momentum) into a
// short, personalised, encouraging report. Pure functions, no network, no LLM —
// everything stays on the device. Linear regression for the weight trend; simple
// adherence analysis for habits.
// =====================================================================

import { dayWasMarked } from './dayStreak';
import { isSystemHabit } from './systemHabits';
import { getWeightUnit, kgToUnitValue, unitLabel } from './weightUnit';

export interface WeighIn { day: string; weight: number; } // day = 'DD/MM'
export interface TrackerHabitRow { day: string; habit_name: string; state: string | null; }
export interface HabitMeta { name: string; startDate: string | null; cadence?: string; }
export interface Goal { goalType?: string; targetWeight?: number; }

export interface CoachLine { icon: string; title: string; body: string; tone: 'good' | 'warn' | 'neutral'; }
export interface CoachReport {
  emoji: string;
  headline: string;
  lines: CoachLine[];
  closing: string;
  wantsWalk?: boolean;  // Dub is restless, nudge the user to get moving
  // This week's tick tally (already computed for the wins pool) — the chat's
  // "How's my week looking?" answer reads it rather than re-analysing.
  weekStats?: { weekTicks: number; possibleTicks: number };
}

const YEAR = new Date().getFullYear();

export function ddmmToEpochDay(ddmm: string): number {
  const [d, m] = ddmm.split('/').map(Number);
  return Math.round(new Date(YEAR, (m || 1) - 1, d || 1).getTime() / 86400000);
}
export function fmtDate(epochDay: number): string {
  return new Date(epochDay * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
// Stable "random" pick keyed to the day, so the wording is consistent within a day.
function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

/* ── Weight trend (linear regression) ─────────────────────────────────────── */
function regressionSlope(pts: { x: number; y: number }[]): number {
  const n = pts.length;
  if (n < 2) return 0;
  const sx = pts.reduce((a, p) => a + p.x, 0);
  const sy = pts.reduce((a, p) => a + p.y, 0);
  const sxx = pts.reduce((a, p) => a + p.x * p.x, 0);
  const sxy = pts.reduce((a, p) => a + p.x * p.y, 0);
  const denom = n * sxx - sx * sx;
  return denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
}

/** One source of pace truth for the coach report, the Dub chat and the daily
 *  brief. This week's ACTUAL movement: first vs last weigh-in inside the
 *  trailing 7 days (no extrapolation, the two numbers you can verify on the
 *  chart), falling back to a 14-day regression when the week is too sparse.
 *  `seed` is today's epoch day. Returns null with fewer than 2 clean weigh-ins. */
export interface WeekPace {
  hasWeek: boolean;                          // enough spread to call it a week
  rate: number;                              // signed kg over the week (or regression per-week)
  perWeek: number;                           // |rate| normalised to a full 7 days (for ETAs)
  first: { x: number; y: number } | null;    // week window endpoints (epoch day, kg)
  last: { x: number; y: number } | null;
  latest: number;                            // most recent weigh-in, kg
  prev: number | null;                       // the weigh-in before it, kg
  count: number;                             // clean weigh-in count
}
export function weekPace(weights: WeighIn[], seed: number): WeekPace | null {
  const clean = weights
    .filter(w => w.weight > 0)
    .map(w => ({ x: ddmmToEpochDay(w.day), y: Number(w.weight) }))
    .sort((a, b) => a.x - b.x);
  if (clean.length < 2) return null;
  const win7 = clean.filter(p => p.x >= seed - 6 && p.x <= seed);
  const first = win7[0] ?? null;
  const last = win7.length > 0 ? win7[win7.length - 1] : null;
  const weekSpan = win7.length >= 2 ? last!.x - first!.x : 0;
  const hasWeek = weekSpan >= 3; // need points spread across the week to call it a week
  const weekDelta = hasWeek ? last!.y - first!.y : null; // signed kg over this week
  const regPerWeek = regressionSlope(clean.slice(-14)) * 7;
  const rate = weekDelta != null ? weekDelta : regPerWeek;
  const perWeek = hasWeek ? Math.abs(weekDelta!) / weekSpan * 7 : Math.abs(rate);
  return {
    hasWeek, rate, perWeek,
    first: hasWeek ? first : null,
    last: hasWeek ? last : null,
    latest: clean[clean.length - 1].y,
    prev: clean.length >= 2 ? clean[clean.length - 2].y : null,
    count: clean.length,
  };
}

function weightLine(weights: WeighIn[], goal: Goal | null, seed: number): CoachLine | null {
  const wp = weekPace(weights, seed);
  if (!wp) {
    return { icon: '⚖️', title: 'Building your trend', tone: 'neutral',
      body: 'A few more weigh-ins and I can show you exactly which way things are heading. Keep logging daily.' };
  }
  const { hasWeek, rate, first, last, latest } = wp;
  const goalType = goal?.goalType ?? (goal?.targetWeight != null ? (goal.targetWeight < latest ? 'lose' : 'gain') : undefined);

  // Detection stays in kg (storage/engine unit); only DISPLAY converts to the
  // user's chosen unit. kgToUnitValue is linear so it's right for deltas too.
  // Guarded because coach.ts also runs under node in the *.check.ts files.
  const unit = (() => { try { return getWeightUnit(); } catch { return 'kg' as const; } })();
  const lbl = unitLabel(unit);
  const w = (kg: number) => kgToUnitValue(kg, unit).toFixed(1);

  const absWk = Math.abs(rate);
  const plateau = absWk < 0.1;
  const losing = rate < 0;
  const weekWord = hasWeek ? 'this week' : 'lately';
  const detail = hasWeek ? ` (${w(first!.y)} → ${w(last!.y)} ${lbl} since ${fmtDate(first!.x)})` : '';

  // No goal — just describe the movement kindly.
  if (!goal || goal.targetWeight == null || !goalType || goalType === 'maintain') {
    if (plateau) return { icon: '⚖️', title: 'Holding steady', tone: 'neutral', body: `You're stable around ${w(latest)} ${lbl}${detail}. Consistency is its own win.` };
    return { icon: losing ? '📉' : '📈', title: losing ? 'Trending down' : 'Trending up', tone: 'neutral',
      body: `${w(absWk)} ${lbl} ${losing ? 'down' : 'up'} ${weekWord}${detail}, now at ${w(latest)} ${lbl}.` };
  }

  const target = goal.targetWeight;
  const goingRightWay = (goalType === 'lose' && losing) || (goalType === 'gain' && !losing && !plateau);
  const remaining = Math.abs(latest - target);

  if (remaining <= 0.3) {
    return { icon: '🏆', title: 'Right on your goal', tone: 'good', body: `You're essentially at your ${w(target)} ${lbl} target. Incredible. Now let's hold it.` };
  }
  if (plateau) {
    return { icon: '🪨', title: 'A small plateau', tone: 'warn',
      body: pick([
        `The scale's been flat ${weekWord}${detail}. Totally normal. Trust the process; ${w(remaining)} ${lbl} to go.`,
        `Plateaus happen to everyone${detail}. Tighten one thing today and the trend usually resumes within a week.`,
      ], seed) };
  }
  if (goingRightWay) {
    // ETA from this week's honest pace, normalised to a full 7 days (weekPace).
    const weeksToGoal = wp.perWeek > 0 ? remaining / wp.perWeek : Infinity;
    const etaStr = isFinite(weeksToGoal) && weeksToGoal < 104
      ? ` At this pace you'll hit ${w(target)} ${lbl} around ${fmtDate(seed + Math.round(weeksToGoal * 7))}.`
      : '';
    return { icon: '📉', title: `${w(absWk)} ${lbl} ${losing ? 'down' : 'up'} ${weekWord}, on track`, tone: 'good',
      body: `${hasWeek ? `${w(first!.y)} → ${w(last!.y)} ${lbl} since ${fmtDate(first!.x)}.` : ''}${etaStr} ${w(remaining)} ${lbl} to go. Keep it steady.` };
  }
  // Moving the wrong way
  return { icon: '🧭', title: 'Drifting off course', tone: 'warn',
    body: pick([
      `${w(absWk)} ${lbl} the wrong way ${weekWord}${detail}. One solid day resets the momentum. You've got this.`,
      `Slightly off target ${weekWord}${detail}. No drama. Focus on today's basics and the line will turn.`,
    ], seed) };
}

/* ── Habit adherence ──────────────────────────────────────────────────────── */
// Exported for the Return Review, which needs the same gap-safe adherence this
// report is built on. `elapsed` counting only marked days is the whole reason:
// it survives a three-week silence instead of reading it as three weeks of misses.
export interface HabitAnalysis {
  name: string; adherence: number; streak: number; misses: number; doneDays: number; elapsed: number;
  done7: number;      // ticks in the trailing 7 days (incl. today)
  donePrev7: number;  // ticks in the 7 days before that
}

export function analyseHabit(name: string, startDate: string | null, map: Record<string, Record<string, string | null>>, allDays: string[], todayIdx: number): HabitAnalysis {
  let startIdx = 0;
  if (startDate) {
    const parts = startDate.split('-');
    if (parts.length === 3) {
      const key = `${parts[2]}/${parts[1]}`;
      const si = allDays.indexOf(key);
      if (si >= 0) startIdx = si;
    }
  }
  let doneDays = 0;
  for (let i = startIdx; i <= todayIdx; i++) {
    if (map[allDays[i]]?.[name] === 'done') doneDays++;
  }
  // Days they were actually here, not days on the calendar. Adherence then reads
  // "of the days you showed up, how often did you do this", which survives a gap
  // instead of collapsing into a verdict about three weeks of silence.
  // ponytail: presence is inferred from habit marks only, so a day with just a
  // weigh-in reads as absent. Upgrade path is to pass the check-in days in too.
  let elapsed = 0;
  for (let i = startIdx; i <= todayIdx; i++) if (dayWasMarked(map[allDays[i]])) elapsed++;
  elapsed = Math.max(1, elapsed);
  // week-over-week volume, for the "most improved" win
  let done7 = 0, donePrev7 = 0;
  for (let i = Math.max(startIdx, todayIdx - 6); i <= todayIdx; i++) {
    if (map[allDays[i]]?.[name] === 'done') done7++;
  }
  for (let i = Math.max(startIdx, todayIdx - 13); i <= todayIdx - 7; i++) {
    if (i >= 0 && map[allDays[i]]?.[name] === 'done') donePrev7++;
  }
  // current streak (counting today if done, else from yesterday)
  let streak = 0;
  const todayDone = map[allDays[todayIdx]]?.[name] === 'done';
  let idx = todayDone ? todayIdx : todayIdx - 1;
  while (idx >= startIdx && map[allDays[idx]]?.[name] === 'done') { streak++; idx--; }
  // recent consecutive misses before today
  let misses = 0;
  for (let i = todayIdx - 1; i >= startIdx && i >= todayIdx - 7; i--) {
    const day = map[allDays[i]];
    if (!dayWasMarked(day)) break;          // they weren't here. Silence is not a miss.
    if (day?.[name] === 'na') continue;     // deliberate skip, out of the count as everywhere else
    if (day?.[name] !== 'done') misses++; else break;
  }
  return { name, adherence: doneDays / elapsed, streak, misses, doneDays, elapsed, done7, donePrev7 };
}

const TIPS: { match: RegExp; tip: string }[] = [
  { match: /walk|steps|10\s?k/i, tip: 'Try a 10-minute walk straight after a meal. It compounds faster than you\'d think.' },
  { match: /water|hydrat/i, tip: 'Keep a filled bottle in sight and sip before every task.' },
  { match: /read/i, tip: 'Read just one page tonight. Momentum beats volume.' },
  { match: /gym|workout|exercise|train|lift/i, tip: 'Lay your kit out the night before to kill the friction.' },
  { match: /smok|vape/i, tip: 'When the urge hits, set a 5-minute timer. It usually passes before it ends.' },
  { match: /sugar|snack|junk|takeaway|take\s?away/i, tip: 'Swap one snack for fruit today. Small wins stack into big ones.' },
  { match: /sleep|bed/i, tip: 'Set a wind-down alarm 30 minutes before bed.' },
  { match: /medit|mindful|breath/i, tip: 'Two minutes of breathing counts. Start tiny.' },
  { match: /porn|masturb|nofap/i, tip: 'Plan a replacement action for trigger moments: a walk, a call, anything that moves you.' },
  { match: /duolingo|language|learn|study/i, tip: 'Do one lesson on your commute. Stack it onto something you already do.' },
  { match: /journal|write/i, tip: 'One sentence is a full entry today. Just open the page.' },
];
export function tipFor(name: string): string {
  const hit = TIPS.find(t => t.match.test(name));
  return hit ? hit.tip : `Shrink it: do the tiniest possible version of "${name}" today, just to keep the chain alive.`;
}

/* ── Report assembly ──────────────────────────────────────────────────────── */
const HEADLINES_GOOD = ['You\'re on a roll', 'Momentum looks great', 'This is working', 'Strong week so far'];
const HEADLINES_MIXED = ['Solid effort. Let\'s sharpen one thing', 'Good base, one tweak to go', 'You\'re in the game'];
const HEADLINES_TOUGH = ['Every comeback starts with one day', 'Reset and go again', 'Today\'s a fresh line'];
const CLOSING = [
  'Tiny, boring consistency wins. See you tomorrow. 💪',
  'Show up again tomorrow. That\'s the whole secret.',
  'You don\'t have to be perfect, just persistent. 🙌',
  'One honest day at a time. Proud of you.',
];

export function buildCoachReport(
  weights: WeighIn[],
  habits: HabitMeta[],
  trackerHabits: TrackerHabitRow[],
  allDays: string[],
  today: string,
  goal: Goal | null,
): CoachReport | null {
  const seed = ddmmToEpochDay(today);
  const todayIdx = allDays.indexOf(today);
  if (todayIdx < 0) return null;

  // day → habit → state map
  const map: Record<string, Record<string, string | null>> = {};
  for (const row of trackerHabits) {
    (map[row.day] ??= {})[row.habit_name] = row.state ?? null;
  }

  const daily = habits.filter(h => (h.cadence ?? 'daily') === 'daily' && !isSystemHabit(h.name));
  const analyses = daily.map(h => analyseHabit(h.name, h.startDate, map, allDays, todayIdx))
    .filter(a => a.elapsed >= 2);

  const lines: CoachLine[] = [];

  // 1) Weight
  const wl = weightLine(weights, goal, seed);
  if (wl) lines.push(wl);

  // 2) A win — build every kind of win available today, then rotate by day so
  //    it isn't stuck on the same streak headline for weeks.
  const wins: CoachLine[] = [];
  const byStreak = [...analyses].sort((a, b) => b.streak - a.streak);
  const streakWin = byStreak[0];
  if (streakWin && streakWin.streak >= 2) {
    wins.push({ icon: '🔥', title: `${streakWin.streak}-day ${streakWin.name} streak`, tone: 'good',
      body: pick([`That streak is hard-earned. Protect it today.`, `${streakWin.name} is becoming who you are. Keep the chain alive.`], seed) });
  }
  const improved = [...analyses]
    .filter(a => a.done7 - a.donePrev7 >= 2 && a.elapsed >= 10)
    .sort((a, b) => (b.done7 - b.donePrev7) - (a.done7 - a.donePrev7))[0];
  if (improved) {
    wins.push({ icon: '📈', title: `${improved.name} is levelling up`, tone: 'good',
      body: `${improved.done7} day${improved.done7 === 1 ? '' : 's'} this week vs ${improved.donePrev7} last week. That's real momentum building.` });
  }
  const possibleTicks = analyses.reduce((s, a) => s + Math.min(7, a.elapsed), 0);
  const weekTicks = analyses.reduce((s, a) => s + a.done7, 0);
  if (possibleTicks >= 7 && weekTicks / possibleTicks >= 0.6) {
    wins.push({ icon: '🧱', title: `${weekTicks} of ${possibleTicks} habit ticks this week`, tone: 'good',
      body: `${Math.round((weekTicks / possibleTicks) * 100)}% of everything you set out to do. Brick by brick.` });
  }
  const byAdh = [...analyses].sort((a, b) => b.adherence - a.adherence)[0];
  if (byAdh && byAdh.adherence >= 0.6 && !wins.some(w => w.title.includes(byAdh.name))) {
    wins.push({ icon: '✅', title: `Strong on ${byAdh.name}`, tone: 'good',
      body: `You're hitting it ${Math.round(byAdh.adherence * 100)}% of days since you started. That's real consistency.` });
  }
  const win = wins.length > 0 ? wins[seed % wins.length] : null;
  if (win) lines.push(win);

  // 3) A struggle — most recent misses, else lowest adherence (not today's win)
  const candidates = analyses.filter(a => !win || !win.title.includes(a.name));
  const struggle = candidates
    .filter(a => a.misses >= 2 || a.adherence < 0.5)
    .sort((a, b) => (b.misses - a.misses) || (a.adherence - b.adherence))[0];
  if (struggle) {
    const why = struggle.misses >= 2 ? `${struggle.misses} days missed in a row` : `only ${Math.round(struggle.adherence * 100)}% of days`;
    lines.push({ icon: '🎯', title: `Let's rescue ${struggle.name}`, tone: 'warn',
      body: `${why}. ${tipFor(struggle.name)}` });
  }

  // Walkies — only when momentum has GENUINELY stalled (no live streak on any
  // habit), and at most once every 3 days. One struggling habit is the
  // struggle line's job, not a reason to nag for walks every day.
  // Being away is not a stall: someone back after three weeks has no live streak
  // on anything, and their first morning back should not open with a nag.
  const presentLately = allDays.slice(Math.max(0, todayIdx - 6), todayIdx + 1).some(d => dayWasMarked(map[d]));
  const globalStall = analyses.length > 0 && presentLately && !analyses.some(a => a.streak >= 1);
  let wantsWalk = false;
  if (globalStall) {
    try {
      const K = 'superdub.dub.walkNudgeDay';
      const lastShown = parseInt(localStorage.getItem(K) ?? '0', 10) || 0;
      if (seed === lastShown || seed - lastShown >= 3) {
        wantsWalk = true;
        localStorage.setItem(K, String(seed));
      }
    } catch { wantsWalk = true; }
  }
  if (wantsWalk) {
    lines.push({ icon: '🦴', title: 'Dub wants a walk', tone: 'warn',
      body: pick([
        `Things have gone a bit quiet. Take me out. A short walk today is the easiest way to restart the momentum.`,
        `I'm getting restless! Let's go for a walk and knock out one easy win today.`,
      ], seed) });
  }

  if (lines.length === 0) return null;

  // Headline + closing based on overall tone
  const goods = lines.filter(l => l.tone === 'good').length;
  const warns = lines.filter(l => l.tone === 'warn').length;
  let headline: string, emoji: string;
  if (goods > warns) { headline = pick(HEADLINES_GOOD, seed); emoji = '🚀'; }
  else if (warns > goods) { headline = pick(HEADLINES_TOUGH, seed); emoji = '🌱'; }
  else { headline = pick(HEADLINES_MIXED, seed); emoji = '💡'; }

  return { emoji, headline, lines, closing: pick(CLOSING, seed), wantsWalk, weekStats: { weekTicks, possibleTicks } };
}
