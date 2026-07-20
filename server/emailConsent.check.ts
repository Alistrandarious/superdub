// Self-check for unsubscribe tokens (run: npx tsx server/emailConsent.check.ts)
process.env.JWT_SECRET = 'test-secret-for-check';
import assert from 'assert';
import { makeUnsubToken, verifyUnsubToken } from './services/emailConsent';

// ── Round-trips: the token carries the user id back out ─────────────────────────
const token = makeUnsubToken(42);
assert.strictEqual(verifyUnsubToken(token), 42, 'valid token → same user id');
assert.strictEqual(verifyUnsubToken(makeUnsubToken(1)), 1, 'works for other ids');

// ── Rejects: tampered / garbage / empty ─────────────────────────────────────────
assert.strictEqual(verifyUnsubToken(token.slice(0, -2) + 'xy'), null, 'tampered signature → null');
assert.strictEqual(verifyUnsubToken('not-a-jwt'), null, 'garbage → null');
assert.strictEqual(verifyUnsubToken(''), null, 'empty → null');

// ── Rejects: valid JWT signed with our secret but wrong purpose ─────────────────
import jwt from 'jsonwebtoken';
const wrongPurpose = jwt.sign({ uid: 42, p: 'login' }, process.env.JWT_SECRET!);
assert.strictEqual(verifyUnsubToken(wrongPurpose), null, 'wrong purpose claim → null');
const noUid = jwt.sign({ p: 'email-unsub' }, process.env.JWT_SECRET!);
assert.strictEqual(verifyUnsubToken(noUid), null, 'missing uid → null');

// ── Rejects: signed with a different secret (forgery) ───────────────────────────
const forged = jwt.sign({ uid: 42, p: 'email-unsub' }, 'some-other-secret');
assert.strictEqual(verifyUnsubToken(forged), null, 'foreign secret → null');

console.log('emailConsent.check.ts — all assertions passed');
