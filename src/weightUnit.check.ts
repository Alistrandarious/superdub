// Self-check for weight-unit conversions (run: npx tsx src/weightUnit.check.ts)
// Only the pure converters are exercised — the React hook needs a DOM.
import assert from 'assert';
import { kgToLbs, lbsToKg, kgToStLb, stLbToKg, formatWeightKg, unitLabel, kgToUnitValue } from './weightUnit';

const near = (a: number, b: number, tol = 0.05) => assert.ok(Math.abs(a - b) < tol, `${a} !~= ${b}`);

// ── kg ↔ lb ─────────────────────────────────────────────────────────────────────
near(kgToLbs(100), 220.462);
near(lbsToKg(220.462), 100);
near(lbsToKg(kgToLbs(73.4)), 73.4); // round-trip

// ── kg ↔ st+lb ───────────────────────────────────────────────────────────────────
// 100 kg = 220.462 lb = 15 st (210 lb) + 10.5 lb
const s = kgToStLb(100);
assert.strictEqual(s.st, 15);
near(s.lb, 10.5);
near(stLbToKg(15, 10.5), 100);          // round-trip within rounding
near(stLbToKg(kgToStLb(84.2).st, kgToStLb(84.2).lb), 84.2);

// rounding edge: a remainder that rounds to 14 lb must roll into the next stone
const edge = kgToStLb(lbsToKg(14 + 13.98)); // ~27.98 lb → 1 st 13.98 lb → 2 st 0 lb
assert.strictEqual(edge.st, 2);
assert.strictEqual(edge.lb, 0);

// ── display formatting ───────────────────────────────────────────────────────────
assert.strictEqual(formatWeightKg(100, 'kg'), '100 kg');
assert.strictEqual(formatWeightKg(100, 'lbs'), '220.5 lb');
assert.strictEqual(formatWeightKg(100, 'st'), '15 st 10.5 lb');
assert.strictEqual(formatWeightKg(0, 'kg'), '—');   // no data
assert.strictEqual(formatWeightKg(-5, 'st'), '—');  // guard against garbage

assert.strictEqual(unitLabel('kg'), 'kg');
assert.strictEqual(unitLabel('lbs'), 'lb');
assert.strictEqual(unitLabel('st'), 'st');

// ── kgToUnitValue: numeric (used for chart axes + single-number displays) ────────
assert.strictEqual(kgToUnitValue(80, 'kg'), 80);
near(kgToUnitValue(100, 'lbs'), 220.462);
near(kgToUnitValue(100, 'st'), 220.462 / 14); // ~15.75 st decimal
// linear through origin → correct for signed deltas too
near(kgToUnitValue(-2, 'lbs'), -4.409);

console.log('weightUnit: all checks passed');
