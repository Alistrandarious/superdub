import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './App.css';
import { api, clearToken } from './api';

/* ── helpers ─────────────────────────────────────────────── */

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

// [streak threshold, XP per completed day at that gate]
const XP_GATES: [number, number][] = [
  [0, 10], [7, 15], [14, 20], [30, 25], [60, 30], [100, 35], [200, 40], [365, 50],
];
const GATE_LABELS = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'MAX'];

function todayKey(): string {
  const n = new Date();
  return `${String(n.getDate()).padStart(2, '0')}/${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function getWeekDays(): { key: string; label: string; isFuture: boolean; isToday: boolean }[] {
  const now = new Date();
  const dow = now.getDay(); // 0 = Sunday
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  mon.setHours(0, 0, 0, 0);
  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = todayKey();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const nowStart = new Date(now);
    nowStart.setHours(0, 0, 0, 0);
    return { key, label: DAY_LABELS[i], isFuture: dayStart > nowStart, isToday: key === today };
  });
}

function getRank(totalDays: number): { title: string; color: string } {
  if (totalDays >= 365) return { title: 'Master', color: '#ffd700' };
  if (totalDays >= 100) return { title: 'In the Hundreds', color: '#bf5af2' };
  if (totalDays >= 50)  return { title: 'Habit Tracking Superstar', color: '#ff9500' };
  if (totalDays >= 30)  return { title: 'Rising Star', color: '#ff6ec7' };
  if (totalDays >= 10)  return { title: 'Gathering Momentum', color: '#00e5ff' };
  return { title: 'Habitteaur', color: '#888' };
}

function weatherEmoji(code: number): string {
  if (code === 0)  return '☀️';
  if (code <= 3)   return '⛅';
  if (code <= 48)  return '🌫️';
  if (code <= 55)  return '🌦️';
  if (code <= 65)  return '🌧️';
  if (code <= 77)  return '❄️';
  if (code <= 82)  return '🌧️';
  return '⛈️';
}

/* ── habit stats computation ─────────────────────────────── */

interface HabitStats {
  streak: number;
  totalDays: number;
  totalXP: number;
  currentGateIndex: number;
  xpPerDay: number;
  nextGateAt: number;
  gateProgress: number; // 0–1 within current gate segment
  misses: number;       // consecutive misses ending at yesterday
}

function computeHabitStats(
  habit: string,
  ht: Record<string, Record<string, boolean>>,
  today: string
): HabitStats {
  const todayIdx = ALL_DAYS.indexOf(today);
  if (todayIdx < 0) {
    return { streak: 0, totalDays: 0, totalXP: 0, currentGateIndex: 0, xpPerDay: 10, nextGateAt: 7, gateProgress: 0, misses: 0 };
  }

  // Rolling pass to compute totalXP and totalDays
  let totalXP = 0;
  let totalDays = 0;
  let rollingStreak = 0;

  for (let i = 0; i <= todayIdx; i++) {
    const day = ALL_DAYS[i];
    const done = !!ht[day]?.[habit];
    if (done) {
      rollingStreak++;
      totalDays++;
      const snap = rollingStreak;
      const gateIdx = XP_GATES.filter(([t]) => t > 0 && snap >= t).length;
      totalXP += XP_GATES[Math.min(gateIdx, XP_GATES.length - 1)][1];
    } else if (i < todayIdx) {
      rollingStreak = 0;
    }
  }

  // Consecutive misses before today — only relevant if habit has been done before
  let misses = 0;
  if (totalDays > 0) {
    for (let i = todayIdx - 1; i >= 0 && i >= todayIdx - 4; i--) {
      if (!ht[ALL_DAYS[i]]?.[habit]) misses++;
      else break;
    }
  }

  // Streak (allow 1-grace miss)
  let streak = 0;
  if (misses < 2) {
    const todayDone = !!ht[today]?.[habit];
    let graceUsed = false;
    let idx = todayDone ? todayIdx : todayIdx - 1;
    while (idx >= 0) {
      const done = !!ht[ALL_DAYS[idx]]?.[habit];
      if (done) {
        streak++;
        idx--;
      } else if (!graceUsed) {
        graceUsed = true;
        idx--;
      } else {
        break;
      }
    }
  }

  // Current gate from streak
  const gateIdx = XP_GATES.filter(([t]) => t > 0 && streak >= t).length;
  const currentGateIndex = gateIdx;
  const xpPerDay = XP_GATES[Math.min(gateIdx, XP_GATES.length - 1)][1];
  const currentGateThreshold = XP_GATES[Math.min(gateIdx, XP_GATES.length - 1)][0];
  const nextGateIdx = Math.min(gateIdx + 1, XP_GATES.length - 1);
  const nextGateAt = XP_GATES[nextGateIdx][0];
  const range = nextGateAt - currentGateThreshold;
  const gateProgress = range > 0
    ? Math.min((streak - currentGateThreshold) / range, 1)
    : 1;

  return { streak, totalDays, totalXP, currentGateIndex, xpPerDay, nextGateAt, gateProgress, misses };
}

/* ── featured habits ─────────────────────────────────────── */

const FEATURED = [
  {
    id: 'walk-10k',
    name: '10K Walks',
    tagline: "Ali's doing steps — join him",
    icon: '🚶‍♂️',
    accent: '#00e5ff',
    bgClass: 'featured-bg-walk',
  },
  {
    id: 'no-gambling',
    name: '0 Gambling',
    tagline: 'Take back control. Every day counts.',
    icon: '🎯',
    accent: '#bf5af2',
    bgClass: 'featured-bg-gamble',
  },
  {
    id: 'pet-iggy',
    name: 'Petting Iggy',
    tagline: 'Daily love for your sweet fury baby girl.',
    icon: '🐶',
    accent: '#30d158',
    bgClass: 'featured-bg-iggy',
  },
];

/* ── types ───────────────────────────────────────────────── */

interface WeatherState { temp: number; code: number; city: string; }

/* ── sub-components ──────────────────────────────────────── */

const WeatherBar: React.FC<{ weather: WeatherState | null }> = ({ weather }) => {
  if (!weather) return null;
  return (
    <div className="weather-bar">
      <span className="weather-emoji">{weatherEmoji(weather.code)}</span>
      <span className="weather-temp">{weather.temp}°C</span>
      {weather.city && <span className="weather-city">{weather.city}</span>}
    </div>
  );
};

const FeaturedCarousel: React.FC<{
  userHabits: string[];
  onAdd: (name: string) => void;
}> = ({ userHabits, onAdd }) => {
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActive(a => (a + 1) % FEATURED.length);
    }, 5000);
  }, []);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  const goTo = (i: number) => {
    setActive(i);
    startTimer();
  };

  const card = FEATURED[active];
  const alreadyAdded = userHabits.includes(card.name);

  return (
    <div className="featured-wrap">
      <p className="featured-section-label">Featured Habits</p>
      <div className={`featured-card ${card.bgClass}`} style={{ '--featured-accent': card.accent } as React.CSSProperties}>
        <div className="featured-icon-bg">{card.icon}</div>
        <div className="featured-content">
          <p className="featured-tag">Featured</p>
          <h3 className="featured-name">{card.name}</h3>
          <p className="featured-tagline">{card.tagline}</p>
          <button
            className={`featured-add-btn ${alreadyAdded ? 'added' : ''}`}
            onClick={() => !alreadyAdded && onAdd(card.name)}
            style={{ '--featured-accent': card.accent } as React.CSSProperties}
          >
            {alreadyAdded ? '✓ Added' : '+ Join'}
          </button>
        </div>
        <div className="featured-dots">
          {FEATURED.map((_, i) => (
            <button
              key={i}
              className={`featured-dot ${i === active ? 'active' : ''}`}
              onClick={() => goTo(i)}
              style={{ '--featured-accent': card.accent } as React.CSSProperties}
              aria-label={`Go to ${FEATURED[i].name}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const HabitCard: React.FC<{
  habit: string;
  stats: HabitStats;
  weekDays: ReturnType<typeof getWeekDays>;
  ht: Record<string, Record<string, boolean>>;
  today: string;
  onToggle: (habit: string, done: boolean) => void;
  onRemove: (habit: string) => void;
}> = ({ habit, stats, weekDays, ht, today, onToggle, onRemove }) => {
  const rank = getRank(stats.totalDays);
  const todayDone = !!ht[today]?.[habit];
  const isFlame = stats.streak >= 7;
  const hasDanger = stats.misses >= 2;
  const hasWarning = stats.misses === 1 && !todayDone;

  // EXP bar gate dots
  const gateDots = XP_GATES.map(([t], i) => ({
    label: GATE_LABELS[i],
    reached: stats.streak >= t || (t === 0),
  }));

  return (
    <div className={`hcard ${hasDanger ? 'hcard-danger' : hasWarning ? 'hcard-warning' : ''}`}>
      {/* Header */}
      <div className="hcard-header">
        <span className="hcard-icon">{isFlame ? '🔥' : '✓'}</span>
        <span className="hcard-name">{habit}</span>
        <span className="hcard-streak">{stats.streak}d</span>
        <button className="hcard-remove" onClick={() => onRemove(habit)} aria-label="Remove habit">✕</button>
      </div>

      {/* EXP bar */}
      <div className="hcard-exp-area">
        <div className="hcard-exp-bar-wrap">
          <div className="hcard-exp-bar">
            <div
              className="hcard-exp-fill"
              style={{ width: `${stats.gateProgress * 100}%` }}
            />
          </div>
          <div className="hcard-gate-dots">
            {gateDots.map((g, i) => (
              <div
                key={i}
                className={`hcard-gate-dot ${g.reached ? 'reached' : ''}`}
                title={`${g.label}: ${XP_GATES[i][0]}d streak`}
              />
            ))}
          </div>
        </div>
        <div className="hcard-xp-info">
          <span className="hcard-xp-total">{stats.totalXP} XP</span>
          <span className="hcard-xp-rate">+{stats.xpPerDay} XP/day</span>
        </div>
      </div>

      {/* Gate progress text */}
      {stats.currentGateIndex < XP_GATES.length - 1 && (
        <p className="hcard-gate-label">
          {GATE_LABELS[stats.currentGateIndex]} → next gate at {stats.nextGateAt}d streak
        </p>
      )}

      {/* Rank */}
      <div className="hcard-rank" style={{ color: rank.color }}>{rank.title}</div>

      {/* Warnings */}
      {hasDanger && (
        <div className="hcard-alert danger">
          🔴 2 consecutive misses — streak reset. Start fresh today!
        </div>
      )}
      {hasWarning && (
        <div className="hcard-alert warning">
          ⚠️ You missed yesterday — don't break your streak!
        </div>
      )}

      {/* Week circles */}
      <div className="hcard-week">
        {weekDays.map(({ key, label, isFuture, isToday }) => {
          const done = !!ht[key]?.[habit];
          return (
            <div
              key={key}
              className={`hcard-day ${done ? 'done' : ''} ${isFuture ? 'future' : ''} ${isToday ? 'is-today' : ''}`}
            >
              <div className="hcard-day-circle">
                {done && !isFuture && <span className="hcard-day-tick">{isFlame && done ? '🔥' : '✓'}</span>}
              </div>
              <span className="hcard-day-label">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Today toggle */}
      <button
        className={`hcard-today-btn ${todayDone ? 'done' : ''}`}
        onClick={() => onToggle(habit, !todayDone)}
      >
        {todayDone ? '✓ Done today' : '+ Mark done today'}
      </button>
    </div>
  );
};

/* ── main page ───────────────────────────────────────────── */

const Habits: React.FC = () => {
  const [habits, setHabits] = useState<string[]>([]);
  const [ht, setHt] = useState<Record<string, Record<string, boolean>>>({});
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const today = todayKey();
  const weekDays = getWeekDays();

  // Load habits + tracker
  useEffect(() => {
    Promise.all([api.getHabits(), api.getTracker()]).then(([loadedHabits, trackerData]) => {
      const active = loadedHabits.length > 0 ? loadedHabits : [];
      setHabits(active);

      const map: Record<string, Record<string, boolean>> = {};
      ALL_DAYS.forEach(d => { map[d] = {}; });
      active.forEach(h => ALL_DAYS.forEach(d => { map[d][h] = false; }));
      (trackerData.habits as any[]).forEach(row => {
        if (map[row.day]) map[row.day][row.habit_name] = row.done;
      });
      setHt(map);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  // Load weather via geolocation
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const [wxRes, geoRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`),
            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`),
          ]);
          const wx = await wxRes.json();
          const geo = await geoRes.json();
          const city = geo.address?.city || geo.address?.town || geo.address?.village || geo.address?.county || '';
          setWeather({
            temp: Math.round(wx.current.temperature_2m),
            code: wx.current.weather_code,
            city,
          });
        } catch {}
      },
      () => {} // permission denied — silent
    );
  }, []);

  const handleToggle = useCallback((habit: string, done: boolean) => {
    setHt(prev => ({
      ...prev,
      [today]: { ...prev[today], [habit]: done },
    }));
    api.toggleTrackerHabit(today, habit, done).catch(() => {});
  }, [today]);

  const handleAddFeatured = useCallback((name: string) => {
    if (habits.includes(name)) return;
    const updated = [...habits, name];
    setHabits(updated);
    setHt(prev => {
      const next = { ...prev };
      ALL_DAYS.forEach(d => { next[d] = { ...next[d], [name]: false }; });
      return next;
    });
    api.updateHabits(updated).catch(() => {});
  }, [habits]);

  if (!loaded) {
    return (
      <div className="app" style={{ '--theme': '#bf5af2', '--theme-dim': '#bf5af266', '--theme-glow': '#bf5af233' } as React.CSSProperties}>
        <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: '#bf5af2', fontSize: '1.2rem' }}>
          Loading…
        </div>
      </div>
    );
  }

  const [newHabit, setNewHabit] = useState('');

  const addHabit = () => {
    const n = newHabit.trim();
    if (!n || habits.includes(n)) return;
    const updated = [...habits, n];
    setHabits(updated);
    setHt(prev => {
      const next = { ...prev };
      ALL_DAYS.forEach(d => { next[d] = { ...next[d], [n]: false }; });
      return next;
    });
    setNewHabit('');
    api.updateHabits(updated).catch(() => {});
  };

  const removeHabit = (n: string) => {
    const updated = habits.filter(h => h !== n);
    setHabits(updated);
    api.updateHabits(updated).catch(() => {});
  };

  return (
    <div className="app" style={{ '--theme': '#bf5af2', '--theme-dim': '#bf5af266', '--theme-glow': '#bf5af233' } as React.CSSProperties}>
      <header className="header">
        <div className="header-left">
          <button className="hamburger" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <span /><span /><span />
          </button>
        </div>
        <h1 className="title">Superdub</h1>
      </header>

      {menuOpen && (
        <div className="menu-overlay" onClick={() => setMenuOpen(false)}>
          <nav className="menu" onClick={e => e.stopPropagation()}>
            <div className="menu-header">
              <span className="menu-title">menu</span>
              <button className="menu-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">✕</button>
            </div>
            <Link to="/" onClick={() => setMenuOpen(false)}>Habits</Link>
            <Link to="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</Link>
            <Link to="/diet" onClick={() => setMenuOpen(false)}>Diet</Link>
            <Link to="/tasks" onClick={() => setMenuOpen(false)}>Additional Tasks</Link>
            <Link to="/profile" onClick={() => setMenuOpen(false)}>Profile</Link>
            <button type="button" onClick={() => { clearToken(); window.location.href = '/'; }}>Log out</button>
          </nav>
        </div>
      )}

      <div className="habits-page-scroll">
        <WeatherBar weather={weather} />
        <FeaturedCarousel userHabits={habits} onAdd={handleAddFeatured} />

        <div className="habits-section">
          <div className="habits-section-head">
            <h2 className="habits-section-title">Your Habits</h2>
            <span className="habits-count">{habits.length} active</span>
          </div>

          <div className="habit-add-row" style={{ marginBottom: 20 }}>
            <input
              type="text"
              className="habit-add-input"
              value={newHabit}
              onChange={e => setNewHabit(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addHabit()}
              placeholder="Add a new habit…"
            />
            <button className="habit-add-btn" onClick={addHabit}>+</button>
          </div>

          {habits.length === 0 ? (
            <div className="habits-empty">
              <p>No habits yet. Add one above or join a featured habit.</p>
            </div>
          ) : (
            <div className="habits-grid">
              {habits.map(habit => {
                const stats = computeHabitStats(habit, ht, today);
                return (
                  <HabitCard
                    key={habit}
                    habit={habit}
                    stats={stats}
                    weekDays={weekDays}
                    ht={ht}
                    today={today}
                    onToggle={handleToggle}
                    onRemove={removeHabit}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Habits;
