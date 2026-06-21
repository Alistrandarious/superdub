// ─────────────────────────────────────────────────────────────────────────────
// Plan Engine — pure calculation functions, no DB access.
//
// Design: proportional-feedback loop. The engine observes weight trend (EMA),
// compares the actual weekly rate to the required rate from the active goal,
// and adjusts the prescribed calorie target to close the gap. It does NOT need
// to know what the user ate — the weight trend is the observable output of
// their energy balance, whatever the cause.
//
// V1: trend vs goal only (activity-adjusted correction is V1.1).
// ─────────────────────────────────────────────────────────────────────────────

export interface WeightPoint {
  day: string;   // DD/MM
  weight: number;
  date: Date;
}

export interface EMAPoint {
  day: string;
  date: Date;
  raw: number;
  ema: number;
  flagged: boolean; // >2.5% overnight swing — physically implausible, reduced EMA influence
}

export interface Biometrics {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
  activityMultiplier: number; // e.g. 1.55
}

export interface Goal {
  id: string;
  goalType: 'lose' | 'gain' | 'maintain';
  startWeight: number;
  startDate: Date;
  targetWeight: number;
  targetDate: Date;
  ratePctBw: number; // chosen rate as fraction of body weight per week (e.g. 0.005 = 0.5%)
}

export interface CycleResult {
  shouldAdjust: boolean;
  newCalories: number;
  prevCalories: number;
  reason: string;
  actualSlope: number | null;  // kg/week, negative = losing
  targetSlope: number;          // kg/week required to reach goal on time
  onTrack: boolean;
  bmrFloor: number;
  flaggedDays: string[];        // DD/MM entries with implausible overnight swings
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EMA_ALPHA = 0.25;        // smoothing constant (~3-4 day effective window)
const OUTLIER_PCT = 0.025;     // >2.5% overnight change = flagged
const OUTLIER_ALPHA = EMA_ALPHA * 0.2; // flagged points get 1/5th the normal pull
const TOLERANCE_PCT_BW = 0.001; // 0.1% body weight per week tolerance band
const KCAL_PER_KG = 7700;      // approximate energy density of body fat
const MAX_ADJ_FRACTION = 0.40; // correction capped at 40% of weekly rate's kcal equivalent

// ── BMR / TDEE ────────────────────────────────────────────────────────────────

// Mifflin-St Jeor, sex-differentiated. Inputs from profile table.
// This is the safe minimum floor — going below this means the deficit
// is being filled by lean mass and organ tissue, not fat stores.
export function computeBMR({ weightKg, heightCm, age, sex }: Biometrics): number {
  const offset = sex === 'female' ? -161 : 5;
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + offset);
}

export function computeTDEE(bio: Biometrics): number {
  return Math.round(computeBMR(bio) * bio.activityMultiplier);
}

// ── EMA trend smoothing ───────────────────────────────────────────────────────

export function computeEMA(points: WeightPoint[]): EMAPoint[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  const out: EMAPoint[] = [];
  let ema = sorted[0].weight;
  out.push({ day: sorted[0].day, date: sorted[0].date, raw: sorted[0].weight, ema, flagged: false });

  for (let i = 1; i < sorted.length; i++) {
    const w = sorted[i].weight;
    // Flag if the raw reading jumps more than OUTLIER_PCT from the running EMA.
    // These aren't silently dropped — they're included with reduced weight so
    // a genuine large change still moves the trend, just more slowly.
    const flagged = Math.abs(w - ema) / ema > OUTLIER_PCT;
    const alpha = flagged ? OUTLIER_ALPHA : EMA_ALPHA;
    ema = +(alpha * w + (1 - alpha) * ema).toFixed(3);
    out.push({ day: sorted[i].day, date: sorted[i].date, raw: w, ema, flagged });
  }
  return out;
}

// ── Trend slope from EMA series ───────────────────────────────────────────────

