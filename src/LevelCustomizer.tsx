import React, { useState, useEffect } from 'react';
import { api } from './api';
import { useXP } from './XPContext';
import LevelHeroRing from './LevelHeroRing';
import DubMascot, { getMascot, MASCOT_KEY, type MascotSpecies } from './DubMascot';
import { getDubGender, DUB_GENDER_KEY, type DubGender } from './dubPronouns';
import {
  PLAYER_LEVELS, RING_THEMES, getSelectedThemeId,
  SELECTED_THEME_KEY, type RingTheme,
  isUnlocked, unlockLabel, EARLY_ADOPTER_BEFORE, type UnlockCtx, globalWhiteEarned,
  DUB_COLORS, DUB_COLOR_KEY, getDubColor,
  HABIT_COLORS, GLOW_COLORS, HABITS_COLOR_KEY, NAV_GLOW_KEY, type AccentColor,
  BACKGROUNDS, BACKGROUND_KEY, getBackground, type Background,
} from './levels';

// The cosmetic/companion customization, plus the shared level hero (LevelHeroRing).
// Lifted out of LevelPage so it lives on Profile (identity + customization). Every
// picker writes localStorage + dispatches a custom event; nothing hits the server.
// The deep ladder/badges/habit record stay on /level.

const CAT_UNLOCK_LEVEL = 2;

