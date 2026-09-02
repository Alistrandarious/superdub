// Self-check for the signup-day quiet rule (run: npx tsx src/firstDay.check.ts).
// A new account finishing onboarding in the evening must not be met by the
// evening reflection sheet over a home screen it has never seen.
import assert from 'assert';

const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};

import { markSignupDay, isSignupDay } from './promptPrefs';

// Nothing stamped: an existing account is never treated as brand new.
assert.strictEqual(isSignupDay('2026-09-02'), false, 'unstamped is not signup day');

markSignupDay('2026-09-02');
assert.strictEqual(isSignupDay('2026-09-02'), true, 'signup day is quiet');
// The very next day the prompts resume — the rule must not silence them forever.
assert.strictEqual(isSignupDay('2026-09-03'), false, 'the day after is not quiet');

console.log('firstDay: all checks passed');
