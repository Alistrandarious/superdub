// Runnable check for the trend sheet logic (npm run check).
// Guards the two things the sheet depends on: that a wrong-way weight series
// against a loss goal reads as the "Drifting off course" warn verdict (so the
// sheet shows the cause factors), and that the action resolver prefers the
// server stall fix only for warn states and otherwise falls back correctly.
import assert from 'node:assert';
import { buildCoachReport, type WeighIn } from './coach';
import { classifyTrend, resolveAction, FALLBACK_ACTION, TREND_BUTTONS } from './trendKinds';

const YEAR = new Date().getFullYear();
function ddmm(daysAgo: number): string {
  const d = new Date(); d.setDate(d.getDate() - daysAgo);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const ALL_DAYS = (() => {
  const out: string[] = [];
  for (let m = 0; m < 12; m++) {
    const n = new Date(YEAR, m + 1, 0).getDate();
    for (let day = 1; day <= n; day++) out.push(`${String(day).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}`);
  }
  return out;
})();

// ── Wrong-way weight (gaining) against a loss goal → "Drifting off course" ──
const drifting: WeighIn[] = [{ day: ddmm(6), weight: 80.0 }, { day: ddmm(3), weight: 80.3 }, { day: ddmm(0), weight: 80.6 }];
const report = buildCoachReport(drifting, [], [], ALL_DAYS, ddmm(0), { goalType: 'lose', targetWeight: 78 });
assert(report, 'drifting fixture must produce a coach report');
const verdict = report!.lines[0];
assert.strictEqual(verdict.tone, 'warn', `expected warn tone, got ${verdict.tone} (${verdict.title})`);
assert.match(verdict.title, /drifting off course/i, `expected drifting verdict, got "${verdict.title}"`);
assert.strictEqual(classifyTrend(verdict.title), 'drift', 'drifting verdict must classify as "drift"');

// ── classifyTrend maps every state string coach.ts can emit ──
assert.strictEqual(classifyTrend('A small plateau'), 'plateau');
assert.strictEqual(classifyTrend('Right on your goal'), 'goal');
assert.strictEqual(classifyTrend('0.4 kg down this week, on track'), 'ontrack');
assert.strictEqual(classifyTrend('Building your trend'), 'building');
assert.strictEqual(classifyTrend('Holding steady'), 'holding');
assert.strictEqual(classifyTrend('Trending down'), 'trending');
assert.strictEqual(classifyTrend('Trending up'), 'trending');

// ── resolveAction: server fix only for warn + present, else fallback ──
assert.strictEqual(resolveAction('drift', 'warn', 'Get your steps back up.'), 'Get your steps back up.',
  'warn state with a stall action must use the server fix');
assert.strictEqual(resolveAction('drift', 'warn', ''), FALLBACK_ACTION.drift,
  'warn state with an empty stall action must fall back');
assert.strictEqual(resolveAction('drift', 'warn', null), FALLBACK_ACTION.drift,
  'warn state with no stall action must fall back');
assert.strictEqual(resolveAction('ontrack', 'good', 'ignored server text'), FALLBACK_ACTION.ontrack,
  'non-warn state must ignore any stall action and use its fallback');

// ── every kind has a fallback action and at least one button ──
for (const kind of Object.keys(FALLBACK_ACTION) as (keyof typeof FALLBACK_ACTION)[]) {
  assert(FALLBACK_ACTION[kind].length > 0, `${kind} needs a fallback action`);
  assert(TREND_BUTTONS[kind]?.length > 0, `${kind} needs at least one button`);
}

console.log('trendKinds.check.ts OK');
