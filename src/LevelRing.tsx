import React, { useId, useRef, useEffect, useState, useCallback } from 'react';
import type { RingTheme } from './levels';

// Each theme is either an arc (classic progress ring) or a liquid (water fill
// that rises with XP) — the fill is part of the theme's identity, earned as
// you level. All themes react to device tilt (gyroscope) or mouse hover with
// a perspective tilt + a shifting glare highlight.

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

  // ── Water level: spring-settle instead of snap ──────────────────
  // Real water pours in and finds its level with a little overshoot, not an
  // instant jump. When progress changes we run an under-damped spring toward
  // the new level and carry its velocity out so the surface sloshes harder
  // while the level is still moving, then calms. rAF only runs while settling
  // (idle at rest — no battery cost), and reduced-motion snaps straight there.
  const [settle, setSettle] = useState({ p: clampedP, v: 0 });
  const springRef = useRef({ p: clampedP, v: 0 });
  const settleRafRef = useRef(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      springRef.current = { p: clampedP, v: 0 };
      setSettle({ p: clampedP, v: 0 });
      return;
    }
    const K = 110, D = 9; // D < 2·√K ⇒ slight overshoot (the slosh)
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const s = springRef.current;
      s.v += (-K * (s.p - clampedP) - D * s.v) * dt;
      s.p += s.v * dt;
      if (Math.abs(s.p - clampedP) > 0.0005 || Math.abs(s.v) > 0.0005) {
        setSettle({ p: s.p, v: s.v });
        settleRafRef.current = requestAnimationFrame(step);
      } else {
        s.p = clampedP; s.v = 0;
        setSettle({ p: clampedP, v: 0 });
      }
    };
    settleRafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(settleRafRef.current);
  }, [clampedP]);
  const displayP = Math.max(0, Math.min(1, settle.p));

  // ── Derived geometry ────────────────────────────────────────────
  const cx = size / 2, cy = size / 2;

  // Glare circle shifts with tilt
  const glareX = cx + tilt.y * size * 0.28;
  const glareY = cy + tilt.x * size * 0.22;

  // Liquid fill: part of the theme's identity (fill: 'liquid'). Liquid themes
  // are a filled vessel — NO arc ring; the water expands to the full outer
  // radius and its level alone shows progress.
  const useLiquid = theme.fill === 'liquid';
  const innerR = r - stroke / 2 - 1;      // inner disc for arc themes
  const R = size / 2;
  const fillR = useLiquid ? R - 2 : innerR; // water radius (hairline rim on liquid)
  // Liquid level: rises from the bottom of the fill circle (spring-settled level)
  const liquidTopY = cy + fillR - displayP * fillR * 2;

  // Wave at the liquid surface: smooth quadratic curves (no straight-segment
  // facets), extended past the clip on both sides so the CSS slosh animation
  // (translateX ±6px) never drags a hard edge into view.
  // Surface = a densely-sampled line (smooth, no facets) that (a) ripples with a
  // sine wave and (b) TILTS with device roll so the water finds its level like
  // real liquid as you move the phone.
  // Base ripple when the vessel is between empty and full, plus a boost while the
  // level is still settling — a fresh pour sloshes hard, then calms to the gentle
  // idle ripple as the spring's velocity bleeds off.
  const sloshBoost = Math.min(7, Math.abs(settle.v) * 16);
  const waveAmp = (displayP > 0.02 && displayP < 0.98 ? 3.5 : 0) + sloshBoost;
  const WAVE_EXT = 16;
  const wx0 = cx - fillR - WAVE_EXT;
  const wx1 = cx + fillR + WAVE_EXT;
  // Negative: water pools toward the LOW edge, so the surface rises (smaller y)
  // on the side the phone tilts down — real liquid finds its level opposite the roll.
  const slope = -Math.max(-1, Math.min(1, tilt.y)) * fillR * 0.5; // height delta centre→edge
  const N = 44;
  const bottomY = cy + fillR + 2;
  // Surface height at t (0..1) — TWO summed sines of different frequency give a
  // richer, non-uniform crest that doesn't read as one plain wave. `phase`,
  // `ampScale` and `levelShift` let the front + back layers differ. The two
  // layers are then slid at different speeds in CSS so the composite morphs.
  const surfaceY = (t: number, phase: number, ampScale: number, levelShift: number) => {
    const px = wx0 + (wx1 - wx0) * t;
    const base = liquidTopY + levelShift + ((px - cx) / fillR) * slope;
    const ripple = (Math.sin(t * Math.PI * 3 + phase) * 2.4 + Math.sin(t * Math.PI * 5 + 0.9 + phase) * 1.1)
      * (waveAmp / 3.5) * ampScale;
    return base + ripple;
  };
  const surfaceLine = (phase: number, ampScale: number, levelShift: number) => {
    let d = '';
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const px = wx0 + (wx1 - wx0) * t;
      d += `${i === 0 ? 'M' : 'L'}${px.toFixed(2)},${surfaceY(t, phase, ampScale, levelShift).toFixed(2)} `;
    }
    return d;
  };
  const fillFrom = (phase: number, ampScale: number, levelShift: number) =>
    `${surfaceLine(phase, ampScale, levelShift)}L${wx1.toFixed(2)},${bottomY.toFixed(2)} L${wx0.toFixed(2)},${bottomY.toFixed(2)} Z`;
  const liquidPath = fillFrom(0, 1, 0);
  const liquidPathBack = fillFrom(1.9, 1.15, -2.5); // offset phase + slightly higher so it peeks above the front
  const liquidSurfaceLine = surfaceLine(0, 1, 0);
  // Rising bubbles (subtle), placed within the water column. Clipped to the water
  // body so they dissolve at the surface. Only when the vessel is actually rippling.
  const bubbles = (useLiquid && waveAmp > 0) ? [
    { x: cx - fillR * 0.50, r: 1.6, delay: 0.0, dur: 5.6 },
    { x: cx - fillR * 0.18, r: 1.1, delay: 1.9, dur: 6.6 },
    { x: cx + fillR * 0.10, r: 2.0, delay: 0.8, dur: 5.0 },
    { x: cx + fillR * 0.34, r: 1.3, delay: 2.7, dur: 6.1 },
    { x: cx + fillR * 0.55, r: 0.9, delay: 1.3, dur: 7.0 },
    { x: cx - fillR * 0.62, r: 1.0, delay: 3.5, dur: 6.3 },
  ] : [];

  const tiltTransform = `perspective(320px) rotateY(${tilt.y * TILT_MAX_DEG}deg) rotateX(${-tilt.x * TILT_MAX_DEG * 0.85}deg)`;

  return (
    <button
      ref={btnRef}
      className="lvl-ring"
      style={{ width: size, height: size, transform: tiltTransform, transition: 'transform 0.12s ease-out', willChange: 'transform' }}
      onClick={onClick}
      aria-label={`Level ${level}, ${title}`}
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

          {/* Clip path: the full water disc */}
          {useLiquid && (
            <clipPath id={`${gid}clip`}>
              <circle cx={cx} cy={cy} r={fillR} />
            </clipPath>
          )}

          {/* Water-body clip: everything below the surface line (bubbles use it,
              nested inside the disc clip, so they only show inside the water). */}
          {useLiquid && (
            <clipPath id={`${gid}water`}>
              <rect x={cx - fillR} y={liquidTopY} width={fillR * 2} height={bottomY - liquidTopY} />
            </clipPath>
          )}

          {/* Glare radial gradient */}
          <radialGradient id={`${gid}glare`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" stopOpacity={GLARE_STRENGTH} />
            <stop offset="100%" stopColor="#fff" stopOpacity={0} />
          </radialGradient>
        </defs>

        {useLiquid ? (
          <>
            {/* LIQUID THEME, a filled vessel, no arc. Dark empty vessel, water
                on top clipped to the full disc, then a thin themed rim. */}
            <circle cx={cx} cy={cy} r={fillR} fill="#0B0B11" />
            {displayP > 0 && (
              <g clipPath={`url(#${gid}clip)`}>
                {/* Back swell — lighter, slid the other way so the surface morphs */}
                <path d={liquidPathBack} fill={theme.from} fillOpacity={0.28} className="lvl-liquid-back" shapeRendering="geometricPrecision" />
                {/* Front body — the main themed water */}
                <path d={liquidPath} fill={`url(#${gid}liq)`} className="lvl-liquid-front" shapeRendering="geometricPrecision" />
                {/* Waterline highlight — catches the light, rides with the front */}
                {waveAmp > 0 && (
                  <path d={liquidSurfaceLine} fill="none" stroke="#fff" strokeOpacity={0.32} strokeWidth={1.2} className="lvl-liquid-front" shapeRendering="geometricPrecision" />
                )}
                {/* Rising bubbles, clipped to the water body (disc ∩ water rect) */}
                {bubbles.length > 0 && (
                  <g clipPath={`url(#${gid}water)`}>
                    {bubbles.map((b, i) => (
                      <circle
                        key={i}
                        className="lvl-bubble"
                        cx={b.x}
                        cy={bottomY - 3}
                        r={b.r}
                        fill={theme.from}
                        fillOpacity={0.55}
                        style={{ animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s` }}
                      />
                    ))}
                  </g>
                )}
              </g>
            )}
            {/* Rim, two crisp strokes (no drop-shadow filter; filters rasterise
                blurrily under the ring's 3D tilt and look pixelated). */}
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

      <div className="lvl-ring-center">
        <span className="lvl-ring-eyebrow">LEVEL</span>
        <span className="lvl-ring-num" style={{ color: theme.to }}>{level}</span>
        <span className="lvl-ring-title">{title}</span>
      </div>
    </button>
  );
};

export default LevelRing;
