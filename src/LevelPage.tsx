import React, { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import './App.css';
import { api } from './api';
import { useXP } from './XPContext';

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

const XP_GATES: [number, number][] = [
  [0, 10], [7, 15], [14, 20], [30, 25], [60, 30], [100, 35], [200, 40], [365, 50],
];

const LEVEL_GATES: [number, string][] = [
  [0, 'Rookie'], [100, 'Beginner'], [300, 'Novice'], [700, 'Apprentice'],
  [1500, 'Adept'], [3000, 'Journeyman'], [5000, 'Expert'], [8000, 'Elite'],
  [12000, 'Champion'], [18000, 'Legend'], [28000, 'Grandmaster'],
  [42000, 'Mythic'], [60000, 'Immortal'], [85000, 'Eternal'], [120000, 'Transcendent'],
];

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

  let totalXP = 0;
  let totalDays = 0;
  let rollingStreak = 0;
  let bestStreak = 0;

  for (let i = startIdx; i <= todayIdx; i++) {
    const done = !!ht[ALL_DAYS[i]]?.[habit];
    if (done) {
      rollingStreak++;
      totalDays++;
      bestStreak = Math.max(bestStreak, rollingStreak);
      const snap = rollingStreak;
      const gateIdx = XP_GATES.filter(([t]) => t > 0 && snap >= t).length;
      totalXP += XP_GATES[Math.min(gateIdx, XP_GATES.length - 1)][1];
    } else if (i < todayIdx) {
      rollingStreak = 0;
    }
  }

  const streak = rollingStreak;
  return { totalXP, totalDays, streak, bestStreak };
}

function getPlayerLevel(totalXP: number): { level: number; title: string; progress: number; xpForNext: number | null; xpForLevel: number; nextTitle: string | null } {
  let idx = 0;
  for (let i = LEVEL_GATES.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_GATES[i][0]) { idx = i; break; }
  }
  const xpForLevel = LEVEL_GATES[idx][0];
  const xpForNext = idx < LEVEL_GATES.length - 1 ? LEVEL_GATES[idx + 1][0] : null;
  const nextTitle = idx < LEVEL_GATES.length - 1 ? LEVEL_GATES[idx + 1][1] : null;
  const progress = xpForNext ? (totalXP - xpForLevel) / (xpForNext - xpForLevel) : 1;
  return { level: idx + 1, title: LEVEL_GATES[idx][1], progress, xpForNext, xpForLevel, nextTitle };
}

// Big circular level ring (gold gradient), matching the Habits page
const LevelRing: React.FC<{ level: number; title: string; progress: number; onClick?: () => void }> = ({ level, title, progress, onClick }) => {
  const size = 172, stroke = 13, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <button className="lvl-ring" style={{ width: size, height: size }} onClick={onClick} aria-label="Back to habits">
      <svg width={size} height={size} className="lvl-ring-svg">
        <defs>
          <linearGradient id="lvlGradLP" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFE15A" />
            <stop offset="100%" stopColor="#FFC42E" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#33333D" strokeWidth={stroke} />
        <circle className="lvl-ring-arc" cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#lvlGradLP)" strokeWidth={stroke} strokeLinecap="butt" strokeDasharray={circ} strokeDashoffset={offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <circle cx={size / 2} cy={size / 2} r={r - stroke / 2} fill="#0B0B11" />
      </svg>
      <div className="lvl-ring-center">
        <span className="lvl-ring-eyebrow">LEVEL</span>
        <span className="lvl-ring-num">{level}</span>
        <span className="lvl-ring-title">{title}</span>
      </div>
    </button>
  );
};

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

  return (
    <div className="app flush" style={{ '--theme': '#22C55E', '--theme-dim': '#22C55E66', '--theme-glow': '#22C55E14' } as React.CSSProperties}>
      {/* Top bar: brand + cog */}
      <div className="hb-topbar">
        <div className="hb-brand">
          <img className="hb-brand-logo" src="/superdub-logo.png" alt="" />
          <span className="hb-brand-name">super<span className="hb-brand-dub">dub</span></span><span className="hb-build-tag">v2.144</span>
        </div>
        <div className="hb-topbar-actions">
          <button className="hb-cog" onClick={() => navigate('/profile')} aria-label="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="19" height="19">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="page-content level-page-content">
        {/* Level ring + XP */}
        <div className="hb-level">
          <LevelRing level={playerLevel.level} title={playerLevel.title} progress={playerLevel.progress} onClick={() => navigateWithTransition(navigate, '/')} />
          <div className="hb-xp">
            <div className="hb-xp-scale">
              <span>{totalXP.toLocaleString()} XP</span>
              <span>{playerLevel.xpForNext != null ? playerLevel.xpForNext.toLocaleString() : 'MAX'}</span>
            </div>
            <div className="hb-xp-bar">
              <div className="hb-xp-fill" style={{ width: `${Math.max(2, playerLevel.progress * 100)}%` }} />
            </div>
            {playerLevel.xpForNext != null ? (
              <p className="hb-xp-to">{(playerLevel.xpForNext - totalXP).toLocaleString()} XP to <span>{playerLevel.nextTitle}</span></p>
            ) : (
              <p className="hb-xp-to">Max level — you legend.</p>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="diet-section">
          <h2 className="diet-heading">Badges</h2>
          <div className="badges-grid">
            {badges.map(b => (
              <div key={b.id} className={`badge-card ${b.earned ? 'earned' : 'locked'}`}>
                <div className="badge-icon">{b.earned ? b.icon : '🔒'}</div>
                <div className="badge-name">{b.name}</div>
                <div className="badge-desc">{b.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Per-habit XP breakdown */}
        {loaded && sortedByXP.length > 0 && (
          <div className="diet-section">
            <h2 className="diet-heading">Habit Stats</h2>
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
          </div>
        )}

        {/* Level table */}
        <div className="diet-section" style={{ marginBottom: 100 }}>
          <h2 className="diet-heading">All Levels</h2>
          <div className="about-table-wrap">
            <table className="about-table">
              <thead>
                <tr><th>Level</th><th>Title</th><th>XP needed</th></tr>
              </thead>
              <tbody>
                {LEVEL_GATES.map(([xp, title], i) => (
                  <tr key={i} className={playerLevel.level === i + 1 ? 'current-level-row' : ''}>
                    <td>Lv.{i + 1}</td>
                    <td>{title as string}</td>
                    <td>{(xp as number).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LevelPage;
