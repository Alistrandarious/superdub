import React from 'react';

// The Global habit's entry point: a small earth that slowly turns. Pure inline SVG
// (no asset, no emoji — house style). The continents sit in a `.gp-land` group that
// CSS rotates; an invisible full-size disc in the group fixes the spin centre so it
// rotates about the globe, not the continents' own bounding box. Clipped to the
// ocean circle so land never spills past the edge.
const GlobalPlanet: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg className="gp-svg" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <radialGradient id="gp-ocean" cx="38%" cy="32%" r="78%">
        <stop offset="0%" stopColor="#6FC3FF" />
        <stop offset="55%" stopColor="#2E8BFF" />
        <stop offset="100%" stopColor="#123E8E" />
      </radialGradient>
      <clipPath id="gp-clip"><circle cx="50" cy="50" r="45" /></clipPath>
    </defs>
    <circle cx="50" cy="50" r="45" fill="url(#gp-ocean)" />
    <g className="gp-land" clipPath="url(#gp-clip)">
      {/* invisible full disc — pins the rotation centre to the globe centre */}
      <circle cx="50" cy="50" r="45" fill="none" />
      <path d="M18 40 q10 -12 22 -6 q10 5 6 16 q-6 12 -20 8 q-14 -4 -8 -18 Z" fill="#43C982" />
      <path d="M58 22 q14 -4 20 8 q4 12 -8 16 q-14 4 -18 -8 q-3 -12 6 -16 Z" fill="#4FD08A" />
      <path d="M52 58 q12 -3 16 8 q3 12 -10 16 q-13 3 -16 -9 q-2 -11 10 -15 Z" fill="#3FBE7A" />
      <path d="M30 66 q8 -2 11 6 q2 9 -7 11 q-9 1 -11 -7 q-1 -8 7 -10 Z" fill="#47CE86" />
    </g>
    {/* soft glare + atmosphere rim */}
    <ellipse cx="37" cy="31" rx="15" ry="9" fill="rgba(255,255,255,0.18)" />
    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
  </svg>
);

export default GlobalPlanet;
