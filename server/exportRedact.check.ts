// Runnable self-check for the data-export redaction. Run: npx tsx server/exportRedact.check.ts
//
// The export hands a user a copy of everything we hold about them. The one thing
// that must never slip through is a secret — a password hash, their API key, or
// push-crypto material. So the redaction gets a check.
import assert from 'assert';
import { EXPORT_OMIT, redactExportRow } from './exportRedact';

// ── The password hash never leaves, even though the export route hand-picks the
//    users columns, this is the belt to that braces ───────────────────────────
assert.ok(EXPORT_OMIT.users?.includes('password_hash'), 'password_hash is on the omit list');
const user = redactExportRow('users', { id: 1, email: 'a@b.co', password_hash: '$2b$secret' });
assert.strictEqual(user.password_hash, undefined, 'password hash is stripped');
assert.strictEqual(user.email, 'a@b.co', 'non-secret fields survive');

// ── The Anthropic API key is stripped from the profile ──────────────────────
const profile = redactExportRow('profile', { user_id: 1, name: 'Ali', anthropic_api_key: 'sk-ant-xxx' });
assert.strictEqual(profile.anthropic_api_key, undefined, 'API key is stripped');
assert.strictEqual(profile.name, 'Ali', 'profile data survives');

// ── Push crypto material is stripped ────────────────────────────────────────
const push = redactExportRow('push_subscriptions', { user_id: 1, endpoint: 'https://push', p256dh: 'KEY', auth: 'SECRET' });
assert.strictEqual(push.p256dh, undefined, 'push key stripped');
assert.strictEqual(push.auth, undefined, 'push auth stripped');

// ── A table with nothing to hide passes through untouched ───────────────────
const habit = { user_id: 1, name: 'Read', streak: 12 };
assert.deepStrictEqual(redactExportRow('habits', habit), habit, 'ordinary rows are unchanged');

// ── Redaction returns a COPY — it must never mutate the source row ───────────
const original = { user_id: 1, anthropic_api_key: 'sk-ant-xxx' };
redactExportRow('profile', original);
assert.strictEqual(original.anthropic_api_key, 'sk-ant-xxx', 'the source row is not mutated');

console.log('exportRedact.check.ts: all assertions passed');