const LockIc: React.FC<{ size?: number }> = ({ size = 11 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="Locked">
    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const DropIc: React.FC<{ size?: number }> = ({ size = 10 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-label="Liquid fill">
    <path d="M12 2.7s6 7.6 6 11.8a6 6 0 0 1-12 0C6 10.3 12 2.7 12 2.7z" />
  </svg>
);
const ArcIc: React.FC<{ size?: number }> = ({ size = 10 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-label="Arc">
    <path d="M4.5 15.5a8 8 0 0 1 15 0" />
  </svg>
);
const Eyebrow: React.FC<{ children: React.ReactNode; sub?: string }> = ({ children, sub }) => (
  <div className="asc-eyebrow-row">
    <span className="asc-eyebrow">{children}</span>
    {sub && <span className="asc-eyebrow-sub">{sub}</span>}
  </div>
);

const rewardMark = (r: (typeof PLAYER_LEVELS)[number]['reward']) => {
  if (r.kind === 'theme' && r.themeId) {
    const t = RING_THEMES.find(x => x.id === r.themeId);
    if (t) return <span className="asc-swatch" style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }} />;
  }
  return <span className="asc-diamond" />;
};

// `showHero` renders the level ring hero above the pickers (Profile). The Habits
// page reveals this panel in place under its own ring, so it passes showHero={false}.
const LevelCustomizer: React.FC<{ showHero?: boolean }> = ({ showHero = true }) => {
  const { playerLevel } = useXP();

  const [earlyAdopter, setEarlyAdopter] = useState(false);
  useEffect(() => {
    api.getProfile().then((p: any) => {
      if (p?.accountCreatedAt) setEarlyAdopter(new Date(p.accountCreatedAt) < new Date(EARLY_ADOPTER_BEFORE));
    }).catch(() => {});
  }, []);
  const dayStreak = parseInt(localStorage.getItem('superdub.dayStreak') || '0', 10);
  const ctx: UnlockCtx = { level: playerLevel.level, streak: dayStreak, earlyAdopter, globalWhite: globalWhiteEarned() };

  const [themeId, setThemeId] = useState(getSelectedThemeId);
  const equipTheme = (t: RingTheme) => {
    if (!isUnlocked(t.unlock, ctx)) return;
    localStorage.setItem(SELECTED_THEME_KEY, t.id);
    setThemeId(t.id);
    window.dispatchEvent(new CustomEvent('superdub:ring-theme-changed'));
  };

  const [species, setSpecies] = useState<MascotSpecies>(getMascot);
  const catUnlocked = playerLevel.level >= CAT_UNLOCK_LEVEL;
  const pickSpecies = (s: MascotSpecies) => {
    if (s === 'cat' && !catUnlocked) return;
    setSpecies(s);
    localStorage.setItem(MASCOT_KEY, s);
    window.dispatchEvent(new CustomEvent('superdub:mascot-changed'));
  };

  const [dubGender, setDubGender] = useState<DubGender>(getDubGender);
  const pickGender = (g: DubGender) => {
    setDubGender(g);
    localStorage.setItem(DUB_GENDER_KEY, g);
    window.dispatchEvent(new CustomEvent('superdub:mascot-changed'));
  };

  const [dubColorId, setDubColorId] = useState(() => getDubColor().id);
  const pickDubColor = (id: string, locked: boolean) => {
    if (locked) return;
    localStorage.setItem(DUB_COLOR_KEY, id);
    setDubColorId(id);
    window.dispatchEvent(new CustomEvent('superdub:mascot-changed'));
  };

  const [habitsColor, setHabitsColor] = useState(() => localStorage.getItem(HABITS_COLOR_KEY) || '#FFB300');
  const [navGlow, setNavGlow] = useState(() => localStorage.getItem(NAV_GLOW_KEY) || '#2FD27E');
  const pickHabitColor = (c: AccentColor, locked: boolean) => {
    if (locked) return;
    localStorage.setItem(HABITS_COLOR_KEY, c.color); setHabitsColor(c.color);
    window.dispatchEvent(new CustomEvent('superdub:habits-color-changed'));
  };
  const pickGlow = (c: AccentColor, locked: boolean) => {
    if (locked) return;
    localStorage.setItem(NAV_GLOW_KEY, c.color); setNavGlow(c.color);
    window.dispatchEvent(new CustomEvent('superdub:nav-glow-changed'));
  };

  const [bgId, setBgId] = useState(() => getBackground().id);
  const pickBg = (b: Background, locked: boolean) => {
    if (locked) return;
    localStorage.setItem(BACKGROUND_KEY, b.id); setBgId(b.id);
    window.dispatchEvent(new CustomEvent('superdub:bg-changed'));
  };

  return (
    <>
      {/* Hero — the ring floats on a theme-coloured bloom; tap through to the full ladder */}
      {showHero && <LevelHeroRing />}

      {playerLevel.nextReward && (
        <div className="next-reward-card">
          <span className="next-reward-mark">{rewardMark(playerLevel.nextReward)}</span>
          <div className="next-reward-text">
            <span className="next-reward-eyebrow">NEXT UNLOCK · LV{playerLevel.level + 1}</span>
            <span className="next-reward-label">{playerLevel.nextReward.label}</span>
            <span className="next-reward-blurb">{playerLevel.nextReward.blurb}</span>
          </div>
        </div>
      )}

      <section className="asc-section">
        <Eyebrow sub="arc or liquid, marked on each">RING</Eyebrow>
        <div className="asc-shelf">
          {RING_THEMES.map(t => {
            const locked = !isUnlocked(t.unlock, ctx);
            const active = t.id === themeId;
            const isLiquid = t.fill === 'liquid';
            return (
              <button
                key={t.id}
                className={`ringtheme-chip${active ? ' active' : ''}${locked ? ' locked' : ''}`}
                onClick={() => equipTheme(t)}
                disabled={locked}
                title={`${t.name}, ${isLiquid ? 'liquid fill' : 'arc'}${locked ? ` · unlocks: ${unlockLabel(t.unlock)}` : ''}`}
              >
                <span className={`ringtheme-swatch${t.animated ? ' animated' : ''}`} style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})`, boxShadow: active ? `0 0 12px ${t.glow}` : undefined }}>
                  {locked && <span className="ringtheme-lock"><LockIc /></span>}
                  {active && !locked && <span className="ringtheme-check">✓</span>}
                  <span className={`ringtheme-fillbadge${isLiquid ? ' liquid' : ''}`}>{isLiquid ? <DropIc /> : <ArcIc />}</span>
                </span>
                <span className="ringtheme-name">{locked ? unlockLabel(t.unlock) : t.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="asc-section">
        <Eyebrow sub="who walks with you">COMPANION</Eyebrow>
        <div className="companion-grid">
          <button className={`companion-card${species === 'dog' ? ' active' : ''}`} onClick={() => pickSpecies('dog')}>
            <span className="companion-pet"><DubMascot size={66} mood="happy" species="dog" /></span>
            <span className="companion-name">Dub the dog{species === 'dog' ? ' ✓' : ''}</span>
          </button>
          <button
            className={`companion-card${species === 'cat' ? ' active' : ''}${catUnlocked ? '' : ' locked'}`}
            onClick={() => pickSpecies('cat')}
            disabled={!catUnlocked}
          >
            <span className="companion-pet">
              <DubMascot size={66} mood="happy" species="cat" />
              {!catUnlocked && <span className="companion-lock"><LockIc size={14} /></span>}
            </span>
            <span className="companion-name">{catUnlocked ? `Dub the cat${species === 'cat' ? ' ✓' : ''}` : 'Cat · LV2'}</span>
          </button>
        </div>
        <div className="dub-gender-row">
          <span className="dub-gender-label">Dub's pronouns</span>
          <div className="dub-gender-seg">
            {([['he', 'He'], ['she', 'She'], ['they', 'They']] as [DubGender, string][]).map(([g, label]) => (
              <button
                key={g}
                className={`dub-gender-pick${dubGender === g ? ' active' : ''}`}
                onClick={() => pickGender(g)}
              >{label}</button>
            ))}
          </div>
        </div>
        <div className="asc-shelf" style={{ marginTop: 10 }}>
          {DUB_COLORS.map(dc => {
            const locked = !isUnlocked(dc.unlock, ctx);
            const active = dc.id === dubColorId;
            return (
              <button key={dc.id} className={`ringtheme-chip${active ? ' active' : ''}${locked ? ' locked' : ''}`} onClick={() => pickDubColor(dc.id, locked)} disabled={locked} title={locked ? `Unlocks: ${unlockLabel(dc.unlock)}` : dc.name}>
                <span className="ringtheme-swatch" style={{ background: `linear-gradient(135deg, ${dc.bodyFrom}, ${dc.bodyTo})`, boxShadow: active ? `0 0 12px ${dc.accent}66` : undefined }}>
                  {locked && <span className="ringtheme-lock"><LockIc /></span>}
                  {active && !locked && <span className="ringtheme-check">✓</span>}
                </span>
                <span className="ringtheme-name">{locked ? unlockLabel(dc.unlock) : dc.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="asc-section">
        <Eyebrow sub="habits button · nav glow">ACCENTS</Eyebrow>
        <div className="asc-shelf">
          {HABIT_COLORS.map(c => {
            const locked = !isUnlocked(c.unlock, ctx);
            const active = habitsColor.toLowerCase() === c.color.toLowerCase();
            return (
              <button key={c.id} className={`ringtheme-chip${active ? ' active' : ''}${locked ? ' locked' : ''}`} onClick={() => pickHabitColor(c, locked)} disabled={locked} title={locked ? `Unlocks: ${unlockLabel(c.unlock)}` : `Habits button · ${c.name}`}>
                <span className="ringtheme-swatch" style={{ background: c.color, boxShadow: active ? `0 0 12px ${c.color}88` : undefined }}>
                  {locked && <span className="ringtheme-lock"><LockIc /></span>}
                  {active && !locked && <span className="ringtheme-check">✓</span>}
                </span>
                <span className="ringtheme-name">{locked ? unlockLabel(c.unlock) : c.name}</span>
              </button>
            );
          })}
        </div>
        <div className="asc-shelf" style={{ marginTop: 10 }}>
          {GLOW_COLORS.map(c => {
            const locked = !isUnlocked(c.unlock, ctx);
            const active = navGlow.toLowerCase() === c.color.toLowerCase();
            return (
              <button key={c.id} className={`ringtheme-chip${active ? ' active' : ''}${locked ? ' locked' : ''}`} onClick={() => pickGlow(c, locked)} disabled={locked} title={locked ? `Unlocks: ${unlockLabel(c.unlock)}` : `Menu glow · ${c.name}`}>
                <span className="ringtheme-swatch" style={{ background: c.color, boxShadow: active ? `0 0 12px ${c.color}88` : undefined }}>
                  {locked && <span className="ringtheme-lock"><LockIc /></span>}
                  {active && !locked && <span className="ringtheme-check">✓</span>}
                </span>
                <span className="ringtheme-name">{locked ? unlockLabel(c.unlock) : c.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="asc-section">
        <Eyebrow sub="the whole app's mood">BACKGROUND</Eyebrow>
        <div className="asc-shelf">
          {BACKGROUNDS.map(b => {
            const locked = !isUnlocked(b.unlock, ctx);
            const active = b.id === bgId;
            return (
              <button key={b.id} className={`ringtheme-chip${active ? ' active' : ''}${locked ? ' locked' : ''}`} onClick={() => pickBg(b, locked)} disabled={locked} title={locked ? `Unlocks: ${unlockLabel(b.unlock)}` : b.name}>
                <span className="ringtheme-swatch" style={{ background: b.grad, boxShadow: active ? '0 0 12px rgba(255,255,255,0.25)' : undefined, border: '1px solid rgba(255,255,255,0.12)' }}>
                  {locked && <span className="ringtheme-lock"><LockIc /></span>}
                  {active && !locked && <span className="ringtheme-check">✓</span>}
                </span>
                <span className="ringtheme-name">{locked ? unlockLabel(b.unlock) : b.name}</span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
};

export default LevelCustomizer;
