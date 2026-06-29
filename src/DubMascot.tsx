import React from 'react';
import { getDubColor, DUB_COLORS } from './levels';

export type MascotSpecies = 'dog' | 'cat';
export const MASCOT_KEY = 'superdub.mascot';
export function getMascot(): MascotSpecies {
  return (typeof localStorage !== 'undefined' && localStorage.getItem(MASCOT_KEY)) === 'cat' ? 'cat' : 'dog';
}

// "Dub" — Superdub's coaching pet. A cute robo-companion: a Yorkie by default,
// or a cat once unlocked at level 2. Pure SVG + CSS (idle bob, blink, ear twitch,
// antenna glow, tail wag, a gentle pant). He doesn't yap — no constant mouth flap.
const DubMascot: React.FC<{ size?: number; mood?: 'happy' | 'neutral' | 'concerned'; species?: MascotSpecies; colorId?: string }> = ({ size = 120, mood = 'happy', species = 'dog', colorId }) => {
  const cat = species === 'cat';
  // The equipped colour, or a specific one when previewing a swatch.
  const c = (colorId && DUB_COLORS.find(x => x.id === colorId)) || getDubColor();
  const bodyFrom = c.bodyFrom, bodyTo = c.bodyTo, accent = c.accent;
  return (
    <div className={`dub dub--${mood} dub--${species}`} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <defs>
          <linearGradient id="dubBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={bodyFrom} /><stop offset="100%" stopColor={bodyTo} />
          </linearGradient>
          <radialGradient id="dubFace" cx="50%" cy="38%" r="70%">
            <stop offset="0%" stopColor={bodyFrom} /><stop offset="100%" stopColor={bodyTo} />
          </radialGradient>
          <linearGradient id="dubTan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E0AC68" /><stop offset="100%" stopColor="#A9742F" />
          </linearGradient>
          <radialGradient id="dubEye" cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#BFFBFF" /><stop offset="55%" stopColor="#2FD2E0" /><stop offset="100%" stopColor="#1B7E96" />
          </radialGradient>
        </defs>

        {/* wagging tail */}
        <g className="dub-tail">
          {cat
            ? <path d="M92 84 q22 2 20 -22 q-4 18 -22 12 z" fill="url(#dubBody)" stroke="#3a3f4d" strokeWidth="1.5" />
            : <path d="M90 80 q16 -4 18 -20 q-12 4 -20 14 z" fill="url(#dubTan)" stroke="#3A2C18" strokeWidth="1.5" />}
        </g>

        {/* body */}
        <path className="dub-body" d="M28 114 q-2 -38 32 -38 q34 0 32 38 z" fill="url(#dubBody)" stroke="#3a3f4d" strokeWidth="2" />
        <rect x="49" y="90" width="22" height="20" rx="6" fill="#474d5e" />
        <circle className="dub-chest-led" cx="60" cy="99" r="3.4" fill={accent} />

        {/* head bobs gently */}
        <g className="dub-head">
          {cat ? (
            <>
              {/* upright pointy cat ears with pink inner */}
              <g className="dub-ear dub-ear--l"><path d="M34 30 L30 6 L52 24 Z" fill="url(#dubFace)" stroke="#3a3f4d" strokeWidth="2" strokeLinejoin="round" /><path d="M37 26 L35 13 L46 23 Z" fill="#F4A6C0" /></g>
              <g className="dub-ear dub-ear--r"><path d="M86 30 L90 6 L68 24 Z" fill="url(#dubFace)" stroke="#3a3f4d" strokeWidth="2" strokeLinejoin="round" /><path d="M83 26 L85 13 L74 23 Z" fill="#F4A6C0" /></g>
            </>
          ) : (
            <>
              {/* floppy rounded Yorkie ears */}
              <g className="dub-ear dub-ear--l"><path d="M30 30 q-10 6 -8 24 q10 2 16 -10 q4 -10 -8 -14z" fill="url(#dubTan)" stroke="#3A2C18" strokeWidth="2" strokeLinejoin="round" /></g>
              <g className="dub-ear dub-ear--r"><path d="M90 30 q10 6 8 24 q-10 2 -16 -10 q-4 -10 8 -14z" fill="url(#dubTan)" stroke="#3A2C18" strokeWidth="2" strokeLinejoin="round" /></g>
            </>
          )}

          {/* antenna */}
          <g className="dub-antenna">
            <line x1="60" y1="24" x2="60" y2="7" stroke="#9AA3B8" strokeWidth="2.5" strokeLinecap="round" />
            <circle className="dub-antenna-tip" cx="60" cy="6" r="4" fill={accent} />
          </g>

          {/* big round cuddly head */}
          <ellipse cx="60" cy="50" rx="30" ry="27" fill="url(#dubFace)" stroke="#3a3f4d" strokeWidth="2.5" />
          {/* tan cheek tufts (dog only) */}
          {!cat && <>
            <path d="M33 52 q-4 10 4 16 q4 -6 6 -14z" fill="url(#dubTan)" opacity="0.9" />
            <path d="M87 52 q4 10 -4 16 q-4 -6 -6 -14z" fill="url(#dubTan)" opacity="0.9" />
          </>}

          {/* big cute eyes */}
          <g className="dub-eyes">
            <circle cx="49" cy="48" r="9.5" fill="#10131b" />
            <circle cx="71" cy="48" r="9.5" fill="#10131b" />
            <circle className="dub-eye" cx="49" cy="48" r="7.5" fill="url(#dubEye)" />
            <circle className="dub-eye" cx="71" cy="48" r="7.5" fill="url(#dubEye)" />
            <circle cx="46" cy="45" r="2.6" fill="#fff" />
            <circle cx="68" cy="45" r="2.6" fill="#fff" />
            <circle cx="52" cy="50" r="1.2" fill="#fff" opacity="0.8" />
            <circle cx="74" cy="50" r="1.2" fill="#fff" opacity="0.8" />
          </g>

          {/* nose */}
          {cat
            ? <path d="M57 60 L63 60 L60 64 Z" fill="#E58AA8" stroke="#9A4B66" strokeWidth="0.8" />
            : <ellipse cx="60" cy="61" rx="5" ry="3.8" fill="#22262f" />}

          {/* whiskers (cat) */}
          {cat && <g stroke="#cfd4e0" strokeWidth="1.2" strokeLinecap="round" opacity="0.8">
            <line x1="40" y1="62" x2="26" y2="59" /><line x1="40" y1="65" x2="26" y2="66" />
            <line x1="80" y1="62" x2="94" y2="59" /><line x1="80" y1="65" x2="94" y2="66" />
          </g>}

          {/* mouth + happy panting tongue (dog) */}
          <path d="M53 66 q7 6 14 0" fill="none" stroke="#22262f" strokeWidth="2" strokeLinecap="round" />
          {!cat && <g className="dub-tongue"><path d="M56 67 q4 7 8 0 z" fill="#FF7E9B" stroke="#C45070" strokeWidth="0.8" /></g>}
        </g>
      </svg>
    </div>
  );
};

export default DubMascot;
