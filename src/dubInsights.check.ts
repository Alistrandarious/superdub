// Runnable self-check for dubInsights — no framework. Run: npx tsx src/dubInsights.check.ts
// Builds a synthetic tracker where "Walk" is always skipped on Mondays and always
// co-occurs with high steps, and "Gym" is kept up on alternate weeks with the
// weight dropping only in those weeks, then asserts Dub spots all three and
// labels each with the right theme, tone and signal.
import assert from 'assert';
import { buildHabitInsights, groupInsights, pearson } from './dubInsights';

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
const weightByDay: Record<string, number> = {};
const epochDay = (ddmm: string) => Math.round(new Date(YEAR, +ddmm.slice(3) - 1, +ddmm.slice(0, 2)).getTime() / 86400000);
for (const d of history) {
  const isMon = dow(d) === 0;
  const done = !isMon;                        // Walk done every day except Mondays
  trackerHabits.push({ day: d, habit_name: 'Walk', state: done ? 'done' : 'failed' });
  stepsByDay[d] = done ? 9000 : 4000;         // high steps on done days, low otherwise
  // Gym: whole weeks on, whole weeks off (same 7-day buckets the engine uses);
  // weight falls 0.1 kg a day in on-weeks and climbs in off-weeks.
  const gymWeek = Math.floor(epochDay(d) / 7) % 2 === 0;
  trackerHabits.push({ day: d, habit_name: 'Gym', state: gymWeek ? 'done' : 'failed' });
  weightByDay[d] = 80 + (epochDay(d) % 7) * (gymWeek ? -0.1 : 0.1);
}

const build = (goalType: string | null) => buildHabitInsights({
  habits: ['Walk', 'Gym'],
  trackerHabits,
  stepsByDay,
  weightByDay,
  moodByDay: {},
  allDays: ALL,
  today,
  goalType,
});
const insights = build('lose');

const texts = insights.map(i => i.text);
console.log('insights:\n' + texts.map(t => '  · ' + t).join('\n'));

// 1) weekday-miss finding names Monday
assert(texts.some(t => /skip Walk most on Mondays/.test(t)), 'expected a Monday-skip insight');
// 2) steps finding reports higher steps on done days
assert(texts.some(t => /average 9\.0k steps.*4\.0k/.test(t)), 'expected a steps-boost insight');

// 2b) every finding carries its theme, tone, direction and signal
const monday = insights.find(i => i.theme === 'rhythm')!;
assert(monday && monday.tone === 'warn' && monday.direction === null && monday.signal === 'strong', `rhythm finding mis-labelled: ${JSON.stringify(monday)}`);
const steps = insights.find(i => i.theme === 'steps')!;
assert(steps && steps.tone === 'good' && steps.direction === 'up' && steps.signal === 'strong', `steps finding mis-labelled: ${JSON.stringify(steps)}`);
const gym = insights.find(i => i.theme === 'weight')!;
assert(gym && gym.habit === 'Gym' && gym.direction === 'down' && gym.signal === 'strong', `weight finding mis-labelled: ${JSON.stringify(gym)}`);
assert(/tends to drop \(strong link\)/.test(gym.text), `weight text names the link strength: ${gym.text}`);
// the same drop is good news on a lose goal, a heads up on a gain goal, no verdict without one
assert(gym.tone === 'good', 'weight drop on a lose goal is good');
assert(build('gain').find(i => i.theme === 'weight')!.tone === 'warn', 'weight drop on a gain goal is a heads up');
assert(build(null).find(i => i.theme === 'weight')!.tone === 'neutral', 'weight drop with no goal is neutral');

// 2c) grouping: one group per theme, strongest theme first, every item in its own theme
const groups = groupInsights(insights);
assert(new Set(groups.map(g => g.theme)).size === groups.length, 'one group per theme');
assert(groups[0].theme === insights[0].theme, 'strongest finding leads the first group');
assert(groups.every(g => g.items.every(i => i.theme === g.theme)), 'items sit in their own theme');
assert(groups.reduce((n, g) => n + g.items.length, 0) === insights.length, 'grouping loses nothing');

// 3) pearson sanity: perfect positive correlation ~ 1
const r = pearson([[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6]]);
assert(r != null && Math.abs(r - 1) < 1e-9, `expected pearson ~1, got ${r}`);
// too-few points → null
assert(pearson([[1, 1], [2, 2]]) === null, 'expected null for <6 points');

console.log('\n✓ dubInsights checks passed');
