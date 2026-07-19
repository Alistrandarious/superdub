// Runnable self-check for the level-up glance model. Run: npx tsx src/glanceModel.check.ts
import assert from 'assert';
import { computeGlance } from './glanceModel';

const base = {
  streak: 12,
  today: '19/07',
  year: 2026,
  days: [
    { day: '12/07', weight: '82.0', steps: '9000' },
    { day: '16/07', weight: '81.6', steps: '7000' },
    { day: '19/07', weight: '81.4', steps: '6200' },
  ],
  habitStates: [
    { day: '19/07', habit_name: 'Read', state: 'done' },
    { day: '19/07', habit_name: 'Walk', state: 'failed' },
    { day: '18/07', habit_name: 'No sugar', state: 'done' }, // wrong day, ignored
  ],
  habits: [
    { name: 'Read', starred: true },
    { name: 'Walk', starred: true },
    { name: 'No sugar', starred: false },
  ],
  stepTarget: 8000,
  goalKg: 74,
};

const g = computeGlance(base);

assert(g.streak === 12, 'streak passes through when > 0');
assert(g.steps && g.steps.today === 6200 && g.steps.target === 8000, 'steps read today vs target');
assert(g.weight && g.weight.currentKg === 81.4, 'current weight is the latest sample');
assert(g.weight && g.weight.weekDeltaKg === 0.6, 'week delta = ~week-ago minus latest (82.0 - 81.4)');
assert(g.weight && g.weight.goalType === 'lose', 'goal below current = lose');
assert(g.starred.length === 2, 'only starred habits appear');
assert(g.starred[0].name === 'Read' && g.starred[0].done === true, "starred 'Read' is done today");
assert(g.starred[1].name === 'Walk' && g.starred[1].done === false, "'Walk' failed today = not done");

// Empty/zero states hide their sections.
const empty = computeGlance({ ...base, streak: 0, stepTarget: 0, goalKg: null, days: [], habits: [] });
assert(empty.streak === null, 'zero streak hides');
assert(empty.steps === null, 'no step target hides steps');
assert(empty.weight === null, 'no weights hides weight');
assert(empty.starred.length === 0, 'no starred habits hides targets');

// Not enough history for a weekly delta -> null, but weight block still shows current + goal.
const oneWeigh = computeGlance({ ...base, days: [{ day: '19/07', weight: '81.4', steps: '6200' }] });
assert(oneWeigh.weight && oneWeigh.weight.weekDeltaKg === null, 'single weigh-in = no week delta');
assert(oneWeigh.weight && oneWeigh.weight.currentKg === 81.4, 'single weigh-in still yields current weight');

console.log('levelGlance.check.ts — all assertions passed');
