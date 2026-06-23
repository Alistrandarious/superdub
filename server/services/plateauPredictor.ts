// ─────────────────────────────────────────────────────────────────────────────
// Plateau / Stall predictor.
//
// A weighted score that flags when progress is stalling *before* it's obvious,
// and attributes a likely cause from the behavioural signals the app already
// collects: weight-trend deceleration (primary), plus steps, energy, mood, and
// logging consistency (secondary). It's a transparent additive model — every
// point of risk maps to a named factor the user can act on.
// ─────────────────────────────────────────────────────────────────────────────

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export interface StallSignal {
  risk: 'none' | 'low' | 'medium' | 'high';
  score: number;        // 0–1
  message: string;      // plain-English summary
  factors: string[];    // contributing causes, ordered by weight
  action: string;       // the single concrete thing to do about it
}

export function predictStall(params: {
  goalType: 'lose' | 'gain' | 'maintain';
  recentSlope: number | null;  // last ~10 days, kg/week
  priorSlope: number | null;   // the ~10 days before that, kg/week
  steps7: number | null;       // avg daily steps, last 7 days
  stepsPrev7: number | null;   // avg daily steps, the 7 days before
  energyAvg: number | null;    // 1–5, last ~7 check-ins
  moodAvg: number | null;      // 1–5, last ~7 check-ins
  loggingRate: number | null;  // fraction of recent days with a weigh-in, 0–1
}): StallSignal {
  const factors: { label: string; weight: number }[] = [];

  // ── Primary: weight-trend deceleration ──────────────────────────────────────
  // For a loss goal, "good" is a clearly negative slope. Stalling = the recent
  // rate is much weaker than the prior rate (you were losing, now you're not).
  if (params.goalType !== 'maintain' && params.recentSlope != null && params.priorSlope != null) {
    const sign = params.goalType === 'lose' ? -1 : 1;   // desired direction
    const recentProgress = sign * params.recentSlope;    // +ve = moving the right way
    const priorProgress = sign * params.priorSlope;
    if (priorProgress > 0.05) {
      // We were making real progress. How much of it have we kept?
      const retained = recentProgress / priorProgress;   // 1 = full pace, 0 = stalled
      const decel = clamp(1 - retained, 0, 1);            // 0 = fine, 1 = fully stalled
      if (decel > 0.35) factors.push({ label: `weight loss slowing (${Math.round(decel * 100)}% off recent pace)`, weight: 0.5 * decel });
    } else if (recentProgress <= 0.03) {
      // No prior progress and still flat → a sustained plateau
      factors.push({ label: 'weight has been flat', weight: 0.4 });
    }
  }

  // ── Secondary: activity dropped (steps) ─────────────────────────────────────
  if (params.steps7 != null && params.stepsPrev7 != null && params.stepsPrev7 > 500) {
    const drop = 1 - params.steps7 / params.stepsPrev7;
    if (drop > 0.15) factors.push({ label: `daily steps down ~${Math.round(drop * 100)}%`, weight: clamp(drop, 0, 0.4) * 0.6 });
  }

  // ── Secondary: low energy (metabolic adaptation / fatigue) ──────────────────
  if (params.energyAvg != null && params.energyAvg <= 2.6) {
    factors.push({ label: 'energy running low (possible metabolic adaptation)', weight: 0.18 });
  }

  // ── Secondary: low mood (adherence risk) ────────────────────────────────────
  if (params.moodAvg != null && params.moodAvg <= 2.4) {
    factors.push({ label: 'mood dipping — adherence at risk', weight: 0.12 });
  }

  // ── Secondary: logging dropped off (data going stale) ───────────────────────
  if (params.loggingRate != null && params.loggingRate < 0.5) {
    factors.push({ label: 'weigh-ins getting sparse — trend less reliable', weight: 0.15 });
  }

  const score = clamp(factors.reduce((s, f) => s + f.weight, 0), 0, 1);
  factors.sort((a, b) => b.weight - a.weight);
  const labels = factors.map(f => f.label);

  let risk: StallSignal['risk'] = 'none';
  if (score >= 0.6) risk = 'high';
  else if (score >= 0.35) risk = 'medium';
  else if (score >= 0.18) risk = 'low';

  let message: string;
  let action = '';
  if (risk === 'none') {
    message = 'No stall signals — progress and habits look healthy.';
  } else {
    const lead = labels[0] ?? 'progress slowing';
    const extra = labels.length > 1 ? `, plus ${labels.slice(1, 3).join(' and ')}` : '';
    const verdict = risk === 'high' ? 'Likely stalling' : risk === 'medium' ? 'Early stall signs' : 'Watch for a stall';
    message = `${verdict}: ${lead}${extra}.`;

    // One concrete next step, keyed off the dominant cause
    const top = labels[0] ?? '';
    if (top.includes('energy')) {
      action = 'Energy is low — a 3–5 day break at maintenance calories often restores it and breaks the stall.';
    } else if (top.includes('steps')) {
      action = 'Activity has dropped — get your daily steps back to your prior average before cutting calories.';
    } else if (top.includes('mood')) {
      action = 'Mood is dipping — hold calories steady and protect adherence rather than adding restriction.';
    } else if (top.includes('weigh-ins') || top.includes('sparse')) {
      action = 'Log your weight more consistently for a week so the trend is reliable before adjusting.';
    } else {
      action = 'Trend has slowed — tighten ~150 kcal/day, or take a planned refeed day if you have dieted 8+ weeks.';
    }
  }

  return { risk, score: +score.toFixed(2), message, factors: labels, action };
}
