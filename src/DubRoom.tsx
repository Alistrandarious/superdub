import React from 'react';
import DubMascot, { type MascotSpecies } from './DubMascot';

// ── Dub's room ────────────────────────────────────────────────────────────────
// A cozy scene docked at the bottom third of the Dub page. The window MAPS THE
// TIME OF DAY — bright sky + sun by day, a warm dusk, moon + stars at night. Dub
// sits on the rug inside the SVG (a foreignObject) so he scales with the room and
// stays glued to the rug at any height. Tap Dub to chat: a "!" badge sits by his
// head — gold when he has fresh info, grey once you've seen it.

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

const DubRoom: React.FC<{
  species: MascotSpecies;
  hasNew: boolean;
  onChat: () => void;
  // Live day state (dubDayState): Dub's mood, a celebrate flag (sparkles +
  // brighter glow) and the one-line thought in his speech bubble.
  mood?: 'happy' | 'neutral' | 'concerned';
  celebrate?: boolean;
  thought?: string | null;
}> = ({ species, hasNew, onChat, mood = 'happy', celebrate = false, thought = null }) => {
  const phase = timePhase(new Date().getHours());
  const sky = SKY[phase];
  const sun = phase !== 'night';
  return (
    <div className={`dub-room${celebrate ? ' dub-room--celebrate' : ''}`}>
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
                  <circle cx="88" cy={phase === 'dusk' ? 74 : 50} r="22" fill="url(#dr-sun)" opacity="0.35" />
                  <circle cx="88" cy={phase === 'dusk' ? 74 : 50} r="12" fill="url(#dr-sun)" />
                  {phase === 'day' && (
                    <g fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.85">
                      <path d="M40 88 q4 -8 12 -6 q4 -8 12 -3 q7 0 5 9" />
                      <path d="M58 44 q3 -6 9 -4 q3 -5 9 -2" opacity="0.6" />
                    </g>
                  )}
                </>
              ) : (
                <>
                  <circle cx="88" cy="52" r="13" fill="#FFE9A8" />
                  <circle cx="82" cy="48" r="11" fill="url(#dr-sky)" />
                  <circle cx="52" cy="44" r="1.6" fill="#cfe0ff" />
                  <circle cx="64" cy="70" r="1.4" fill="#cfe0ff" />
                  <circle cx="46" cy="86" r="1.2" fill="#cfe0ff" />
                </>
              )}
            </g>
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
            <rect x="250" y="44" width="18" height="14" rx="3" fill="#5a4632" />
            <path d="M259 44 C 252 30, 250 26, 254 22" fill="none" stroke="#2FD27E" strokeWidth="3" strokeLinecap="round" />
            <path d="M259 44 C 266 32, 270 30, 268 24" fill="none" stroke="#2FD27E" strokeWidth="3" strokeLinecap="round" />
            <path d="M259 44 C 259 32, 259 28, 261 24" fill="none" stroke="#37E08C" strokeWidth="3" strokeLinecap="round" />
          </g>

          {/* Warm floor glow under Dub — mood-tinted: cooler and dimmer when
              concerned, doubled up when celebrating */}
          <ellipse cx="160" cy="182" rx="96" ry="26" fill="url(#dr-glow)"
            opacity={mood === 'concerned' ? 0.45 : 1} />
          {celebrate && <ellipse cx="160" cy="180" rx="110" ry="32" fill="url(#dr-glow)" className="dr-glow-boost" />}

          {/* Rug — concentric rounded rings */}
          <ellipse cx="160" cy="184" rx="86" ry="22" fill="#7A2E3B" />
          <ellipse cx="160" cy="184" rx="86" ry="22" fill="none" stroke="#9E3B4C" strokeWidth="2" />
          <ellipse cx="160" cy="184" rx="62" ry="15.5" fill="#8E3444" />
          <ellipse cx="160" cy="184" rx="40" ry="10" fill="#A94055" />
          <ellipse cx="160" cy="184" rx="18" ry="4.5" fill="#C6566C" />

          {/* Dub on the rug — tap to chat. In a foreignObject so he scales with the room. */}
          <g className={`dub-room-dub${hasNew ? ' is-new' : ''}`} onClick={onChat} role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChat(); } }}
            aria-label="Chat to Dub" style={{ cursor: 'pointer' }}>
            <foreignObject x="102" y="72" width="116" height="116">
              <div style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 7px 10px rgba(0,0,0,0.5))' }}>
                <DubMascot size={116} mood={mood} species={species} />
              </div>
            </foreignObject>
            {/* "!" notification badge by Dub's head */}
            <circle className="dub-bang-dot" cx="188" cy="94" r="13" stroke="#141826" strokeWidth="2.5"
              fill={hasNew ? '#FFC400' : '#8A8F9E'} />
            <text x="188" y="100" textAnchor="middle" fontSize="16" fontWeight="800" fill="#141826"
              fontFamily="'Sora', sans-serif" style={{ pointerEvents: 'none' }}>!</text>
          </g>

          {/* Celebration sparkles above Dub (clean sweep / goal reached) */}
          {celebrate && (
            <g className="dr-sparks" fill="#FFE08A" aria-hidden="true">
              {[[128, 66], [196, 58], [160, 44], [110, 96], [212, 92]].map(([x, y], i) => (
                <path key={i} className="dr-spark" style={{ animationDelay: `${i * 0.25}s` }}
                  d={`M${x} ${y - 5} Q${x + 1} ${y - 1} ${x + 5} ${y} Q${x + 1} ${y + 1} ${x} ${y + 5} Q${x - 1} ${y + 1} ${x - 5} ${y} Q${x - 1} ${y - 1} ${x} ${y - 5} Z`} />
              ))}
            </g>
          )}

          {/* Dub's current thought — a speech bubble on the wall strip above the
              shelf, tap to chat (same target as tapping Dub) */}
          {thought && (
            <foreignObject x="140" y="3" width="172" height="34" style={{ cursor: 'pointer' }} onClick={onChat}>
              <div className="dr-thought">{thought}</div>
            </foreignObject>
          )}
        </svg>
      </div>
      <button className="dub-room-chat" onClick={onChat}>Chat to Dub</button>
    </div>
  );
};

export default DubRoom;
