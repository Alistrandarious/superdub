import React, { useState, useEffect } from 'react';
import './App.css';
import { api } from './api';
import { useXP } from './XPContext';
import SuperdubHeader from './SuperdubHeader';
import { pageTheme, GOLD } from './theme';
import { PLAYER_LEVELS, RING_THEMES, habitXPForDoneDays } from './levels';

const YEAR = new Date().getFullYear();

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

// ── Small stroke glyphs (style guide: no emoji in UI chrome) ────────────────
const LockIc: React.FC<{ size?: number }> = ({ size = 11 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="Locked">
    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
// Section header: mono eyebrow + hairline, per the swatches type spec
const Eyebrow: React.FC<{ children: React.ReactNode; sub?: string }> = ({ children, sub }) => (
  <div className="asc-eyebrow-row">
    <span className="asc-eyebrow">{children}</span>
    {sub && <span className="asc-eyebrow-sub">{sub}</span>}
  </div>
);

const LevelPage: React.FC = () => {
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

  const earnedBadges = badges.filter(b => b.earned).length;

  // Reward glyph for the ladder: theme rewards show their actual gradient
  // swatch; milestones & flair get the violet rank diamond (guide: violet =
  // rare rank accent). No emoji.
  const rewardMark = (r: (typeof PLAYER_LEVELS)[number]['reward']) => {
    if (r.kind === 'theme' && r.themeId) {
      const t = RING_THEMES.find(x => x.id === r.themeId);
      if (t) return <span className="asc-swatch" style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }} />;
    }
    return <span className="asc-diamond" />;
  };

  return (
    <div className="app flush" style={pageTheme(GOLD)}>
      <div className="page-content level-page-content">
        {/* Header scrolls with the page, nothing on this page needs to stay pinned */}
        <SuperdubHeader />
        {/* ── The Ladder, every level as a stop on a gold spine ── */}
        <section className="asc-section">
          <Eyebrow sub={`you're LV${playerLevel.level} of ${PLAYER_LEVELS.length}`}>THE LADDER</Eyebrow>
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

        {/* ── Badges, medals, not emoji ── */}
        <section className="asc-section">
          <Eyebrow sub={`${earnedBadges} of ${badges.length} earned`}>BADGES</Eyebrow>
          <div className="badges-grid">
            {badges.map(b => (
              <div key={b.id} className={`badge-card ${b.earned ? 'earned' : 'locked'}`}>
                <div className={`badge-medal${b.earned ? ' earned' : ''}`}>{b.earned ? '✓' : <LockIc />}</div>
                <div className="badge-name">{b.name}</div>
                <div className="badge-desc">{b.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {loaded && sortedByXP.length > 0 && (
          <section className="asc-section" style={{ marginBottom: 100 }}>
            <Eyebrow sub="ranked by XP">HABIT RECORD</Eyebrow>
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
          </section>
        )}

      </div>
    </div>
  );
};

export default LevelPage;
