import React, { useEffect, useState } from 'react';
import { useXP } from './XPContext';
import { getRingTheme, SELECTED_THEME_KEY } from './levels';

const LAST_LEVEL_KEY = 'superdub.lastSeenLevel';

// Watches the player level and, when it increases, shows a one-time celebration
// naming the new title + the reward that level unlocked.
const LevelUpCelebration: React.FC = () => {
  const { playerLevel } = useXP();
  const [show, setShow] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const stored = parseInt(localStorage.getItem(LAST_LEVEL_KEY) || '0', 10);
    // First ever load (no stored value): record silently, never celebrate retroactively.
    if (!stored) {
      localStorage.setItem(LAST_LEVEL_KEY, String(playerLevel.level));
      return;
    }
    if (playerLevel.level > stored) {
      setShow(true);
      // If the reward is a theme, auto-equip it so the unlock feels immediate.
      if (playerLevel.reward.kind === 'theme' && playerLevel.reward.themeId) {
        localStorage.setItem(SELECTED_THEME_KEY, playerLevel.reward.themeId);
        window.dispatchEvent(new CustomEvent('superdub:ring-theme-changed'));
      }
      localStorage.setItem(LAST_LEVEL_KEY, String(playerLevel.level));
    }
  }, [playerLevel.level]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null;

  const close = () => {
    setClosing(true);
    setTimeout(() => { setShow(false); setClosing(false); }, 320);
  };

  const theme = playerLevel.reward.kind === 'theme'
    ? getRingTheme(playerLevel.reward.themeId)
    : getRingTheme('gold');

  return (
    <div className={`lvlup-overlay${closing ? ' closing' : ''}`} onClick={close}>
      <div className="lvlup-card" onClick={e => e.stopPropagation()}>
        <div className="lvlup-rays" style={{ ['--ray' as any]: theme.glow }} />
        <div className="lvlup-burst">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="lvlup-spark" style={{ ['--i' as any]: i } as React.CSSProperties} />
          ))}
        </div>

        <p className="lvlup-eyebrow">LEVEL UP</p>
        <div
          className="lvlup-num"
          style={{ background: `linear-gradient(160deg, ${theme.from}, ${theme.to})`, boxShadow: `0 0 40px ${theme.glow}` }}
        >
          {playerLevel.level}
        </div>
        <h2 className="lvlup-title">{playerLevel.title}</h2>

        <div className="lvlup-reward">
          <span className="lvlup-reward-icon">{playerLevel.reward.icon}</span>
          <div className="lvlup-reward-text">
            <span className="lvlup-reward-label">{playerLevel.reward.label}</span>
            <span className="lvlup-reward-blurb">{playerLevel.reward.blurb}</span>
          </div>
        </div>

        <button className="lvlup-btn" onClick={close}>
          {playerLevel.reward.kind === 'theme' ? 'Equipped — nice!' : 'Keep going 🚀'}
        </button>
      </div>
    </div>
  );
};

export default LevelUpCelebration;
