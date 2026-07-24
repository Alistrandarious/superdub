// Runnable check for Dub's chat question bank (npm run check).
// Guards the four properties that make the chat trustworthy: availability
// gating, real numbers in answers, determinism, and the Superdub voice rules
// (no dashes as punctuation, no jargon) as hard asserts.
import assert from 'node:assert';
import { buildQuestionBank, type DubData } from './dubQuestions';
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

// ── Fixture: steady loser, one slipping habit, short sleep ──────────────────
const weights: WeighIn[] = [6, 5, 4, 3, 2, 1, 0].map(ago => ({ day: ddmm(ago), weight: 86.6 - (6 - ago) * 0.08 }));
const habits = [{ name: 'Reading', startDate: iso(30) }, { name: 'Walk', startDate: iso(30) }];
const trackerHabits = [] as { day: string; habit_name: string; state: string }[];
for (let ago = 30; ago >= 0; ago--) {
  trackerHabits.push({ day: ddmm(ago), habit_name: 'Walk', state: 'done' });          // perfect streak
  if (ago > 3) trackerHabits.push({ day: ddmm(ago), habit_name: 'Reading', state: 'done' }); // slipped 3 days
}
const report = buildCoachReport(weights, habits, trackerHabits as any, ALL_DAYS, TODAY, { goalType: 'lose', targetWeight: 82 });
assert(report, 'fixture must produce a coach report');

const target = new Date(); target.setDate(target.getDate() + 84);
const full: DubData = {
  weights, report, insights: [
    { habit: 'Reading', icon: '📅', text: 'You skip Reading most on Fridays (missed 3 of 4). Worth a plan for that day.', strength: 0.8 },
    { habit: 'Walk', icon: '😊', text: 'You feel better on days you do Walk, 4.1 out of 5 against 3.2 when you skip it.', strength: 0.5 },
  ],
  plan: {
    active: true, tdee: { observedTDEE: 2400, blendedTDEE: 2450, formulaTDEE: 2500, confidence: 0.62, intakeUsed: 2000, intakeIsLogged: false },
    stall: null,
    replan: null,
    goal: { id: 'g', goalType: 'lose', startWeight: 88, startDate: iso(60), targetWeight: 82, targetDate: iso(-84), ratePctBw: 0.5 },
    currentTarget: { calories: 1950, reason: 'plan', effectiveFrom: iso(10) },
    history: [],
  },
  coaching: { message: '', churnRisk: 'LOW', trend: 'on-track', todayEnergy: 4, workoutCalories: null, advisableSteps: 11000 },
  checkins: Array.from({ length: 10 }, (_, i) => ({ date: iso(i), sleep: 6.4, mood: 7 })),
  totalXP: 925,
  today: TODAY,
};

const bank = buildQuestionBank(full);
const ids = bank.map(q => q.id);

// 1) Gating: full fixture offers the data-backed questions
for (const want of ['pace', 'goalDate', 'target', 'burn', 'sleep', 'steps', 'level', 'else', 'insight:0']) {
  assert(ids.includes(want), `full fixture should offer "${want}" (got ${ids.join(', ')})`);
}
// ...and an empty fixture doesn't
const empty = buildQuestionBank({ ...full, weights: [], report: null, insights: [], plan: null, coaching: null, checkins: [] });
const emptyIds = empty.map(q => q.id);
for (const not of ['pace', 'whyUp', 'goalDate', 'target', 'burn', 'sleep', 'steps', 'focus', 'wins', 'week']) {
  assert(!emptyIds.includes(not), `empty fixture must not offer "${not}"`);
}
assert(emptyIds.includes('level') && emptyIds.includes('else'), 'level and the catch-all survive an empty fixture');

// 2) Content: real numbers from the fixture appear in the answers
const pace = bank.find(q => q.id === 'pace')!;
assert(/kg/.test(pace.answer) && /82\.0/.test(pace.answer), `pace answer carries the goal figure: ${pace.answer}`);
const burn = bank.find(q => q.id === 'burn')!;
assert(burn.answer.includes('2,450'), `burn answer carries blended kcal: ${burn.answer}`);
const sleepQ = bank.find(q => q.id === 'sleep')!;
assert(sleepQ.answer.includes('6.4'), `sleep answer carries the average: ${sleepQ.answer}`);
const focus = bank.find(q => q.id === 'focus');
assert(focus && focus.answer.includes('Reading'), 'focus answer names the slipping habit');

// 3) whyUp gating: only when the latest weigh-in rose
const up = { ...full, weights: [...weights.slice(0, -1), { day: TODAY, weight: 86.9 }] };
assert(buildQuestionBank(up).some(q => q.id === 'whyUp'), 'rising weigh-in offers whyUp');
assert(!ids.includes('whyUp'), 'falling fixture must not offer whyUp');

// 4) Determinism: identical input, byte-identical output
assert.strictEqual(JSON.stringify(bank), JSON.stringify(buildQuestionBank(full)), 'same input must give identical banks');

// 5) Voice lint: no dashes-as-punctuation, no jargon, in any label or answer
const banned = /TDEE|EMA\b|maintenance|prescribed|velocity/i;
for (const q of bank.concat(empty)) {
  assert(!/[—–]/.test(q.label) && !/[—–]/.test(q.answer), `voice: dash found in "${q.id}"`);
  assert(!banned.test(q.label) && !banned.test(q.answer), `voice: jargon found in "${q.id}": ${q.answer}`);
}

// 6) Weight unit: answers render in the user's unit, not always kg. Stub
//    localStorage so getWeightUnit() returns 'lbs' under node. (Kept last so the
//    kg assertions above run against the default.)
const store = new Map<string, string>([['superdub.weightUnit', 'lbs']]);
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};
const lbPace = buildQuestionBank(full).find(q => q.id === 'pace')!;
assert(/\blb\b/.test(lbPace.answer), `pace answer must use lb when the unit is lbs: ${lbPace.answer}`);
assert(!/\d\s?kg\b/.test(lbPace.answer), `pace answer must not show kg when the unit is lbs: ${lbPace.answer}`);
assert(/180\.8/.test(lbPace.answer), `82.0 kg goal must convert to 180.8 lb: ${lbPace.answer}`);

console.log('dubQuestions.check.ts — all assertions passed');
