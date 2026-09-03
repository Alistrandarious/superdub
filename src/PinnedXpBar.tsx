import React, { useEffect, useRef, useState } from 'react';
import { useXP } from './XPContext';
import { getRingTheme, getSelectedThemeId } from './levels';

// The XP bar that rides inside the cadence dock's glass capsule (above the dots).
// Identical to the hero's XP bar; the fill animates on width change and a brief
// pulse fires whenever XP increases (a habit was just ticked → XPContext recomputed).
const PinnedXpBar: React.FC = () => {
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

  // Pulse when XP grows.
  // `delta` is the last gain, keyed so consecutive ticks each get a fresh float
  // rather than one that restarts mid-flight.
  const prev = useRef(totalXP);
  const [grew, setGrew] = useState(false);
  const [delta, setDelta] = useState<{ n: number; key: number } | null>(null);
  useEffect(() => {
    if (totalXP > prev.current) {
      setGrew(true);
      const n = totalXP - prev.current;   // read before prev moves on below
      setDelta(d => ({ n, key: (d?.key ?? 0) + 1 }));
      const t = setTimeout(() => { setGrew(false); setDelta(null); }, 1100);
      prev.current = totalXP;
      return () => clearTimeout(t);
    }
    prev.current = totalXP;
  }, [totalXP]);

  return (
    <div
      className={`hb-xp-bar${grew ? ' grew' : ''}`}
      style={{ '--pxp-glow': theme.glow } as React.CSSProperties}
    >
      <div className="hb-xp-fill" style={{ width: `${Math.max(2, playerLevel.progress * 100)}%`, background: `linear-gradient(90deg, ${theme.from}, ${theme.to})`, boxShadow: `0 0 10px ${theme.glow}` }} />
      <span className="hb-xp-inbar">{span != null ? `${into.toLocaleString()} / ${span.toLocaleString()} XP` : `${totalXP.toLocaleString()} XP`}</span>
      {delta && <span key={delta.key} className="hb-xp-float" aria-hidden="true">+{delta.n} XP</span>}
    </div>
  );
};

export default PinnedXpBar;
