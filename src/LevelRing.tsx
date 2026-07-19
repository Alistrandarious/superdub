import React, { useId, useRef, useEffect, useState, useCallback } from 'react';
import type { RingTheme } from './levels';
import LiquidCanvas from './LiquidCanvas';

// Each theme is either an arc (classic progress ring) or a liquid (water fill
// that rises with XP) — the fill is part of the theme's identity, earned as
// you level. Liquid themes render a real shallow-water sim on a <canvas>
// (LiquidCanvas); the SVG here draws only the rim + glare on top. All themes
// react to device tilt (gyroscope) or mouse hover with a perspective tilt + a
// shifting glare highlight, and that same tilt drives the water's slosh.

const TILT_MAX_DEG = 14;  // max perspective tilt angle
const GLARE_STRENGTH = 0.18;

const LevelRing: React.FC<{
  level: number;
  title: string;
  progress: number;
  theme: RingTheme;
  size?: number;
  onClick?: () => void;
}> = ({ level, title, progress, theme, size = 170, onClick }) => {
  const stroke = 13;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clampedP = Math.max(0, Math.min(1, progress));
  const offset = circ * (1 - clampedP);
  const gid = useId().replace(/:/g, '_');

  // ── Tilt state (-1..1) ──────────────────────────────────────────
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const rafRef = useRef<number>(0);

  const applyTilt = useCallback((x: number, y: number) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() =>
      setTilt({
        x: Math.max(-1, Math.min(1, x)),
        y: Math.max(-1, Math.min(1, y)),
      })
    );
  }, []);

  useEffect(() => {
    // Device gyroscope (mobile)
    const onOrientation = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0; // left-right: -90..90
      const beta  = e.beta  ?? 45; // front-back: 0..180
      applyTilt((beta - 45) / 45, gamma / 45);
    };
    window.addEventListener('deviceorientation', onOrientation, { passive: true });

    // Mouse fallback (desktop)
    const btn = btnRef.current;
    const onMouseMove = (e: MouseEvent) => {
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      applyTilt((e.clientY - cy) / (rect.height * 0.7), (e.clientX - cx) / (rect.width * 0.7));
    };
    const onMouseLeave = () => applyTilt(0, 0);
    btn?.addEventListener('mousemove', onMouseMove, { passive: true });
    btn?.addEventListener('mouseleave', onMouseLeave, { passive: true });

    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      btn?.removeEventListener('mousemove', onMouseMove);
      btn?.removeEventListener('mouseleave', onMouseLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, [applyTilt]);

  // ── Derived geometry ────────────────────────────────────────────
  const cx = size / 2, cy = size / 2;

  // Glare circle shifts with tilt
  const glareX = cx + tilt.y * size * 0.28;
  const glareY = cy + tilt.x * size * 0.22;

  // Liquid fill: part of the theme's identity (fill: 'liquid'). Liquid themes
  // are a filled vessel — NO arc ring; the water (rendered on the canvas) expands
  // to the full outer radius and its level alone shows progress.
  const useLiquid = theme.fill === 'liquid';
  const innerR = r - stroke / 2 - 1;      // inner disc for arc themes
  const R = size / 2;
  const fillR = useLiquid ? R - 2 : innerR; // water radius (hairline rim on liquid)

  const tiltTransform = `perspective(320px) rotateY(${tilt.y * TILT_MAX_DEG}deg) rotateX(${-tilt.x * TILT_MAX_DEG * 0.85}deg)`;

  return (
    <button
      ref={btnRef}
      className="lvl-ring"
      style={{ width: size, height: size, transform: tiltTransform, transition: 'transform 0.12s ease-out', willChange: 'transform' }}
      onClick={onClick}
      aria-label={`Level ${level}, ${title}`}
    >
      {useLiquid && (
        <LiquidCanvas
          size={size}
          fillR={fillR}
          progress={clampedP}
          from={theme.from}
          to={theme.to}
          tiltX={tilt.x}
          tiltY={tilt.y}
        />
      )}
      <svg width={size} height={size} className="lvl-ring-svg" style={{ overflow: 'visible', position: 'relative', zIndex: 1 }}>
        <defs>
          {/* Arc gradient */}
          <linearGradient id={`${gid}arc`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={theme.from} />
            <stop offset="100%" stopColor={theme.to} />
          </linearGradient>

          {/* Glare radial gradient */}
          <radialGradient id={`${gid}glare`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" stopOpacity={GLARE_STRENGTH} />
            <stop offset="100%" stopColor="#fff" stopOpacity={0} />
          </radialGradient>
        </defs>

        {useLiquid ? (
          // LIQUID THEME — the water is the canvas underneath; here we only lay
          // the themed rim on top (two crisp strokes; no drop-shadow filter — it
          // rasterises blurrily under the ring's 3D tilt).
          <>
            <circle cx={cx} cy={cy} r={fillR} fill="none" stroke={theme.glow} strokeWidth={5} />
            <circle cx={cx} cy={cy} r={fillR} fill="none" stroke={theme.to} strokeOpacity={0.65} strokeWidth={2.5} />
          </>
        ) : (
          <>
            {/* ARC THEME, track + progress arc around a dark inner disc */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#33333D" strokeWidth={stroke} />
            <circle
              className={`lvl-ring-arc${theme.animated ? ' animated' : ''}`}
              cx={cx} cy={cy} r={r} fill="none"
              stroke={`url(#${gid}arc)`} strokeWidth={stroke} strokeLinecap="butt"
              strokeDasharray={circ} strokeDashoffset={offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ filter: `drop-shadow(0 0 4px ${theme.glow})` }}
            />
            <circle cx={cx} cy={cy} r={innerR} fill="#0B0B11" />
          </>
        )}

        {/* Glare highlight, shifts with tilt */}
        <circle cx={glareX} cy={glareY} r={size * 0.36} fill={`url(#${gid}glare)`} style={{ pointerEvents: 'none' }} />
      </svg>

      <div className="lvl-ring-center" style={{ zIndex: 2 }}>
        <span className="lvl-ring-eyebrow">LEVEL</span>
        <span className="lvl-ring-num" style={{ color: theme.to }}>{level}</span>
        <span className="lvl-ring-title">{title}</span>
      </div>
    </button>
  );
};

export default LevelRing;
