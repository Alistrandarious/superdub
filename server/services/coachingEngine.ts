// Template-based coaching engine — no LLM calls anywhere in this file.
// Keys are (trend × adherence × energyBand), looked up with graceful fallbacks.

import type { ChurnRisk } from './churnRisk';

export type TrendStatus = 'ahead' | 'on-track' | 'behind' | 'none';
export type Adherence = 'above' | 'about' | 'below';
export type EnergyBand = 'high' | 'mid' | 'low';

export interface CoachingInput {
  trend: TrendStatus;
  adherence: Adherence | null;
  energyBand: EnergyBand | null;
  churnRisk: ChurnRisk;
  streakDays: number;
  kgToGoal: number | null;   // signed: positive = still above target weight
  newTarget: number | null;  // current prescribed kcal
}

export function getEnergyBand(energy: number): EnergyBand {
  if (energy >= 4) return 'high';
  if (energy >= 2) return 'mid';
  return 'low';
}

// Derive trend from plan cycle output.
// actualSlope is kg/week (negative = losing). targetSlope similarly signed.
export function getTrendStatus(
  onTrack: boolean,
  actualSlope: number | null,
  targetSlope: number,
  goalType: 'lose' | 'gain' | 'maintain' | null,
): TrendStatus {
  if (goalType === null || actualSlope === null) return 'none';
  if (onTrack) return 'on-track';
  if (goalType === 'lose') {
    // more negative actual = losing faster = ahead
    return actualSlope < targetSlope ? 'ahead' : 'behind';
  }
  if (goalType === 'gain') {
    return actualSlope > targetSlope ? 'ahead' : 'behind';
  }
  return 'on-track';
}

// ── Empathy bank ──────────────────────────────────────────────────────────────
// Shown when churn risk is HIGH or CRITICAL — bypasses all trend/adherence logic.
const EMPATHY_TEMPLATES = [
  "You've done this before. No pressure, no pace — just check in when you're ready.",
  "Rest is part of the work. The numbers will be here when you come back.",
  "Every streak started with a day-one. This can be yours again whenever.",
  "No guilt here. Life gets full. You showed up today — that counts.",
  "Your body's keeping score even when the app isn't open. Come back at your own pace.",
  "Low-energy weeks are real data too. The engine will recalibrate when you're ready.",
];

