// Runnable self-check for dubInsights — no framework. Run: npx tsx src/dubInsights.check.ts
// Builds a synthetic tracker where "Walk" is always skipped on Mondays and always
// co-occurs with high steps, then asserts Dub spots both.
import assert from 'assert';
import { buildHabitInsights, pearson } from './dubInsights';

const YEAR = new Date().getFullYear();
function allDaysFor(): string[] {
  const d: string[] = [];
  for (let m = 0; m < 12; m++) {
    const n = new Date(YEAR, m + 1, 0).getDate();
    for (let day = 1; day <= n; day++) d.push(`${String(day).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}`);
  }
  return d;
}
const ALL = allDaysFor();
const dow = (ddmm: string) => (new Date(YEAR, +ddmm.slice(3) - 1, +ddmm.slice(0, 2)).getDay() + 6) % 7;

// Use the first 70 days of the year as history; "today" is day 70.
const history = ALL.slice(0, 70);
const today = ALL[70];

const trackerHabits: { day: string; habit_name: string; state: string | null }[] = [];
const stepsByDay: Record<string, number> = {};
for (const d of history) {
  const isMon = dow(d) === 0;
  const done = !isMon;                        // Walk done every day except Mondays
  trackerHabits.push({ day: d, habit_name: 'Walk', state: done ? 'done' : 'failed' });
  stepsByDay[d] = done ? 9000 : 4000;         // high steps on done days, low otherwise
}

const insights = buildHabitInsights({
  habits: ['Walk'],
  trackerHabits,
  stepsByDay,
  weightByDay: {},
  moodByDay: {},
  allDays: ALL,
  today,
});

const texts = insights.map(i => i.text);
console.log('insights:\n' + texts.map(t => '  · ' + t).join('\n'));

// 1) weekday-miss finding names Monday
assert(texts.some(t => /skip Walk most on Mondays/.test(t)), 'expected a Monday-skip insight');
// 2) steps finding reports higher steps on done days
assert(texts.some(t => /average 9\.0k steps.*4\.0k/.test(t)), 'expected a steps-boost insight');

// 3) pearson sanity: perfect positive correlation ~ 1
const r = pearson([[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6]]);
assert(r != null && Math.abs(r - 1) < 1e-9, `expected pearson ~1, got ${r}`);
// too-few points → null
assert(pearson([[1, 1], [2, 2]]) === null, 'expected null for <6 points');

console.log('\n✓ dubInsights checks passed');
