// Self-check for the header weather toggle (run: npx tsx src/weatherPref.check.ts).
// Lives here rather than in promptPrefs.test.ts because jest can't discover tests from
// a .claude/worktrees path (the backslash escapes the glob), so `npm run check` is the
// only gate that actually runs everywhere.
import assert from 'assert';

// Minimal localStorage shim so the pref is exercisable under node (same shim as day.check.ts).
const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};

import { weatherEnabled, setWeatherEnabled } from './promptPrefs';

// Unset means on, so upgrading users keep the chip they already had.
assert.strictEqual(weatherEnabled(), true, 'unset → chip shows');

setWeatherEnabled(false);
assert.strictEqual(weatherEnabled(), false, 'turned off stays off');

setWeatherEnabled(true);
assert.strictEqual(weatherEnabled(), true, 'turned back on shows again');

// A junk value must not read as off — only an explicit 'false' hides the chip.
localStorage.setItem('superdub.weather.enabled', 'yes');
assert.strictEqual(weatherEnabled(), true, 'only an explicit false hides the chip');

console.log('weatherPref: all checks passed');
