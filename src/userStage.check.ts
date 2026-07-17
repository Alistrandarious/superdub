// Runnable self-check for the user-stage blend. Run: npx tsx src/userStage.check.ts
import assert from 'assert';
import { computeStage } from './userStage';

// New — either gate alone is enough.
assert(computeStage({ daysSinceJoin: 6, playerLevel: 9, dayStreak: 200 }) === 'new', 'day-6 is new even if leveled');
assert(computeStage({ daysSinceJoin: 400, playerLevel: 2, dayStreak: 200 }) === 'new', 'level-2 is new even if tenured');
assert(computeStage({ daysSinceJoin: 0, playerLevel: 1, dayStreak: 0 }) === 'new', 'fresh signup is new');

// Super — needs BOTH gold-wordmark level (>=7) AND a live 21+ streak.
assert(computeStage({ daysSinceJoin: 90, playerLevel: 8, dayStreak: 30 }) === 'super', 'level-8 + 30-streak is super');
assert(computeStage({ daysSinceJoin: 90, playerLevel: 7, dayStreak: 21 }) === 'super', 'level-7 + 21-streak is on the super boundary');

// Regular — the AND keeps a dormant veteran (cold streak) out of super.
assert(computeStage({ daysSinceJoin: 365, playerLevel: 8, dayStreak: 5 }) === 'regular', 'dormant veteran is regular, not super');
assert(computeStage({ daysSinceJoin: 90, playerLevel: 6, dayStreak: 100 }) === 'regular', 'level-6 (below gold) is regular even with a big streak');
assert(computeStage({ daysSinceJoin: 30, playerLevel: 4, dayStreak: 10 }) === 'regular', 'mid user is regular');

// Streak boundary: 20 is not yet super.
assert(computeStage({ daysSinceJoin: 90, playerLevel: 8, dayStreak: 20 }) === 'regular', 'streak-20 falls short of super');

console.log('✓ userStage checks passed');
