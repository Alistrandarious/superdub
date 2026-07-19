import React, { useEffect, useRef } from 'react';
import { stepWater, WATER } from './waterSim';

// Pixel-water: the liquid ring's fill rendered on a <canvas> by a real
// shallow-water simulation (see waterSim.ts) — not an SVG wave path. Surface
// columns are coupled like springs, so waves actually travel and bounce off the
// vessel walls; a weak restoring pull makes the body seek its level. The level
// sloshes when the phone tilts (water finds its level opposite the roll) and
// splashes when XP lands. Sits behind the SVG rim/glare in LevelRing.
// ponytail: the rAF sim runs while the tab is visible even if the ring is
// scrolled off-screen (ceiling). Upgrade path: pause via IntersectionObserver.

interface Props {
  size: number;
  fillR: number;        // water disc radius
  progress: number;     // 0..1 target level
  from: string;         // theme deep colour (bottom of gradient)
  to: string;           // theme bright colour (top / surface)
  tiltX: number;        // -1..1 front-back tilt
  tiltY: number;        // -1..1 left-right roll (drives the slosh)
}

interface Bubble { x: number; y: number; r: number; vy: number; wob: number; phase: number; }

const LiquidCanvas: React.FC<Props> = ({ size, fillR, progress, from, to, tiltX, tiltY }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Live inputs the animation loop reads without restarting (tilt every frame,
  // progress compared each frame to detect an XP splash).
  const tiltRef = useRef({ x: tiltX, y: tiltY });
  const progRef = useRef(progress);
  useEffect(() => { tiltRef.current = { x: tiltX, y: tiltY }; }, [tiltX, tiltY]);
  useEffect(() => { progRef.current = progress; }, [progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2, cy = size / 2, R = fillR;
    const N = Math.max(48, Math.round(size / 2)); // surface columns (~2px apart)
    const surf = new Float32Array(N);
    const vel = new Float32Array(N);
    const colX = (i: number) => cx - R + (i / (N - 1)) * R * 2;
    const colXs = Array.from({ length: N }, (_, i) => colX(i));
    const levelToY = (lv: number) => cy + R - Math.max(0, Math.min(1, lv)) * R * 2;
    const surfaceAt = (x: number) => {
      const idx = Math.max(0, Math.min(N - 1, Math.round(((x - (cx - R)) / (R * 2)) * (N - 1))));
      return surf[idx];
    };

    let lastProg = progRef.current;
    for (let i = 0; i < N; i++) surf[i] = levelToY(lastProg); // start settled

    // A few rising bubbles for life inside the column.
    const bubbles: Bubble[] = Array.from({ length: 5 }, () => ({
      x: cx + (Math.random() - 0.5) * R * 1.1,
      y: cy + R - Math.random() * R,
      r: 0.8 + Math.random() * 1.4,
      vy: 0.25 + Math.random() * 0.4,
      wob: 0.3 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
    }));

    const gradTop = to, gradBottom = from;

    const drawFill = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      // Empty vessel
      ctx.fillStyle = '#0B0B11';
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

      // Water body — surface polyline down to the floor
      const grad = ctx.createLinearGradient(0, cy - R, 0, cy + R);
      grad.addColorStop(0, gradTop);
      grad.addColorStop(1, gradBottom);
      ctx.beginPath();
      ctx.moveTo(colXs[0], surf[0]);
      for (let i = 1; i < N; i++) ctx.lineTo(colXs[i], surf[i]);
      ctx.lineTo(cx + R, cy + R);
      ctx.lineTo(cx - R, cy + R);
      ctx.closePath();
      ctx.globalAlpha = 0.82;
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Bubbles (behind the surface sheen)
      for (const b of bubbles) {
        if (b.y <= surfaceAt(b.x) + 1) continue;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = gradTop;
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Sky-reflection band just under the surface
      ctx.beginPath();
      ctx.moveTo(colXs[0], surf[0]);
      for (let i = 1; i < N; i++) ctx.lineTo(colXs[i], surf[i]);
      for (let i = N - 1; i >= 0; i--) ctx.lineTo(colXs[i], surf[i] + 7);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fill();

      // Bright meniscus line riding the surface
      ctx.beginPath();
      ctx.moveTo(colXs[0], surf[0]);
      for (let i = 1; i < N; i++) ctx.lineTo(colXs[i], surf[i]);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.restore();
    };

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      for (let i = 0; i < N; i++) surf[i] = levelToY(progRef.current);
      drawFill();
      return;
    }

    let raf = 0;
    let running = true;

    const tick = () => {
      const p = progRef.current;

      // XP splash — level changed: kick a velocity burst, biggest at the centre.
      if (p !== lastProg) {
        const dy = Math.max(-28, Math.min(28, levelToY(p) - levelToY(lastProg)));
        const mid = (N - 1) / 2;
        for (let i = 0; i < N; i++) {
          const k = 1 - Math.abs(i - mid) / mid;
          vel[i] += dy * 0.5 * k;
        }
        lastProg = p;
      }

      // Ambient life — the odd stray droplet so still water never looks dead.
      if (Math.random() < 0.03) {
        vel[(Math.random() * N) | 0] += 0.4 + Math.random() * 0.6;
      }

      // Tilt: the surface seeks a sloped level — pools to the low edge (roll).
      const roll = Math.max(-1, Math.min(1, tiltRef.current.y));
      const slope = -roll * R * 0.5;
      const targetY = levelToY(p);
      stepWater(surf, vel, (i) => targetY + ((colXs[i] - cx) / R) * slope, WATER);

      // Bubbles rise and wobble, respawning at the floor when they hit air.
      for (const b of bubbles) {
        b.y -= b.vy;
        b.phase += 0.12;
        b.x += Math.sin(b.phase) * b.wob;
        if (b.y <= surfaceAt(b.x) + 1) {
          b.x = cx + (Math.random() - 0.5) * R * 1.1;
          b.y = cy + R - 2;
          b.r = 0.8 + Math.random() * 1.4;
        }
      }

      drawFill();
      if (running) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Don't burn frames on a backgrounded tab.
    const onVis = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!running) { running = true; raf = requestAnimationFrame(tick); }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [size, fillR, from, to]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ position: 'absolute', inset: 0, width: size, height: size, zIndex: 0, pointerEvents: 'none' }}
      aria-hidden
    />
  );
};

export default LiquidCanvas;
