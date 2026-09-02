import React, { useState } from 'react';
import {
  RING_THEMES, getSelectedThemeId, SELECTED_THEME_KEY, type RingTheme,
  isUnlocked, unlockLabel, EARLY_ADOPTER_BEFORE, type UnlockCtx,
  HABIT_COLORS, GLOW_COLORS, HABITS_COLOR_KEY, NAV_GLOW_KEY, type AccentColor,
  BACKGROUNDS, BACKGROUND_KEY, getBackground, type Background,
} from './levels';

// "Make it yours" — the cosmetic shelves on the finish screen. Every picker writes
// the SAME localStorage key + dispatches the SAME CustomEvent as LevelCustomizer, so
// choices made here (before the account exists) are already applied the moment the
// app boots, and Profile shows them as equipped.
//
// The Dub mascot shelves (species, pronouns, Dub colour) were removed with the
// mascot itself (retired app-wide in v2.447) — they dressed a companion no other
// screen shows. What is left drives live surfaces: the XP ring, the two accents
// and the background.
//
// ponytail: this deliberately does NOT reuse LevelCustomizer — that component
// calls useXP() + api.getProfile/getFriends, which have no token pre-account. We
// reuse its DATA and helpers (levels.ts) instead, with a fixed level-1 unlock
// context. Locked shelves show as aspirational teasers ("unlocks as you level").

// New accounts created before the early-adopter cutoff genuinely qualify, so we
// unlock those cosmetics here too — accurate, and a generous welcome.
const ONB_CTX: UnlockCtx = {
  level: 1,
  streak: 0,
  earlyAdopter: Date.now() < Date.parse(EARLY_ADOPTER_BEFORE),
  globalWhite: false,
};

const LockIc: React.FC<{ size?: number }> = ({ size = 11 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="Locked">
    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const Eyebrow: React.FC<{ children: React.ReactNode; sub?: string }> = ({ children, sub }) => (
  <div className="asc-eyebrow-row">
    <span className="asc-eyebrow">{children}</span>
    {sub && <span className="asc-eyebrow-sub">{sub}</span>}
  </div>
);

const OnboardingCustomize: React.FC = () => {
  const [themeId, setThemeId] = useState(getSelectedThemeId);
  const [habitsColor, setHabitsColor] = useState(() => localStorage.getItem(HABITS_COLOR_KEY) || '#FFB300');
  const [navGlow, setNavGlow] = useState(() => localStorage.getItem(NAV_GLOW_KEY) || '#2FD27E');
  const [bgId, setBgId] = useState(() => getBackground().id);

  const equipTheme = (t: RingTheme, locked: boolean) => {
    if (locked) return;
    localStorage.setItem(SELECTED_THEME_KEY, t.id); setThemeId(t.id);
    window.dispatchEvent(new CustomEvent('superdub:ring-theme-changed'));
  };
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
  const pickBg = (b: Background, locked: boolean) => {
    if (locked) return;
    localStorage.setItem(BACKGROUND_KEY, b.id); setBgId(b.id);
    window.dispatchEvent(new CustomEvent('superdub:bg-changed'));
  };

  return (
    <div className="onb-dub">
      <section className="asc-section">
        <Eyebrow sub="your XP ring">RING</Eyebrow>
        <div className="asc-shelf">
          {RING_THEMES.map(t => {
            const locked = !isUnlocked(t.unlock, ONB_CTX);
            const active = t.id === themeId;
            return (
              <button key={t.id} className={`ringtheme-chip${active ? ' active' : ''}${locked ? ' locked' : ''}`} onClick={() => equipTheme(t, locked)} disabled={locked} title={locked ? `Unlocks: ${unlockLabel(t.unlock)}` : t.name}>
                <span className={`ringtheme-swatch${t.animated ? ' animated' : ''}`} style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})`, boxShadow: active ? `0 0 12px ${t.glow}` : undefined }}>
                  {locked && <span className="ringtheme-lock"><LockIc /></span>}
                  {active && !locked && <span className="ringtheme-check">✓</span>}
                </span>
                <span className="ringtheme-name">{locked ? unlockLabel(t.unlock) : t.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="asc-section">
        <Eyebrow sub="habits button · nav glow">ACCENTS</Eyebrow>
        <div className="asc-shelf">
          {HABIT_COLORS.map(c => {
            const locked = !isUnlocked(c.unlock, ONB_CTX);
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
            const locked = !isUnlocked(c.unlock, ONB_CTX);
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
            const locked = !isUnlocked(b.unlock, ONB_CTX);
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
    </div>
  );
};

export default OnboardingCustomize;
