import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './App.css';
import { api } from './api';

const PWA_PROMPT_VERSION = '1.0';
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;

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

const XP_GATES: [number, number][] = [
  [0, 10], [7, 15], [14, 20], [30, 25], [60, 30], [100, 35], [200, 40], [365, 50],
];
const GATE_LABELS = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'MAX'];

const LEVEL_GATES: [number, string][] = [
  [0,      'Rookie'],
  [100,    'Beginner'],
  [300,    'Novice'],
  [700,    'Apprentice'],
  [1500,   'Adept'],
  [3000,   'Journeyman'],
  [5000,   'Expert'],
  [8000,   'Elite'],
  [12000,  'Champion'],
  [18000,  'Legend'],
  [28000,  'Grandmaster'],
  [42000,  'Mythic'],
  [60000,  'Immortal'],
  [85000,  'Eternal'],
  [120000, 'Transcendent'],
];

function getPlayerLevel(totalXP: number): { level: number; title: string; progress: number; xpForNext: number | null } {
  let idx = 0;
  for (let i = LEVEL_GATES.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_GATES[i][0]) { idx = i; break; }
  }
  const xpForLevel = LEVEL_GATES[idx][0];
  const xpForNext = idx < LEVEL_GATES.length - 1 ? LEVEL_GATES[idx + 1][0] : null;
  const progress = xpForNext ? (totalXP - xpForLevel) / (xpForNext - xpForLevel) : 1;
  return { level: idx + 1, title: LEVEL_GATES[idx][1], progress, xpForNext };
}

