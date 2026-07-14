import React, { useId } from 'react';

// The Global habit's motif: a clean WIREFRAME globe (no blotchy landmasses). An
// ocean sphere with fixed latitude arcs and a belt of longitude meridians that
// scrolls sideways and wraps — so the wireframe turns on its axis like a real
// globe. Scroll uses SVG <animateTransform> (user units, exact at any size) and
// is JS-gated for reduced motion. Ids are namespaced per instance so multiple
// globes on a page (ring button + prompt hero) never collide.

// One set of evenly spaced meridians (vertical lines), spanning one globe-width.
const MERIDIANS = (
  <g fill="none" stroke="rgba(206,232,255,0.34)" strokeWidth="1">
    {[6.25, 18.75, 31.25, 43.75, 56.25, 68.75, 81.25, 93.75].map(x => (
      <line key={x} x1={x} y1="4" x2={x} y2="96" />
    ))}
  </g>
);

const GlobalPlanet: React.FC<{ size?: number }> = ({ size = 34 }) => {
  const uid = useId().replace(/[:]/g, '');
  const oceanId = `gpo-${uid}`;
  const clipId = `gpc-${uid}`;
  const limbId = `gpl-${uid}`;
  const aurId = `gpa-${uid}`;
  const reduce = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return (
    <svg className="gp-svg" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={oceanId} cx="38%" cy="32%" r="80%">
          <stop offset="0%" stopColor="#6FC3FF" />
          <stop offset="55%" stopColor="#2E8BFF" />
          <stop offset="100%" stopColor="#0E357E" />
        </radialGradient>
        <clipPath id={clipId}><circle cx="50" cy="50" r="45" /></clipPath>
        {/* Limb darkening — transparent core to a deep-space edge, sells the sphere. */}
        <radialGradient id={limbId} cx="42%" cy="36%" r="72%">
          <stop offset="0%" stopColor="rgba(3,9,28,0)" />
          <stop offset="70%" stopColor="rgba(3,9,28,0)" />
          <stop offset="100%" stopColor="rgba(3,9,28,0.55)" />
        </radialGradient>
        {/* Polar aurora sweep — teal into violet, fading at both ends. */}
        <linearGradient id={aurId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(47,210,126,0)" />
          <stop offset="35%" stopColor="rgba(47,226,180,0.55)" />
          <stop offset="70%" stopColor="rgba(139,92,246,0.45)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0)" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill={`url(#${oceanId})`} />
      <g clipPath={`url(#${clipId})`}>
        {/* Longitude belt — two copies side by side; translating 0 → -100 loops
            seamlessly, turning the wireframe on its axis. */}
        <g className="gp-belt">
          {MERIDIANS}
          <g transform="translate(100 0)">{MERIDIANS}</g>
          {!reduce && (
            <animateTransform
              attributeName="transform"
              attributeType="XML"
              type="translate"
              from="0 0"
              to="-100 0"
              dur="22s"
              repeatCount="indefinite"
            />
          )}
        </g>
        {/* Fixed latitude arcs, gently bowed to read as a sphere; equator brightest. */}
        <g fill="none" stroke="rgba(206,232,255,0.4)" strokeWidth="1">
          <path d="M12 34 Q50 30 88 34" />
          <path d="M6 50 Q50 50 94 50" stroke="rgba(206,232,255,0.6)" strokeWidth="1.4" />
          <path d="M12 66 Q50 70 88 66" />
        </g>
        {/* Aurora shimmering over the north pole. */}
        <path d="M22 22 Q50 8 78 22" fill="none" stroke={`url(#${aurId})`} strokeWidth="5" strokeLinecap="round" opacity="0.8" />
        {/* Limb darkening over everything inside the sphere. */}
        <circle cx="50" cy="50" r="45" fill={`url(#${limbId})`} />
      </g>
      {/* Atmosphere rim + soft glare. */}
      <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(206,232,255,0.38)" strokeWidth="1.5" />
      <ellipse cx="36" cy="28" rx="17" ry="10" fill="rgba(255,255,255,0.14)" />
    </svg>
  );
};

export default GlobalPlanet;
