// Runnable self-check for the analytics consent gate. Run: npx tsx src/consent.check.ts
//
// The whole point of this file is that analytics stays OFF unless a key exists
// AND the user has explicitly said yes. Getting that gate wrong means either
// tracking people who never agreed, or never tracking anyone. So it gets a check.
import assert from 'assert';

// Minimal localStorage so consent.ts (browser code) runs under tsx.
let store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = String(v); },
  removeItem: (k: string) => { delete store[k]; },
};

import { analyticsConsent, storeConsent, analyticsActive, CONSENT_KEY } from './consent';

// ── Not asked yet ⇒ null, and analytics is OFF ──────────────────────────────
assert.strictEqual(analyticsConsent(), null, 'no stored value reads as null (not yet asked)');
assert.strictEqual(analyticsActive('phc_key', null), false, 'a key alone does NOT start analytics');

// ── The round trip ──────────────────────────────────────────────────────────
storeConsent(true);
assert.strictEqual(analyticsConsent(), 'granted', 'granting stores granted');
storeConsent(false);
assert.strictEqual(analyticsConsent(), 'denied', 'denying stores denied');

// ── Garbage in storage is not a valid consent ───────────────────────────────
store[CONSENT_KEY] = 'yes-please';
assert.strictEqual(analyticsConsent(), null, 'an unrecognised stored value is treated as not-asked');

// ── The gate: needs BOTH a key and explicit grant ───────────────────────────
assert.strictEqual(analyticsActive('phc_key', 'granted'), true,  'key + granted ⇒ active');
assert.strictEqual(analyticsActive('phc_key', 'denied'),  false, 'denied ⇒ never active');
assert.strictEqual(analyticsActive('phc_key', null),      false, 'not-asked ⇒ never active');
assert.strictEqual(analyticsActive(undefined,  'granted'), false, 'no key ⇒ dormant even if consented');
assert.strictEqual(analyticsActive('',         'granted'), false, 'empty key ⇒ dormant');
assert.strictEqual(analyticsActive(null,       'granted'), false, 'null key ⇒ dormant');

console.log('consent.check.ts: all assertions passed');
