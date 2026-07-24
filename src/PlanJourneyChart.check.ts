// Self-check for the journey chart's EMA + projection math (run: npx tsx src/PlanJourneyChart.check.ts)
import assert from 'assert';
import { buildJourneySeries, JourneyGoal, localDayMs } from './journeyMath';
import { emaStep, sinceLastGap, GAP_DAYS } from './weightMath';

const goal: JourneyGoal = {
  goalType: 'lose',
  startWeight: 88,
  startDate: '2026-06-01T00:00:00.000Z',
  targetWeight: 78,
  targetDate: '2026-09-12T00:00:00.000Z',
};

// Weekly weigh-ins across the goal-start → today window (1 Jun → 1 Jul).
const days = [
  { day: '01/06', weight: '88.0' },
  { day: '08/06', weight: '87.0' },
  { day: '15/06', weight: '86.0' },
  { day: '22/06', weight: '85.0' },
  { day: '01/07', weight: '84.0' },
];
const now = new Date(2026, 6, 1); // 1 Jul 2026, local midnight

const s = buildJourneySeries(days, goal, now);

assert.strictEqual(s.points, 5, 'uses all five logged weigh-ins');
assert.strictEqual(s.data[0].ema, 88, 'first EMA equals first weigh-in');

// A weekly weigh-in pulls seven days' worth of smoothing, not one.
const wk = emaStep(88, 87, 7);
assert.ok(Math.abs(wk - (1 - 0.75 ** 7) * 87 - 0.75 ** 7 * 88) < 1e-9, 'alpha compounds over elapsed days');
assert.ok(Math.abs((s.data[7].ema ?? 0) - +wk.toFixed(2)) < 0.01, 'second EMA uses the 7-day pull');

// Days between two weigh-ins are bridged, so a normal week draws as one line.
assert.ok(s.data[1].ema !== null, 'a day between weigh-ins is bridged');
assert.ok((s.data[1].ema ?? 0) < 88 && (s.data[1].ema ?? 0) > (s.data[7].ema ?? 0), 'bridge interpolates between the two');

// "Now" anchor = the last EMA point, at today's label.
assert.strictEqual(s.nowLabel, '01/07', 'now anchored to the last weigh-in day');
assert.strictEqual(s.data[30].projection, s.nowValue, 'projection line joins the EMA at now');
assert.ok((s.weeklyRate ?? 0) < 0, 'weekly trend is losing');

// Projection runs to the target date and heads downward (losing).
const last = s.data[s.data.length - 1];
assert.strictEqual(s.targetLabel, '12/09', 'projection reaches the target date');
assert.ok(last.ema === null && typeof last.projection === 'number', 'target point is projection-only');
assert.ok((last.projection ?? 99) < (s.nowValue ?? 0), 'projection trends below current weight');

// ── The long quiet stretch ────────────────────────────────────────────────
// Weighs in daily, vanishes for six weeks, comes back heavier than they left.
const lapsed = [
  { day: '01/06', weight: '88.0' },
  { day: '02/06', weight: '87.9' },
  { day: '03/06', weight: '87.8' },
  { day: '01/07', weight: '91.0' },
];
const g = buildJourneySeries(lapsed, goal, now);

// The weigh-in back IS the trend — it is not averaged against who they were.
assert.ok(Math.abs((g.nowValue ?? 0) - 91) < 0.25, 'the weigh-in back re-anchors the trend, not 88-ish');
assert.ok((g.nowValue ?? 0) > 90, 'the chart shows the weight they actually are');

// The line breaks over the quiet days instead of drawing a body that was not there.
assert.strictEqual(g.data[10].ema, null, 'no line drawn across the quiet stretch');
assert.strictEqual(g.data[20].ema, null, 'the gap stays empty end to end');

// One point since the break is not a trend, so nothing is projected from it.
assert.strictEqual(sinceLastGap([{ x: 0 }, { x: 1 }, { x: 2 }, { x: 30 }]).length, 1, 'trend restarts after a gap');
assert.ok(g.data.every(d => d.projection === null), 'no projection off a single post-gap point');
assert.ok(GAP_DAYS >= 7, 'a missed week is not yet a break');

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
