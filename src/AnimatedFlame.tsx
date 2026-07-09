import React from 'react';

// Animated streak flame: an SVG fire with a gold→flame→danger gradient body and a
// bright inner core. The flicker/glow live in CSS (.flame-body / .flame-core /
// .flame-svg) and hold steady under reduced-motion. Replaces the old 🔥 emoji
// (design system: no emoji in UI chrome). `size` is the square px box.
const FLAME_D = 'M12 2s5 4.5 5 9a5 5 0 0 1-10 0c0-1.4.6-2.7 1.3-3.7C8.7 8.9 9 10 10 10c0-2.5 2-4.5 2-8z';

const AnimatedFlame: React.FC<{ size?: number }> = ({ size = 16 }) => {
  // Unique gradient ids so multiple flames on a page don't collide (strip the
  // colons React.useId emits, which aren't safe inside url(#...) references).
  const uid = React.useId().replace(/:/g, '');
  return (
    <svg className="flame-svg" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`flb${uid}`} x1="12" y1="2" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFD233" />
          <stop offset="55%" stopColor="#FF8A00" />
          <stop offset="100%" stopColor="#FF5470" />
        </linearGradient>
        <radialGradient id={`flc${uid}`} cx="0.5" cy="0.72" r="0.7">
          <stop offset="0%" stopColor="#FFF6C0" />
          <stop offset="100%" stopColor="#FFB020" />
        </radialGradient>
      </defs>
      <path className="flame-body" fill={`url(#flb${uid})`} d={FLAME_D} />
      <ellipse className="flame-core" cx="12" cy="15.4" rx="2.1" ry="3" fill={`url(#flc${uid})`} />
    </svg>
  );
};

export default AnimatedFlame;
