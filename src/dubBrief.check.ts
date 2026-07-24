// Runnable check for Dub's morning brief / evening debrief (npm run check).
// Guards kind selection, per-sentence data gating, evening's fixed closing,
// the "no data at all" null rule, voice rules, and determinism.
import assert from 'node:assert';
import { buildBrief, dubDayState, type BriefSources } from './dubBrief';
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
    replan: null,
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

// 7) dubDayState priority mapping (drives the live room)
const sweep = dubDayState({ ...fullBase, hour: 12, habitsDone: 2, habitsTotal: 2 });
assert(sweep.celebrate && sweep.mood === 'happy' && /Clean sweep/.test(sweep.thought), `clean sweep celebrates: ${JSON.stringify(sweep)}`);
const stalled = dubDayState({
  ...fullBase, hour: 12,
  plan: { ...(fullBase.plan as any), stall: { risk: 'high', score: 0.8, message: '', factors: [], action: '' } },
});
assert(stalled.mood === 'concerned' && !stalled.celebrate, `stall risk reads concerned: ${JSON.stringify(stalled)}`);
const quiet = dubDayState({ ...empty, hour: 12 });
assert(quiet.mood === 'neutral' && quiet.thought === 'Tap me for a chat.', 'no data falls back to neutral');
for (const st of [sweep, stalled, quiet]) {
  assert(!/[—–]/.test(st.thought) && !jargon.test(st.thought), `voice: day-state thought clean: ${st.thought}`);
}

// 8) Stage adaptation: absent stage === 'regular' voice (no regression), 'new'
//    appends a nudge, 'super' is terser (no greeting) and never longer.
for (const hour of [9, 14, 20]) {
  const regular = buildBrief({ ...fullBase, hour })!;
  const noStage = buildBrief({ ...fullBase, hour, stage: 'regular' })!;
  assert.strictEqual(regular.text, noStage.text, `absent stage matches 'regular' at hour ${hour}`);

  const fresh = buildBrief({ ...fullBase, hour, stage: 'new' })!;
  const superb = buildBrief({ ...fullBase, hour, stage: 'super' })!;
  assert(superb.text.length <= regular.text.length, `super is not longer at hour ${hour}`);
  assert(!/^Morning\.|^Day closed\./.test(superb.text), `super drops the greeting at hour ${hour}: ${superb.text}`);
  for (const b of [fresh, superb]) {
    assert(!/[—–]/.test(b.text) && !jargon.test(b.text), `voice: stage text clean at hour ${hour}: ${b.text}`);
    assert(!/\bnull\b|\bNaN\b|\bundefined\b|  /.test(b.text), `no placeholder at hour ${hour}: ${b.text}`);
  }
}
// Morning 'new' carries the one-tick nudge; empty sources stay null regardless of stage.
assert(/tick one habit/.test(buildBrief({ ...fullBase, hour: 9, stage: 'new' })!.text), 'new morning nudges to tick one habit');
assert.strictEqual(buildBrief({ ...empty, hour: 9, stage: 'new' }), null, 'new stage never fabricates a brief from nothing');
// New-user neutral room greeting; regular/absent keeps the original line.
assert.strictEqual(dubDayState({ ...empty, hour: 12, stage: 'new' }).thought, "Hi, I'm Dub. Tap me.", 'new user gets the intro thought');
assert.strictEqual(dubDayState({ ...empty, hour: 12 }).thought, 'Tap me for a chat.', 'absent stage keeps the original thought');

// 9) Weight unit: the morning weight sentence renders in the user's unit, not
//    always kg. Stub localStorage so getWeightUnit() returns 'lbs' under node.
//    (Last, so the assertions above run against the kg default.)
const store = new Map<string, string>([['superdub.weightUnit', 'lbs']]);
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};
const lbMorning = buildBrief({ ...fullBase, hour: 9 })!;
assert(/scale says .*\blb\b/.test(lbMorning.text), `morning weight sentence must use lb when the unit is lbs: ${lbMorning.text}`);
assert(!/\d\s?kg\b/.test(lbMorning.text), `morning brief must not show kg when the unit is lbs: ${lbMorning.text}`);

console.log('dubBrief.check.ts — all assertions passed');
