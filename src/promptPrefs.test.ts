import assert from 'assert';
import { promptEnabled, setPromptEnabled } from './promptPrefs';

// jest supplies `test` at runtime; declare it so the app's `tsc --noEmit` (no
// @types/jest) stays clean without adding a dev dependency.
declare const test: (name: string, fn: () => void) => void;

test('unset defaults: weigh-in follows the plan, the rest default on', () => {
  localStorage.clear();
  assert.strictEqual(promptEnabled('weight'), false, 'no plan → weigh-in off');
  assert.strictEqual(promptEnabled('sleep'), true);
  assert.strictEqual(promptEnabled('energy'), true);
  assert.strictEqual(promptEnabled('mood'), true);
  localStorage.setItem('superdub.plan.badge', JSON.stringify({ active: true }));
  assert.strictEqual(promptEnabled('weight'), true, 'active plan → weigh-in on');
});

test('an explicit choice overrides the default either way', () => {
  localStorage.clear();
  localStorage.setItem('superdub.plan.badge', JSON.stringify({ active: true }));
  setPromptEnabled('weight', false);
  assert.strictEqual(promptEnabled('weight'), false, 'explicit off beats active-plan default');
  setPromptEnabled('mood', false);
  assert.strictEqual(promptEnabled('mood'), false, 'explicit off beats the on default');
});
