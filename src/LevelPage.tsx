import React, { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import './App.css';
import { api } from './api';
import { useXP } from './XPContext';
import SuperdubHeader from './SuperdubHeader';
import LevelRing from './LevelRing';
import DubMascot, { getMascot, MASCOT_KEY, type MascotSpecies } from './DubMascot';
import {
  PLAYER_LEVELS, RING_THEMES, getRingTheme, getSelectedThemeId,
  SELECTED_THEME_KEY, type RingTheme, habitXPForDoneDays,
  isUnlocked, unlockLabel, EARLY_ADOPTER_BEFORE, type UnlockCtx,
  DUB_COLORS, DUB_COLOR_KEY, getDubColor,
  HABIT_COLORS, GLOW_COLORS, HABITS_COLOR_KEY, NAV_GLOW_KEY, type AccentColor,
  BACKGROUNDS, BACKGROUND_KEY, getBackground, type Background,
} from './levels';

const CAT_UNLOCK_LEVEL = 2;

function navigateWithTransition(navigate: any, to: string) {
  const doNav = () => navigate(to);
  const startVT = (document as any).startViewTransition?.bind(document);
  if (startVT) startVT(() => flushSync(doNav));
  else doNav();
}

const YEAR = 2026;

function buildAllDays(): string[] {
  const d: string[] = [];
  for (let m = 0; m < 12; m++) {
    const n = new Date(YEAR, m + 1, 0).getDate();
    for (let day = 1; day <= n; day++) {
      d.push(`${String(day).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}`);
    }
  }
  return d;
}
const ALL_DAYS = buildAllDays();

function todayKey(): string {
  const n = new Date();
  return `${String(n.getDate()).padStart(2, '0')}/${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function startDateToKey(startDate: string | null): string | null {
  if (!startDate) return null;
  const parts = startDate.split('-');
  if (parts.length !== 3) return null;
  return `${parts[2]}/${parts[1]}`;
}

function computeHabitXP(
  habit: string,
  ht: Record<string, Record<string, boolean>>,
  today: string,
  startDate?: string | null
): { totalXP: number; totalDays: number; streak: number; bestStreak: number } {
  const todayIdx = ALL_DAYS.indexOf(today);
  let startIdx = 0;
  if (startDate) {
    const key = startDateToKey(startDate);
    if (key) {
      const si = ALL_DAYS.indexOf(key);
      if (si >= 0) startIdx = si;
    }
  }

  let totalDays = 0;
  let rollingStreak = 0;
  let bestStreak = 0;

  for (let i = startIdx; i <= todayIdx; i++) {
    const done = !!ht[ALL_DAYS[i]]?.[habit];
    if (done) {
      rollingStreak++;
      totalDays++;
      bestStreak = Math.max(bestStreak, rollingStreak);
    } else if (i < todayIdx) {
      rollingStreak = 0;
    }
  }

  const streak = rollingStreak;
  const totalXP = habitXPForDoneDays(totalDays);
  return { totalXP, totalDays, streak, bestStreak };
}

// Big circular level ring — themeable gradient (cosmetic unlock)
interface BadgeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  earned: boolean;
}

function computeBadges(
  habits: { name: string; startDate: string | null }[],
  ht: Record<string, Record<string, boolean>>,
  today: string,
  totalXP: number,
  playerLevel: number,
): BadgeDef[] {
  const allStats = habits.map(h => computeHabitXP(h.name, ht, today, h.startDate));
  const maxStreak = allStats.reduce((m, s) => Math.max(m, s.streak), 0);
  const maxBestStreak = allStats.reduce((m, s) => Math.max(m, s.bestStreak), 0);
  const totalDaysAllHabits = allStats.reduce((m, s) => m + s.totalDays, 0);

  return [
    {
      id: 'first-habit',
      name: 'First Step',
      icon: '🐣',
      desc: 'Added your first habit',
      earned: habits.length > 0,
    },
    {
      id: 'week-warrior',
      name: 'Week Warrior',
      icon: '🔥',
      desc: '7-day streak on any habit',
      earned: maxBestStreak >= 7,
    },
    {
      id: 'month-master',
      name: 'Month Master',
      icon: '📅',
      desc: '30-day streak on any habit',
      earned: maxBestStreak >= 30,
    },
    {
      id: 'century-club',
      name: 'Century Club',
      icon: '💯',
      desc: '100 total habit completions',
      earned: totalDaysAllHabits >= 100,
    },
    {
      id: 'level5',
      name: 'Rising',
      icon: '⚡',
      desc: 'Reach level 5',
      earned: playerLevel >= 5,
    },
    {
      id: 'level10',
      name: 'Halfway',
      icon: '🌟',
      desc: 'Reach level 10',
      earned: playerLevel >= 10,
    },
    {
      id: 'xp-1000',
      name: 'XP Grinder',
      icon: '💎',
      desc: 'Earn 1,000 total XP',
      earned: totalXP >= 1000,
    },
    {
      id: 'three-habits',
      name: 'Juggler',
      icon: '🎪',
      desc: 'Track 3+ habits at once',
      earned: habits.length >= 3,
    },
    {
      id: 'current-streak-30',
      name: 'On Fire',
      icon: '🌋',
      desc: 'Active 30-day streak right now',
      earned: maxStreak >= 30,
    },
    {
      id: 'transcendent',
      name: 'Transcendent',
      icon: '👑',
      desc: 'Reach max level 15',
      earned: playerLevel >= 15,
    },
  ];
}

// Collapsible section wrapper for the Level page
const Collapsible: React.FC<{ title: string; sub?: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, sub, defaultOpen, children }) => {
  const [o, setO] = useState(!!defaultOpen);
  return (
    <div className={`lvl-collapse${o ? ' open' : ''}`}>
      <button className="lvl-collapse-head" onClick={() => setO(v => !v)}>
        <span className="lvl-collapse-title">{title}</span>
        <span className={`lvl-collapse-chev${o ? ' open' : ''}`}>▾</span>
      </button>
      <div className="lvl-collapse-wrap"><div className="lvl-collapse-body">
        {sub && <p className="rewards-sub">{sub}</p>}
        {children}
      </div></div>
    </div>
  );
};

const LevelPage: React.FC = () => {
  const navigate = useNavigate();
  const [habits, setHabits] = useState<{ name: string; startDate: string | null }[]>([]);
  const [ht, setHt] = useState<Record<string, Record<string, boolean>>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([api.getHabits(), api.getTracker()]).then(([loadedHabits, trackerData]) => {
      setHabits(loadedHabits);
      const map: Record<string, Record<string, boolean>> = {};
      ALL_DAYS.forEach(d => { map[d] = {}; });
      loadedHabits.forEach(h => ALL_DAYS.forEach(d => { map[d][h.name] = false; }));
      (trackerData.habits as any[]).forEach(row => {
        if (map[row.day]) map[row.day][row.habit_name] = row.state === 'done' || row.done === true;
      });
      setHt(map);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const today = todayKey();
  const { totalXP, playerLevel } = useXP();
  const allStats = habits.map(h => ({
    ...h,
    ...computeHabitXP(h.name, ht, today, h.startDate),
  }));
  const badges = computeBadges(habits, ht, today, totalXP, playerLevel.level);

  const sortedByXP = [...allStats].sort((a, b) => b.totalXP - a.totalXP);

  // Equipped ring theme (cosmetic unlock)
  // Unlock context — what the user has earned
  const [earlyAdopter, setEarlyAdopter] = useState(false);
  useEffect(() => {
    api.getProfile().then((p: any) => {
      if (p?.accountCreatedAt) setEarlyAdopter(new Date(p.accountCreatedAt) < new Date(EARLY_ADOPTER_BEFORE));
    }).catch(() => {});
  }, []);
  const dayStreak = parseInt(localStorage.getItem('superdub.dayStreak') || '0', 10);
  const ctx: UnlockCtx = { level: playerLevel.level, streak: dayStreak, earlyAdopter };

  const [themeId, setThemeId] = useState(getSelectedThemeId);
  const theme = getRingTheme(themeId);
  const equipTheme = (t: RingTheme) => {
    if (!isUnlocked(t.unlock, ctx)) return;
    localStorage.setItem(SELECTED_THEME_KEY, t.id);
    setThemeId(t.id);
    window.dispatchEvent(new CustomEvent('superdub:ring-theme-changed'));
  };

  // Dub's species — cat unlocks at level 2
  const [species, setSpecies] = useState<MascotSpecies>(getMascot);
  const catUnlocked = playerLevel.level >= CAT_UNLOCK_LEVEL;
  const pickSpecies = (s: MascotSpecies) => {
    if (s === 'cat' && !catUnlocked) return;
    setSpecies(s);
    localStorage.setItem(MASCOT_KEY, s);
    window.dispatchEvent(new CustomEvent('superdub:mascot-changed'));
  };

  // Dub colour
  const [dubColorId, setDubColorId] = useState(() => getDubColor().id);
  const pickDubColor = (id: string, locked: boolean) => {
    if (locked) return;
    localStorage.setItem(DUB_COLOR_KEY, id);
    setDubColorId(id);
    window.dispatchEvent(new CustomEvent('superdub:mascot-changed'));
  };

  // Habit-button colour + menu-glow colour (unlock-gated swatches)
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

  // App background
  const [bgId, setBgId] = useState(() => getBackground().id);
  const pickBg = (b: Background, locked: boolean) => {
    if (locked) return;
    localStorage.setItem(BACKGROUND_KEY, b.id); setBgId(b.id);
    window.dispatchEvent(new CustomEvent('superdub:bg-changed'));
  };

  return (
    <div className="app flush" style={{ '--theme': '#22C55E', '--theme-dim': '#22C55E66', '--theme-glow': '#22C55E14' } as React.CSSProperties}>
      <SuperdubHeader />

      <div className="page-content level-page-content">
        {/* Level ring + XP */}
        <div className="hb-level">
          <LevelRing level={playerLevel.level} title={playerLevel.title} progress={playerLevel.progress} theme={theme} onClick={() => navigateWithTransition(navigate, '/')} />
          <div className="hb-xp">
            <div className="hb-xp-scale">
              <span>{totalXP.toLocaleString()} XP</span>
              <span>{playerLevel.xpForNext != null ? playerLevel.xpForNext.toLocaleString() : 'MAX'}</span>
            </div>
            <div className="hb-xp-bar">
              <div className="hb-xp-fill" style={{ width: `${Math.max(2, playerLevel.progress * 100)}%`, background: `linear-gradient(90deg, ${theme.from}, ${theme.to})`, boxShadow: `0 0 10px ${theme.glow}` }} />
            </div>
            {playerLevel.xpForNext != null ? (
              <p className="hb-xp-to">{(playerLevel.xpForNext - totalXP).toLocaleString()} XP to <span>{playerLevel.nextTitle}</span></p>
            ) : (
              <p className="hb-xp-to">Max level — you legend.</p>
            )}
          </div>
        </div>

        {/* Next reward callout */}
        {playerLevel.nextReward && (
          <div className="next-reward-card">
            <span className="next-reward-icon">{playerLevel.nextReward.icon}</span>
            <div className="next-reward-text">
              <span className="next-reward-eyebrow">NEXT REWARD · LV{playerLevel.level + 1}</span>
              <span className="next-reward-label">{playerLevel.nextReward.label}</span>
              <span className="next-reward-blurb">{playerLevel.nextReward.blurb}</span>
            </div>
          </div>
        )}

        <Collapsible title="🎨 Cosmetics & Unlocks" defaultOpen>
        {/* Ring themes — equip an unlocked cosmetic */}
        <div className="diet-section">
          <h2 className="diet-heading">Ring Themes</h2>
          <p className="rewards-sub">Equip a level-ring theme you’ve unlocked.</p>
          <div className="ringtheme-grid">
            {RING_THEMES.map(t => {
              const locked = !isUnlocked(t.unlock, ctx);
              const active = t.id === themeId;
              return (
                <button
                  key={t.id}
                  className={`ringtheme-chip${active ? ' active' : ''}${locked ? ' locked' : ''}`}
                  onClick={() => equipTheme(t)}
                  disabled={locked}
                  title={locked ? `Unlocks: ${unlockLabel(t.unlock)}` : t.name}
                >
                  <span className={`ringtheme-swatch${t.animated ? ' animated' : ''}`} style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})`, boxShadow: active ? `0 0 12px ${t.glow}` : undefined }}>
                    {locked && <span className="ringtheme-lock">🔒</span>}
                    {active && !locked && <span className="ringtheme-check">✓</span>}
                  </span>
                  <span className="ringtheme-name">{locked ? unlockLabel(t.unlock) : t.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dub colours */}
        <div className="diet-section">
          <h2 className="diet-heading">Dub's Colour</h2>
          <p className="rewards-sub">Recolour your companion. Unlock more as you level up.</p>
          <div className="ringtheme-grid">
            {DUB_COLORS.map(dc => {
              const locked = !isUnlocked(dc.unlock, ctx);
              const active = dc.id === dubColorId;
              return (
                <button key={dc.id} className={`ringtheme-chip${active ? ' active' : ''}${locked ? ' locked' : ''}`} onClick={() => pickDubColor(dc.id, locked)} disabled={locked} title={locked ? `Unlocks: ${unlockLabel(dc.unlock)}` : dc.name}>
                  <span className="ringtheme-swatch" style={{ background: `linear-gradient(135deg, ${dc.bodyFrom}, ${dc.bodyTo})`, boxShadow: active ? `0 0 12px ${dc.accent}66` : undefined }}>
                    {locked && <span className="ringtheme-lock">🔒</span>}
                    {active && !locked && <span className="ringtheme-check">✓</span>}
                  </span>
                  <span className="ringtheme-name">{locked ? unlockLabel(dc.unlock) : dc.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Habits button colour */}
        <div className="diet-section">
          <h2 className="diet-heading">Habits Button</h2>
          <p className="rewards-sub">The colour of your centre Habits button.</p>
          <div className="ringtheme-grid">
            {HABIT_COLORS.map(c => {
              const locked = !isUnlocked(c.unlock, ctx);
              const active = habitsColor.toLowerCase() === c.color.toLowerCase();
              return (
                <button key={c.id} className={`ringtheme-chip${active ? ' active' : ''}${locked ? ' locked' : ''}`} onClick={() => pickHabitColor(c, locked)} disabled={locked} title={locked ? `Unlocks: ${unlockLabel(c.unlock)}` : c.name}>
                  <span className="ringtheme-swatch" style={{ background: c.color, boxShadow: active ? `0 0 12px ${c.color}88` : undefined }}>
                    {locked && <span className="ringtheme-lock">🔒</span>}
                    {active && !locked && <span className="ringtheme-check">✓</span>}
                  </span>
                  <span className="ringtheme-name">{locked ? unlockLabel(c.unlock) : c.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Menu glow colour */}
        <div className="diet-section">
          <h2 className="diet-heading">Menu Glow</h2>
          <p className="rewards-sub">The glow on the selected bottom-nav item.</p>
          <div className="ringtheme-grid">
            {GLOW_COLORS.map(c => {
              const locked = !isUnlocked(c.unlock, ctx);
              const active = navGlow.toLowerCase() === c.color.toLowerCase();
              return (
                <button key={c.id} className={`ringtheme-chip${active ? ' active' : ''}${locked ? ' locked' : ''}`} onClick={() => pickGlow(c, locked)} disabled={locked} title={locked ? `Unlocks: ${unlockLabel(c.unlock)}` : c.name}>
                  <span className="ringtheme-swatch" style={{ background: c.color, boxShadow: active ? `0 0 12px ${c.color}88` : undefined }}>
                    {locked && <span className="ringtheme-lock">🔒</span>}
                    {active && !locked && <span className="ringtheme-check">✓</span>}
                  </span>
                  <span className="ringtheme-name">{locked ? unlockLabel(c.unlock) : c.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Companion — switch Dub between dog and cat */}
        <div className="diet-section">
          <h2 className="diet-heading">Your Companion</h2>
          <p className="rewards-sub">Choose what Dub is. The cat unlocks at level 2.</p>
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
                {!catUnlocked && <span className="companion-lock">🔒</span>}
              </span>
              <span className="companion-name">{catUnlocked ? `Dub the cat${species === 'cat' ? ' ✓' : ''}` : 'Cat · LV2'}</span>
            </button>
          </div>
        </div>

        {/* App background */}
        <div className="diet-section">
          <h2 className="diet-heading">App Background</h2>
          <p className="rewards-sub">Set the mood of the whole app. Unlock more as you level.</p>
          <div className="ringtheme-grid">
            {BACKGROUNDS.map(b => {
              const locked = !isUnlocked(b.unlock, ctx);
              const active = b.id === bgId;
              return (
                <button key={b.id} className={`ringtheme-chip${active ? ' active' : ''}${locked ? ' locked' : ''}`} onClick={() => pickBg(b, locked)} disabled={locked} title={locked ? `Unlocks: ${unlockLabel(b.unlock)}` : b.name}>
                  <span className="ringtheme-swatch" style={{ background: b.grad, boxShadow: active ? '0 0 12px rgba(255,255,255,0.25)' : undefined, border: '1px solid rgba(255,255,255,0.12)' }}>
                    {locked && <span className="ringtheme-lock">🔒</span>}
                    {active && !locked && <span className="ringtheme-check">✓</span>}
                  </span>
                  <span className="ringtheme-name">{locked ? unlockLabel(b.unlock) : b.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        </Collapsible>

        <Collapsible title="🏅 Badges">
          <div className="badges-grid">
            {badges.map(b => (
              <div key={b.id} className={`badge-card ${b.earned ? 'earned' : 'locked'}`}>
                <div className="badge-icon">{b.earned ? b.icon : '🔒'}</div>
                <div className="badge-name">{b.name}</div>
                <div className="badge-desc">{b.desc}</div>
              </div>
            ))}
          </div>
        </Collapsible>

        {loaded && sortedByXP.length > 0 && (
          <Collapsible title="📊 Habit Stats">
            <div className="habit-stats-list">
              {sortedByXP.map((h, i) => (
                <div key={h.name} className="habit-stat-row">
                  <span className="habit-stat-rank">#{i + 1}</span>
                  <div className="habit-stat-info">
                    <span className="habit-stat-name">{h.name}</span>
                    <span className="habit-stat-sub">{h.totalDays}d done · {h.streak}d streak · best {h.bestStreak}d</span>
                  </div>
                  <span className="habit-stat-xp">{h.totalXP.toLocaleString()} XP</span>
                </div>
              ))}
            </div>
          </Collapsible>
        )}

        <div style={{ marginBottom: 100 }}>
        <Collapsible title="⭐ All Levels & Rewards">
          <div className="level-reward-list">
            {PLAYER_LEVELS.map((lv, i) => {
              const reached = playerLevel.level >= i + 1;
              const current = playerLevel.level === i + 1;
              return (
                <div key={i} className={`level-reward-row${current ? ' current' : ''}${reached ? ' reached' : ' locked'}`}>
                  <span className="lrr-lv">LV{i + 1}</span>
                  <span className="lrr-reward-icon">{reached ? lv.reward.icon : '🔒'}</span>
                  <div className="lrr-info">
                    <span className="lrr-title">{lv.title}</span>
                    <span className="lrr-reward">{lv.reward.label}</span>
                  </div>
                  <span className="lrr-xp">{lv.xp.toLocaleString()}<span className="lrr-xp-unit">XP</span></span>
                </div>
              );
            })}
          </div>
        </Collapsible>
        </div>

      </div>
    </div>
  );
};

export default LevelPage;
