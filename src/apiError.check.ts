// Runnable self-check for the API error classifier. Run: npx tsx src/apiError.check.ts
//
// The point of ApiError is that a screen can tell the user something TRUE about
// why a load failed. Before this, every failure arrived as a bare Error and
// screens rendered their empty state — so "we can't reach the server" looked
// exactly like "you have no habits yet". On a streak tracker that reads as data
// loss, so the classification is worth a check.
import assert from 'assert';
import { ApiError, apiErrorMessage } from './api';

// ── Every kind produces its own message, and none of them lie ───────────────
const kinds = ['offline', 'timeout', 'auth', 'server'] as const;
const messages = kinds.map(k => apiErrorMessage(new ApiError(k, 'raw')));

assert(new Set(messages).size === kinds.length, 'each kind gets a distinct message');
assert(messages.every(m => m.length > 0), 'no kind falls through to an empty string');

// The raw internal message must never reach the user — it is developer text.
assert(!messages.includes('raw'), 'internal error text is not shown to the user');

// ── Offline copy must reassure, because this is the case that scared people ──
const offline = apiErrorMessage(new ApiError('offline', 'x'));
assert(/safe/i.test(offline), 'offline copy tells the user their data is safe');

// ── retryable: retrying a dead network can work, retrying a dead token cannot ─
assert(new ApiError('offline', 'x').retryable, 'offline is retryable');
assert(new ApiError('timeout', 'x').retryable, 'timeout is retryable');
assert(new ApiError('server', 'x').retryable, 'server error is retryable');
assert(!new ApiError('auth', 'x').retryable, 'auth is NOT retryable — it needs a new session, not another go');

// ── instanceof must survive, or `err instanceof ApiError` in screens silently
//    fails and every message degrades to the generic fallback ────────────────
const e = new ApiError('server', 'boom', 500);
assert(e instanceof ApiError, 'ApiError is instanceof ApiError');
assert(e instanceof Error, 'ApiError is still an Error');
assert(e.status === 500, 'status is carried for logging');
assert(e.name === 'ApiError', 'name is set so logs are readable');

// ── Unknown throws still get a sentence, never "[object Object]" or a crash ──
for (const junk of [new Error('plain'), 'a string', null, undefined, { weird: true }]) {
  const m = apiErrorMessage(junk);
  assert(typeof m === 'string' && m.length > 0, `non-ApiError still yields copy: ${String(junk)}`);
  assert(!m.includes('object Object'), 'never leaks a stringified object to the user');
}

console.log('apiError.check.ts: all assertions passed');
