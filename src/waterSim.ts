// Shallow-water height field — a row of surface samples coupled like springs so
// waves genuinely travel and reflect off the vessel walls, plus a weak pull
// toward each column's rest level so the body finds its (tilt-shifted) level.
// Pure and DOM-free so LiquidCanvas can render it and a *.check.ts can verify it.

export interface WaterParams {
  coupling: number; // neighbour spring — sets wave speed (keep < 0.5 for stability)
  gravity: number;  // pull toward the rest level — how fast the body finds its level
  damping: number;  // per-tick energy bleed — <1, or waves never calm
}

// Tuned for ~60fps, one step per frame: lively but stable, settles in ~1s.
export const WATER: WaterParams = { coupling: 0.28, gravity: 0.008, damping: 0.986 };

// One integration tick. `restY(i)` is the target surface Y for column i (canvas
// pixels, smaller = higher water). Mutates surf/vel in place. Walls are
// reflective (clamped neighbour index), so a wave bounces back instead of
// leaking off the edge.
export function stepWater(
  surf: Float32Array,
  vel: Float32Array,
  restY: (i: number) => number,
  p: WaterParams = WATER,
): void {
  const N = surf.length;
  for (let i = 0; i < N; i++) {
    const left = surf[i > 0 ? i - 1 : 0];
    const right = surf[i < N - 1 ? i + 1 : N - 1];
    const acc = ((left + right) * 0.5 - surf[i]) * p.coupling + (restY(i) - surf[i]) * p.gravity;
    vel[i] = (vel[i] + acc) * p.damping;
  }
  for (let i = 0; i < N; i++) surf[i] += vel[i];
}
