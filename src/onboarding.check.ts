// Runnable self-check for the onboarding screen model. Run: npx tsx src/onboarding.check.ts
import assert from 'assert';
import { onboardingScreens, onbProgressPct, screenPrompt } from './onboarding';

// Password path: full flow, opens on account, ends on finish.
const pw = onboardingScreens(false);
assert(pw.length === 6, 'password flow has 6 screens');
assert(pw[0] === 'account', 'password flow opens on account');
assert(pw[pw.length - 1] === 'finish', 'password flow ends on finish');

// Google path: account dropped, opens on name, still ends on finish.
const g = onboardingScreens(true);
assert(g.length === 5, 'google flow has 5 screens');
assert(g[0] === 'name', 'google flow opens on name');
assert(!g.includes('account'), 'google flow has no account screen');
assert(g[g.length - 1] === 'finish', 'google flow ends on finish');

// The retired screens stay retired: a dead illustration step and an optional
// demographics wall between the user and their app (demographics live on Profile).
for (const dead of ['day', 'dub', 'more']) {
  assert(!(pw as string[]).includes(dead), `${dead} screen is retired`);
}

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

// Every screen asks its own question, except the finish reveal which titles
// itself from the user's name.
for (const s of onboardingScreens(false)) {
  if (s === 'finish') { assert(screenPrompt(s, 'Ali') === '', 'finish has no prompt'); continue; }
  assert(screenPrompt(s, 'Ali').length > 0, `screenPrompt present for ${s}`);
}
assert(screenPrompt('body', 'Ali').includes('Ali'), 'body prompt greets by name');

console.log('✓ onboarding checks passed');