function todayKey(): string {
  const n = new Date();
  return `${String(n.getDate()).padStart(2, '0')}/${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function startDateToKey(startDate: string | null | undefined): string | null {
  if (!startDate) return null;
  const parts = startDate.split('-');
  if (parts.length !== 3) return null;
  return `${parts[2]}/${parts[1]}`;
}

function getWeekDays(): { key: string; label: string; isFuture: boolean; isToday: boolean }[] {
  const now = new Date();
  const dow = now.getDay();
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
  if (totalDays === 0)  return { title: '6ft Under', color: '#555' };
  if (totalDays >= 365) return { title: 'Master', color: '#ffd700' };
  if (totalDays >= 100) return { title: 'In the Hundreds', color: '#0a84ff' };
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
  gateProgress: number;
  misses: number;
}

type HabitState = 'done' | 'failed' | null;
type HabitTracker = Record<string, Record<string, HabitState>>;

function computeHabitStats(
  habit: string,
  ht: HabitTracker,
  today: string,
  startDate?: string | null
): HabitStats {
  const todayIdx = ALL_DAYS.indexOf(today);
  if (todayIdx < 0) {
    return { streak: 0, totalDays: 0, totalXP: 0, currentGateIndex: 0, xpPerDay: 10, nextGateAt: 7, gateProgress: 0, misses: 0 };
  }

  let startIdx = 0;
  if (startDate) {
    const key = startDateToKey(startDate);
    if (key) {
      const si = ALL_DAYS.indexOf(key);
      if (si >= 0) startIdx = si;
    }
  } else {
    const firstDone = ALL_DAYS.findIndex(d => ht[d]?.[habit] === 'done');
    startIdx = firstDone >= 0 ? firstDone : todayIdx;
  }

  let totalXP = 0;
  let totalDays = 0;
  let rollingStreak = 0;

  for (let i = startIdx; i <= todayIdx; i++) {
    const day = ALL_DAYS[i];
    const state = ht[day]?.[habit];
    if (state === 'done') {
      rollingStreak++;
      totalDays++;
      const snap = rollingStreak;
      const gateIdx = XP_GATES.filter(([t]) => t > 0 && snap >= t).length;
      totalXP += XP_GATES[Math.min(gateIdx, XP_GATES.length - 1)][1];
    } else if (i < todayIdx) {
      rollingStreak = 0;
    }
  }

  // Consecutive misses (done=null or failed) before today
  let misses = 0;
  if (totalDays > 0) {
    for (let i = todayIdx - 1; i > startIdx && i >= todayIdx - 4; i--) {
      if (ht[ALL_DAYS[i]]?.[habit] !== 'done') misses++;
      else break;
    }
  }

  // Streak with 1-grace for blank days; 'failed' gets no grace
  let streak = 0;
  if (misses < 2) {
    const todayState = ht[today]?.[habit];
    let graceUsed = false;
    let idx = todayState === 'done' ? todayIdx : todayIdx - 1;
    while (idx >= startIdx) {
      const state = ht[ALL_DAYS[idx]]?.[habit];
      if (state === 'done') {
        streak++;
        idx--;
      } else if (state !== 'failed' && !graceUsed) {
        graceUsed = true;
        idx--;
      } else {
        break;
      }
    }
  }

  const gateIdx = XP_GATES.filter(([t]) => t > 0 && streak >= t).length;
  const currentGateIndex = gateIdx;
  const xpPerDay = XP_GATES[Math.min(gateIdx, XP_GATES.length - 1)][1];
  const currentGateThreshold = XP_GATES[Math.min(gateIdx, XP_GATES.length - 1)][0];
  const nextGateIdx = Math.min(gateIdx + 1, XP_GATES.length - 1);
  const nextGateAt = XP_GATES[nextGateIdx][0];
  const range = nextGateAt - currentGateThreshold;
  const gateProgress = range > 0 ? Math.min((streak - currentGateThreshold) / range, 1) : 1;

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
    accent: '#0a84ff',
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
  {
    id: 'yoga',
    name: 'Yoga',
    tagline: "You happy now Florian, you Putana?",
    icon: '🧘',
    accent: '#ff6ec7',
    bgClass: 'featured-bg-yoga',
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

  const goTo = (i: number) => { setActive(i); startTimer(); };

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

function cycleState(current: HabitState): HabitState {
  if (current === null || current === undefined) return 'done';
  if (current === 'done') return 'failed';
  return null;
}

const HabitCard: React.FC<{
  habit: string;
  startDate: string | null;
  stats: HabitStats;
  weekDays: ReturnType<typeof getWeekDays>;
  ht: HabitTracker;
  today: string;
  onToggleDay: (habit: string, dayKey: string, state: HabitState) => void;
  onRequestRemove: (habit: string) => void;
  isMandatory?: boolean;
}> = ({ habit, startDate, stats, weekDays, ht, today, onToggleDay, onRequestRemove, isMandatory }) => {
  const rank = getRank(stats.totalDays);
  const todayState = ht[today]?.[habit] ?? null;
  const isFlame = stats.streak >= 7;
  const hasDanger = stats.misses >= 2;
  const hasWarning = stats.misses === 1 && todayState !== 'done';

  const startKey = startDateToKey(startDate);
  const startDayIdx = startKey ? ALL_DAYS.indexOf(startKey) : -1;

  const gateDots = XP_GATES.map(([t], i) => ({
    label: GATE_LABELS[i],
    reached: stats.streak >= t || (t === 0),
  }));

  return (
    <div className={`hcard ${hasDanger ? 'hcard-danger' : hasWarning ? 'hcard-warning' : ''}`}>
      <div className="hcard-header">
        <span className="hcard-icon">{isFlame ? '🔥' : '✓'}</span>
        <span className="hcard-name">{habit}</span>
        <span className="hcard-streak">{stats.streak}d</span>
        {isMandatory
          ? <span className="hcard-mandatory-badge">Pinned</span>
          : <button className="hcard-remove" onClick={() => onRequestRemove(habit)} aria-label="Remove habit">✕</button>
        }
      </div>

      <div className="hcard-exp-area">
        <div className="hcard-exp-bar-wrap">
          <div className="hcard-exp-bar">
            <div className="hcard-exp-fill" style={{ width: `${stats.gateProgress * 100}%` }} />
          </div>
          <div className="hcard-gate-dots">
            {gateDots.map((g, i) => (
              <div key={i} className={`hcard-gate-dot ${g.reached ? 'reached' : ''}`} title={`${g.label}: ${XP_GATES[i][0]}d streak`} />
            ))}
          </div>
        </div>
        <div className="hcard-xp-info">
          <span className="hcard-xp-total">{stats.totalXP} XP</span>
          <span className="hcard-xp-rate">+{stats.xpPerDay} XP/day</span>
        </div>
      </div>

      {stats.currentGateIndex < XP_GATES.length - 1 && (
        <p className="hcard-gate-label">
          {GATE_LABELS[stats.currentGateIndex]} → next gate at {stats.nextGateAt}d streak
        </p>
      )}

      <div className="hcard-rank" style={{ color: rank.color }}>{rank.title}</div>

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

      <div className="hcard-week">
        {weekDays.map(({ key, label, isFuture, isToday }) => {
          const state = ht[key]?.[habit] ?? null;
          const dayIdx = ALL_DAYS.indexOf(key);
          const isBeforeStart = startDayIdx >= 0 && dayIdx < startDayIdx;
          const disabled = isFuture || isBeforeStart;
          return (
            <div key={key} className={`hcard-day ${state === 'done' && !isBeforeStart ? 'done' : ''} ${state === 'failed' && !isBeforeStart ? 'failed' : ''} ${isFuture ? 'future' : ''} ${isToday ? 'is-today' : ''} ${isBeforeStart ? 'before-start' : ''}`}>
              <button
                className="hcard-day-circle"
                disabled={disabled}
                onClick={() => !disabled && onToggleDay(habit, key, cycleState(state))}
                aria-label={`${label}: ${state ?? 'blank'}`}
              >
                {state === 'done' && !disabled && <span className="hcard-day-tick">{isFlame ? '🔥' : '✓'}</span>}
                {state === 'failed' && !disabled && <span className="hcard-day-tick hcard-day-fail">✗</span>}
              </button>
              <span className="hcard-day-label">{label}</span>
            </div>
          );
        })}
      </div>

      <button
        className={`hcard-today-btn ${todayState === 'done' ? 'done' : ''} ${todayState === 'failed' ? 'failed' : ''}`}
        onClick={() => onToggleDay(habit, today, cycleState(todayState))}
      >
        {todayState === 'done' ? '✓ Done today' : todayState === 'failed' ? '✗ Failed today — tap to clear' : '+ Mark done today'}
      </button>
    </div>
  );
};

/* ── main page ───────────────────────────────────────────── */

const FEATURED_NAMES = new Set(FEATURED.map(f => f.name));
const MANDATORY_HABIT = 'Logging into Superdub';

const Habits: React.FC = () => {
  const navigate = useNavigate();
  const [habits, setHabits] = useState<string[]>([]);
  const [startDates, setStartDates] = useState<Record<string, string | null>>({});
  const [ht, setHt] = useState<HabitTracker>({});
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [newHabit, setNewHabit] = useState('');
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [graveyard, setGraveyard] = useState<{ name: string; startDate: string | null }[]>([]);
  const [graveyardOpen, setGraveyardOpen] = useState(false);
  const [restoringHabit, setRestoringHabit] = useState<string | null>(null);
  const [showCogMenu, setShowCogMenu] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  const graveyardRef = useRef<HTMLDivElement>(null);

  const pwaKey = `superdub.pwa.${PWA_PROMPT_VERSION}`;
  const pwaDayKey = `superdub.pwa.day.${PWA_PROMPT_VERSION}`;
  const todayStr = new Date().toDateString();
  const [showInstall, setShowInstall] = useState(() => {
    if (isInStandaloneMode) return false;
    if (localStorage.getItem(pwaKey) === 'dismissed') return false;
    if (localStorage.getItem(pwaDayKey) === todayStr) return false;
    return true;
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler as any);
    return () => window.removeEventListener('beforeinstallprompt', handler as any);
  }, []);

  const dismissInstall = () => { localStorage.setItem(pwaDayKey, todayStr); setShowInstall(false); };
  const neverShowInstall = () => { localStorage.setItem(pwaKey, 'dismissed'); setShowInstall(false); };
  const triggerInstall = async () => {
    if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; setDeferredPrompt(null); }
    neverShowInstall();
  };

  const today = todayKey();
  const weekDays = getWeekDays();
  const totalXPAll = habits.reduce((sum, h) => sum + computeHabitStats(h, ht, today, startDates[h]).totalXP, 0);
  const playerLevel = getPlayerLevel(totalXPAll);

  useEffect(() => {
    Promise.all([api.getHabits(), api.getTracker(), api.getGraveyard()]).then(([loadedHabits, trackerData, graveyardData]) => {
      let names = loadedHabits.map(h => h.name);
      const dates: Record<string, string | null> = {};
      loadedHabits.forEach(h => { dates[h.name] = h.startDate; });

      // Mandatory habit is always present in state.
      // Only write to DB if getHabits returned a real response — guards against
      // a cold-start empty response wiping existing habits via updateHabits.
      if (!names.includes(MANDATORY_HABIT)) {
        names = [MANDATORY_HABIT, ...names];
        dates[MANDATORY_HABIT] = new Date().toISOString().slice(0, 10);
        if (loadedHabits.length > 0) {
          api.updateHabits(names).catch(() => {});
        }
      }

      setHabits(names);
      setStartDates(dates);
      setGraveyard(graveyardData);

      const tod = todayKey();
      const map: HabitTracker = {};
      ALL_DAYS.forEach(d => { map[d] = {}; });
      names.forEach(name => ALL_DAYS.forEach(d => { map[d][name] = null; }));
      (trackerData.habits as any[]).forEach(row => {
        if (map[row.day]) map[row.day][row.habit_name] = row.state as HabitState;
      });
      // Auto-mark mandatory habit done for today
      map[tod] = { ...map[tod], [MANDATORY_HABIT]: 'done' };
      api.toggleTrackerHabit(tod, MANDATORY_HABIT, 'done').catch(() => {});

      setHt(map);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

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
          setWeather({ temp: Math.round(wx.current.temperature_2m), code: wx.current.weather_code, city });
        } catch {}
      },
      () => {}
    );
  }, []);

  const handleToggleDay = useCallback((habit: string, dayKey: string, state: HabitState) => {
    setHt(prev => ({ ...prev, [dayKey]: { ...prev[dayKey], [habit]: state } }));
    api.toggleTrackerHabit(dayKey, habit, state).catch(() => {});
  }, []);

  const handleAddFeatured = useCallback((name: string) => {
    if (habits.includes(name)) return;
    const today = new Date().toISOString().slice(0, 10);
    const updated = [...habits, name];
    setHabits(updated);
    setStartDates(prev => ({ ...prev, [name]: today }));
    setHt(prev => {
      const next = { ...prev };
      ALL_DAYS.forEach(d => { next[d] = { ...next[d], [name]: null }; });
      return next;
    });
    api.updateHabits(updated).catch(() => {});
  }, [habits]);

  const addHabit = () => {
    const n = newHabit.trim();
    if (!n || habits.includes(n)) return;
    const startDate = new Date().toISOString().slice(0, 10);
    const updated = [...habits, n];
    setHabits(updated);
    setStartDates(prev => ({ ...prev, [n]: startDate }));
    setHt(prev => {
      const next = { ...prev };
      ALL_DAYS.forEach(d => { next[d] = { ...next[d], [n]: null }; });
      return next;
    });
    setNewHabit('');
    api.updateHabits(updated).catch(() => {});
  };

  const confirmRemove = (name: string) => {
    if (name === MANDATORY_HABIT) { setPendingRemove(null); return; }
    setPendingRemove(null);
    const updated = habits.filter(h => h !== name);
    setHabits(updated);
    setStartDates(prev => { const next = { ...prev }; delete next[name]; return next; });
    // Archive in DB (soft delete → graveyard)
    api.archiveHabit(name).then(() => {
      api.getGraveyard().then(g => setGraveyard(g)).catch(() => {});
    }).catch(() => {});
  };

  const restoreHabit = async (name: string) => {
    setRestoringHabit(name);
    try {
      await api.restoreHabit(name);
      // Add back to active habits with today's startDate
      const today = new Date().toISOString().slice(0, 10);
      setHabits(prev => [...prev, name]);
      setStartDates(prev => ({ ...prev, [name]: today }));
      setHt(prev => {
        const next = { ...prev };
        ALL_DAYS.forEach(d => { next[d] = { ...next[d], [name]: null }; });
        return next;
      });
      setGraveyard(prev => prev.filter(h => h.name !== name));
    } catch {}
    setTimeout(() => setRestoringHabit(null), 800);
  };

  if (!loaded) {
    return (
      <div className="app" style={{ '--theme': '#0a84ff', '--theme-dim': '#0a84ff66', '--theme-glow': '#0a84ff22' } as React.CSSProperties}>
        <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: '#0a84ff', fontSize: '1.2rem' }}>
          Loading…
        </div>
      </div>
    );
  }

  const featuredHabits = habits.filter(h => FEATURED_NAMES.has(h) && h !== MANDATORY_HABIT);
  const otherHabits = habits.filter(h => !FEATURED_NAMES.has(h) && h !== MANDATORY_HABIT);

  return (
    <div className="app" style={{ '--theme': '#0a84ff', '--theme-dim': '#0a84ff66', '--theme-glow': '#0a84ff22' } as React.CSSProperties}>
      <header className="header">
        <div className="title-group">
          <h1 className="title" style={{ position: 'relative', transform: 'none', left: 'auto' }}>Superdub</h1>
          <button
            className="player-level"
            onClick={() => navigate('/level')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
          >
            <span className="player-level-badge">Lv.{playerLevel.level}</span>
            <span className="player-level-name">{playerLevel.title}</span>
            <div className="player-level-bar">
              <div className="player-level-fill" style={{ width: `${playerLevel.progress * 100}%` }} />
            </div>
          </button>
        </div>
        <div className="habits-header-actions">
          <div style={{ position: 'relative' }}>
            <button
              className="habits-cog-btn"
              onClick={() => setShowCogMenu(o => !o)}
              aria-label="Habits settings"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            {showCogMenu && (
              <>
                <div className="cog-menu-overlay" onClick={() => setShowCogMenu(false)} />
                <div className="cog-menu">
                  <button className="cog-menu-item" onClick={() => { setShowCogMenu(false); setTimeout(() => addRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }}>
                    <span>＋</span> Add Habit
                  </button>
                  <button className="cog-menu-item" onClick={() => { setShowCogMenu(false); setGraveyardOpen(true); setTimeout(() => graveyardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }}>
                    <span>📦</span> Archived Habits
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Remove confirmation dialog */}
      {pendingRemove && (
        <div className="confirm-overlay" onClick={() => setPendingRemove(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <p className="confirm-title">Archive "{pendingRemove}"?</p>
            <p className="confirm-desc">It'll move to the Graveyard. You can bring it back any time.</p>
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setPendingRemove(null)}>Cancel</button>
              <button className="confirm-ok" onClick={() => confirmRemove(pendingRemove)}>Archive it</button>
            </div>
          </div>
        </div>
      )}

      <div className="habits-page-scroll">
        <WeatherBar weather={weather} />

        {showInstall && (
          <div className="pwa-banner">
            <span className="pwa-banner-icon">📲</span>
            <div className="pwa-banner-text">
              <strong>Add to Home Screen</strong>
              {isIOS
                ? <span>Tap <strong>Share</strong> then <strong>Add to Home Screen</strong></span>
                : <span>Get the full app experience</span>}
            </div>
            {!isIOS && <button className="pwa-banner-btn" onClick={triggerInstall}>Install</button>}
            <button className="pwa-banner-dismiss" onClick={dismissInstall} title="Hide for today">✕</button>
            <button className="pwa-banner-never" onClick={neverShowInstall}>Don't show again</button>
          </div>
        )}

        {/* Pinned / Mandatory habits */}
        <div className="habits-pinned-section">
          <div className="habits-pinned-head">
            <span className="habits-pinned-title">Pinned</span>
          </div>
          <div className="habits-grid">
            {(() => {
              const stats = computeHabitStats(MANDATORY_HABIT, ht, today, startDates[MANDATORY_HABIT]);
              return (
                <HabitCard
                  key={MANDATORY_HABIT}
                  habit={MANDATORY_HABIT}
                  startDate={startDates[MANDATORY_HABIT] ?? null}
                  stats={stats}
                  weekDays={weekDays}
                  ht={ht}
                  today={today}
                  onToggleDay={handleToggleDay}
                  onRequestRemove={() => {}}
                  isMandatory={true}
                />
              );
            })()}
          </div>
        </div>

        {/* Featured Habits — ones the user has added from the carousel */}
        {featuredHabits.length > 0 && (
          <div className="habits-section">
            <div className="habits-section-head">
              <h2 className="habits-section-title">Featured Habits</h2>
              <span className="habits-count">{featuredHabits.length}</span>
            </div>
            <div className="habits-grid">
              {featuredHabits.map(habit => {
                const stats = computeHabitStats(habit, ht, today, startDates[habit]);
                return (
                  <HabitCard
                    key={habit}
                    habit={habit}
                    startDate={startDates[habit] ?? null}
                    stats={stats}
                    weekDays={weekDays}
                    ht={ht}
                    today={today}
                    onToggleDay={handleToggleDay}
                    onRequestRemove={setPendingRemove}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Your own habits */}
        {otherHabits.length > 0 && (
          <div className="habits-section">
            <div className="habits-section-head">
              <h2 className="habits-section-title">Your Habits</h2>
              <span className="habits-count">{otherHabits.length}</span>
            </div>
            <div className="habits-grid">
              {otherHabits.map(habit => {
                const stats = computeHabitStats(habit, ht, today, startDates[habit]);
                return (
                  <HabitCard
                    key={habit}
                    habit={habit}
                    startDate={startDates[habit] ?? null}
                    stats={stats}
                    weekDays={weekDays}
                    ht={ht}
                    today={today}
                    onToggleDay={handleToggleDay}
                    onRequestRemove={setPendingRemove}
                  />
                );
              })}
            </div>
          </div>
        )}

        {habits.filter(h => h !== MANDATORY_HABIT).length === 0 && (
          <div className="habits-empty">
            <p>No habits yet. Add one below or join a featured habit above.</p>
          </div>
        )}

        {/* Archived Habits */}
        {graveyard.length > 0 && (
          <div className="graveyard-section" ref={graveyardRef}>
            <button className="graveyard-toggle" onClick={() => setGraveyardOpen(g => !g)}>
              <span>📦 Archived Habits</span>
              <span className="graveyard-count">{graveyard.length}</span>
              <span className="graveyard-arrow">{graveyardOpen ? '▲' : '▼'}</span>
            </button>
            {graveyardOpen && (
              <div className="graveyard-list">
                <p className="graveyard-hint">Restore a habit and it'll start fresh from today.</p>
                {graveyard.map(h => (
                  <div
                    key={h.name}
                    className={`graveyard-card ${restoringHabit === h.name ? 'rising' : ''}`}
                  >
                    <span className="graveyard-card-name">📁 {h.name}</span>
                    <button
                      className="graveyard-restore-btn"
                      onClick={() => restoreHabit(h.name)}
                      disabled={restoringHabit !== null}
                    >
                      {restoringHabit === h.name ? '✨ Restoring…' : 'Restore'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add Habits */}
        <div className="habit-add-section" ref={addRef}>
          <h2 className="habits-section-title" style={{ marginBottom: 14 }}>Add Habits</h2>
          <div className="habit-add-row">
            <input
              type="text"
              className="habit-add-input"
              value={newHabit}
              onChange={e => setNewHabit(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addHabit()}
              placeholder="Name your new habit…"
            />
            <button className="habit-add-btn" onClick={addHabit}>+</button>
          </div>
        </div>

        {/* Featured Habits Carousel — browse & join new habits */}
        <FeaturedCarousel userHabits={habits} onAdd={handleAddFeatured} />

        <div style={{ height: 100 }} />
      </div>
    </div>
  );
};

export default Habits;
