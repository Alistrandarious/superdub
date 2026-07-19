// Self-check for the journey chart's EMA + projection math (run: npx tsx src/PlanJourneyChart.check.ts)
import assert from 'assert';
import { buildJourneySeries, JourneyGoal, localDayMs } from './journeyMath';

const goal: JourneyGoal = {
  goalType: 'lose',
  startWeight: 88,
  startDate: '2026-06-01T00:00:00.000Z',
  targetWeight: 78,
  targetDate: '2026-09-12T00:00:00.000Z',
};

// Three sparse weigh-ins across the goal-start → today window (1 Jun → 1 Jul).
const days = [
  { day: '01/06', weight: '88.0' },
  { day: '15/06', weight: '86.0' },
  { day: '01/07', weight: '84.0' },
];
const now = new Date(2026, 6, 1); // 1 Jul 2026, local midnight

const s = buildJourneySeries(days, goal, now);

// α=0.25 EMA: 88 → 0.25*86+0.75*88=87.5 → 0.25*84+0.75*87.5=86.625
assert.strictEqual(s.points, 3, 'uses all three logged weigh-ins');
assert.strictEqual(s.data[0].ema, 88, 'first EMA equals first weigh-in');
assert.strictEqual(s.data[14].ema, 87.5, 'second EMA smoothed to 87.5');
assert.ok(Math.abs((s.data[30].ema ?? 0) - 86.625) < 0.01, 'third EMA ≈ 86.625');
assert.ok(s.data[1].ema === null, 'gap day between weigh-ins has no EMA');

// "Now" anchor = the last EMA point, at today's label.
assert.strictEqual(s.nowLabel, '01/07', 'now anchored to the last weigh-in day');
assert.ok(Math.abs((s.nowValue ?? 0) - 86.625) < 0.01, 'nowValue is the last EMA');
assert.strictEqual(s.data[30].projection, s.nowValue, 'projection line joins the EMA at now');

// Smoothed weekly trend from the regression (slope*7 ≈ -0.93 kg/wk).
assert.strictEqual(s.weeklyRate, -0.93, 'weekly trend rate is -0.93 kg/wk');

// Projection runs to the target date and heads downward (losing).
const last = s.data[s.data.length - 1];
assert.strictEqual(s.targetLabel, '12/09', 'projection reaches the target date');
assert.strictEqual(last.label, '12/09', 'last point is the target date');
assert.ok(last.ema === null && typeof last.projection === 'number', 'target point is projection-only');
assert.ok((last.projection ?? 99) < (s.nowValue ?? 0), 'projection trends below current weight');
assert.ok(Math.abs((last.projection ?? 0) - 76.9) < 0.3, 'projection endpoint ≈ 76.9 kg');

// UTC ISO start date parses to LOCAL midnight (no DST day-drop).
assert.strictEqual(localDayMs('2026-06-01T00:00:00.000Z'), new Date(2026, 5, 1).getTime(), 'ISO parsed to local midnight');

// No weigh-ins → no trend, no projection, but a labelled empty series.
const empty = buildJourneySeries([], goal, now);
assert.strictEqual(empty.points, 0, 'empty input yields zero points');
assert.strictEqual(empty.weeklyRate, null, 'no rate without data');
assert.strictEqual(empty.nowLabel, null, 'no now anchor without data');
assert.ok(empty.data.every(d => d.projection === null), 'no projection without a trend');

// Single weigh-in → not enough for a regression, so no projection.
const one = buildJourneySeries([{ day: '01/07', weight: '84.0' }], goal, now);
assert.strictEqual(one.points, 1, 'counts the single weigh-in');
assert.strictEqual(one.weeklyRate, null, 'one point is not a trend');
assert.ok(one.data.every(d => d.projection === null), 'one point draws no projection');

console.log('PlanJourneyChart.check.ts — all assertions passed');
