import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useXP } from './XPContext';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import './App.css';
import { api } from './api';

// Navigate with a View Transition (shared-element morph) where supported
function navigateWithTransition(navigate: any, to: string | number) {
  const doNav = () => navigate(to);
  const startVT = (document as any).startViewTransition?.bind(document);
  if (startVT) startVT(() => flushSync(doNav));
  else doNav();
}

const PWA_PROMPT_VERSION = '1.0';
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;

const INSTALL_XP_KEY = 'superdub.installXP';

const OVERLAY_REFRESH_KEY = 'superdub.overlay.refresh';
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

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
  if (totalDays >= 365) return { title: 'Master', color: '#FFD233' };
  if (totalDays >= 100) return { title: 'In the Hundreds', color: '#2E8BFF' };
  if (totalDays >= 50)  return { title: 'Habit Tracking Superstar', color: '#FF8A00' };
  if (totalDays >= 30)  return { title: 'Rising Star', color: '#2FD27E' };
  if (totalDays >= 10)  return { title: 'Gathering Momentum', color: '#FFB928' };
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
    name: '10K Steps',
    tagline: 'Build the daily movement habit, one step at a time.',
    icon: '🚶‍♂️',
    accent: '#22C55E',
    bgClass: 'featured-bg-walk',
  },
  {
    id: 'quit-smoking',
    name: 'Quit Smoking',
    tagline: 'Every cigarette-free day is a victory. Start yours now.',
    icon: '🚭',
    accent: '#FF8A00',
    bgClass: 'featured-bg-smoke',
  },
  {
    id: 'yoga',
    name: 'Yoga',
    tagline: 'Stretch, breathe, and reset. A few minutes goes a long way.',
    icon: '🧘',
    accent: '#ff6ec7',
    bgClass: 'featured-bg-yoga',
  },
  {
    id: 'reading',
    name: 'Reading',
    tagline: 'Sharpen your mind with just 20 pages a day.',
    icon: '📖',
    accent: '#2E8BFF',
    bgClass: 'featured-bg-read',
  },
];

/* ── types ───────────────────────────────────────────────── */

interface WeatherState { temp: number; code: number; city: string; }

/* ── sub-components ──────────────────────────────────────── */

function cycleState(current: HabitState): HabitState {
  if (current === null || current === undefined) return 'done';
  if (current === 'done') return 'failed';
  return null;
}

