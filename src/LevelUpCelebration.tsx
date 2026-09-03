import React, { useEffect, useState } from 'react';
import { useXP } from './XPContext';
import { getRingTheme, SELECTED_THEME_KEY } from './levels';
import LevelGlance from './LevelGlance';
import { SparkIc, MedalIc } from './icons';

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
    // Full-screen "at a glance" moment (styled like the daily prompt popups). The
    // down-chevron is the only way out: it slides the whole page down to reveal the app.
    <div className={`lvlup-overlay${closing ? ' closing' : ''}`}>
      <div className="lvlup-card">
        <div className="lvlup-rays" style={{ ['--ray' as any]: theme.glow }} />
        <div className="lvlup-burst">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="lvlup-spark" style={{ ['--i' as any]: i } as React.CSSProperties} />
          ))}
        </div>

        <p className="lvlup-eyebrow">LEVEL UP</p>
        <div
          className="lvlup-num lvlup-bump"
          style={{ background: `linear-gradient(160deg, ${theme.from}, ${theme.to})`, boxShadow: `0 0 40px ${theme.glow}` }}
        >
          {playerLevel.level}
        </div>
        <h2 className="lvlup-title">{playerLevel.title}</h2>

        <div className="lvlup-reward lvlup-reward--compact">
          {/* Theme rewards show the actual swatch (design rule), the rest a stroke mark. */}
          <span className="lvlup-reward-icon">
            {playerLevel.reward.kind === 'theme' && playerLevel.reward.themeId
              ? <span className="asc-swatch" style={{ background: `linear-gradient(135deg, ${getRingTheme(playerLevel.reward.themeId).from}, ${getRingTheme(playerLevel.reward.themeId).to})` }} />
              : playerLevel.reward.kind === 'flair' ? <SparkIc size={20} /> : <MedalIc size={20} />}
          </span>
          <span className="lvlup-reward-label">{playerLevel.reward.label} unlocked</span>
        </div>

        <LevelGlance />

        <button className="lvlup-down" onClick={close} aria-label="Down to the app">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
          <span>to the app</span>
        </button>
      </div>
    </div>
  );
};

export default LevelUpCelebration;
