import React, { useEffect, useRef, useState } from 'react';
import { useXP } from './XPContext';
import { getRingTheme, getSelectedThemeId } from './levels';

// A compact XP bar that pins to the top of the Habits page once you scroll down to
// the habit list, so you watch your XP grow in its own container as you tick habits.
// The fill animates on width change, and a brief pulse fires whenever XP increases.
const PinnedXpBar: React.FC<{ visible: boolean }> = ({ visible }) => {
  const { totalXP, playerLevel } = useXP();
  const [themeId, setThemeId] = useState(getSelectedThemeId);
  useEffect(() => {
    const h = () => setThemeId(getSelectedThemeId());
    window.addEventListener('superdub:ring-theme-changed', h);
    return () => window.removeEventListener('superdub:ring-theme-changed', h);
  }, []);
  const theme = getRingTheme(themeId);

  const into = Math.max(0, totalXP - playerLevel.xpForLevel);
  const span = playerLevel.xpForNext != null ? playerLevel.xpForNext - playerLevel.xpForLevel : null;

  // Pulse when XP grows (a habit was just ticked → XPContext recomputed higher).
  const prev = useRef(totalXP);
  const [grew, setGrew] = useState(false);
  useEffect(() => {
    if (totalXP > prev.current) {
      setGrew(true);
      const t = setTimeout(() => setGrew(false), 900);
      prev.current = totalXP;
      return () => clearTimeout(t);
    }
    prev.current = totalXP;
  }, [totalXP]);

  return (
    <div
      className={`hb-pinned-xp${visible ? ' show' : ''}${grew ? ' grew' : ''}`}
      style={{ '--pxp-from': theme.from, '--pxp-to': theme.to, '--pxp-glow': theme.glow } as React.CSSProperties}
      aria-hidden={!visible}
    >
      {/* Identical to the hero's XP bar: the count reads inside, no level tag. */}
      <div className="hb-xp-bar">
        <div className="hb-xp-fill" style={{ width: `${Math.max(2, playerLevel.progress * 100)}%`, background: `linear-gradient(90deg, ${theme.from}, ${theme.to})`, boxShadow: `0 0 10px ${theme.glow}` }} />
        <span className="hb-xp-inbar">{span != null ? `${into.toLocaleString()} / ${span.toLocaleString()} XP` : `${totalXP.toLocaleString()} XP`}</span>
      </div>
    </div>
  );
};

export default PinnedXpBar;
