// Runnable self-check for the reorder helpers. Run: npx tsx src/reorder.check.ts
import assert from 'assert';
import { moveItem, applyGroupReorder } from './reorder';

// moveItem: 0 → 2
assert.deepStrictEqual(moveItem(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd'], 'move 0→2');
// moveItem: 3 → 1
assert.deepStrictEqual(moveItem(['a', 'b', 'c', 'd'], 3, 1), ['a', 'd', 'b', 'c'], 'move 3→1');
// no-op
assert.deepStrictEqual(moveItem(['a', 'b'], 1, 1), ['a', 'b'], 'move to same slot');

// applyGroupReorder: reorder the daily group (Walk, Read, Water) inside a mixed
// list that also holds the mandatory habit and a weekly one, which must not move.
const all = ['Logging into Superdub', 'Walk', 'Meal Prep', 'Read', 'Water'];
// daily group in list-order is [Walk, Read, Water]; reorder to [Water, Walk, Read]
const out = applyGroupReorder(all, ['Water', 'Walk', 'Read']);
assert.deepStrictEqual(out, ['Logging into Superdub', 'Water', 'Meal Prep', 'Walk', 'Read'], 'group reorder keeps others fixed');

console.log('✓ reorder checks passed');
