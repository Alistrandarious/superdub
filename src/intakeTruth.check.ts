// Self-check for the reported-vs-actual intake calibration.
// Run: npx tsx src/intakeTruth.check.ts
import assert from 'assert';
import { assessIntakeTruth } from './intakeTruth';

// 14 evenings of "about on target" against a 2,000 kcal target ⇒ reports 2,000/day.
const onTarget = Array.from({ length: 14 }, () => ({ adherenceLevel: 0, targetCalories: 2000 }));
const run = (estimatedIntake: number | null, reports = onTarget, spanDays = 14) =>
  assessIntakeTruth({ reports, estimatedIntake, spanDays });

// ── the honesty bar: silence when the data is too thin ───────────────────────
assert(run(null) === null, 'no weight-trend estimate ⇒ no verdict');
assert(run(2600, onTarget.slice(0, 7)) === null, '7 reports is under the floor');
assert(run(2600, onTarget, 9) === null, 'a 9-day span is too short to trend');

// ── the three verdicts ───────────────────────────────────────────────────────
assert(run(2100)!.verdict === 'aligned', 'a 100 kcal gap is agreement');
assert(run(2399)!.verdict === 'aligned', 'just inside the threshold is still aligned');
assert(run(2600)!.verdict === 'under_reporting', 'scale says 600 more than reported');
assert(run(1400)!.verdict === 'over_reporting', 'scale says 600 less than reported');

// ── the numbers are the right way round ──────────────────────────────────────
const under = run(2600)!;
assert(under.reportedKcal === 2000, 'level 0 reports the target itself');
assert(under.actualKcal === 2600 && under.gapKcal === 600, 'gap is actual minus reported');
assert(under.daysCounted === 14, 'counts the reports it used');
assert(under.headline.includes('600'), 'the headline names the gap');
assert(!under.headline.includes('-') && !under.detail.includes(' - '), 'no dashes in user copy (SUPERDUB_VOICE)');

// The self-report offsets are read, not ignored: "well over" (+2) claims target+700.
const overAte = Array.from({ length: 14 }, () => ({ adherenceLevel: 2, targetCalories: 2000 }));
assert(run(2700, overAte)!.verdict === 'aligned', 'admitting +700 and eating 2700 is honest logging');
assert(run(2700, overAte)!.reportedKcal === 2700, '+2 reports target plus 700');

console.log('intakeTruth.check.ts OK');
