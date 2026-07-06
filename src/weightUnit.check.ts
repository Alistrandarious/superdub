// Self-check for weight-unit conversions (run: npx tsx src/weightUnit.check.ts)
// Only the pure converters are exercised — the React hook needs a DOM.
import assert from 'assert';
import { kgToLbs, lbsToKg, formatWeightKg, unitLabel, kgToUnitValue, unitValueToKg } from './weightUnit';

const near = (a: number, b: number, tol = 0.05) => assert.ok(Math.abs(a - b) < tol, `${a} !~= ${b}`);

// ── kg ↔ lb ─────────────────────────────────────────────────────────────────────
near(kgToLbs(100), 220.462);
near(lbsToKg(220.462), 100);
near(lbsToKg(kgToLbs(73.4)), 73.4); // round-trip

// ── kgToUnitValue / unitValueToKg: single-decimal in each unit, round-trips ───────
assert.strictEqual(kgToUnitValue(80, 'kg'), 80);
near(kgToUnitValue(100, 'lbs'), 220.462);
near(kgToUnitValue(100, 'st'), 220.462 / 14); // ~15.75 st decimal
near(kgToUnitValue(-2, 'lbs'), -4.409);       // linear → correct for signed deltas

assert.strictEqual(unitValueToKg(80, 'kg'), 80);
near(unitValueToKg(220.462, 'lbs'), 100);
near(unitValueToKg(kgToUnitValue(84.2, 'st'), 'st'), 84.2); // kg → st → kg
near(unitValueToKg(kgToUnitValue(84.2, 'lbs'), 'lbs'), 84.2);

// ── display formatting: a single decimal + unit ──────────────────────────────────
assert.strictEqual(formatWeightKg(100, 'kg'), '100 kg');
assert.strictEqual(formatWeightKg(100, 'lbs'), '220.5 lb');
assert.strictEqual(formatWeightKg(100, 'st'), '15.7 st'); // decimal stone
assert.strictEqual(formatWeightKg(0, 'kg'), '—');   // no data
assert.strictEqual(formatWeightKg(-5, 'st'), '—');  // guard against garbage

assert.strictEqual(unitLabel('kg'), 'kg');
assert.strictEqual(unitLabel('lbs'), 'lb');
assert.strictEqual(unitLabel('st'), 'st');

console.log('weightUnit: all checks passed');
