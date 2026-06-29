import React, { useId } from 'react';
import type { RingTheme } from './levels';

// The single level ring used on BOTH the Habits home and the Level page, so the
// size, geometry and theming can never drift apart again.
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
  const offset = circ * (1 - Math.max(0, Math.min(1, progress)));
  const gid = useId();
  return (
    <button className="lvl-ring" style={{ width: size, height: size }} onClick={onClick} aria-label={`Level ${level} — ${title}`}>
      <svg width={size} height={size} className="lvl-ring-svg">
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={theme.from} />
            <stop offset="100%" stopColor={theme.to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#33333D" strokeWidth={stroke} />
        <circle
          className={`lvl-ring-arc${theme.animated ? ' animated' : ''}`}
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`url(#${gid})`} strokeWidth={stroke} strokeLinecap="butt"
          strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 3px ${theme.glow})` }}
        />
        <circle cx={size / 2} cy={size / 2} r={r - stroke / 2} fill="#0B0B11" />
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
