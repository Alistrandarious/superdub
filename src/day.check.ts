// Self-check for the 2 AM logging boundary (run: npx tsx src/day.check.ts)
import assert from 'assert';

// Minimal localStorage shim so the override path is exercisable under node.
const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};

import { getLoggingDay, inGracePeriod, loggingNow } from './day';

// 00:30 on 9 July → still logging 8 July (grace window, no override).
const lateNight = new Date(2026, 6, 9, 0, 30);
assert.strictEqual(getLoggingDay(lateNight), '08/07', 'before 2 AM logs to yesterday');
assert.strictEqual(inGracePeriod(lateNight), true, '00:30 is in grace');
assert.strictEqual(loggingNow(lateNight).getHours(), 0, 'wall-clock hour preserved through the shift');

// 02:30 on 9 July → logging 9 July (past the reset hour).
const afterReset = new Date(2026, 6, 9, 2, 30);
assert.strictEqual(getLoggingDay(afterReset), '09/07', 'after 2 AM logs to today');
assert.strictEqual(inGracePeriod(afterReset), false, '02:30 is out of grace');

// Midday → today, obviously.
assert.strictEqual(getLoggingDay(new Date(2026, 6, 9, 13, 0)), '09/07', 'midday logs to today');

// Manual advance on 9 July: even at 00:30, the override forces today.
store['superdub.day.advanced'] = '2026-07-09';
assert.strictEqual(getLoggingDay(lateNight), '09/07', 'manual advance jumps to today');
assert.strictEqual(inGracePeriod(lateNight), false, 'advanced → no longer in grace');
delete store['superdub.day.advanced'];

// Cross-month boundary: 00:30 on 1 Aug → 31 July.
assert.strictEqual(getLoggingDay(new Date(2026, 7, 1, 0, 30)), '31/07', 'rolls across a month');

console.log('day.check.ts — all assertions passed');
