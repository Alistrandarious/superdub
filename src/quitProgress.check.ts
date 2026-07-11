// Runnable self-check for the quit-habit progress bar. Run: npx tsx src/quitProgress.check.ts
import assert from 'assert';
import { quitProgress } from './quit';

const DAY = 24 * 60 * 60 * 1000;
const start = 1_000_000_000_000;

assert(quitProgress(start, start) === 0, 'at start = 0');
assert(quitProgress(start, start + 15 * DAY) === 0.5, 'at 15 days = 0.5');
assert(quitProgress(start, start + 30 * DAY) === 1, 'at 30 days = 1');
assert(quitProgress(start, start + 45 * DAY) === 1, 'past 30 days caps at 1');
assert(quitProgress(start, start - DAY) === 0, 'clock in the past = 0 (no negative)');
assert(quitProgress(0, start) === 0, 'no start set = 0');

console.log('✓ quitProgress checks passed');
