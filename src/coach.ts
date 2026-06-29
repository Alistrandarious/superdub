// =====================================================================
// SUPERDUB — On-device coaching engine
// Turns the user's own data (weight trend, habit adherence, momentum) into a
// short, personalised, encouraging report. Pure functions, no network, no LLM —
// everything stays on the device. Linear regression for the weight trend; simple
// adherence analysis for habits.
// =====================================================================

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
  wantsWalk?: boolean;  // Dub is restless — nudge the user to get moving
}

const YEAR = 2026;
const MANDATORY_HABIT = 'Logging into Superdub';

function ddmmToEpochDay(ddmm: string): number {
  const [d, m] = ddmm.split('/').map(Number);
  return Math.round(new Date(YEAR, (m || 1) - 1, d || 1).getTime() / 86400000);
}
function fmtDate(epochDay: number): string {
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

function weightLine(weights: WeighIn[], goal: Goal | null, seed: number): CoachLine | null {
  const clean = weights
    .filter(w => w.weight > 0)
    .map(w => ({ x: ddmmToEpochDay(w.day), y: Number(w.weight) }))
    .sort((a, b) => a.x - b.x);
  if (clean.length < 2) {
    return { icon: '⚖️', title: 'Building your trend', tone: 'neutral',
      body: 'A few more weigh-ins and I can show you exactly which way things are heading. Keep logging daily.' };
  }
  const window = clean.slice(-14);
  const slopePerDay = regressionSlope(window);
  const ratePerWeek = slopePerDay * 7;
  const latest = clean[clean.length - 1].y;
  const goalType = goal?.goalType ?? (goal?.targetWeight != null ? (goal.targetWeight < latest ? 'lose' : 'gain') : undefined);

  const absWk = Math.abs(ratePerWeek);
  const plateau = absWk < 0.05;
  const losing = ratePerWeek < 0;

  // No goal — just describe the trend kindly.
  if (!goal || goal.targetWeight == null || !goalType || goalType === 'maintain') {
    if (plateau) return { icon: '⚖️', title: 'Holding steady', tone: 'neutral', body: `You're stable around ${latest.toFixed(1)} kg. Consistency is its own win.` };
    return { icon: losing ? '📉' : '📈', title: losing ? 'Trending down' : 'Trending up', tone: 'neutral',
      body: `About ${absWk.toFixed(1)} kg/week ${losing ? 'down' : 'up'} lately — now at ${latest.toFixed(1)} kg.` };
  }

  const target = goal.targetWeight;
  const goingRightWay = (goalType === 'lose' && losing) || (goalType === 'gain' && !losing && !plateau);
  const remaining = Math.abs(latest - target);

  if (remaining <= 0.3) {
    return { icon: '🏆', title: 'Right on your goal', tone: 'good', body: `You're essentially at your ${target.toFixed(1)} kg target. Incredible — now let's hold it.` };
  }
  if (plateau) {
    return { icon: '🪨', title: 'A small plateau', tone: 'warn',
      body: pick([
        `The scale's been flat this week — totally normal. Trust the process; ${remaining.toFixed(1)} kg to go.`,
        `Plateaus happen to everyone. Tighten one thing today and the trend usually resumes within a week.`,
      ], seed) };
  }
  if (goingRightWay) {
    const weeksToGoal = remaining / absWk;
    const eta = ddmmToEpochDay(weights[weights.length - 1].day) + Math.round(weeksToGoal * 7);
    return { icon: '📉', title: `${absWk.toFixed(1)} kg/week — on track`, tone: 'good',
      body: `At this pace you'll hit ${target.toFixed(1)} kg around ${fmtDate(eta)}. ${remaining.toFixed(1)} kg to go — keep it steady.` };
  }
  // Moving the wrong way
  return { icon: '🧭', title: 'Drifting off course', tone: 'warn',
    body: pick([
      `The trend's nudging the wrong way this week. One solid day resets the momentum — you've got this.`,
      `Slightly off target lately. No drama — focus on today's basics and the line will turn.`,
    ], seed) };
}

/* ── Habit adherence ──────────────────────────────────────────────────────── */
interface HabitAnalysis { name: string; adherence: number; streak: number; misses: number; doneDays: number; elapsed: number; }

function analyseHabit(name: string, startDate: string | null, map: Record<string, Record<string, string | null>>, allDays: string[], todayIdx: number): HabitAnalysis {
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
  const elapsed = Math.max(1, todayIdx - startIdx + 1);
  // current streak (counting today if done, else from yesterday)
  let streak = 0;
  const todayDone = map[allDays[todayIdx]]?.[name] === 'done';
  let idx = todayDone ? todayIdx : todayIdx - 1;
  while (idx >= startIdx && map[allDays[idx]]?.[name] === 'done') { streak++; idx--; }
  // recent consecutive misses before today
  let misses = 0;
  for (let i = todayIdx - 1; i >= startIdx && i >= todayIdx - 7; i--) {
    if (map[allDays[i]]?.[name] !== 'done') misses++; else break;
  }
  return { name, adherence: doneDays / elapsed, streak, misses, doneDays, elapsed };
}

const TIPS: { match: RegExp; tip: string }[] = [
  { match: /walk|steps|10\s?k/i, tip: 'Try a 10-minute walk straight after a meal — it compounds faster than you\'d think.' },
  { match: /water|hydrat/i, tip: 'Keep a filled bottle in sight and sip before every task.' },
  { match: /read/i, tip: 'Read just one page tonight — momentum beats volume.' },
  { match: /gym|workout|exercise|train|lift/i, tip: 'Lay your kit out the night before to kill the friction.' },
  { match: /smok|vape/i, tip: 'When the urge hits, set a 5-minute timer — it usually passes before it ends.' },
  { match: /sugar|snack|junk|takeaway|take\s?away/i, tip: 'Swap one snack for fruit today. Small wins stack into big ones.' },
  { match: /sleep|bed/i, tip: 'Set a wind-down alarm 30 minutes before bed.' },
  { match: /medit|mindful|breath/i, tip: 'Two minutes of breathing counts — start tiny.' },
  { match: /porn|masturb|nofap/i, tip: 'Plan a replacement action for trigger moments — a walk, a call, anything that moves you.' },
  { match: /duolingo|language|learn|study/i, tip: 'Do one lesson on your commute — stack it onto something you already do.' },
  { match: /journal|write/i, tip: 'One sentence is a full entry today. Just open the page.' },
];
function tipFor(name: string): string {
  const hit = TIPS.find(t => t.match.test(name));
  return hit ? hit.tip : `Shrink it: do the tiniest possible version of "${name}" today, just to keep the chain alive.`;
}

/* ── Report assembly ──────────────────────────────────────────────────────── */
const HEADLINES_GOOD = ['You\'re on a roll', 'Momentum looks great', 'This is working', 'Strong week so far'];
const HEADLINES_MIXED = ['Solid effort — let\'s sharpen one thing', 'Good base, one tweak to go', 'You\'re in the game'];
const HEADLINES_TOUGH = ['Every comeback starts with one day', 'Reset and go again', 'Today\'s a fresh line'];
const CLOSING = [
  'Tiny, boring consistency wins. See you tomorrow. 💪',
  'Show up again tomorrow — that\'s the whole secret.',
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

  const daily = habits.filter(h => (h.cadence ?? 'daily') === 'daily' && h.name !== MANDATORY_HABIT);
  const analyses = daily.map(h => analyseHabit(h.name, h.startDate, map, allDays, todayIdx))
    .filter(a => a.elapsed >= 2);

  const lines: CoachLine[] = [];

  // 1) Weight
  const wl = weightLine(weights, goal, seed);
  if (wl) lines.push(wl);

  // 2) A win — longest live streak, else best adherence
  const byStreak = [...analyses].sort((a, b) => b.streak - a.streak);
  const win = byStreak[0];
  if (win && win.streak >= 2) {
    lines.push({ icon: '🔥', title: `${win.streak}-day ${win.name} streak`, tone: 'good',
      body: pick([`That streak is hard-earned — protect it today.`, `${win.name} is becoming who you are. Keep the chain alive.`], seed) });
  } else {
    const byAdh = [...analyses].sort((a, b) => b.adherence - a.adherence);
    if (byAdh[0] && byAdh[0].adherence >= 0.6) {
      lines.push({ icon: '✅', title: `Strong on ${byAdh[0].name}`, tone: 'good',
        body: `You're hitting it ${Math.round(byAdh[0].adherence * 100)}% of days. That's real consistency.` });
    }
  }

  // 3) A struggle — most recent misses, else lowest adherence (not the win)
  const candidates = analyses.filter(a => a.name !== win?.name);
  const struggle = candidates
    .filter(a => a.misses >= 2 || a.adherence < 0.5)
    .sort((a, b) => (b.misses - a.misses) || (a.adherence - b.adherence))[0];
  if (struggle) {
    const why = struggle.misses >= 2 ? `${struggle.misses} days missed in a row` : `only ${Math.round(struggle.adherence * 100)}% of days`;
    lines.push({ icon: '🎯', title: `Let's rescue ${struggle.name}`, tone: 'warn',
      body: `${why}. ${tipFor(struggle.name)}` });
  }

  // Walkies — Dub gets restless when momentum stalls (a real miss streak, or no
  // live wins at all). He'd love to be taken out.
  const stagnant = (struggle && struggle.misses >= 2) || (analyses.length > 0 && !analyses.some(a => a.streak >= 1));
  if (stagnant) {
    lines.push({ icon: '🦴', title: 'Dub wants a walk', tone: 'warn',
      body: pick([
        `Things have gone a bit quiet. Take me out — a short walk today is the easiest way to restart the momentum.`,
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

  return { emoji, headline, lines, closing: pick(CLOSING, seed), wantsWalk: stagnant };
}
