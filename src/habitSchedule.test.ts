import assert from 'assert';
import { scheduleLabel, scheduledDateInPeriod, scheduleDdmm } from './habitSchedule';

// jest supplies `test` at runtime; declare it so the app's `tsc --noEmit` (no
// @types/jest) stays clean without adding a dev dependency.
declare const test: (name: string, fn: () => void) => void;

test('scheduleLabel reads each cadence', () => {
  assert.strictEqual(scheduleLabel('weekly', '1'), 'Every Tuesday'); // Mon=0
  assert.strictEqual(scheduleLabel('monthly', '15'), 'Day 15');
  assert.strictEqual(scheduleLabel('yearly', '6-21'), '21 Jun');
  assert.strictEqual(scheduleLabel('weekly', null), null);
  assert.strictEqual(scheduleLabel('daily', '1'), null);
});

test('scheduledDateInPeriod resolves the day within the current period, with clamping', () => {
  const wed = new Date(2026, 6, 8); // Wed 8 Jul 2026
  // weekly Tuesday (dow 1) of that week is Tue 7 Jul.
  assert.strictEqual(scheduleDdmm(scheduledDateInPeriod('weekly', '1', wed)!), '07/07');
  // monthly day 15 in July → 15 Jul.
  assert.strictEqual(scheduleDdmm(scheduledDateInPeriod('monthly', '15', wed)!), '15/07');

  const feb = new Date(2026, 1, 10); // Feb 2026 (28 days, not a leap year)
  // day 31 clamps to the last day of February.
  assert.strictEqual(scheduleDdmm(scheduledDateInPeriod('monthly', '31', feb)!), '28/02');
  // yearly 30 Feb clamps to 28 Feb regardless of the reference month.
  assert.strictEqual(scheduleDdmm(scheduledDateInPeriod('yearly', '2-30', wed)!), '28/02');
  // yearly 21 Jun stays 21 Jun.
  assert.strictEqual(scheduleDdmm(scheduledDateInPeriod('yearly', '6-21', wed)!), '21/06');
  // unset → null
  assert.strictEqual(scheduledDateInPeriod('weekly', null, wed), null);
});
