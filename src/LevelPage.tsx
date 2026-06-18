import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';
import { api } from './api';

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

function getPlayerLevel(totalXP: number): { level: number; title: string; progress: number; xpForNext: number | null; xpForLevel: number } {
  let idx = 0;
  for (let i = LEVEL_GATES.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_GATES[i][0]) { idx = i; break; }
  }
  const xpForLevel = LEVEL_GATES[idx][0];
  const xpForNext = idx < LEVEL_GATES.length - 1 ? LEVEL_GATES[idx + 1][0] : null;
  const progress = xpForNext ? (totalXP - xpForLevel) / (xpForNext - xpForLevel) : 1;
  return { level: idx + 1, title: LEVEL_GATES[idx][1], progress, xpForNext, xpForLevel };
}

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
        if (map[row.day]) map[row.day][row.habit_name] = row.done;
      });
      setHt(map);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const today = todayKey();
  const allStats = habits.map(h => ({
    ...h,
    ...computeHabitXP(h.name, ht, today, h.startDate),
  }));
  const totalXP = allStats.reduce((sum, s) => sum + s.totalXP, 0);
  const playerLevel = getPlayerLevel(totalXP);
  const badges = computeBadges(habits, ht, today, totalXP, playerLevel.level);

  const sortedByXP = [...allStats].sort((a, b) => b.totalXP - a.totalXP);

  return (
    <div className="app flush" style={{ '--theme': '#7C3AED', '--theme-dim': '#7C3AED66', '--theme-glow': '#7C3AED22' } as React.CSSProperties}>
      <div className="page-content level-page-content">
        <div className="page-intro-row">
          <button className="page-back" onClick={() => navigate(-1)}><span className="page-back-arrow">‹</span> Back</button>
          <h1 className="page-intro-title">Level Profile</h1>
        </div>

        {/* Level card */}
        <div className="level-hero-card">
          <div className="level-hero-badge">Lv.{playerLevel.level}</div>
          <div className="level-hero-info">
            <div className="level-hero-title">{playerLevel.title}</div>
            <div className="level-hero-xp">{totalXP.toLocaleString()} XP total</div>
            <div className="level-hero-bar-wrap">
              <div className="level-hero-bar">
                <div className="level-hero-fill" style={{ width: `${playerLevel.progress * 100}%` }} />
              </div>
              {playerLevel.xpForNext && (
                <div className="level-hero-next">
                  {(totalXP - playerLevel.xpForLevel).toLocaleString()} / {(playerLevel.xpForNext - playerLevel.xpForLevel).toLocaleString()} XP to next level
                </div>
              )}
            </div>
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
