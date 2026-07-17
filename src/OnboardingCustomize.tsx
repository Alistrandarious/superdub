import React, { useState } from 'react';
import DubMascot, { getMascot, MASCOT_KEY, type MascotSpecies } from './DubMascot';
import { getDubGender, DUB_GENDER_KEY, type DubGender } from './dubPronouns';
import {
  RING_THEMES, getSelectedThemeId, SELECTED_THEME_KEY, type RingTheme,
  isUnlocked, unlockLabel, EARLY_ADOPTER_BEFORE, type UnlockCtx,
  DUB_COLORS, DUB_COLOR_KEY, getDubColor,
  HABIT_COLORS, GLOW_COLORS, HABITS_COLOR_KEY, NAV_GLOW_KEY, type AccentColor,
  BACKGROUNDS, BACKGROUND_KEY, getBackground, type Background,
} from './levels';

// Screen 7 of onboarding — "Meet Dub, then make it yours." Dub greets the user in
// person, then the full cosmetic shelves sit below him. Every picker writes the
// SAME localStorage key + dispatches the SAME CustomEvent as LevelCustomizer, so
// choices made here (before the account exists) are already applied the moment the
// app boots, and Profile shows them as equipped.
//
// ponytail: this deliberately does NOT reuse LevelCustomizer — that component
// calls useXP() + api.getProfile/getFriends, which have no token pre-account. We
// reuse its DATA and helpers (levels.ts) instead, with a fixed level-1 unlock
// context. Locked shelves show as aspirational teasers ("unlocks as you level").

// New accounts created before the early-adopter cutoff genuinely qualify, so we
// unlock those cosmetics here too — accurate, and a generous welcome.
const CAT_UNLOCK_LEVEL = 2;
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

const OnboardingCustomize: React.FC<{ nickname: string }> = ({ nickname }) => {
  const [species, setSpecies] = useState<MascotSpecies>(getMascot);
  const [dubGender, setDubGender] = useState<DubGender>(getDubGender);
  const [dubColorId, setDubColorId] = useState(() => getDubColor().id);
  const [themeId, setThemeId] = useState(getSelectedThemeId);
  const [habitsColor, setHabitsColor] = useState(() => localStorage.getItem(HABITS_COLOR_KEY) || '#FFB300');
  const [navGlow, setNavGlow] = useState(() => localStorage.getItem(NAV_GLOW_KEY) || '#2FD27E');
  const [bgId, setBgId] = useState(() => getBackground().id);

  // Cat is the only teased companion worth showing at signup; wizard needs
  // referrals (no friends yet), so it stays on Profile.
  const catUnlocked = false; // level 1
  const pickSpecies = (s: MascotSpecies) => {
    if (s === 'cat' && !catUnlocked) return;
    setSpecies(s);
    localStorage.setItem(MASCOT_KEY, s);
    window.dispatchEvent(new CustomEvent('superdub:mascot-changed'));
  };
  const pickGender = (g: DubGender) => {
    setDubGender(g);
    localStorage.setItem(DUB_GENDER_KEY, g);
    window.dispatchEvent(new CustomEvent('superdub:mascot-changed'));
  };
  const pickDubColor = (id: string, locked: boolean) => {
    if (locked) return;
    localStorage.setItem(DUB_COLOR_KEY, id); setDubColorId(id);
    window.dispatchEvent(new CustomEvent('superdub:mascot-changed'));
  };
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
      {/* Dub greets the user in person, recolouring live as they pick */}
      <div className="onb-dub-hero">
        <div className="onb-dub-bubble">Hi {nickname || 'there'}, I'm Dub. Let's make this yours.</div>
        <DubMascot size={132} mood="happy" species={species} colorId={dubColorId} />
      </div>

      <section className="asc-section">
        <Eyebrow sub="who walks with you">COMPANION</Eyebrow>
        <div className="companion-grid">
          <button className={`companion-card${species === 'dog' ? ' active' : ''}`} onClick={() => pickSpecies('dog')}>
            <span className="companion-pet"><DubMascot size={66} mood="happy" species="dog" colorId={dubColorId} /></span>
            <span className="companion-name">Dub the dog{species === 'dog' ? ' ✓' : ''}</span>
          </button>
          <button className="companion-card locked" onClick={() => pickSpecies('cat')} disabled>
            <span className="companion-pet">
              <DubMascot size={66} mood="happy" species="cat" colorId={dubColorId} />
              <span className="companion-lock"><LockIc size={14} /></span>
            </span>
            <span className="companion-name">Cat · LV{CAT_UNLOCK_LEVEL}</span>
          </button>
        </div>
        <div className="dub-gender-row">
          <span className="dub-gender-label">Dub's pronouns</span>
          <div className="dub-gender-seg">
            {([['he', 'He'], ['she', 'She'], ['they', 'They']] as [DubGender, string][]).map(([g, label]) => (
              <button key={g} className={`dub-gender-pick${dubGender === g ? ' active' : ''}`} onClick={() => pickGender(g)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="asc-shelf" style={{ marginTop: 10 }}>
          {DUB_COLORS.map(dc => {
            const locked = !isUnlocked(dc.unlock, ONB_CTX);
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
