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
        {/* Fixed latitude arcs, gently bowed to read as a sphere. */}
        <g fill="none" stroke="rgba(206,232,255,0.4)" strokeWidth="1">
          <path d="M12 34 Q50 30 88 34" />
          <path d="M6 50 Q50 50 94 50" />
          <path d="M12 66 Q50 70 88 66" />
        </g>
      </g>
      {/* Atmosphere rim + soft glare. */}
      <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(206,232,255,0.38)" strokeWidth="1.5" />
      <ellipse cx="37" cy="30" rx="15" ry="9" fill="rgba(255,255,255,0.16)" />
    </svg>
  );
};

export default GlobalPlanet;
