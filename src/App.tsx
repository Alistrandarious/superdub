import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import './App.css';
import { api } from './api';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MONTH_COLORS: Record<number, string> = {
  0: '#00ff41',  // Jan - matrix green
  1: '#ff6ec7',  // Feb - hot pink
  2: '#00e5ff',  // Mar - electric cyan
  3: '#ff9500',  // Apr - amber
  4: '#b4ff00',  // May - lime
  5: '#ff2d55',  // Jun - coral red
  6: '#bf5af2',  // Jul - purple
  7: '#64d2ff',  // Aug - sky blue
  8: '#ffd60a',  // Sep - gold
  9: '#ff453a',  // Oct - red
  10: '#30d158', // Nov - apple green
  11: '#ac8e68', // Dec - copper
};

function getYearDays(year: number): string[] {
  const days: string[] = [];
  for (let m = 0; m < 12; m++) {
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dd = String(d).padStart(2, '0');
      const mm = String(m + 1).padStart(2, '0');
      days.push(`${dd}/${mm}`);
    }
  }
  return days;
}

const YEAR = 2026;
const ALL_DAYS = getYearDays(YEAR);

function getMonthDays(month: number): string[] {
  const mm = String(month + 1).padStart(2, '0');
  return ALL_DAYS.filter(d => d.slice(3) === mm);
}

function getWeekOfMonth(dayStr: string): number {
  const day = parseInt(dayStr.slice(0, 2));
  return Math.ceil(day / 7);
}

const DEFAULT_HABITS = ['Walking', 'Praying', 'Duolingo'];

interface DayData {
  weight: string;
  habits: Record<string, boolean>;
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
  steps: string;
}

function initData(habits: string[]): Record<string, DayData> {
  const data: Record<string, DayData> = {};
  const h: Record<string, boolean> = {};
  habits.forEach(name => { h[name] = false; });
  ALL_DAYS.forEach(day => {
    data[day] = { weight: '', habits: { ...h }, calories: '', protein: '', carbs: '', fats: '', steps: '' };
  });
  return data;
}

const INITIAL_TRACKER = initData(DEFAULT_HABITS);

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface AppProps { onLogout?: () => void; }

