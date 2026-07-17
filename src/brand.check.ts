// Runnable self-check for the wordmark sanitizer. Run: npx tsx src/brand.check.ts
import assert from 'assert';
import { nickToWordmark } from './brand';

assert.strictEqual(nickToWordmark('Ali'), 'ali', 'lowercases');
assert.strictEqual(nickToWordmark('Big Al'), 'bigal', 'strips spaces');
assert.strictEqual(nickToWordmark('J.D.'), 'jd', 'strips punctuation');
assert.strictEqual(nickToWordmark(''), 'dub', 'empty falls back to dub');
assert.strictEqual(nickToWordmark('   '), 'dub', 'whitespace-only falls back to dub');
assert.strictEqual(nickToWordmark('!!!'), 'dub', 'all-symbols falls back to dub');

console.log('✓ brand checks passed');
