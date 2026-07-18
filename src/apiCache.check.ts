// Runnable check for the shared promise cache (npm run check).
// Guards the four properties E2.2 relies on: concurrent gets share one fetch, a
// resolved value is reused, invalidate() forces a refetch, a rejection releases
// the slot, and the TTL expires a stale value.
import assert from 'node:assert';
import { makeCache } from './apiCache';

(async () => {
  // ── dedup: concurrent + sequential gets share one fetch ──
  let calls = 0;
  const cache = makeCache(async () => { calls++; return calls; });
  const [a, b] = await Promise.all([cache.get(), cache.get()]);
  assert.strictEqual(calls, 1, 'concurrent gets must share one fetch');
  assert.strictEqual(a, b, 'shared result across concurrent gets');
  await cache.get();
  assert.strictEqual(calls, 1, 'a resolved cache must not refetch');

  // ── invalidate forces a refetch ──
  cache.invalidate();
  const c = await cache.get();
  assert.strictEqual(calls, 2, 'invalidate must force a refetch');
  assert.strictEqual(c, 2, 'fresh value after invalidate');

  // ── a rejection releases the slot so the next get retries ──
  let fail = true;
  let failCalls = 0;
  const flaky = makeCache(async () => { failCalls++; if (fail) throw new Error('boom'); return 'ok'; });
  await assert.rejects(flaky.get(), /boom/, 'first get rejects');
  fail = false;
  assert.strictEqual(await flaky.get(), 'ok', 'retry after failure succeeds');
  assert.strictEqual(failCalls, 2, 'a failed fetch must release the slot for a retry');

  // ── TTL expires a stale value ──
  let ttlCalls = 0;
  const ttl = makeCache(async () => { ttlCalls++; return ttlCalls; }, 20);
  await ttl.get();
  await ttl.get();
  assert.strictEqual(ttlCalls, 1, 'within TTL the value is reused');
  await new Promise(r => setTimeout(r, 35));
  await ttl.get();
  assert.strictEqual(ttlCalls, 2, 'past the TTL the value refetches');

  console.log('apiCache.check.ts OK');
})().catch(err => { console.error(err); process.exit(1); });
