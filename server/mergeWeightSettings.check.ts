// Self-check for the weight-settings merge (run: npx tsx server/mergeWeightSettings.check.ts)
import assert from 'assert';
import { mergeWeightSettings } from './routes/weightSettings';

// profile biometrics win over stale legacy weight_settings copies
const merged = mergeWeightSettings(
  { current_weight: '95', goal_weight: '80', loss_per_week: '0.5', height: '170', age: '30', activity_level: '1.2' },
  { weight_kg: '88', height_cm: '178', age: '31', dob: null, activity: '1.55' }
);
assert.strictEqual(merged.currentWeight, '88');
assert.strictEqual(merged.height, '178');
assert.strictEqual(merged.age, '31');
assert.strictEqual(merged.activityLevel, '1.55');
// goal fields come only from weight_settings
assert.strictEqual(merged.goalWeight, '80');
assert.strictEqual(merged.lossPerWeek, '0.5');

// legacy-only account (empty profile) falls back to weight_settings
const legacy = mergeWeightSettings(
  { current_weight: '95', goal_weight: '80', height: '170', age: '30', activity_level: '1.2' },
  { weight_kg: '', height_cm: '', age: '', dob: null, activity: '' }
);
assert.strictEqual(legacy.currentWeight, '95');
assert.strictEqual(legacy.height, '170');
assert.strictEqual(legacy.age, '30');
assert.strictEqual(legacy.activityLevel, '1.2');

// age falls back to dob when profile.age is empty
const dob = new Date(); dob.setFullYear(dob.getFullYear() - 25); dob.setDate(dob.getDate() - 1);
const viaDob = mergeWeightSettings({}, { dob: dob.toISOString().slice(0, 10) });
assert.strictEqual(viaDob.age, '25');

// brand-new user: sane defaults, nothing undefined
const fresh = mergeWeightSettings(null, null);
assert.strictEqual(fresh.currentWeight, '');
assert.strictEqual(fresh.activityLevel, '1.4');

console.log('mergeWeightSettings: all checks passed');