const App: React.FC<AppProps> = ({ onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [weightPlanOpen, setWeightPlanOpen] = useState(false);
  const [habitsModalOpen, setHabitsModalOpen] = useState(false);
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [trackerTab, setTrackerTab] = useState<'habits' | 'nutrition'>('habits');

  // One-time daily check-in overlay
  const todayStamp = `${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}`;
  const [checkinOpen, setCheckinOpen] = useState(() => {
    return localStorage.getItem('superdub.checkin') !== todayStamp;
  });
  const dismissCheckin = () => {
    localStorage.setItem('superdub.checkin', todayStamp);
    setCheckinOpen(false);
  };

  const [name, setName] = useState('');
  const [habits, setHabits] = useState<string[]>(DEFAULT_HABITS);
  const [newHabit, setNewHabit] = useState('');
  const [tracker, setTracker] = useState<Record<string, DayData>>(INITIAL_TRACKER);
  const [loaded, setLoaded] = useState(false);

  // Calendar state
  const now = new Date();
  const currentMonth = now.getMonth();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const themeColor = MONTH_COLORS[selectedMonth];

  const monthDays = useMemo(() => getMonthDays(selectedMonth), [selectedMonth]);
  const visibleDays = useMemo(() => {
    if (selectedWeek === null) return monthDays;
    return monthDays.filter(d => getWeekOfMonth(d) === selectedWeek);
  }, [monthDays, selectedWeek]);

  const weeksInMonth = Math.ceil(monthDays.length / 7);
  const currentWeek = selectedMonth === currentMonth ? Math.ceil(now.getDate() / 7) : null;

  const todayKey = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const todayLabel = `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTH_NAMES[now.getMonth()]}`;
  const hour = now.getHours();
  const greeting = hour < 6 ? 'Good night'
    : hour < 12 ? 'Good morning'
    : hour < 18 ? 'Good afternoon'
    : hour < 21 ? 'Good evening'
    : 'Good night';

  // Weight plan state
  const [currentWeight, setCurrentWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [timeDays, setTimeDays] = useState('');
  const [lossPerWeek, setLossPerWeek] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [activityLevel, setActivityLevel] = useState('1.4');

  // Load all data on mount
  useEffect(() => {
    Promise.all([
      api.getProfile(),
      api.getHabits(),
      api.getTracker(),
      api.getWeightSettings(),
    ]).then(([profile, loadedHabits, trackerData, ws]) => {
      setName(profile.name ?? '');

      const activeHabits = loadedHabits.length > 0 ? loadedHabits : DEFAULT_HABITS;
      setHabits(activeHabits);

      // Merge DB data into full-year tracker structure
      const merged = initData(activeHabits);
      (trackerData.days as any[]).forEach(row => {
        if (merged[row.day]) {
          merged[row.day] = {
            ...merged[row.day],
            weight: row.weight ?? '',
            calories: row.calories ?? '',
            protein: row.protein ?? '',
            carbs: row.carbs ?? '',
            fats: row.fats ?? '',
            steps: row.steps ?? '',
          };
        }
      });
      (trackerData.habits as any[]).forEach(row => {
        if (merged[row.day]) {
          merged[row.day].habits[row.habit_name] = row.done;
        }
      });
      setTracker(merged);

      setCurrentWeight(ws.currentWeight ?? '');
      setGoalWeight(ws.goalWeight ?? '');
      setLossPerWeek(ws.lossPerWeek ?? '');
      setTimeDays(ws.timeDays ?? '');
      setHeight(ws.height ?? '');
      setAge(ws.age ?? '');
      setActivityLevel(ws.activityLevel ?? '1.4');

      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  // Keep a ref to latest tracker for debounced saves
  const trackerRef = useRef(tracker);
  useEffect(() => { trackerRef.current = tracker; }, [tracker]);

  const savePending = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const scheduleTrackerSave = useCallback((day: string) => {
    const existing = savePending.current.get(day);
    if (existing) clearTimeout(existing);
    savePending.current.set(day, setTimeout(() => {
      const d = trackerRef.current[day];
      if (d) {
        api.updateTrackerDay(day, {
          weight: d.weight, calories: d.calories,
          protein: d.protein, carbs: d.carbs, fats: d.fats, steps: d.steps,
        }).catch(() => {});
      }
      savePending.current.delete(day);
    }, 600));
  }, []);

  const saveWeightSettings = () => {
    api.updateWeightSettings({ currentWeight, goalWeight, lossPerWeek, timeDays, height, age, activityLevel }).catch(() => {});
  };

  const closeWeightModal = () => {
    setWeightPlanOpen(false);
    saveWeightSettings();
  };

  const closeNutritionModal = () => {
    setNutritionOpen(false);
    saveWeightSettings();
  };

  // Computed values from weight settings
  const computedLossPerWeek = (() => {
    const cw = parseFloat(currentWeight);
    const gw = parseFloat(goalWeight);
    const td = parseFloat(timeDays);
    if (cw && gw && td && td > 0 && cw > gw) return ((cw - gw) / (td / 7)).toFixed(2);
    return '';
  })();

  const computedTimeDays = (() => {
    const cw = parseFloat(currentWeight);
    const gw = parseFloat(goalWeight);
    const lpw = parseFloat(lossPerWeek);
    if (cw && gw && lpw && lpw > 0 && cw > gw) return Math.ceil(((cw - gw) / lpw) * 7).toString();
    return '';
  })();

  const handleNumericInput = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === '' || /^\d*\.?\d*$/.test(v)) setter(v);
  };

  const activeLoss = parseFloat(lossPerWeek) || parseFloat(computedLossPerWeek) || 0;
  const startWeight = parseFloat(currentWeight) || 0;
  const goal = parseFloat(goalWeight) || 0;

  const ht = parseFloat(height) || 0;
  const ag = parseFloat(age) || 0;
  const al = parseFloat(activityLevel) || 1.4;
  const bmr = startWeight > 0 && ht > 0 && ag > 0 ? (10 * startWeight) + (6.25 * ht) - (5 * ag) + 5 : 0;
  const tdee = Math.round(bmr * al);
  const dailyDeficit = activeLoss > 0 ? Math.round((activeLoss * 7700) / 7) : 0;
  const targetCalories = tdee > 0 ? Math.max(tdee - dailyDeficit, 1200) : 0;
  const targetProtein = startWeight > 0 ? Math.round(startWeight * 2.0) : 0;
  const targetFats = startWeight > 0 ? Math.round(startWeight * 0.8) : 0;
  const targetCarbCals = targetCalories - (targetProtein * 4) - (targetFats * 9);
  const targetCarbs = targetCalories > 0 ? Math.max(Math.round(targetCarbCals / 4), 50) : 0;

  const kRate = (startWeight > goal && activeLoss > 0) ? (activeLoss / 7) / (startWeight - goal) : 0;

  let goalDayIndex = ALL_DAYS.length;
  if (startWeight > 0 && goal > 0 && kRate > 0) {
    goalDayIndex = Math.ceil(-Math.log(0.5 / (startWeight - goal)) / kRate);
    if (goalDayIndex >= ALL_DAYS.length) goalDayIndex = ALL_DAYS.length;
  }

  const goalDayStr = goalDayIndex < ALL_DAYS.length ? ALL_DAYS[goalDayIndex] : null;
  const goalDayVisible = goalDayStr && visibleDays.includes(goalDayStr) ? goalDayStr : null;

  const weightPoints: { i: number; w: number }[] = [];
  visibleDays.forEach((day, i) => {
    const w = parseFloat(tracker[day]?.weight ?? '');
    if (w > 0) weightPoints.push({ i, w });
  });

  let trendSlope = 0;
  let trendIntercept = 0;
  const hasTrend = weightPoints.length >= 2;
  if (hasTrend) {
    const n = weightPoints.length;
    const sumX = weightPoints.reduce((s, p) => s + p.i, 0);
    const sumY = weightPoints.reduce((s, p) => s + p.w, 0);
    const sumXY = weightPoints.reduce((s, p) => s + p.i * p.w, 0);
    const sumX2 = weightPoints.reduce((s, p) => s + p.i * p.i, 0);
    trendSlope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    trendIntercept = (sumY - trendSlope * sumX) / n;
  }

  const chartData = visibleDays.map((day, i) => {
    const d = tracker[day] ?? { weight: '', habits: {}, calories: '', protein: '', carbs: '', fats: '', steps: '' };
    const completed = habits.filter(h => d.habits[h]).length;
    const globalIdx = ALL_DAYS.indexOf(day);
    const prediction = (startWeight > 0 && kRate > 0)
      ? +(goal + (startWeight - goal) * Math.exp(-kRate * globalIdx)).toFixed(1)
      : null;
    const lastDataIndex = hasTrend ? weightPoints[weightPoints.length - 1].i : 0;
    const trend = hasTrend && i >= weightPoints[0].i && i <= lastDataIndex + 7
      ? +(trendIntercept + trendSlope * i).toFixed(1)
      : null;
    return { day, completed, weight: d.weight ? Number(d.weight) : null, prediction, trend };
  });

  const handleWeight = (day: string, value: string) => {
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
    setTracker(prev => ({ ...prev, [day]: { ...prev[day], weight: value } }));
    scheduleTrackerSave(day);
  };

  const handleMacro = (day: string, field: 'calories' | 'protein' | 'carbs' | 'fats' | 'steps', value: string) => {
    if (value !== '' && !/^\d*$/.test(value)) return;
    setTracker(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
    scheduleTrackerSave(day);
  };

  const getDayTargets = (dayIndex: number) => {
    const htVal = parseFloat(height) || 0;
    const agVal = parseFloat(age) || 0;
    const alVal = parseFloat(activityLevel) || 1.4;
    if (htVal === 0 || agVal === 0 || startWeight === 0) return null;

    const day = visibleDays[dayIndex];
    const globalIdx = ALL_DAYS.indexOf(day);

    let dayWeight = (kRate > 0) ? goal + (startWeight - goal) * Math.exp(-kRate * globalIdx) : startWeight;
    for (let d = dayIndex - 1; d >= 0; d--) {
      const w = parseFloat(tracker[visibleDays[d]]?.weight ?? '');
      if (w > 0) { dayWeight = w; break; }
    }

    const dayBmr = (10 * dayWeight) + (6.25 * htVal) - (5 * agVal) + 5;
    const dayTdee = Math.round(dayBmr * alVal);
    const daysRemaining = Math.max(goalDayIndex - globalIdx, 7);
    const weightToLose = Math.max(dayWeight - goal, 0);
    const requiredLossPerWeek = (weightToLose / daysRemaining) * 7;
    const safeLossPerWeek = Math.min(requiredLossPerWeek, 1.0);
    const deficit = Math.round((safeLossPerWeek * 7700) / 7);
    const cal = Math.max(dayTdee - deficit, 1200);
    const protein = Math.round(dayWeight * 2.0);
    const fats = Math.round(dayWeight * 0.8);
    const carbCals = cal - (protein * 4) - (fats * 9);
    const carbs = Math.max(Math.round(carbCals / 4), 50);
    return { calories: cal, protein, carbs, fats };
  };

  const handleCheck = (day: string, habit: string) => {
    const newDone = !(tracker[day]?.habits[habit]);
    setTracker(prev => ({
      ...prev,
      [day]: { ...prev[day], habits: { ...prev[day].habits, [habit]: newDone } }
    }));
    api.toggleTrackerHabit(day, habit, newDone).catch(() => {});
  };

  const addHabit = () => {
    const n = newHabit.trim();
    if (!n || habits.includes(n)) return;
    const newHabits = [...habits, n];
    setHabits(newHabits);
    setTracker(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(day => {
        updated[day] = { ...updated[day], habits: { ...updated[day].habits, [n]: false } };
      });
      return updated;
    });
    setNewHabit('');
    api.updateHabits(newHabits).catch(() => {});
  };

  const removeHabit = (n: string) => {
    const newHabits = habits.filter(h => h !== n);
    setHabits(newHabits);
    setTracker(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(day => {
        const { [n]: _, ...rest } = updated[day].habits;
        updated[day] = { ...updated[day], habits: rest };
      });
      return updated;
    });
    api.updateHabits(newHabits).catch(() => {});
  };

  if (!loaded) {
    return (
      <div className="app" style={{ '--theme': '#00e5ff', '--theme-dim': '#00e5ff66', '--theme-glow': '#00e5ff33' } as React.CSSProperties}>
        <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: '#00e5ff', fontSize: '1.2rem', letterSpacing: '0.1em' }}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="app" style={{ '--theme': themeColor, '--theme-dim': themeColor + '66', '--theme-glow': themeColor + '33' } as React.CSSProperties}>
      <header className="header">
        <div className="header-left">
          <button
            className="hamburger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span />
            <span />
            <span />
          </button>
          <div className="calendar-picker">
            <button className="calendar-btn" onClick={() => setCalendarOpen(!calendarOpen)}>
              {MONTH_NAMES[selectedMonth]} {YEAR}
              {selectedWeek !== null && ` · W${selectedWeek}`}
              <span className="calendar-arrow">{calendarOpen ? '▲' : '▼'}</span>
            </button>
            {calendarOpen && (
              <div className="calendar-dropdown">
                <div className="calendar-grid">
                  {MONTH_SHORT.map((m, i) => (
                    <button
                      key={m}
                      className={`calendar-month ${i === selectedMonth ? 'selected' : ''} ${i === currentMonth ? 'current' : ''}`}
                      style={{ '--month-color': MONTH_COLORS[i] } as React.CSSProperties}
                      onClick={() => { setSelectedMonth(i); setSelectedWeek(null); setCalendarOpen(false); }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="menu-overlay" onClick={() => setMenuOpen(false)}>
          <nav className="menu" onClick={e => e.stopPropagation()}>
            <div className="menu-header">
              <span className="menu-title">menu</span>
              <button className="menu-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">✕</button>
            </div>
            <Link to="/" onClick={() => setMenuOpen(false)}>Habit Tracker</Link>
            <Link to="/dashboard" onClick={() => setMenuOpen(false)}>Progress Overview</Link>
            <Link to="/diet" onClick={() => setMenuOpen(false)}>Diet Maker</Link>
            <Link to="/tasks" onClick={() => setMenuOpen(false)}>To Dos</Link>
            <Link to="/about" onClick={() => setMenuOpen(false)}>About</Link>
            <button type="button" onClick={() => { setHabitsModalOpen(true); setMenuOpen(false); }}>Edit Habits</button>
            <div className="menu-spacer" />
            <Link to="/profile" onClick={() => setMenuOpen(false)}>Profile</Link>
            <button type="button" onClick={() => { setWeightPlanOpen(true); setMenuOpen(false); }}>Settings</button>
            {onLogout && <button type="button" onClick={onLogout}>Log out</button>}
          </nav>
        </div>
      )}

      {habitsModalOpen && (
        <div className="modal-overlay" onClick={() => setHabitsModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Customize Habits</span>
              <button className="modal-close" onClick={() => setHabitsModalOpen(false)}>✕</button>
            </div>
            <div className="habits-list">
              {habits.map(h => (
                <div key={h} className="habit-item">
                  <span>{h}</span>
                  <button className="habit-remove" onClick={() => removeHabit(h)}>✕</button>
                </div>
              ))}
            </div>
            <div className="habit-add-row">
              <input
                type="text"
                value={newHabit}
                onChange={e => setNewHabit(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addHabit()}
                placeholder="New habit name"
                className="habit-add-input"
              />
              <button className="habit-add-btn" onClick={addHabit}>+</button>
            </div>
          </div>
        </div>
      )}

      {weightPlanOpen && (
        <div className="modal-overlay" onClick={closeWeightModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Weight Settings</span>
              <button className="modal-close" onClick={closeWeightModal}>✕</button>
            </div>
            <div className="plan-row">
              <label>
                <span>Current Weight (kg)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={currentWeight}
                  onChange={handleNumericInput(setCurrentWeight)}
                  placeholder="e.g. 85"
                />
              </label>
              <label>
                <span>Goal Weight (kg)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={goalWeight}
                  onChange={handleNumericInput(setGoalWeight)}
                  placeholder="e.g. 70"
                />
              </label>
              <label>
                <span>Expected Loss/Week (kg)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={lossPerWeek}
                  onChange={handleNumericInput(setLossPerWeek)}
                  placeholder={computedLossPerWeek || '—'}
                />
              </label>
              <label>
                <span>Time Taken (days)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={timeDays}
                  onChange={handleNumericInput(setTimeDays)}
                  placeholder={computedTimeDays || '—'}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {nutritionOpen && (
        <div className="modal-overlay" onClick={closeNutritionModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Nutrition Calculator</span>
              <button className="modal-close" onClick={closeNutritionModal}>✕</button>
            </div>
            <div className="plan-row">
              <label>
                <span>Height (cm)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={height}
                  onChange={handleNumericInput(setHeight)}
                  placeholder="e.g. 175"
                />
              </label>
              <label>
                <span>Age</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={age}
                  onChange={handleNumericInput(setAge)}
                  placeholder="e.g. 28"
                />
              </label>
              <label>
                <span>Activity Level</span>
                <select value={activityLevel} onChange={e => setActivityLevel(e.target.value)} className="plan-select">
                  <option value="1.2">Sedentary</option>
                  <option value="1.4">Light (walking)</option>
                  <option value="1.55">Moderate</option>
                  <option value="1.7">Active</option>
                  <option value="1.9">Very Active</option>
                </select>
              </label>
            </div>
            {targetCalories > 0 && (
              <div className="macro-targets">
                <span>Daily Target: <strong>{targetCalories} kcal</strong></span>
                <span>P: <strong>{targetProtein}g</strong></span>
                <span>C: <strong>{targetCarbs}g</strong></span>
                <span>F: <strong>{targetFats}g</strong></span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Daily check-in overlay (once per day) ── */}
      {checkinOpen && (() => {
        const todayEntry = tracker[todayKey];
        const doneCount = todayEntry ? habits.filter(h => todayEntry.habits[h]).length : 0;
        const total = habits.length;
        const allDone = total > 0 && doneCount === total;
        const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
        return (
          <div className="checkin-overlay" onClick={dismissCheckin}>
            <div className="checkin-inner" onClick={e => e.stopPropagation()}>
              <button className="checkin-close" onClick={dismissCheckin} aria-label="Close">✕</button>
              <div className="checkin-head">
                <div className="checkin-greet-wrap">
                  <p className="checkin-eyebrow">{todayLabel}</p>
                  <h2 className="checkin-greeting">
                    {greeting}{name.trim() ? `, ${name.trim()}` : ''} <span className="checkin-wave">👋</span>
                  </h2>
                  <p className="checkin-sub">Here's your check-in for today.</p>
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

              {!todayEntry ? (
                <p className="checkin-empty">Today isn't in this year's tracker.</p>
              ) : total === 0 ? (
                <p className="checkin-empty">No habits yet — add some from the menu.</p>
              ) : (
                <div className="checkin-habits">
                  {habits.map(h => {
                    const done = !!todayEntry.habits[h];
                    return (
                      <button
                        key={h}
                        type="button"
                        className={`checkin-habit ${done ? 'done' : ''}`}
                        onClick={() => handleCheck(todayKey, h)}
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
                  : total > 0 && <p className="checkin-hint-msg">Tap to check off, then head to dashboard.</p>}
                <button type="button" className="checkin-scroll-hint" onClick={dismissCheckin}>
                  {allDone ? 'Let\'s go 🚀' : 'Go to dashboard'} <span className="checkin-chevron">▾</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Week selector bar */}
      <div className="week-bar">
        <button
          className={`week-btn ${selectedWeek === null ? 'active' : ''}`}
          onClick={() => setSelectedWeek(null)}
        >All</button>
        {Array.from({ length: weeksInMonth }, (_, i) => i + 1).map(w => (
          <button
            key={w}
            className={`week-btn ${selectedWeek === w ? 'active' : ''} ${w === currentWeek ? 'current' : ''}`}
            onClick={() => setSelectedWeek(w)}
          >W{w}</button>
        ))}
        <div className="week-bar-spacer"></div>
        <button className="legend-info-btn" aria-label="Chart legend">
          i
          <div className="legend-tooltip">
            <div className="legend-item"><span className="legend-swatch legend-bar"></span>Habits Completed</div>
            <div className="legend-item"><span className="legend-swatch legend-weight"></span>Weight (kg)</div>
            <div className="legend-item"><span className="legend-swatch legend-prediction"></span>Goal Curve</div>
            <div className="legend-item"><span className="legend-swatch legend-trend"></span>Trend</div>
          </div>
        </button>
        <button className="header-btn" onClick={() => setWeightPlanOpen(true)} aria-label="Weight settings">⚖</button>
      </div>

      <section className="chart-section">
        <div className="chart-labels-spacer"></div>
        <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ left: 0, right: 0, top: 5, bottom: 20 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={themeColor + '22'} />
                <stop offset="50%" stopColor={themeColor + '88'} />
                <stop offset="100%" stopColor={themeColor} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={themeColor + '1a'} strokeDasharray="3 3" />
            <XAxis dataKey="day" stroke={themeColor} tick={{ fill: themeColor, fontSize: 10 }} interval={6} tickLine={false} padding={{ left: 10 }} />
            <YAxis yAxisId="left" stroke={themeColor} tick={{ fill: themeColor, fontSize: 10 }} allowDecimals={false} width={30} axisLine={false} tickLine={false} domain={[0, habits.length]} />
            <YAxis yAxisId="right" orientation="right" stroke="#ccff00" tick={{ fill: '#ccff00', fontSize: 10 }} domain={[60, 'auto']} width={50} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#111', border: `1px solid ${themeColor}`, color: themeColor }}
              labelStyle={{ color: themeColor }}
              itemStyle={{ color: themeColor }}
            />
            {parseFloat(goalWeight) > 0 && (
              <ReferenceLine
                yAxisId="right"
                y={parseFloat(goalWeight)}
                stroke="#ff00ff"
                strokeWidth={1}
                strokeDasharray="8 4"
                label={{ value: `Goal: ${goalWeight}kg`, fill: '#ff00ff', fontSize: 11, position: 'right' }}
              />
            )}
            {goalDayVisible && (
              <ReferenceLine
                yAxisId="left"
                x={goalDayVisible}
                stroke="#ff00ff"
                strokeWidth={1}
                strokeDasharray="8 4"
                label={{ value: `🎯 ${goalDayVisible}`, fill: '#ff00ff', fontSize: 11, position: 'top' }}
              />
            )}
            <Bar yAxisId="left" dataKey="completed" fill="url(#barGradient)" name="Habits Completed" />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="weight"
              stroke={themeColor}
              strokeWidth={2}
              dot={(props: any) => {
                const { cx, cy, payload, index } = props;
                if (payload.weight == null) return <g key={`dot-empty-${index}`} />;
                if (payload.prediction == null) return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill={themeColor} />;
                const diff = payload.weight - payload.prediction;
                const maxDiff = 5;
                const ratio = Math.min(Math.abs(diff) / maxDiff, 1);
                let fill: string;
                if (diff > 0) {
                  const r = Math.round(255);
                  const g = Math.round(255 * (1 - ratio));
                  fill = `rgb(${r},${g},0)`;
                } else {
                  const r = 0;
                  const g = Math.round(150 + 105 * ratio);
                  const b = Math.round(65 * (1 - ratio));
                  fill = `rgb(${r},${g},${b})`;
                }
                return <circle key={`dot-${index}`} cx={cx} cy={cy} r={5} fill={fill} stroke={fill} strokeWidth={1} />;
              }}
              name="Weight (kg)"
              connectNulls
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="prediction"
              stroke="#ccff00"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Goal Curve"
              connectNulls
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="trend"
              stroke="#ff6600"
              strokeWidth={2}
              strokeDasharray="3 3"
              dot={false}
              name="Trend"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
        </div>
      </section>

      <section className="tracker">
        <div className="tracker-tabs">
          <button className={`tracker-tab ${trackerTab === 'habits' ? 'active' : ''}`} onClick={() => setTrackerTab('habits')}>Habits</button>
          <button className={`tracker-tab ${trackerTab === 'nutrition' ? 'active' : ''}`} onClick={() => setTrackerTab('nutrition')}>Nutrition</button>
          <div className="tracker-tabs-spacer"></div>
          {trackerTab === 'habits' && (
            <button className="tab-action-btn" onClick={() => setHabitsModalOpen(true)} aria-label="Edit habits">✎</button>
          )}
          {trackerTab === 'nutrition' && (
            <button className="tab-action-btn" onClick={() => setNutritionOpen(true)} aria-label="Nutrition">🍎</button>
          )}
        </div>
        <div className="tracker-body">
        <div className="tracker-grid" style={{ gridTemplateColumns: `120px repeat(${visibleDays.length}, 60px)` }}>
          {/* Header row */}
          <div className="tracker-corner"></div>
          {visibleDays.map(day => (
            <div key={day} className="tracker-header-cell">{day}</div>
          ))}
          {/* Weight row (always visible) */}
          <div className="tracker-label">Weight (kg)</div>
          {visibleDays.map(day => (
            <div key={`w-${day}`} className="tracker-cell">
              <input
                className="weight-input"
                type="text"
                inputMode="decimal"
                value={tracker[day]?.weight ?? ''}
                onChange={e => handleWeight(day, e.target.value)}
                placeholder="—"
              />
            </div>
          ))}
          {/* Nutrition rows */}
          {trackerTab === 'nutrition' && (<>
          <div className="tracker-label">Calories</div>
          {visibleDays.map((day, i) => {
            const t = getDayTargets(i);
            const val = parseInt(tracker[day]?.calories ?? '') || 0;
            const over = t && val > t.calories;
            return (
              <div key={`cal-${day}`} className={`tracker-cell ${over ? 'cell-over' : ''}`}>
                <input
                  className="macro-input"
                  type="text"
                  inputMode="numeric"
                  value={tracker[day]?.calories ?? ''}
                  onChange={e => handleMacro(day, 'calories', e.target.value)}
                  placeholder={t ? String(t.calories) : '—'}
                />
              </div>
            );
          })}
          <div className="tracker-label">Protein (g)</div>
          {visibleDays.map((day, i) => {
            const t = getDayTargets(i);
            const val = parseInt(tracker[day]?.protein ?? '') || 0;
            const over = t && val > t.protein;
            return (
              <div key={`pro-${day}`} className={`tracker-cell ${over ? 'cell-over' : ''}`}>
                <input
                  className="macro-input"
                  type="text"
                  inputMode="numeric"
                  value={tracker[day]?.protein ?? ''}
                  onChange={e => handleMacro(day, 'protein', e.target.value)}
                  placeholder={t ? String(t.protein) : '—'}
                />
              </div>
            );
          })}
          <div className="tracker-label">Carbs (g)</div>
          {visibleDays.map((day, i) => {
            const t = getDayTargets(i);
            const val = parseInt(tracker[day]?.carbs ?? '') || 0;
            const over = t && val > t.carbs;
            return (
              <div key={`carb-${day}`} className={`tracker-cell ${over ? 'cell-over' : ''}`}>
                <input
                  className="macro-input"
                  type="text"
                  inputMode="numeric"
                  value={tracker[day]?.carbs ?? ''}
                  onChange={e => handleMacro(day, 'carbs', e.target.value)}
                  placeholder={t ? String(t.carbs) : '—'}
                />
              </div>
            );
          })}
          <div className="tracker-label">Fats (g)</div>
          {visibleDays.map((day, i) => {
            const t = getDayTargets(i);
            const val = parseInt(tracker[day]?.fats ?? '') || 0;
            const over = t && val > t.fats;
            return (
              <div key={`fat-${day}`} className={`tracker-cell ${over ? 'cell-over' : ''}`}>
                <input
                  className="macro-input"
                  type="text"
                  inputMode="numeric"
                  value={tracker[day]?.fats ?? ''}
                  onChange={e => handleMacro(day, 'fats', e.target.value)}
                  placeholder={t ? String(t.fats) : '—'}
                />
              </div>
            );
          })}          <div className="tracker-label">Steps</div>
          {visibleDays.map((day) => {
            const val = parseInt(tracker[day]?.steps ?? '') || 0;
            const target = 10000;
            const under = val > 0 && val < target;
            return (
              <div key={`steps-${day}`} className={`tracker-cell ${under ? 'cell-under' : ''}`}>
                <input
                  className="macro-input"
                  type="text"
                  inputMode="numeric"
                  value={tracker[day]?.steps ?? ''}
                  onChange={e => handleMacro(day, 'steps', e.target.value)}
                  placeholder="10000"
                />
              </div>
            );
          })}          </>)}
          {/* Habit rows */}
          {trackerTab === 'habits' && habits.map(habit => (
            <React.Fragment key={habit}>
              <div className="tracker-label">{habit}</div>
              {visibleDays.map(day => (
                <div key={`${habit}-${day}`} className="tracker-cell">
                  <input
                    type="checkbox"
                    className="habit-check"
                    checked={tracker[day]?.habits[habit] || false}
                    onChange={() => handleCheck(day, habit)}
                  />
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
        </div>
      </section>
    </div>
  );
};

export default App;