// Linear regression over (days-since-first, ema) → slope in kg/day → scaled to kg/week.
export function weeklySlope(emaPoints: EMAPoint[]): number | null {
  if (emaPoints.length < 2) return null;
  const t0 = emaPoints[0].date.getTime();
  const xs = emaPoints.map(p => (p.date.getTime() - t0) / 86400000);
  const ys = emaPoints.map(p => p.ema);
  const n = xs.length;
  const sx = xs.reduce((a, x) => a + x, 0);
  const sy = ys.reduce((a, y) => a + y, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sx2 = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sx2 - sx * sx;
  if (denom === 0) return 0;
  const slopePerDay = (n * sxy - sx * sy) / denom;
  return +(slopePerDay * 7).toFixed(4); // kg/week
}

// ── Adjustment cycle ──────────────────────────────────────────────────────────

export function runCycle(
  goal: Goal,
  currentCalories: number,
  emaPoints: EMAPoint[],
  bio: Biometrics,
): CycleResult {
  const bmrFloor = computeBMR(bio);
  const flaggedDays = emaPoints.filter(p => p.flagged).map(p => p.day);

  // Required weekly rate from what's left to reach the goal on time.
  // Recomputed every cycle from current EMA (not locked at goal-creation slope).
  const msLeft = goal.targetDate.getTime() - Date.now();
  const weeksLeft = msLeft / (7 * 86400000);
  const latestEMA = emaPoints.length > 0 ? emaPoints[emaPoints.length - 1].ema : goal.startWeight;
  const targetSlope = weeksLeft > 0 ? (goal.targetWeight - latestEMA) / weeksLeft : 0;

  // Tolerance: 0.1% of current body weight per week.
  // Scales with body size — a larger person has proportionally larger
  // natural fluctuations, so the deadband grows with them.
  const tolerance = bio.weightKg * TOLERANCE_PCT_BW;

  const actualSlope = weeklySlope(emaPoints);

  if (actualSlope === null) {
    return {
      shouldAdjust: false, newCalories: currentCalories, prevCalories: currentCalories,
      reason: 'Not enough weight data — log at least 2 weigh-ins to start the engine',
      actualSlope: null, targetSlope, onTrack: false, bmrFloor, flaggedDays,
    };
  }

  const gap = actualSlope - targetSlope; // +ve = actual is less aggressive than needed
  const onTrack = Math.abs(gap) <= tolerance;

  if (onTrack) {
    return {
      shouldAdjust: false, newCalories: currentCalories, prevCalories: currentCalories,
      reason: `On pace — trending ${fmtRate(actualSlope)} kg/wk, target ${fmtRate(targetSlope)} kg/wk`,
      actualSlope, targetSlope, onTrack: true, bmrFloor, flaggedDays,
    };
  }

  // Correction ceiling: 40% of the weekly caloric equivalent of the user's chosen rate.
  // Proportional to both body weight and aggressiveness — a gentle-rate user gets a
  // smaller per-cycle swing than an aggressive-rate user.
  const maxAdj = Math.round(goal.ratePctBw * bio.weightKg * KCAL_PER_KG / 7 * MAX_ADJ_FRACTION);

  // Raw correction: how many kcal/day deficit change would close the gap in one week.
  const rawAdj = Math.round((gap * KCAL_PER_KG) / 7);
  const adj = Math.sign(rawAdj) * Math.min(Math.abs(rawAdj), maxAdj);

  let newCal = Math.round(currentCalories - adj);
  newCal = Math.max(newCal, bmrFloor); // never below BMR

  if (newCal === currentCalories) {
    return {
      shouldAdjust: false, newCalories: currentCalories, prevCalories: currentCalories,
      reason: 'At BMR floor — cannot reduce further without risking lean mass',
      actualSlope, targetSlope, onTrack: false, bmrFloor, flaggedDays,
    };
  }

  const dir = adj > 0 ? 'Reduced' : 'Increased';
  const diff = Math.abs(currentCalories - newCal);
  const paceWord = gap > 0 ? 'behind' : 'ahead of';
  const reason = `${dir} by ${diff} kcal/day — ${paceWord} pace by ${Math.abs(gap).toFixed(2)} kg/wk`
    + ` (actual ${fmtRate(actualSlope)} vs target ${fmtRate(targetSlope)} kg/wk)`;

  return {
    shouldAdjust: true, newCalories: newCal, prevCalories: currentCalories,
    reason, actualSlope, targetSlope, onTrack: false, bmrFloor, flaggedDays,
  };
}

function fmtRate(n: number): string {
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}`;
}