// Big circular level ring (gold gradient progress)
const LevelRing: React.FC<{ level: number; title: string; progress: number; onClick?: () => void }> = ({ level, title, progress, onClick }) => {
  const size = 168, stroke = 13, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, progress));
  const offset = circ * (1 - pct);
  return (
    <button className="lvl-ring" style={{ width: size, height: size }} onClick={onClick} aria-label={`Level ${level} — ${title}`}>
      <svg width={size} height={size} className="lvl-ring-svg">
        <defs>
          <linearGradient id="lvlGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFE15A" />
            <stop offset="100%" stopColor="#FFC42E" />
          </linearGradient>
        </defs>
        {/* track — solid grey, unfilled */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#33333D" strokeWidth={stroke} />
        {/* progress arc — sharp, straight ends, glow only on the line */}
        <circle
          className="lvl-ring-arc"
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="url(#lvlGrad)" strokeWidth={stroke} strokeLinecap="butt"
          strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {/* inner black disc — meets the inner edge of the grey track */}
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

// Full habit card — XP bar · gate dots · weekly M-T-W circles · big done button
const HabitCard: React.FC<{
  habit: string;
  stats: HabitStats;
  weekDays: ReturnType<typeof getWeekDays>;
  ht: HabitTracker;
  today: string;
  onToggleDay: (habit: string, dayKey: string, state: HabitState) => void;
  onRequestRemove: (habit: string) => void;
}> = ({ habit, stats, weekDays, ht, today, onToggleDay, onRequestRemove }) => {
  const rank = getRank(stats.totalDays);
  const todayState = ht[today]?.[habit] ?? null;
  const isFlame = stats.streak >= 7;
  const hasDanger = stats.misses >= 2;
  const hasWarning = stats.misses === 1 && todayState !== 'done';

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
        <button className="hcard-remove" onClick={() => onRequestRemove(habit)} aria-label="Remove habit">✕</button>
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
          return (
            <div key={key} className={`hcard-day ${state === 'done' ? 'done' : ''} ${state === 'failed' ? 'failed' : ''} ${isFuture ? 'future' : ''} ${isToday ? 'is-today' : ''}`}>
              <button
                className="hcard-day-circle"
                disabled={isFuture}
                onClick={() => !isFuture && onToggleDay(habit, key, cycleState(state))}
                aria-label={`${label}: ${state ?? 'blank'}`}
              >
                {state === 'done' && <span className="hcard-day-tick">{isFlame ? '🔥' : '✓'}</span>}
                {state === 'failed' && <span className="hcard-day-tick hcard-day-fail">✗</span>}
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

// Featured habits bottom-sheet (tap the banner to open, then join)
const FeaturedSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  userHabits: string[];
  onAdd: (name: string) => void;
}> = ({ open, onClose, userHabits, onAdd }) => {
  if (!open) return null;
  return (
    <div className="hb-sheet-overlay" onClick={onClose}>
      <div className="hb-sheet" onClick={e => e.stopPropagation()}>
        <div className="hb-sheet-grip" />
        <div className="hb-sheet-head">
          <h3 className="hb-sheet-title">Featured Habits</h3>
          <button className="hb-sheet-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="hb-sheet-sub">Tap to add one to your list.</p>
        <div className="hb-feat-list">
          {FEATURED.map(f => {
            const added = userHabits.includes(f.name);
            return (
              <div key={f.id} className="hb-feat-item" style={{ '--featured-accent': f.accent } as React.CSSProperties}>
                <span className="hb-feat-icon">{f.icon}</span>
                <div className="hb-feat-text">
                  <div className="hb-feat-name">{f.name}</div>
                  <div className="hb-feat-tag">{f.tagline}</div>
                </div>
                <button
                  className={`hb-feat-add ${added ? 'added' : ''}`}
                  onClick={() => !added && onAdd(f.name)}
                  disabled={added}
                >
                  {added ? '✓' : '+ Join'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ── main page ───────────────────────────────────────────── */

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
  const [addOpen, setAddOpen] = useState(false);
  const [featuredOpen, setFeaturedOpen] = useState(false);
  const [showDayOverlay, setShowDayOverlay] = useState(false);
  const graveyardRef = useRef<HTMLDivElement>(null);

  // Week gold — purely derived: gold ONLY on Sunday when all 7 days are logged.
  // Resets to original colour automatically on Monday (no persisted state, no veteran ring).
  const [weekCelebrating, setWeekCelebrating] = useState(false);
  const prevPerfectRef = useRef(false);

  const pwaKey = `superdub.pwa.${PWA_PROMPT_VERSION}`;
  const pwaDayKey = `superdub.pwa.day.${PWA_PROMPT_VERSION}`;
  const todayStr = new Date().toDateString();
  const [showInstall, setShowInstall] = useState(() => {
    if (isInStandaloneMode) return false;
    if ((window as any).Capacitor?.isNativePlatform?.()) return false; // already the native app
    if (localStorage.getItem(pwaKey) === 'dismissed') return false;
    if (localStorage.getItem(pwaDayKey) === todayStr) return false;
    return true;
  });
  const [installClosing, setInstallClosing] = useState(false);
  // +100 XP reward for installing to the home screen (granted once the app runs installed)
  const [, setInstallBonus] = useState(() => localStorage.getItem(INSTALL_XP_KEY) === 'granted');

  // Grant the install reward when the app is actually running as an installed PWA
  useEffect(() => {
    const installed = isInStandaloneMode || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);
    if (installed && localStorage.getItem(INSTALL_XP_KEY) !== 'granted') {
      localStorage.setItem(INSTALL_XP_KEY, 'granted');
      setInstallBonus(true);
    }
  }, []);

  const animateOutInstall = (persist: () => void) => {
    setInstallClosing(true);
    setTimeout(() => { persist(); setShowInstall(false); setInstallClosing(false); }, 320);
  };
  const dismissInstall = () => animateOutInstall(() => localStorage.setItem(pwaDayKey, todayStr));
  const neverShowInstall = () => animateOutInstall(() => localStorage.setItem(pwaKey, 'dismissed'));

  const openDayOverlay = () => {
    localStorage.setItem(OVERLAY_REFRESH_KEY, String(Date.now()));
    setShowDayOverlay(true);
  };
  const shouldAutoRefresh = () => {
    const last = parseInt(localStorage.getItem(OVERLAY_REFRESH_KEY) || '0', 10);
    return Date.now() - last >= SIX_HOURS_MS;
  };

  const today = todayKey();
  const weekDays = getWeekDays();
  const { totalXP: totalXPAll, playerLevel } = useXP();

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

  // Show habit overlay when habits are first loaded + 6-hour threshold has passed
  useEffect(() => {
    if (loaded && shouldAutoRefresh()) openDayOverlay();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // Always show/refresh overlay immediately after a weigh-in
  useEffect(() => {
    const handler = () => openDayOverlay();
    window.addEventListener('superdub:tracker-updated', handler);
    return () => window.removeEventListener('superdub:tracker-updated', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fallback: check every 5 minutes if 6 hours have passed
  useEffect(() => {
    const id = setInterval(() => {
      if (shouldAutoRefresh()) openDayOverlay();
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setAddOpen(false);
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

  // Perfect week — gold ONLY lands on Sunday once all 7 days are logged.
  // (Mid-week "all non-future days done" would otherwise trip gold on Monday.)
  const nonFutureDays = weekDays.filter(d => !d.isFuture);
  const isSunday = new Date().getDay() === 0;
  const isPerfectWeek = isSunday && nonFutureDays.length === 7 &&
    nonFutureDays.every(d => ht[d.key]?.[MANDATORY_HABIT] === 'done');

  // Trigger the flip animation the moment the perfect (Sunday) week is achieved
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isPerfectWeek && !prevPerfectRef.current) {
      setWeekCelebrating(true);
      setTimeout(() => setWeekCelebrating(false), 1800);
    }
    prevPerfectRef.current = isPerfectWeek;
  });

  if (!loaded) {
    return (
      <div className="app" style={{ '--theme': '#22C55E', '--theme-dim': '#22C55E66', '--theme-glow': '#22C55E14' } as React.CSSProperties}>
        <div className="sd-loader-wrap"><div className="sd-loader"><img className="sd-loader-logo" src="/superdub-logo.png" alt="" /></div></div>
      </div>
    );
  }

  const yourHabits = habits.filter(h => h !== MANDATORY_HABIT);

  const mandatoryStats = computeHabitStats(MANDATORY_HABIT, ht, today, startDates[MANDATORY_HABIT]);

  return (
    <div className="app flush" style={{ '--theme': '#22C55E', '--theme-dim': '#22C55E66', '--theme-glow': '#22C55E0D' } as React.CSSProperties}>
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

      {/* Add habit sheet */}
      {addOpen && (
        <div className="hb-sheet-overlay" onClick={() => setAddOpen(false)}>
          <div className="hb-sheet" onClick={e => e.stopPropagation()}>
            <div className="hb-sheet-grip" />
            <div className="hb-sheet-head">
              <h3 className="hb-sheet-title">New Habit</h3>
              <button className="hb-sheet-close" onClick={() => setAddOpen(false)} aria-label="Close">✕</button>
            </div>
            <p className="hb-sheet-sub">What do you want to build?</p>
            <div className="habit-add-row">
              <input
                type="text"
                className="habit-add-input"
                value={newHabit}
                autoFocus
                onChange={e => setNewHabit(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addHabit()}
                placeholder="Name your new habit…"
              />
              <button className="habit-add-btn" onClick={addHabit}>+</button>
            </div>
          </div>
        </div>
      )}

      {/* Featured habits sheet */}
      <FeaturedSheet open={featuredOpen} onClose={() => setFeaturedOpen(false)} userHabits={habits} onAdd={handleAddFeatured} />

      <div className="habits-page-scroll">
        {/* Top bar: brand + weather + cog */}
        <div className="hb-topbar">
          <div className="hb-brand">
            <img className="hb-brand-logo" src="/superdub-logo.png" alt="" />
            <span className="hb-brand-name">super<span className="hb-brand-dub">dub</span></span><span className="hb-build-tag">v2.144</span>
          </div>
          <div className="hb-topbar-actions">
            {weather && (
              <span className="hb-weather">{weatherEmoji(weather.code)} {weather.temp}°</span>
            )}
            <div style={{ position: 'relative' }}>
              <button className="hb-cog" onClick={() => setShowCogMenu(o => !o)} aria-label="Settings">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="19" height="19">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
              {showCogMenu && (
                <>
                  <div className="cog-menu-overlay" onClick={() => setShowCogMenu(false)} />
                  <div className="cog-menu">
                    <button className="cog-menu-item" onClick={() => { setShowCogMenu(false); setAddOpen(true); }}>
                      <span>＋</span> Add Habit
                    </button>
                    <button className="cog-menu-item" onClick={() => { setShowCogMenu(false); window.dispatchEvent(new CustomEvent('superdub:show-checkin')); }}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle'}}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Log Weight
                    </button>
                    <button className="cog-menu-item" onClick={() => { setShowCogMenu(false); window.dispatchEvent(new CustomEvent('superdub:show-step-entry')); }}>
                      <span>👟</span> Log Steps
                    </button>
                    <button className="cog-menu-item" onClick={() => { setShowCogMenu(false); setGraveyardOpen(true); setTimeout(() => graveyardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }}>
                      <span>📦</span> Archived Habits
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {showInstall && (
          <div className={`pwa-banner${installClosing ? ' closing' : ''}`}>
            <button className="pwa-banner-dismiss" onClick={dismissInstall} aria-label="Hide for today">✕</button>
            <div className="pwa-banner-main">
              <img className="pwa-banner-icon" src="/superdub-icon-512.png" alt="" />
              <div className="pwa-banner-text">
                {isIOS ? (
                  <>
                    <strong>Add to Home Screen</strong>
                    <span>Tap <strong>Share</strong> → <strong>Add to Home Screen</strong></span>
                  </>
                ) : (
                  <>
                    <strong>Superdub for Android</strong>
                    <span>The Android app is here — download it now.</span>
                  </>
                )}
              </div>
            </div>
            {isIOS ? (
              <>
                <div className="pwa-banner-foot">
                  <span className="pwa-reward"><span className="pwa-reward-plus">+</span>100 XP</span>
                  <button className="pwa-banner-never" onClick={neverShowInstall}>Don't show again</button>
                </div>
              </>
            ) : (
              <>
                <div className="pwa-banner-foot">
                  <a
                    className="pwa-banner-btn"
                    href="/downloads/superdub.apk"
                    download="superdub.apk"
                    onClick={dismissInstall}
                  >
                    Download APK
                  </a>
                </div>
                <p className="pwa-banner-note">
                  Not from the Play Store — Android will ask you to allow “install from unknown sources”. That’s expected, not a problem.
                </p>
                <button className="pwa-banner-never pwa-banner-never--row" onClick={neverShowInstall}>Don't show again</button>
              </>
            )}
          </div>
        )}

        {/* Level ring + XP */}
        <div className="hb-level">
          <LevelRing level={playerLevel.level} title={playerLevel.title} progress={playerLevel.progress} onClick={() => navigateWithTransition(navigate, '/level')} />
          <div className="hb-xp">
            <div className="hb-xp-scale">
              <span>{totalXPAll.toLocaleString()} XP</span>
              <span>{playerLevel.xpForNext != null ? playerLevel.xpForNext.toLocaleString() : 'MAX'}</span>
            </div>
            <div className="hb-xp-bar">
              <div className="hb-xp-fill" style={{ width: `${Math.max(2, playerLevel.progress * 100)}%` }} />
            </div>
            {playerLevel.xpForNext != null ? (
              <p className="hb-xp-to">{(playerLevel.xpForNext - totalXPAll).toLocaleString()} XP to <span>{playerLevel.nextTitle}</span></p>
            ) : (
              <p className="hb-xp-to">Max level — you legend.</p>
            )}
          </div>
        </div>

        {/* Weekly strip — the simplified "Logging into Superdub" habit */}
        <div className={`hb-week${isPerfectWeek ? ' hb-week-gold' : ''}${weekCelebrating ? ' hb-week-celebrating' : ''}`}>
          {weekDays.map(({ key, label, isFuture, isToday }) => {
            const state = ht[key]?.[MANDATORY_HABIT] ?? null;
            // Read-only: this strip mirrors your daily login automatically — not tappable.
            return (
              <div key={key} className="hb-week-col">
                <span className="hb-week-dow">{label}</span>
                <div
                  className={`hb-week-circle ${state === 'done' ? 'done' : ''} ${state === 'failed' ? 'failed' : ''} ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}`}
                  role="img"
                  aria-label={`${label}: ${state ?? 'not logged'}`}
                >
                  {state === 'done' && <span className="hb-week-tick">✓</span>}
                  {state === 'failed' && <span className="hb-week-tick fail">✕</span>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="hb-week-caption">{mandatoryStats.streak}-day check-in streak · keep it alive</p>

        {/* Your habits — full cards with weekly circles + done button */}
        {yourHabits.length > 0 ? (
          <div className="hb-rows">
            {yourHabits.map(habit => {
              const stats = computeHabitStats(habit, ht, today, startDates[habit]);
              return (
                <HabitCard
                  key={habit}
                  habit={habit}
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
        ) : (
          <div className="habits-empty">
            <p>No habits yet. Tap the cog to add one, or join a featured habit.</p>
          </div>
        )}

        {/* Featured banner — tap to open & join (below the user's habits) */}
        <button className="hb-featured" onClick={() => setFeaturedOpen(true)}>
          <div className="hb-featured-text">
            <span className="hb-featured-eyebrow">FEATURED</span>
            <span className="hb-featured-cta">Discover habits to join →</span>
          </div>
          <span className="hb-featured-icon">🚶</span>
        </button>

        {/* Archived Habits — always rendered so ref is valid for scroll */}
        <div className="graveyard-section" ref={graveyardRef}>
          <button className="graveyard-toggle" onClick={() => setGraveyardOpen(g => !g)}>
            <span>📦 Archived Habits</span>
            {graveyard.length > 0 && <span className="graveyard-count">{graveyard.length}</span>}
            <span className="graveyard-arrow">{graveyardOpen ? '▲' : '▾'}</span>
          </button>
          {graveyardOpen && (
            <div className="graveyard-list">
              {graveyard.length === 0 ? (
                <p className="graveyard-hint" style={{ textAlign: 'center', opacity: 0.45 }}>
                  No archived habits yet. Archive a habit to find it here later.
                </p>
              ) : (
                <>
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
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ height: 100 }} />
      </div>

      {/* ── Habit day overlay — triggered by weigh-in or 6-hour refresh ── */}
      {showDayOverlay && loaded && (() => {
        const todayHabits = ht[today] ?? {};
        const displayHabits = yourHabits;
        const doneCount = displayHabits.filter(h => todayHabits[h] === 'done').length;
        const total = displayHabits.length;
        const allDone = total > 0 && doneCount === total;
        const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
        const now = new Date();
        const hour = now.getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        const todayLabel = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
        return (
          <div className="checkin-overlay" onClick={() => setShowDayOverlay(false)}>
            <div className="checkin-inner" onClick={e => e.stopPropagation()}>
              <button className="checkin-close" onClick={() => setShowDayOverlay(false)} aria-label="Close">✕</button>
              <div className="checkin-head">
                <div className="checkin-greet-wrap">
                  <p className="checkin-eyebrow">{todayLabel}</p>
                  <h2 className="checkin-greeting">{greeting} <span className="checkin-wave">👋</span></h2>
                  <p className="checkin-sub">Here's your habit progress for today.</p>
                </div>
                <div
                  className="checkin-ring"
                  style={{ '--pct': pct } as React.CSSProperties}
                  aria-label={`${doneCount} of ${total} habits done today`}
                >
                  <div className="checkin-ring-inner">
                    <span className="checkin-count">{doneCount}<span className="checkin-count-total">/{total}</span></span>
                    <span className="checkin-progress-label">done</span>
                  </div>
                </div>
              </div>

              {total === 0 ? (
                <p className="checkin-empty">No habits yet — add some below.</p>
              ) : (
                <div className="checkin-habits">
                  {displayHabits.map(h => {
                    const state = todayHabits[h] ?? null;
                    const done = state === 'done';
                    return (
                      <button
                        key={h}
                        type="button"
                        className={`checkin-habit ${done ? 'done' : ''}`}
                        onClick={() => handleToggleDay(h, today, cycleState(state))}
                        aria-pressed={done}
                      >
                        <span className="checkin-tick">{done ? '✓' : '+'}</span>
                        <span className="checkin-habit-name">{h}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="checkin-footer">
                {allDone
                  ? <p className="checkin-done-msg">All habits done — nice work! 🎉</p>
                  : total > 0 && <p className="checkin-hint-msg">Tap to check off habits.</p>}
                <button type="button" className="checkin-scroll-hint" onClick={() => setShowDayOverlay(false)}>
                  {allDone ? 'Keep it up 🚀' : 'Close'} <span className="checkin-chevron">▾</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Habits;
