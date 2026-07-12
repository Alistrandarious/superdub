import React, { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useXP } from './XPContext';
import LevelRing from './LevelRing';
import { getRingTheme, getSelectedThemeId } from './levels';

// The level hero — the XP ring on a theme-coloured bloom plus the XP-to-next bar.
// Lifted out of LevelCustomizer so both Profile (customization) and the Global tab
// show the identical hero. Tapping the ring jumps to the full ladder (/level).
// Re-reads the selected ring theme whenever it changes elsewhere so both heroes
// (Profile + Global) stay in sync without prop plumbing.
function navigateWithTransition(navigate: ReturnType<typeof useNavigate>, to: string) {
  const doNav = () => navigate(to);
  const startVT = (document as any).startViewTransition?.bind(document);
  if (startVT) startVT(() => flushSync(doNav));
  else doNav();
}

// `to` is where tapping the ring goes. Default is the level ladder (/level); the
// Habits page sends it to /profile (customization, which links on to the ladder).
const LevelHeroRing: React.FC<{ to?: string }> = ({ to = '/level' }) => {
  const navigate = useNavigate();
  const { totalXP, playerLevel } = useXP();

  const [themeId, setThemeId] = useState(getSelectedThemeId);
  useEffect(() => {
    const h = () => setThemeId(getSelectedThemeId());
    window.addEventListener('superdub:ring-theme-changed', h);
    return () => window.removeEventListener('superdub:ring-theme-changed', h);
  }, []);
  const theme = getRingTheme(themeId);

  return (
    <div className="lvl-hero" style={{ '--hero-glow': theme.glow, '--hero-from': theme.from, '--hero-to': theme.to } as React.CSSProperties}>
      <div className="lvl-hero-bloom" />
      <div className="lvl-hero-ring">
        <LevelRing level={playerLevel.level} title={playerLevel.title} progress={playerLevel.progress} theme={theme} size={170} onClick={() => navigateWithTransition(navigate, to)} />
      </div>
      <div className="lvl-hero-xp">
        <div className="hb-xp-bar">
          <div className="hb-xp-fill" style={{ width: `${Math.max(2, playerLevel.progress * 100)}%`, background: `linear-gradient(90deg, ${theme.from}, ${theme.to})`, boxShadow: `0 0 10px ${theme.glow}` }} />
        </div>
        <div className="lvl-hero-scale">
          <span>{totalXP.toLocaleString()} XP</span>
          <span>{playerLevel.xpForNext != null ? playerLevel.xpForNext.toLocaleString() : 'MAX'}</span>
        </div>
        {playerLevel.xpForNext != null ? (
          <p className="hb-xp-to">{(playerLevel.xpForNext - totalXP).toLocaleString()} XP to <span>{playerLevel.nextTitle}</span></p>
        ) : (
          <p className="hb-xp-to">Max level, you legend.</p>
        )}
      </div>
    </div>
  );
};

export default LevelHeroRing;