// ── Main template table ───────────────────────────────────────────────────────
// key = `${trend}|${adherence}|${energyBand}`
// Slots: {streakDays}, {kgToGoal}, {newTarget}
const TEMPLATES: Record<string, string[]> = {
  'behind|above|high': [
    "Trending a little behind pace while eating above target — the engine will likely tighten the prescription next cycle. One dialled-in day resets a lot.",
    "Behind pace, energy high, portions running over — a small recalibration now pays off in three weeks.",
  ],
  'behind|above|mid': [
    "Behind target pace and eating above — worth one deliberate day to get back in range.",
    "Pace is slow and intake is high. No emergency, but tightening for a day or two has a disproportionate effect.",
  ],
  'behind|above|low': [
    "You're behind pace and energy is low — rest first, then one tighter day. Don't pile pressure on a depleted week.",
  ],
  'behind|about|high': [
    "Behind pace but adherence is right and you're feeling good — could be water, could be timing. Hold the line.",
    "Trending slow despite doing everything right. The engine will nudge the prescription next cycle; trust the data.",
  ],
  'behind|about|mid': [
    "Pace is off but intake looks fine — one more week of data before adjusting anything.",
    "A bit behind schedule with consistent eating. Give it another cycle before reading too much into it.",
  ],
  'behind|about|low': [
    "Behind pace and energy is low — that's often water weight and fatigue compounding. Rest well tonight.",
  ],
  'behind|below|high': [
    "Eating under target and still behind pace — the engine reads this as your baseline being lower than estimated. Stay consistent and it will recalibrate.",
    "Under target, behind pace, energy high — classic sign of a TDEE underestimate. The engine will close the gap.",
  ],
  'behind|below|mid': [
    "Under target and behind pace. Could be TDEE variance or recovery from a hard stretch. Hold steady.",
  ],
  'behind|below|low': [
    "Eating under target, behind pace, and energy is low — this week sounds hard. Rest, eat enough, the pace conversation can wait.",
  ],
  'ahead|above|high': [
    "Ahead of pace while eating above target — that combination won't hold long. One steadier day is worth more than pushing further ahead.",
    "Moving faster than planned and eating high. Fast drops often bounce. A slightly slower week here is an investment.",
  ],
  'ahead|above|mid': [
    "Ahead of pace even with higher intake — your TDEE may have been underestimated. The engine will factor this in.",
    "Good week. Ahead of target despite higher portions — the prescription will likely move upward next cycle.",
  ],
  'ahead|about|high': [
    "Right on adherence, ahead of schedule, energy is high — {streakDays} days in and the system is working. Don't change anything.",
    "On track with everything and ahead of pace. This is exactly what consistent looks like.",
  ],
  'ahead|about|mid': [
    "Ahead of pace with consistent intake. Let the week play out — no adjustments needed.",
  ],
  'ahead|below|high': [
    "Ahead of pace and eating under target — you may be under-fuelling. The engine will raise the prescription; accept the extra calories.",
  ],
  'ahead|below|mid': [
    "Moving ahead of pace while eating below target. Sustainable in the short term; the engine will raise the prescription soon.",
  ],
  'on-track|about|high': [
    "Right on pace, right on portions, feeling great — nothing to change. {streakDays} days in and building.",
    "Textbook week. On pace, on track, high energy. Keep the routine going.",
  ],
  'on-track|about|mid': [
    "On pace with consistent intake. Solid week — nothing to flag.",
    "{streakDays} days in and on schedule. Consistency is the whole strategy.",
  ],
  'on-track|above|high': [
    "On pace even eating above target — your metabolism may be running higher than modelled. No action needed.",
  ],
  'on-track|above|mid': [
    "On pace despite higher intake. Hold this pace and the engine will factor the surplus into next cycle.",
  ],
  'on-track|below|high': [
    "On pace while eating under target — the engine will likely raise your prescription. Don't resist the extra fuel.",
  ],
  'on-track|below|mid': [
    "On pace and eating under target. Sustainable? Keep an eye on energy levels — fuelling enough matters.",
  ],
  'none|about|high': [
    "No goal set yet, but you're consistent and feeling good — the foundation is there whenever you want the engine to calibrate around your results.",
    "High energy, consistent adherence, no goal set. Go to Plans when you're ready to put a target on it.",
  ],
  'none|about|mid': [
    "Showing up consistently is the work — the data is building. Set a goal whenever you're ready.",
  ],
  'none|above|high': [
    "Energy high, eating above self-target — set a goal in Plans to give the engine something to calibrate against.",
  ],
  'none|below|mid': [
    "Eating under your own target without a goal set. When you're ready, the engine can help make that intentional.",
  ],
  'none|null|high': [
    "High energy today — a good day to check in with your goal if you have one, or set one if you don't.",
  ],
  'none|null|mid': [
    "Solid check-in. The engine is ready whenever you set a weight goal.",
  ],
  'none|null|low': [
    "Rest is valid data. Low-energy days are part of the pattern, not the whole picture.",
  ],
};

function dayOfYear(): number {
  const now = new Date();
  return Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
}

function pick(templates: string[]): string {
  return templates[dayOfYear() % templates.length];
}

function interpolate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

export function getCoachingMessage(input: CoachingInput): string {
  const { trend, adherence, energyBand, churnRisk, streakDays, kgToGoal, newTarget } = input;

  // Empathy mode overrides everything
  if (churnRisk === 'HIGH' || churnRisk === 'CRITICAL') {
    return EMPATHY_TEMPLATES[dayOfYear() % EMPATHY_TEMPLATES.length];
  }

  const aKey = adherence ?? 'null';
  const eKey = energyBand ?? 'null';

  // Fallback ladder: exact match → energy fallback → adherence fallback → trend-only → last resort
  const candidates = [
    `${trend}|${aKey}|${eKey}`,
    `${trend}|${aKey}|mid`,
    `${trend}|about|${eKey}`,
    `${trend}|about|mid`,
    `none|null|mid`,
  ];

  let template: string | undefined;
  for (const key of candidates) {
    const t = TEMPLATES[key];
    if (t?.length) { template = pick(t); break; }
  }

  if (!template) template = 'Keep going. Consistency is the whole strategy.';

  return interpolate(template, {
    streakDays: String(streakDays),
    kgToGoal: kgToGoal != null ? `${Math.abs(kgToGoal).toFixed(1)} kg` : '',
    newTarget: newTarget != null ? String(newTarget) : '',
  });
}
