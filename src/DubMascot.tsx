import React from 'react';

// "Dub" — Superdub's coaching mascot: a little robotic Yorkshire Terrier.
// Pure SVG + CSS animation (idle bob, blink, ear + antenna twitch, tail wag).
// `mood` shifts the expression; `talking` animates the mouth while delivering a line.
const DubMascot: React.FC<{ size?: number; mood?: 'happy' | 'neutral' | 'concerned'; talking?: boolean }> = ({ size = 120, mood = 'happy', talking = false }) => {
  return (
    <div className={`dub dub--${mood}${talking ? ' dub--talking' : ''}`} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <defs>
          <linearGradient id="dubBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8E97AE" />
            <stop offset="100%" stopColor="#5A6276" />
          </linearGradient>
          <linearGradient id="dubFace" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B9C0D2" />
            <stop offset="100%" stopColor="#7E869B" />
          </linearGradient>
          <linearGradient id="dubTan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D8A05A" />
            <stop offset="100%" stopColor="#A9742F" />
          </linearGradient>
          <radialGradient id="dubEye" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#9BF6FF" />
            <stop offset="60%" stopColor="#2FD2E0" />
            <stop offset="100%" stopColor="#1B8FA8" />
          </radialGradient>
        </defs>

        {/* wagging tail */}
        <g className="dub-tail">
          <path d="M92 78 q16 -6 18 -20 q-12 4 -20 14 z" fill="url(#dubTan)" stroke="#3A2C18" strokeWidth="1.5" />
        </g>

        {/* body / shoulders */}
        <path className="dub-body" d="M30 112 q-4 -34 30 -34 q34 0 30 34 z" fill="url(#dubBody)" stroke="#3a3f4d" strokeWidth="2" />
        {/* chest panel */}
        <rect x="50" y="86" width="20" height="20" rx="4" fill="#454b5c" />
        <circle className="dub-chest-led" cx="60" cy="96" r="3.4" fill="#2FD27E" />

        {/* the whole head bobs */}
        <g className="dub-head">
          {/* ears */}
          <g className="dub-ear dub-ear--l"><path d="M34 40 L26 12 L48 30 Z" fill="url(#dubTan)" stroke="#3A2C18" strokeWidth="2" strokeLinejoin="round" /></g>
          <g className="dub-ear dub-ear--r"><path d="M86 40 L94 12 L72 30 Z" fill="url(#dubTan)" stroke="#3A2C18" strokeWidth="2" strokeLinejoin="round" /></g>

          {/* antenna */}
          <g className="dub-antenna">
            <line x1="60" y1="22" x2="60" y2="6" stroke="#9AA3B8" strokeWidth="2.5" strokeLinecap="round" />
            <circle className="dub-antenna-tip" cx="60" cy="5" r="4" fill="#2FD27E" />
          </g>

          {/* head plate */}
          <rect x="32" y="22" width="56" height="50" rx="20" fill="url(#dubFace)" stroke="#3a3f4d" strokeWidth="2.5" />
          {/* tan brow tufts */}
          <path d="M36 34 q8 -8 18 -4 q-8 2 -10 10 q-6 -4 -8 -6z" fill="url(#dubTan)" opacity="0.85" />
          <path d="M84 34 q-8 -8 -18 -4 q8 2 10 10 q6 -4 8 -6z" fill="url(#dubTan)" opacity="0.85" />

          {/* eyes */}
          <g className="dub-eyes">
            <circle cx="49" cy="46" r="8" fill="#10131b" />
            <circle cx="71" cy="46" r="8" fill="#10131b" />
            <circle className="dub-eye" cx="49" cy="46" r="6" fill="url(#dubEye)" />
            <circle className="dub-eye" cx="71" cy="46" r="6" fill="url(#dubEye)" />
            <circle cx="47" cy="44" r="1.8" fill="#fff" />
            <circle cx="69" cy="44" r="1.8" fill="#fff" />
          </g>

          {/* snout + nose + mouth */}
          <rect x="50" y="56" width="20" height="14" rx="7" fill="url(#dubFace)" stroke="#3a3f4d" strokeWidth="1.5" />
          <ellipse cx="60" cy="60" rx="4.5" ry="3.4" fill="#22262f" />
          <path className="dub-mouth" d="M54 66 q6 5 12 0" fill="none" stroke="#22262f" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
};

export default DubMascot;
