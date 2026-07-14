// Runnable check for Dub's morning brief / evening debrief (npm run check).
// Guards kind selection, per-sentence data gating, evening's fixed closing,
// the "no data at all" null rule, voice rules, and determinism.
import assert from 'node:assert';
import { buildBrief, type BriefSources } from './dubBrief';
import { buildCoachReport, type WeighIn } from './coach';

const YEAR = new Date().getFullYear();
function ddmm(daysAgo: number): string {
  const d = new Date(); d.setDate(d.getDate() - daysAgo);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function iso(daysAgo: number): string {
  const d = new Date(); d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const ALL_DAYS = (() => {
  const out: string[] = [];
  for (let m = 0; m < 12; m++) {
    const n = new Date(YEAR, m + 1, 0).getDate();
    for (let day = 1; day <= n; day++) out.push(`${String(day).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}`);
  }
  return out;
})();
const TODAY = ddmm(0);

// ── Fixture: steady loser, one slipping habit ────────────────────────────
const weights: WeighIn[] = [6, 5, 4, 3, 2, 1, 0].map(ago => ({ day: ddmm(ago), weight: 86.6 - (6 - ago) * 0.08 }));
const habits = [{ name: 'Reading', startDate: iso(30) }, { name: 'Walk', startDate: iso(30) }];
const trackerHabits: { day: string; habit_name: string; state: string }[] = [];
for (let ago = 30; ago >= 0; ago--) {
  trackerHabits.push({ day: ddmm(ago), habit_name: 'Walk', state: 'done' });
  if (ago > 3) trackerHabits.push({ day: ddmm(ago), habit_name: 'Reading', state: 'done' });
}
const report = buildCoachReport(weights, habits, trackerHabits as any, ALL_DAYS, TODAY, { goalType: 'lose', targetWeight: 82 });
assert(report, 'fixture must produce a coach report');

const fullBase: Omit<BriefSources, 'hour'> = {
  weights, today: TODAY, report,
  plan: {
    active: true,
    tdee: { observedTDEE: 2400, blendedTDEE: 2450, formulaTDEE: 2500, confidence: 0.62, intakeUsed: 2000, intakeIsLogged: false },
    stall: null,
    goal: { id: 'g', goalType: 'lose', startWeight: 88, startDate: iso(60), targetWeight: 82, targetDate: iso(-84), ratePctBw: 0.5 },
    currentTarget: { calories: 1950, reason: 'plan', effectiveFrom: iso(10) },
    history: [],
  },
  coaching: { message: '', churnRisk: 'LOW', trend: 'on-track', todayEnergy: 4, workoutCalories: null, advisableSteps: 11000 },
  sleepLastNight: 7.4,
  adherenceToday: 1,
  habitsDone: 1, habitsTotal: 2,
};

// 1) Kind selection
assert.strictEqual(buildBrief({ ...fullBase, hour: 9 })!.kind, 'morning', 'hour 9 is morning');
assert.strictEqual(buildBrief({ ...fullBase, hour: 20 })!.kind, 'evening', 'hour 20 is evening');
assert.strictEqual(buildBrief({ ...fullBase, hour: 14 })!.kind, 'day', 'hour 14 is day');

// 2) Missing sleep drops the sentence; no output ever leaks a raw placeholder
const noSleep = buildBrief({ ...fullBase, hour: 9, sleepLastNight: null });
assert(noSleep && !/slept/.test(noSleep.text), 'missing sleep drops the sleep sentence');
for (const hour of [9, 14, 20]) {
  const b = buildBrief({ ...fullBase, hour });
  assert(b, `full fixture at hour ${hour} should produce a brief`);
  assert(!/\bnull\b|\bNaN\b|\bundefined\b|  /.test(b.text), `no placeholder or double space at hour ${hour}: ${b.text}`);
}

// 3) Evening always closes with the fixed line and names tomorrow's focus
const evening = buildBrief({ ...fullBase, hour: 20 })!;
assert(evening.text.endsWith('Sleep well.'), `evening ends with Sleep well.: ${evening.text}`);
assert(evening.text.includes("Tomorrow's one thing"), 'evening names tomorrow\'s one thing');

// 4) Empty sources: no data anywhere → null for all three kinds
const empty: Omit<BriefSources, 'hour'> = {
  weights: [], today: TODAY, report: null, plan: null, coaching: null,
  sleepLastNight: null, adherenceToday: null, habitsDone: 0, habitsTotal: 0,
};
for (const hour of [9, 14, 20]) {
  assert.strictEqual(buildBrief({ ...empty, hour }), null, `empty sources at hour ${hour} must be null`);
}

// 5) Voice lint: no dashes-as-punctuation, no jargon
const jargon = /TDEE|EMA\b|maintenance|prescribed/i;
for (const hour of [9, 14, 20]) {
  const b = buildBrief({ ...fullBase, hour })!;
  assert(!/[—–]/.test(b.text), `voice: dash found at hour ${hour}: ${b.text}`);
  assert(!jargon.test(b.text), `voice: jargon found at hour ${hour}: ${b.text}`);
}

// 6) Determinism
const a1 = buildBrief({ ...fullBase, hour: 9 });
const a2 = buildBrief({ ...fullBase, hour: 9 });
assert.strictEqual(JSON.stringify(a1), JSON.stringify(a2), 'same input must give identical text');

console.log('dubBrief.check.ts — all assertions passed');
