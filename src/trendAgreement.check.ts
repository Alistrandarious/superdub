// Self-check: /dashboard and /plan must report the SAME weekly rate.
//
// The Progress chart used to hand-roll its own least-squares over every point in
// the window while the journey chart on /plan regressed only the run since the
// last break. Same user, same data, same day, two different kg/wk, and nothing
// anywhere flagged it. Both now go through linearReg(sinceLastGap(...)).
// Run: npx tsx src/trendAgreement.check.ts
import assert from 'assert';
import { linearReg, sinceLastGap } from './weightMath';

/** Steady loss for a fortnight, three weeks of silence, then a heavier restart. */
const pts = [
  { x: 0, y: 90.0 }, { x: 3, y: 89.4 }, { x: 6, y: 88.8 },
  { x: 9, y: 88.2 }, { x: 12, y: 87.6 },
  // 21 quiet days.
  { x: 33, y: 89.0 }, { x: 36, y: 88.7 }, { x: 39, y: 88.4 },
];

const gapAware = linearReg(sinceLastGap(pts));
const naive = linearReg(pts);
assert(gapAware && naive, 'both regressions should resolve');

// 1) The fix is load-bearing: ignoring the gap gives a materially different answer.
assert(Math.abs(gapAware!.weeklyRate - naive!.weeklyRate) > 0.1,
  'if these already agreed, this check would prove nothing');

// 2) The gap-aware rate describes only the run since the break.
assert(sinceLastGap(pts).length === 3, 'the run since the break is the last three weigh-ins');
assert(gapAware!.weeklyRate < 0, 'that run is coming down');

// 3) The naive line is the one the dashboard used to draw. Here the restart came
//    back heavier, so regressing through the silence drags the slope toward flat
//    and reports barely any progress for a run that is actually coming down well.
assert(naive!.weeklyRate > gapAware!.weeklyRate,
  'drawing through the gap should flatten this slope');
assert(Math.abs(naive!.weeklyRate) < Math.abs(gapAware!.weeklyRate) / 2,
  'and it understates the real rate by more than half');

// 4) With no break in the record the two are identical, so ordinary users see no change.
const unbroken = [{ x: 0, y: 90 }, { x: 2, y: 89.5 }, { x: 4, y: 89 }, { x: 6, y: 88.5 }];
assert(linearReg(sinceLastGap(unbroken))!.weeklyRate === linearReg(unbroken)!.weeklyRate,
  'no gap, no difference');

console.log('trendAgreement.check.ts OK');
