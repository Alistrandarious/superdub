// Self-check for the plan engine (run: npx tsx server/services/planEngine.check.ts)
import assert from 'assert';
import {
  computeBMR, computeTDEE, computeEMA, weeklySlope, runCycle,
  detectMetabolicProtection, type Biometrics, type WeightPoint, type EMAPoint, type Goal,
} from './planEngine';

const bio: Biometrics = { weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityMultiplier: 1.55 };

// ── BMR / TDEE: Mifflin-St Jeor, sex-differentiated ─────────────────────────────
// male:   10*80 + 6.25*180 - 5*30 + 5   = 1780
// female: 10*80 + 6.25*180 - 5*30 - 161 = 1614
assert.strictEqual(computeBMR(bio), 1780);
assert.strictEqual(computeBMR({ ...bio, sex: 'female' }), 1614);
assert.strictEqual(computeTDEE(bio), Math.round(1780 * 1.55)); // 2759

// ── EMA: outlier readings are damped, not dropped ───────────────────────────────
const D0 = new Date('2026-01-01T00:00:00Z');
const mkPoint = (dayOffset: number, weight: number): WeightPoint => ({
  day: String(dayOffset), weight,
  date: new Date(D0.getTime() + dayOffset * 86400000),
});
const ema = computeEMA([mkPoint(0, 80), mkPoint(1, 80.2), mkPoint(2, 85)]);
assert.strictEqual(ema[0].ema, 80);            // seed = first raw
assert.strictEqual(ema[1].flagged, false);     // 0.25% move — normal
assert.strictEqual(ema[1].ema, 80.05);         // 0.25*80.2 + 0.75*80
assert.strictEqual(ema[2].flagged, true);      // >2.5% jump — flagged
// flagged point uses 1/5th alpha (0.05), so it barely moves the trend
assert.ok(ema[2].ema < 80.3, 'flagged reading should be damped');

// ── weeklySlope: linear regression scaled to kg/week ────────────────────────────
assert.strictEqual(weeklySlope([]), null);
assert.strictEqual(weeklySlope([{ day: '0', date: D0, raw: 80, ema: 80, flagged: false }]), null);
const flat: EMAPoint[] = [
  { day: '0', date: D0, raw: 80, ema: 80, flagged: false },
  { day: '7', date: new Date(D0.getTime() + 7 * 86400000), raw: 80, ema: 80, flagged: false },
];
assert.strictEqual(weeklySlope(flat), 0);
const losing: EMAPoint[] = [
  { day: '0', date: D0, raw: 80, ema: 80, flagged: false },
  { day: '7', date: new Date(D0.getTime() + 7 * 86400000), raw: 79.9, ema: 79.9, flagged: false },
];
assert.strictEqual(weeklySlope(losing), -0.1); // -0.1 kg over 1 week

// ── runCycle: needs 2+ points ───────────────────────────────────────────────────
const goal: Goal = {
  id: 'g1', goalType: 'lose', startWeight: 82, startDate: D0,
  targetWeight: 76, targetDate: new Date(Date.now() + 8 * 7 * 86400000), ratePctBw: 0.005,
};
const single: EMAPoint[] = [{ day: '0', date: D0, raw: 80, ema: 80, flagged: false }];
const noData = runCycle(goal, 2000, single, bio);
assert.strictEqual(noData.shouldAdjust, false);
assert.strictEqual(noData.actualSlope, null);
assert.match(noData.reason, /at least 2/);

// ── runCycle: on pace → no adjustment (within tolerance deadband) ────────────────
// latestEMA 80 == targetWeight 80 → targetSlope 0; flat actual → gap 0.
const onPaceGoal: Goal = { ...goal, targetWeight: 80 };
const onPace = runCycle(onPaceGoal, 2000, flat, bio);
assert.strictEqual(onPace.onTrack, true);
assert.strictEqual(onPace.shouldAdjust, false);
assert.strictEqual(onPace.newCalories, 2000);

// ── runCycle: behind pace → cut calories, capped at 40% of rate's kcal equiv ─────
// latestEMA 79.9, target 76, 8 wks → targetSlope ≈ -0.4875; actual -0.1 → behind.
const behind = runCycle(goal, 2000, losing, bio);
assert.strictEqual(behind.onTrack, false);
assert.strictEqual(behind.shouldAdjust, true);
assert.ok(behind.newCalories < 2000, 'behind pace should reduce calories');
// maxAdj = round(0.005*80*7700/7*0.40) = 176 → 2000 - 176 = 1824
assert.strictEqual(behind.newCalories, 1824);
assert.match(behind.reason, /Reduced/);

// ── runCycle: never prescribes below BMR floor ──────────────────────────────────
const atFloor = runCycle(goal, computeBMR(bio), losing, bio);
assert.strictEqual(atFloor.newCalories, computeBMR(bio));
assert.match(atFloor.reason, /BMR floor/);

// ── detectMetabolicProtection: needs 2+ weeks of data ───────────────────────────
assert.strictEqual(detectMetabolicProtection(losing, 80), false); // too few points
// 3 weeks losing ~2 kg/wk (2.5% BW) → sustained over-velocity → true
const fast: EMAPoint[] = Array.from({ length: 21 }, (_, i) => ({
  day: String(i), date: new Date(D0.getTime() + i * 86400000),
  raw: 80 - i * 0.28, ema: 80 - i * 0.28, flagged: false,
}));
assert.strictEqual(detectMetabolicProtection(fast, 80), true);

// ── Coming back after a long quiet stretch ─────────────────────────────────────
// Logs daily, disappears for eleven weeks, returns 3 kg heavier. The old engine
// called that reading an outlier and kept prescribing for the body they used to
// have; the trend must land on the body standing on the scale today.
const returned = computeEMA([
  mkPoint(0, 90), mkPoint(1, 89.9), mkPoint(2, 89.8), mkPoint(3, 89.7),
  mkPoint(80, 93),
]);
const back = returned[returned.length - 1];
assert.strictEqual(back.flagged, false, 'a 3% change over eleven weeks is a body, not an outlier');
assert.ok(Math.abs(back.ema - 93) < 0.01, 'the weigh-in back re-anchors the trend');

// The rate is measured from the return onwards, never smeared across the silence.
assert.strictEqual(weeklySlope(returned), null, 'one point since the break is not a trend');
const settled = computeEMA([
  mkPoint(0, 90), mkPoint(1, 89.9), mkPoint(80, 93), mkPoint(87, 92.5), mkPoint(94, 92),
]);
const rate = weeklySlope(settled);
assert.ok(rate !== null && rate < 0 && rate > -1.2, `post-gap rate is the real one, got ${rate}`);

// Same-day-scale noise is still smoothed away — the fix must not un-smooth normal use.
const noisy = computeEMA([mkPoint(0, 90), mkPoint(1, 92)]);
assert.ok(noisy[1].ema < 90.6, 'an overnight jump still barely moves the trend');

console.log('planEngine: all checks passed');
