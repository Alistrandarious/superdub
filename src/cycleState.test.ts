import assert from 'assert';
import { cycleState } from './habitState';

// jest supplies `test` at runtime; declare it so the app's `tsc --noEmit` (which
// has no @types/jest) stays clean without adding a dev dependency.
declare const test: (name: string, fn: () => void) => void;

// The tap/big-button cycle must walk all four states in order and loop back to
// blank, so N/A is reachable and blank always returns. If this breaks, a habit
// tap could skip or strand a state.
test('cycleState walks done → failed → na → blank → done', () => {
  assert.strictEqual(cycleState(null), 'done');
  assert.strictEqual(cycleState('done'), 'failed');
  assert.strictEqual(cycleState('failed'), 'na');
  assert.strictEqual(cycleState('na'), null);
  // full loop returns to the start
  let s = null as ReturnType<typeof cycleState>;
  const seen: unknown[] = [];
  for (let i = 0; i < 4; i++) { s = cycleState(s); seen.push(s); }
  assert.deepStrictEqual(seen, ['done', 'failed', 'na', null]);
});
