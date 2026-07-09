import assert from 'assert';
import { pickDayLog } from './dailyLogPick';

// Day-mapping guard: Today's Log must read the SELECTED day's row (rewindDay),
// not just today's. Run: npx tsx src/dailyLogPick.selfcheck.ts
const days = [
  { day: '07/07', weight: '81.2', steps: '9000' },
  { day: '08/07', weight: '80.9', steps: '4200' },
  { day: '09/07', weight: '', steps: '' },
];

// Reads the chosen day, not the first row.
assert.deepStrictEqual(pickDayLog(days, '08/07'), { weight: '80.9', steps: 4200 });
// Empty row and a missing day both fall back to nulls (blank, not stale).
assert.deepStrictEqual(pickDayLog(days, '09/07'), { weight: null, steps: null });
assert.deepStrictEqual(pickDayLog(days, '31/12'), { weight: null, steps: null });

console.log('dailyLogPick self-check passed');
