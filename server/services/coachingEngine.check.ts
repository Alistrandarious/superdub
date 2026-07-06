// Self-check for the coaching engine (run: npx tsx server/services/coachingEngine.check.ts)
import assert from 'assert';
import {
  getEnergyBand, getTrendStatus, getCoachingMessage,
  type TrendStatus, type Adherence, type EnergyBand, type CoachingInput,
} from './coachingEngine';

// ── getEnergyBand: 4-5 high, 2-3 mid, 1 low ─────────────────────────────────────
assert.strictEqual(getEnergyBand(5), 'high');
assert.strictEqual(getEnergyBand(4), 'high');
assert.strictEqual(getEnergyBand(3), 'mid');
assert.strictEqual(getEnergyBand(2), 'mid');
assert.strictEqual(getEnergyBand(1), 'low');

// ── getTrendStatus: direction-aware ─────────────────────────────────────────────
assert.strictEqual(getTrendStatus(false, null, -0.5, 'lose'), 'none');   // no actual data
assert.strictEqual(getTrendStatus(false, -0.5, -0.5, null), 'none');     // no goal
assert.strictEqual(getTrendStatus(true, -0.1, -0.5, 'lose'), 'on-track'); // onTrack wins
// losing faster than target = ahead; slower = behind
assert.strictEqual(getTrendStatus(false, -0.8, -0.5, 'lose'), 'ahead');
assert.strictEqual(getTrendStatus(false, -0.2, -0.5, 'lose'), 'behind');
// gaining: more positive than target = ahead
assert.strictEqual(getTrendStatus(false, 0.8, 0.5, 'gain'), 'ahead');
assert.strictEqual(getTrendStatus(false, 0.2, 0.5, 'gain'), 'behind');

const base: CoachingInput = {
  trend: 'on-track', adherence: 'about', energyBand: 'high',
  churnRisk: 'NONE', streakDays: 12, kgToGoal: 3, newTarget: 2100,
};

// ── math correction outranks everything (accuracy before motivation) ────────────
assert.strictEqual(
  getCoachingMessage({ ...base, churnRisk: 'CRITICAL', mathCorrection: 'Check your logged weight.' }),
  'Check your logged weight.'
);

// ── empathy mode on high churn — never a trend template, no placeholders ─────────
for (const risk of ['HIGH', 'CRITICAL'] as const) {
  const msg = getCoachingMessage({ ...base, churnRisk: risk });
  assert.ok(msg.length > 0);
  assert.ok(!msg.includes('{'), 'empathy templates carry no interpolation slots');
}

// ── fallback ladder always resolves + interpolation runs ─────────────────────────
// Every combination must yield a non-empty message with no unfilled {slots}.
// pick() is date-seeded, so we can't pin one key's variant; instead assert the
// invariant across the whole matrix — and that streakDays lands in at least one
// (slotted templates exist at both dayOfYear parities, so this holds on any day).
const trends: TrendStatus[] = ['ahead', 'on-track', 'behind', 'none'];
const adherences: (Adherence | null)[] = ['above', 'about', 'below', null];
const bands: (EnergyBand | null)[] = ['high', 'mid', 'low', null];
let anyStreakInterpolated = false;
for (const trend of trends) {
  for (const adherence of adherences) {
    for (const energyBand of bands) {
      const msg = getCoachingMessage({ ...base, trend, adherence, energyBand });
      assert.ok(msg.length > 0, `empty message for ${trend}|${adherence}|${energyBand}`);
      assert.ok(!msg.includes('{'), `unfilled slot in ${trend}|${adherence}|${energyBand}: ${msg}`);
      if (msg.includes('12')) anyStreakInterpolated = true;
    }
  }
}
assert.ok(anyStreakInterpolated, 'streakDays should be interpolated into at least one template');

console.log('coachingEngine: all checks passed');
