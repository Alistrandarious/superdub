// Runnable self-check for the onboarding screen model. Run: npx tsx src/onboarding.check.ts
import assert from 'assert';
import { onboardingScreens, onbProgressPct } from './onboarding';

// Password path: full flow, opens on account, ends on finish.
const pw = onboardingScreens(false);
assert(pw.length === 9, 'password flow has 9 screens');
assert(pw[0] === 'account', 'password flow opens on account');
assert(pw[pw.length - 1] === 'finish', 'password flow ends on finish');

// Google path: account dropped, opens on name, still ends on finish.
const g = onboardingScreens(true);
assert(g.length === 8, 'google flow has 8 screens');
assert(g[0] === 'name', 'google flow opens on name');
assert(!g.includes('account'), 'google flow has no account screen');
assert(g[g.length - 1] === 'finish', 'google flow ends on finish');

// Progress is strictly increasing and the last screen is exactly 100%.
for (const screens of [pw, g]) {
  let prev = -1;
  screens.forEach((_, i) => {
    const pct = onbProgressPct(i, screens.length);
    assert(pct > prev, 'progress must strictly increase');
    prev = pct;
  });
  assert(onbProgressPct(screens.length - 1, screens.length) === 100, 'last screen is 100%');
}

console.log('✓ onboarding checks passed');
