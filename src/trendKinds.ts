// =====================================================================
// SUPERDUB — Trend sheet logic (pure, no React)
// The home "WHERE YOU'RE TRENDING" strip taps into a detail sheet. This
// maps the coach's weight verdict (coach.ts weightLine → report.lines[0])
// to: which "kind" of trend it is, the fallback next-step when the server
// stall signal is silent, and which action buttons to show.
// Kept React-free so trendSheet.check.ts can exercise it directly.
// =====================================================================

export type TrendKind = 'drift' | 'plateau' | 'ontrack' | 'goal' | 'trending' | 'holding' | 'building';
export type TrendAct = 'checkin' | 'plan' | 'maths' | 'coach';
export interface TrendButton { label: string; act: TrendAct; }

// Classify from the verdict TITLE (the one string every surface already shows),
// so the sheet never needs to re-derive goal/plateau/direction itself.
export function classifyTrend(title: string): TrendKind {
  const t = title.toLowerCase();
  if (t.includes('drifting')) return 'drift';
  if (t.includes('plateau')) return 'plateau';
  if (t.includes('right on')) return 'goal';
  if (t.includes('on track')) return 'ontrack';
  if (t.includes('building')) return 'building';
  if (t.includes('holding')) return 'holding';
  return 'trending'; // "Trending up" / "Trending down"
}

// The single concrete next step when the server stall signal has none (good /
// neutral states, or no active plan). For warn states with a live stall signal
// we prefer plan.stall.action — see resolveAction.
export const FALLBACK_ACTION: Record<TrendKind, string> = {
  drift: 'One solid day resets the momentum. Log today and nudge your steps back up.',
  plateau: 'Tighten one thing today, or take a planned refeed if you have dieted 8+ weeks.',
  ontrack: "Keep it steady. You're doing the thing that works.",
  goal: 'Switch to maintain so I track holding, not losing.',
  trending: "Set a target and I'll tell you if this pace gets you there.",
  holding: "Set a goal and I'll track you against it.",
  building: "Weigh in daily for a few days and I'll show you exactly which way things head.",
};

export const TREND_BUTTONS: Record<TrendKind, TrendButton[]> = {
  drift: [{ label: 'Log weight', act: 'checkin' }, { label: 'My plan', act: 'plan' }, { label: 'Talk to Dub', act: 'coach' }],
  plateau: [{ label: 'My plan', act: 'plan' }, { label: 'Log a check-in', act: 'checkin' }, { label: 'Talk to Dub', act: 'coach' }],
  ontrack: [{ label: 'Log weight', act: 'checkin' }, { label: 'My plan', act: 'plan' }],
  goal: [{ label: 'Switch to maintain', act: 'plan' }, { label: 'Talk to Dub', act: 'coach' }],
  trending: [{ label: 'Set a goal', act: 'plan' }, { label: 'See the maths', act: 'maths' }],
  holding: [{ label: 'Set a goal', act: 'plan' }, { label: 'Talk to Dub', act: 'coach' }],
  building: [{ label: 'Log weight', act: 'checkin' }, { label: 'How trends work', act: 'maths' }],
};

// Prefer the server's own concrete fix, but only for the warn states it was
// written for (drift / plateau) and only when it actually produced one
// (predictStall returns action '' at risk 'none'). Otherwise the fallback.
export function resolveAction(kind: TrendKind, tone: 'good' | 'warn' | 'neutral', stallAction: string | null | undefined): string {
  if (tone === 'warn' && stallAction && stallAction.trim()) return stallAction.trim();
  return FALLBACK_ACTION[kind];
}
