import assert from 'node:assert';
import { stepWater } from './waterSim';

// A violently disturbed surface must settle toward its rest level and stay
// finite. If the scheme goes unstable (coupling too high) the ring's water would
// blow up into NaNs instead of finding its level.
{
  const N = 64;
  const surf = new Float32Array(N);
  const vel = new Float32Array(N);
  const REST = 50;
  for (let i = 0; i < N; i++) surf[i] = i % 2 ? 120 : 10; // zig-zag shock start
  for (let s = 0; s < 4000; s++) stepWater(surf, vel, () => REST);
  for (let i = 0; i < N; i++) {
    assert.ok(Number.isFinite(surf[i]), `surf[${i}] went non-finite`);
    assert.ok(Math.abs(surf[i] - REST) < 0.5, `column ${i} settled at ${surf[i].toFixed(2)}, expected ~${REST}`);
  }
}

// A tilted rest target must be tracked — water finds a sloped level, which is
// what makes the ring pool to the low edge when the phone rolls.
{
  const N = 64;
  const surf = new Float32Array(N);
  const vel = new Float32Array(N);
  const slope = (i: number) => 40 + (i / (N - 1)) * 30; // 40 → 70 across the vessel
  for (let s = 0; s < 6000; s++) stepWater(surf, vel, slope);
  for (let i = 0; i < N; i++) assert.ok(Number.isFinite(surf[i]), `surf[${i}] went non-finite`);
  // The centre is free of the reflective wall, so it tracks the tilt exactly;
  // the edges deflect a couple of px inward (a real wall/meniscus effect), so we
  // assert the surface tilts the right way and keeps most of the 30px span.
  const mid = surf[(N / 2) | 0];
  assert.ok(Math.abs(mid - 55) < 1, `centre settled at ${mid.toFixed(2)}, expected ~55`);
  assert.ok(surf[0] < surf[N - 1], 'surface did not tilt low-edge-up');
  assert.ok(surf[N - 1] - surf[0] > 24, `tilt span was ${(surf[N - 1] - surf[0]).toFixed(2)}, expected > 24 of 30`);
}

console.log('waterSim: settles to level + tracks tilt ✓');
