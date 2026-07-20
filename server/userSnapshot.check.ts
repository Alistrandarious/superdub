// Self-check for snapshot date helpers (run: npx tsx server/userSnapshot.check.ts)
// Only the pure helpers are exercised here; the DB assembly is covered by the
// compose-HTML smoke script in the plan's verification section.
import assert from 'assert';
import { normalizeDDMM, recentDayKeys, currentStreak } from './services/userSnapshot';

// ── normalizeDDMM: accepts both stored shapes ───────────────────────────────────
assert.strictEqual(normalizeDDMM('2026-07-19T00:00:00Z'), '19/07', 'ISO → DD/MM');
assert.strictEqual(normalizeDDMM('2026-03-05'), '05/03', 'ISO date-only → DD/MM');
assert.strictEqual(normalizeDDMM('19/07'), '19/07', 'already DD/MM → unchanged');

// ── recentDayKeys: last n days, today first ─────────────────────────────────────
const now = new Date(2026, 6, 19); // 19 Jul 2026 (local)
assert.deepStrictEqual(recentDayKeys(now, 3), ['19/07', '18/07', '17/07'], 'three keys, newest first');
assert.strictEqual(recentDayKeys(now, 7).length, 7, 'seven keys for a week');
// Rolls back across a month boundary.
assert.deepStrictEqual(recentDayKeys(new Date(2026, 6, 1), 2), ['01/07', '30/06'], 'crosses month start');

// ── currentStreak: consecutive done-days ending today or yesterday ──────────────
const done = (keys: string[]) => new Set(keys);
assert.strictEqual(currentStreak(done(['19/07', '18/07', '17/07']), now), 3, 'unbroken run to today');
assert.strictEqual(currentStreak(done(['18/07', '17/07']), now), 2, 'today pending, run to yesterday still counts');
assert.strictEqual(currentStreak(done(['17/07']), now), 0, 'gap at yesterday → streak broken');
assert.strictEqual(currentStreak(done(['19/07']), now), 1, 'just today');
assert.strictEqual(currentStreak(done([]), now), 0, 'nothing done → 0');
assert.strictEqual(currentStreak(done(['19/07', '18/07', '16/07']), now), 2, 'gap stops the count');

console.log('userSnapshot.check.ts — all assertions passed');
