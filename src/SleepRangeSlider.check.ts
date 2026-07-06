// Self-check for the sleep-slider axis math (run: npx tsx src/SleepRangeSlider.check.ts)
import assert from 'assert';
import { axisToHHMM, axisToLabel } from './SleepRangeSlider';

// Axis = hours after 6pm on a 6pm→6pm clock (matches SleepCandleChart.hhmmToAxis).
assert.strictEqual(axisToHHMM(0), '18:00');   // 6pm
assert.strictEqual(axisToHHMM(5), '23:00');   // 11pm bed
assert.strictEqual(axisToHHMM(6), '00:00');   // midnight
assert.strictEqual(axisToHHMM(13), '07:00');  // 7am wake
assert.strictEqual(axisToHHMM(24), '18:00');  // wraps back to 6pm
assert.strictEqual(axisToHHMM(5.25), '23:15'); // 15-min granularity

// 12-hour labels
assert.strictEqual(axisToLabel(5), '11:00 PM');
assert.strictEqual(axisToLabel(6), '12:00 AM');   // midnight, not 0
assert.strictEqual(axisToLabel(13), '7:00 AM');
assert.strictEqual(axisToLabel(18), '12:00 PM');  // noon, not 0

console.log('SleepRangeSlider.check.ts — all assertions passed');
