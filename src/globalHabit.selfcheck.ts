// Runnable check for the Global-habit pure logic. No framework — run with:
//   npx tsx src/globalHabit.selfcheck.ts
import assert from 'node:assert';
import { habitLevelFromDays, HABIT_LEVEL_RATES, whiteUnlocked } from './levels';

const rateFor = (days: number) =>
  HABIT_LEVEL_RATES[Math.min(habitLevelFromDays(days) - 1, HABIT_LEVEL_RATES.length - 1)];

// A user's very first deed is the 1st completion → level 1 → base rate (10 XP).
assert.strictEqual(rateFor(1), 10, 'first deed pays the level-1 rate');
// The rate climbs with the day-count, tracking the habit ladder (day 7 → level 2).
assert.strictEqual(habitLevelFromDays(7), 2, 'day 7 reaches level 2');
assert.strictEqual(rateFor(7), 15, 'level-2 deed pays 15 XP');
assert.ok(rateFor(400) > rateFor(1), 'the rate scales up over time');

// White dub unlocks only when the community hits 10k AND you gave ≥100 XP.
assert.strictEqual(whiteUnlocked(9999, 100), false, 'community below 10k stays locked');
assert.strictEqual(whiteUnlocked(10000, 99), false, 'personal below 100 stays locked');
assert.strictEqual(whiteUnlocked(10000, 100), true, 'both thresholds met unlocks white');

console.log('globalHabit self-check passed');
