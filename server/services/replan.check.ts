// Self-check for the re-plan proposal (run: npx tsx server/services/replan.check.ts)
import assert from 'assert';
import { proposeReplan, safeWeeklyRate } from './replan';

const now = new Date('2026-07-24T12:00:00Z');
const base = {
  goalType: 'lose' as const,
  targetWeight: 80,
  currentWeight: 93,
  tdee: 2760,
  bmr: 1780,
  gapDays: 0,
  now,
};

// ── The safe rate is the tighter of body size and the BMR floor ────────────────
// 93 kg → 0.93 kg/wk by body; (2760-1780)*7/7700 = 0.89 kg/wk by floor → floor wins.
assert.ok(Math.abs(safeWeeklyRate(93, 2760, 1780) - 0.89) < 0.01, 'BMR floor caps the rate');
// A big TDEE gap means body size is the binding limit instead.
assert.ok(Math.abs(safeWeeklyRate(93, 4000, 1780) - 0.93) < 0.01, 'body size caps the rate');
assert.ok(safeWeeklyRate(93, 1800, 1780) >= 0.05, 'never proposes a zero-rate plan');

// ── A plan still within reach is left alone ───────────────────────────────────
const fine = proposeReplan({ ...base, currentWeight: 83, targetDate: new Date('2026-12-01') });
assert.strictEqual(fine, null, '3 kg over four months needs no re-plan');

// ── The returning user: off target, date too close ────────────────────────────
const p = proposeReplan({ ...base, targetDate: new Date('2026-09-01'), gapDays: 62 });
assert.ok(p, 'off target with five weeks left should propose a re-plan');
assert.strictEqual(p!.cause, 'unreachable');
assert.strictEqual(p!.kgToGo, 13);
assert.ok(p!.requiredRate > 2, `old plan demanded an absurd pace, got ${p!.requiredRate}`);
assert.ok(p!.safeRate < 1, 'proposed pace is a sane one');
// 13 kg at 0.89 kg/wk → 15 weeks, and the goal weight never moves.
assert.strictEqual(p!.weeksNeeded, 15);
assert.ok(p!.newTargetDate > '2026-11-01', `new date is honest, got ${p!.newTargetDate}`);
assert.strictEqual(p!.gapDays, 62, 'carries the gap through for the copy');
assert.match(p!.headline, /Same goal/, 'the destination is never what moves');

// ── Target date already gone, weight not reached ──────────────────────────────
const late = proposeReplan({ ...base, targetDate: new Date('2026-06-01') });
assert.ok(late, 'a passed date with weight left is a re-plan, not a completed goal');
assert.strictEqual(late!.cause, 'date-passed');
assert.match(late!.headline, /been and gone/);

// ── Goal already reached is the celebration path, not this one ────────────────
assert.strictEqual(
  proposeReplan({ ...base, currentWeight: 79, targetDate: new Date('2026-06-01') }),
  null,
  'already at goal proposes nothing',
);
// Same for a gain goal that has overshot upward.
assert.strictEqual(
  proposeReplan({ ...base, goalType: 'gain', targetWeight: 90, currentWeight: 93, targetDate: new Date('2026-06-01') }),
  null,
  'gain goal already met proposes nothing',
);
// A gain goal genuinely behind still re-plans.
const gain = proposeReplan({ ...base, goalType: 'gain', targetWeight: 100, currentWeight: 93, targetDate: new Date('2026-08-10') });
assert.ok(gain && gain.weeksNeeded > 2, 'gain goals re-plan too');

// ── Maintain has no date to miss ──────────────────────────────────────────────
assert.strictEqual(
  proposeReplan({ ...base, goalType: 'maintain', targetDate: new Date('2026-06-01') }),
  null,
  'maintain never re-plans',
);

console.log('replan: all checks passed');
