import React from 'react';
import { useXP } from './XPContext';
import { PLAYER_LEVELS, RING_THEMES } from './levels';

// The full level ladder — every level as a stop on the gold spine, with its
// reward and XP threshold. Shared by /level and the Habits ring reveal, where
// it doubles as the "how do I level up" guide.

const LockIc: React.FC<{ size?: number }> = ({ size = 11 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="Locked">
    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const rewardMark = (r: (typeof PLAYER_LEVELS)[number]['reward']) => {
  if (r.kind === 'theme' && r.themeId) {
    const t = RING_THEMES.find(x => x.id === r.themeId);
    if (t) return <span className="asc-swatch" style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }} />;
  }
  return <span className="asc-diamond" />;
};

const LevelLadder: React.FC = () => {
  const { playerLevel } = useXP();
  return (
    <section className="asc-section">
      <div className="asc-eyebrow-row">
        <span className="asc-eyebrow">THE LADDER</span>
        <span className="asc-eyebrow-sub">{`you're LV${playerLevel.level} of ${PLAYER_LEVELS.length}`}</span>
      </div>
      <div className="asc-ladder">
        {PLAYER_LEVELS.map((lv, i) => {
          const reached = playerLevel.level >= i + 1;
          const current = playerLevel.level === i + 1;
          return (
            <div key={i} className={`asc-ladder-row${current ? ' current' : ''}${reached ? ' reached' : ' locked'}`}>
              <span className="asc-ladder-node" />
              <span className="asc-ladder-lv">LV{i + 1}</span>
              <div className="asc-ladder-info">
                <span className="asc-ladder-title">{lv.title}</span>
                <span className="asc-ladder-reward">{lv.reward.label}</span>
              </div>
              <span className="asc-ladder-mark">{reached || current ? rewardMark(lv.reward) : <LockIc />}</span>
              <span className="asc-ladder-xp">{lv.xp.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default LevelLadder;
