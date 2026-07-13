import React from 'react';
import DubMascot, { type MascotSpecies } from './DubMascot';

// ── Dub's room ────────────────────────────────────────────────────────────────
// A cozy little scene docked at the bottom of the Dub page: a warm rug on a wood
// floor, a shelf, a plant, and Dub sitting in his own space. The window MAPS THE
// TIME OF DAY — a bright sky + sun by day, a warm dusk, or the moon + stars at
// night — so his room tracks the real world hour. Pure SVG scene; the mascot
// itself is the existing DubMascot, so Dub's colour/species choices carry through.

type Phase = 'day' | 'dusk' | 'night';
function timePhase(hour: number): Phase {
  // ponytail: coarse 3-way split on the local clock — good enough for a mood cue,
  // no sunrise/sunset geolocation. Upgrade path: real solar times if we ever care.
  if (hour >= 6 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}
const SKY: Record<Phase, { inner: string; outer: string }> = {
  day:   { inner: '#BFE6FF', outer: '#6FB2EE' },
  dusk:  { inner: '#FFC178', outer: '#4B3A72' },
  night: { inner: '#2E3A6E', outer: '#141A33' },
};

const DubRoom: React.FC<{ species: MascotSpecies }> = ({ species }) => {
  const phase = timePhase(new Date().getHours());
  const sky = SKY[phase];
  const sun = phase !== 'night';
  return (
    <div className="dub-room">
      <span className="dub-room-eyebrow">DUB'S ROOM</span>
      <div className="dub-room-stage">
        <svg viewBox="0 0 320 210" className="dub-room-svg" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
          <defs>
            <linearGradient id="dr-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1b2030" />
              <stop offset="100%" stopColor="#141826" />
            </linearGradient>
            <linearGradient id="dr-floor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2a2320" />
              <stop offset="100%" stopColor="#1d1815" />
            </linearGradient>
            <radialGradient id="dr-sky" cx="50%" cy="40%" r="72%">
              <stop offset="0%" stopColor={sky.inner} />
              <stop offset="100%" stopColor={sky.outer} />
            </radialGradient>
            <radialGradient id="dr-sun" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFF3C4" />
              <stop offset="60%" stopColor={phase === 'dusk' ? '#FF9E4D' : '#FFD65A'} />
              <stop offset="100%" stopColor={phase === 'dusk' ? '#FF7A33' : '#FFB928'} />
            </radialGradient>
            <radialGradient id="dr-glow" cx="50%" cy="60%" r="60%">
              <stop offset="0%" stopColor="rgba(255,185,40,0.18)" />
              <stop offset="100%" stopColor="rgba(255,185,40,0)" />
            </radialGradient>
          </defs>

          {/* Room */}
          <rect x="0" y="0" width="320" height="150" fill="url(#dr-wall)" />
          <rect x="0" y="150" width="320" height="60" fill="url(#dr-floor)" />
          <line x1="0" y1="150" x2="320" y2="150" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />

          {/* Window — sky mapped to the hour, with sun by day/dusk or moon + stars at night */}
          <g>
            <clipPath id="dr-win"><rect x="30" y="26" width="86" height="86" rx="10" /></clipPath>
            <g clipPath="url(#dr-win)">
              <rect x="30" y="26" width="86" height="86" fill="url(#dr-sky)" />
              {sun ? (
                <>
                  {/* soft sun halo + disc; sits lower and warmer at dusk */}
                  <circle cx="88" cy={phase === 'dusk' ? 74 : 50} r="22" fill="url(#dr-sun)" opacity="0.35" />
                  <circle cx="88" cy={phase === 'dusk' ? 74 : 50} r="12" fill="url(#dr-sun)" />
                  {phase === 'day' && (
                    <g fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.85">
                      {/* two soft clouds */}
                      <path d="M40 88 q4 -8 12 -6 q4 -8 12 -3 q7 0 5 9" />
                      <path d="M58 44 q3 -6 9 -4 q3 -5 9 -2" opacity="0.6" />
                    </g>
                  )}
                </>
              ) : (
                <>
                  {/* crescent moon (a sky-coloured disc bites the lit one) + stars */}
                  <circle cx="88" cy="52" r="13" fill="#FFE9A8" />
                  <circle cx="82" cy="48" r="11" fill="url(#dr-sky)" />
                  <circle cx="52" cy="44" r="1.6" fill="#cfe0ff" />
                  <circle cx="64" cy="70" r="1.4" fill="#cfe0ff" />
                  <circle cx="46" cy="86" r="1.2" fill="#cfe0ff" />
                </>
              )}
            </g>
            {/* frame + mullions on top of the sky */}
            <rect x="30" y="26" width="86" height="86" rx="10" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
            <line x1="73" y1="26" x2="73" y2="112" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
            <line x1="30" y1="69" x2="116" y2="69" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
          </g>

          {/* Shelf + a couple of books and a potted plant */}
          <g>
            <rect x="196" y="58" width="86" height="8" rx="3" fill="#3a2f26" />
            <rect x="204" y="40" width="9" height="18" rx="1.5" fill="#2FD27E" />
            <rect x="215" y="36" width="9" height="22" rx="1.5" fill="#2E8BFF" />
            <rect x="226" y="43" width="9" height="15" rx="1.5" fill="#FF8A00" />
            {/* plant */}
            <rect x="250" y="44" width="18" height="14" rx="3" fill="#5a4632" />
            <path d="M259 44 C 252 30, 250 26, 254 22" fill="none" stroke="#2FD27E" strokeWidth="3" strokeLinecap="round" />
            <path d="M259 44 C 266 32, 270 30, 268 24" fill="none" stroke="#2FD27E" strokeWidth="3" strokeLinecap="round" />
            <path d="M259 44 C 259 32, 259 28, 261 24" fill="none" stroke="#37E08C" strokeWidth="3" strokeLinecap="round" />
          </g>

          {/* Warm floor glow under Dub */}
          <ellipse cx="160" cy="182" rx="96" ry="26" fill="url(#dr-glow)" />

          {/* Rug — concentric rounded rings */}
          <ellipse cx="160" cy="184" rx="86" ry="22" fill="#7A2E3B" />
          <ellipse cx="160" cy="184" rx="86" ry="22" fill="none" stroke="#9E3B4C" strokeWidth="2" />
          <ellipse cx="160" cy="184" rx="62" ry="15.5" fill="#8E3444" />
          <ellipse cx="160" cy="184" rx="40" ry="10" fill="#A94055" />
          <ellipse cx="160" cy="184" rx="18" ry="4.5" fill="#C6566C" />
        </svg>
        {/* Dub himself, sitting on the rug */}
        <div className="dub-room-pet"><DubMascot size={104} mood="happy" species={species} /></div>
      </div>
    </div>
  );
};

export default DubRoom;
