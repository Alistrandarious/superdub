import React, { useId, useRef, useEffect, useState, useCallback } from 'react';
import { getRingFill, type RingTheme } from './levels';

// The liquid fill is a separate cosmetic from the colour theme: any theme can
// run 'classic' (arc only) or 'liquid' (water fill that rises with XP).
// All themes react to device tilt (gyroscope) or mouse hover with a perspective
// tilt + a shifting glare highlight — like holding a coin under a light.

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

  // ── Fill style (classic arc vs liquid) — device-level preference ─
  const [fill, setFill] = useState(getRingFill);
  useEffect(() => {
    const sync = () => setFill(getRingFill());
    window.addEventListener('superdub:ring-fill-changed', sync);
    return () => window.removeEventListener('superdub:ring-fill-changed', sync);
  }, []);

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

  // Liquid fill: the user's fill-style pick — works with any colour theme
  const useLiquid = fill === 'liquid';
  const innerR = r - stroke / 2 - 1;
  // Liquid level: rises from bottom of inner circle
  const liquidTopY = cy + innerR - clampedP * innerR * 2;

  // Wave path at liquid surface (sine wave spanning the inner circle width)
  const waveAmp = clampedP > 0.02 && clampedP < 0.98 ? 3.5 : 0;
  const wavePts = Array.from({ length: 24 }, (_, i) => {
    const t = i / 23;
    const px = (cx - innerR) + t * innerR * 2;
    const py = liquidTopY + Math.sin(t * Math.PI * 3) * waveAmp;
    return `${i === 0 ? 'M' : 'L'}${px.toFixed(2)},${py.toFixed(2)}`;
  }).join(' ');
  const liquidPath = `${wavePts} L${cx + innerR},${cy + innerR} L${cx - innerR},${cy + innerR} Z`;

  const tiltTransform = `perspective(320px) rotateY(${tilt.y * TILT_MAX_DEG}deg) rotateX(${-tilt.x * TILT_MAX_DEG * 0.85}deg)`;

  return (
    <button
      ref={btnRef}
      className="lvl-ring"
      style={{ width: size, height: size, transform: tiltTransform, transition: 'transform 0.12s ease-out', willChange: 'transform' }}
      onClick={onClick}
      aria-label={`Level ${level} — ${title}`}
    >
      <svg width={size} height={size} className="lvl-ring-svg" style={{ overflow: 'visible' }}>
        <defs>
          {/* Arc gradient */}
          <linearGradient id={`${gid}arc`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={theme.from} />
            <stop offset="100%" stopColor={theme.to} />
          </linearGradient>

          {/* Liquid fill gradient (bottom-up) */}
          {useLiquid && (
            <linearGradient id={`${gid}liq`} x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor={theme.to} stopOpacity={0.75} />
              <stop offset="100%" stopColor={theme.from} stopOpacity={0.55} />
            </linearGradient>
          )}

          {/* Clip path: inner circle only */}
          {useLiquid && (
            <clipPath id={`${gid}clip`}>
              <circle cx={cx} cy={cy} r={innerR} />
            </clipPath>
          )}

          {/* Glare radial gradient */}
          <radialGradient id={`${gid}glare`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" stopOpacity={GLARE_STRENGTH} />
            <stop offset="100%" stopColor="#fff" stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* 1. Track ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#33333D" strokeWidth={stroke} />

        {/* 2. Liquid fill (animated themes only) */}
        {useLiquid && clampedP > 0 && (
          <g clipPath={`url(#${gid}clip)`}>
            <path d={liquidPath} fill={`url(#${gid}liq)`} className="lvl-liquid-fill" />
          </g>
        )}

        {/* 3. Progress arc */}
        <circle
          className={`lvl-ring-arc${theme.animated ? ' animated' : ''}`}
          cx={cx} cy={cy} r={r} fill="none"
          stroke={`url(#${gid}arc)`} strokeWidth={stroke} strokeLinecap="butt"
          strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ filter: `drop-shadow(0 0 4px ${theme.glow})` }}
        />

        {/* 4. Inner background (hide liquid outside the ring area) */}
        {!useLiquid && (
          <circle cx={cx} cy={cy} r={innerR} fill="#0B0B11" />
        )}
        {useLiquid && (
          /* Dark overlay ring between inner circle edge and outer ring edge */
          <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="#0B0B11" strokeWidth={2} />
        )}

        {/* 5. Glare highlight — shifts with tilt */}
        <circle cx={glareX} cy={glareY} r={size * 0.36} fill={`url(#${gid}glare)`} style={{ pointerEvents: 'none' }} />
      </svg>

      <div className="lvl-ring-center">
        <span className="lvl-ring-eyebrow">LEVEL</span>
        <span className="lvl-ring-num" style={{ color: theme.to }}>{level}</span>
        <span className="lvl-ring-title">{title}</span>
      </div>
    </button>
  );
};

export default LevelRing;
