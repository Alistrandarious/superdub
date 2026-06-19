import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  0: '#FF4D8D',  // Jan - hot pink
  1: '#B84DFF',  // Feb - violet
  2: '#7C3AED',  // Mar - deep purple
  3: '#FF8A00',  // Apr - orange
  4: '#FFD233',  // May - gold
  5: '#FF4D8D',  // Jun - hot pink
  6: '#7C3AED',  // Jul - deep purple
  7: '#B84DFF',  // Aug - violet
  8: '#FFD233',  // Sep - gold
  9: '#FF8A00',  // Oct - orange
  10: '#FF4D8D', // Nov - hot pink
  11: '#FFD233', // Dec - gold
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

function getChartDayRange(from: Date, to: Date): Array<{ ddmm: string; date: Date }> {
  const result: Array<{ ddmm: string; date: Date }> = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  while (cur <= end) {
    const dd = String(cur.getDate()).padStart(2, '0');
    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    result.push({ ddmm: `${dd}/${mm}`, date: new Date(cur) });
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

function getMonthDays(month: number): string[] {
  const mm = String(month + 1).padStart(2, '0');
  return ALL_DAYS.filter(d => d.slice(3) === mm);
}

function getWeekOfMonth(dayStr: string): number {
  const day = parseInt(dayStr.slice(0, 2));
  return Math.ceil(day / 7);
}

const DEFAULT_HABITS: string[] = [];

type HabitState = true | 'failed' | false;

interface DayData {
  weight: string;
  habits: Record<string, HabitState>;
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

const INITIAL_TRACKER = initData([]);

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface AppProps { onLogout?: () => void; }

const App: React.FC<AppProps> = ({ onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const cogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (cogRef.current && !cogRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);
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
  const [habits, setHabits] = useState<string[]>([]);
  const [newHabit, setNewHabit] = useState('');
  const [tracker, setTracker] = useState<Record<string, DayData>>(INITIAL_TRACKER);
  const [loaded, setLoaded] = useState(false);

  // Calendar state
  const now = new Date();
  const currentMonth = now.getMonth();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Progress page is fixed "growth blue" (month colours still drive the month picker)
  const themeColor = '#3B9EFF';

  // Chart state
  const [accountCreatedAt, setAccountCreatedAt] = useState<string>('');

  // Join date as month index + day (within 2026) for filtering
  const joinMonth = useMemo(() => {
    if (!accountCreatedAt) return 0;
    return new Date(accountCreatedAt).getMonth();
  }, [accountCreatedAt]);

  const joinDay = useMemo(() => {
    if (!accountCreatedAt) return 1;
    return new Date(accountCreatedAt).getDate();
  }, [accountCreatedAt]);

  const monthDays = useMemo(() => {
    const days = getMonthDays(selectedMonth);
    if (!accountCreatedAt) return days;
    if (selectedMonth < joinMonth) return [];
    if (selectedMonth > joinMonth) return days;
    // Same month — drop days before join day
    const joinDDStr = String(joinDay).padStart(2, '0');
    return days.filter(d => d.slice(0, 2) >= joinDDStr);
  }, [selectedMonth, accountCreatedAt, joinMonth, joinDay]);

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

  // Chart state
  const [chartRange, setChartRange] = useState<'7d' | '1m' | '3m' | 'all'>('all');

  // Weight plan state
  const [currentWeight, setCurrentWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [timeDays, setTimeDays] = useState('');
  const [lossPerWeek, setLossPerWeek] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [activityLevel, setActivityLevel] = useState('1.4');

  // Load all data on mount
  const loadData = useCallback((currentHabits?: string[]) => {
    return Promise.all([
      api.getProfile(),
      api.getHabits(),
      api.getTracker(),
      api.getWeightSettings(),
    ]).then(([profile, loadedHabits, trackerData, ws]) => {
      setName(profile.name ?? '');
      if (profile.accountCreatedAt) setAccountCreatedAt(profile.accountCreatedAt);

      const habitObjs = loadedHabits as { name: string }[];
      const activeHabits = habitObjs.length > 0 ? habitObjs.map(h => h.name) : (currentHabits ?? DEFAULT_HABITS);
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
          merged[row.day].habits[row.habit_name] =
            row.state === 'done' ? true : row.state === 'failed' ? 'failed' : false;
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

  useEffect(() => {
    loadData().then(() => {
      // Auto-mark the mandatory habit done on every app open
      const MANDATORY = 'Logging into Superdub';
      api.toggleTrackerHabit(todayKey, MANDATORY, 'done').catch(() => {});
      setTracker(prev => {
        if (!prev[todayKey] || prev[todayKey].habits[MANDATORY]) return prev;
        const next = { ...prev };
        next[todayKey] = { ...next[todayKey], habits: { ...next[todayKey].habits, [MANDATORY]: true } };
        return next;
      });
    });
  }, [loadData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-sync tracker when DailyCheckIn saves weight
  useEffect(() => {
    const handler = () => api.getTracker().then(trackerData => {
      setTracker(prev => {
        const next = { ...prev };
        (trackerData.days as any[]).forEach(row => {
          if (next[row.day]) {
            next[row.day] = {
              ...next[row.day],
              weight:   row.weight   ?? next[row.day].weight,
              calories: row.calories ?? next[row.day].calories,
              protein:  row.protein  ?? next[row.day].protein,
              carbs:    row.carbs    ?? next[row.day].carbs,
              fats:     row.fats     ?? next[row.day].fats,
              steps:    row.steps    ?? next[row.day].steps,
            };
          }
        });
        return next;
      });
    }).catch(() => {});
    window.addEventListener('superdub:tracker-updated', handler);
    return () => window.removeEventListener('superdub:tracker-updated', handler);
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

  // Account creation date — fallback to 30 days ago if not loaded yet
  const accountCreatedDate = useMemo(() => {
    if (accountCreatedAt) return new Date(accountCreatedAt);
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  }, [accountCreatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chart day range based on selected range tab
  const chartDayRange = useMemo(() => {
    let from: Date;
    if (chartRange === '7d') { from = new Date(now); from.setDate(now.getDate() - 6); }
    else if (chartRange === '1m') { from = new Date(now); from.setDate(now.getDate() - 29); }
    else if (chartRange === '3m') { from = new Date(now); from.setDate(now.getDate() - 89); }
    else { from = new Date(accountCreatedDate); } // 'all' — from day 1
    // Never start before account creation
    if (from < accountCreatedDate) from = new Date(accountCreatedDate);
    return getChartDayRange(from, now);
  }, [chartRange, accountCreatedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Days to reach goal (for goal reference line)
  const daysToGoal = activeLoss > 0 && startWeight > goal && goal > 0
    ? Math.ceil((startWeight - goal) / (activeLoss / 7))
    : null;

  // Goal date DD/MM — shown on chart if within current range
  const goalDateDDMM = useMemo(() => {
    if (!daysToGoal || !accountCreatedAt) return null;
    const d = new Date(accountCreatedDate);
    d.setDate(d.getDate() + daysToGoal);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  }, [daysToGoal, accountCreatedDate, accountCreatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const goalDayVisible = goalDateDDMM && chartDayRange.some(d => d.ddmm === goalDateDDMM)
    ? goalDateDDMM : null;

  // Trend (linear regression on actual logged weights within the chart range)
  const weightPoints: { i: number; w: number }[] = [];
  chartDayRange.forEach(({ ddmm }, i) => {
    const w = parseFloat(tracker[ddmm]?.weight ?? '');
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

  // XAxis tick density based on how many days are visible
  const xAxisInterval = chartDayRange.length <= 10 ? 0
    : chartDayRange.length <= 35 ? 6
    : chartDayRange.length <= 100 ? 13
    : 29;

  const chartData = chartDayRange.map(({ ddmm, date }, i) => {
    const d = tracker[ddmm] ?? { weight: '', habits: {}, calories: '', protein: '', carbs: '', fats: '', steps: '' };
    const completed = habits.filter(h => d.habits[h] === true).length;
    const failed = habits.filter(h => d.habits[h] === 'failed').length;

    // Days since account creation → drives the linear goal curve
    const daysSinceStart = Math.round((date.getTime() - accountCreatedDate.getTime()) / 86400000);
    const prediction = (startWeight > 0 && activeLoss > 0 && daysSinceStart >= 0)
      ? +Math.max(startWeight - (activeLoss / 7) * daysSinceStart, goal > 0 ? goal : 0).toFixed(1)
      : null;

    const lastDataIndex = hasTrend ? weightPoints[weightPoints.length - 1].i : 0;
    const trend = hasTrend && i >= weightPoints[0].i && i <= lastDataIndex + 7
      ? +(trendIntercept + trendSlope * i).toFixed(1)
      : null;

    return { day: ddmm, completed, failed, weight: d.weight ? Number(d.weight) : null, prediction, trend };
  });

  // ── Reporting: consistency heatmap (from start date → today, grows over time) ──
  const nowMs = Date.now();
  const hmEnd = new Date(); hmEnd.setHours(0, 0, 0, 0);
  const startDay = new Date(accountCreatedDate); startDay.setHours(0, 0, 0, 0);
  let hmStart = new Date(startDay);
  // back up to the Monday on/before the start date so columns align to weeks
  hmStart.setDate(hmStart.getDate() - ((hmStart.getDay() + 6) % 7));
  const MAX_WEEKS = 30;
  let weeks = Math.ceil((Math.floor((hmEnd.getTime() - hmStart.getTime()) / 86400000) + 1) / 7);
  if (weeks < 1) weeks = 1;
  if (weeks > MAX_WEEKS) {
    weeks = MAX_WEEKS;
    hmStart = new Date(hmEnd);
    hmStart.setDate(hmEnd.getDate() - (MAX_WEEKS * 7 - 1));
    hmStart.setDate(hmStart.getDate() - ((hmStart.getDay() + 6) % 7));
    weeks = Math.ceil((Math.floor((hmEnd.getTime() - hmStart.getTime()) / 86400000) + 1) / 7);
  }
  const heatmapCells: { ddmm: string; ratio: number; monthIdx: number; inactive: boolean }[] = [];
  let kDone = 0, kPoss = 0;
  for (let w = 0; w < weeks; w++) {
    for (let dow = 0; dow < 7; dow++) {
      const dt = new Date(hmStart);
      dt.setDate(hmStart.getDate() + w * 7 + dow);
      const ddmm = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const inactive = dt.getTime() > nowMs || dt.getTime() < startDay.getTime();
      const d = tracker[ddmm];
      const done = d ? habits.filter(h => d.habits[h] === true).length : 0;
      const ratio = habits.length > 0 ? done / habits.length : 0;
      heatmapCells.push({ ddmm, ratio, monthIdx: dt.getMonth(), inactive });
      const hasMark = !!d && habits.some(h => d.habits[h] === true || d.habits[h] === ('failed' as any));
      if (hasMark && !inactive) { kDone += done; kPoss += habits.length; }
    }
  }
  const consistencyPct = kPoss > 0 ? Math.round((kDone / kPoss) * 100) : 0;
  const daysLogged = Object.values(tracker).filter((d: any) =>
    d && (d.weight || (d.habits && habits.some(h => d.habits[h] === true || d.habits[h] === 'failed')) || d.calories || d.steps)
  ).length;
  // month labels positioned under their first column
  const heatmapMonths: { idx: number; col: number }[] = [];
  for (let w = 0; w < weeks; w++) {
    const m = heatmapCells[w * 7].monthIdx;
    if (w === 0 || heatmapCells[(w - 1) * 7].monthIdx !== m) heatmapMonths.push({ idx: m, col: w });
  }

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

    let dayWeight = startWeight;
    for (let d = dayIndex - 1; d >= 0; d--) {
      const w = parseFloat(tracker[visibleDays[d]]?.weight ?? '');
      if (w > 0) { dayWeight = w; break; }
    }

    const dayBmr = (10 * dayWeight) + (6.25 * htVal) - (5 * agVal) + 5;
    const dayTdee = Math.round(dayBmr * alVal);
    const daysRemaining = daysToGoal ? Math.max(daysToGoal, 7) : 90;
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
    api.toggleTrackerHabit(day, habit, newDone ? 'done' : null).catch(() => {});
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
      <div className="app" style={{ '--theme': '#3B9EFF', '--theme-dim': '#3B9EFF66', '--theme-glow': '#3B9EFF33' } as React.CSSProperties}>
        <div className="sd-loader-wrap"><div className="sd-loader" /></div>
      </div>
    );
  }

  return (
    <div className="app" style={{ '--theme': themeColor, '--theme-dim': themeColor + '66', '--theme-glow': themeColor + '33' } as React.CSSProperties}>
      <header className="header">
        <div className="header-brand header-brand--left">
          <img className="header-brand-logo" src="/superdub-logo.png" alt="" />
          <span className="header-brand-name">super<span className="hb-brand-dub">dub</span></span>
        </div>

        {/* Cog dropdown — top right */}
        <div ref={cogRef} style={{ marginLeft: 'auto', position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{
              background: 'none', border: 'none', color: menuOpen ? 'var(--theme)' : '#666',
              cursor: 'pointer', fontSize: '1.1rem', padding: '6px 8px',
              lineHeight: 1, borderRadius: 8, transition: 'color 0.15s',
            }}
            aria-label="Settings"
          >
            ⚙️
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              background: '#0E0E14', border: '1px solid #252532',
              borderRadius: 12, minWidth: 160, overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)', zIndex: 300,
            }}>
              <button
                onClick={() => { setHabitsModalOpen(true); setMenuOpen(false); }}
                style={{
                  display: 'block', width: '100%', padding: '12px 16px',
                  background: 'none', border: 'none', color: '#ccc',
                  textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem',
                  fontFamily: 'inherit', borderBottom: '1px solid #252532',
                }}
              >
                Edit Habits
              </button>
              <button
                onClick={() => { setWeightPlanOpen(true); setMenuOpen(false); }}
                style={{
                  display: 'block', width: '100%', padding: '12px 16px',
                  background: 'none', border: 'none', color: '#ccc',
                  textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem',
                  fontFamily: 'inherit',
                }}
              >
                Weight Settings
              </button>
            </div>
          )}
        </div>
      </header>

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

      {/* ── Daily check-in overlay (once per day, waits for habits to load) ── */}
      {checkinOpen && loaded && (() => {
        const todayEntry = tracker[todayKey];
        const doneCount = todayEntry ? habits.filter(h => todayEntry.habits[h] === true).length : 0;
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
                    const done = todayEntry.habits[h] === true;
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

      <div className="dashboard-scroll">
      {/* Overview heading + month picker */}
      <div className="progress-overview">
        <div className="progress-overview-titles">
          <p className="progress-eyebrow">{YEAR} OVERVIEW</p>
          <h1 className="progress-title">Progress</h1>
        </div>
        <div className="calendar-picker">
          <button className="calendar-btn" onClick={() => setCalendarOpen(!calendarOpen)}>
            {MONTH_NAMES[selectedMonth]} {YEAR}
            {selectedWeek !== null && ` · W${selectedWeek}`}
            <span className="calendar-arrow">{calendarOpen ? '▲' : '▾'}</span>
          </button>
          {calendarOpen && (
            <div className="calendar-dropdown">
              <div className="calendar-grid">
                {MONTH_SHORT.map((m, i) => {
                  const isBeforeJoin = i < joinMonth;
                  return (
                    <button
                      key={m}
                      className={`calendar-month ${i === selectedMonth ? 'selected' : ''} ${i === currentMonth ? 'current' : ''} ${isBeforeJoin ? 'disabled' : ''}`}
                      style={{ '--month-color': MONTH_COLORS[i] } as React.CSSProperties}
                      disabled={isBeforeJoin}
                      onClick={() => { setSelectedMonth(i); setSelectedWeek(null); setCalendarOpen(false); }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Week selector bar */}
      <div className="week-bar">
        <button
          className="week-btn today-jump-btn"
          onClick={() => { setSelectedMonth(currentMonth); setSelectedWeek(currentWeek); }}
          title="Jump to today"
        >Today</button>
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
      </div>

      <section className="chart-section">
        <div className="chart-range-tabs">
          {(['7d', '1m', '3m', 'all'] as const).map(r => (
            <button
              key={r}
              className={`chart-range-btn ${chartRange === r ? 'active' : ''}`}
              onClick={() => setChartRange(r)}
            >
              {r === '7d' ? '7D' : r === '1m' ? '1M' : r === '3m' ? '3M' : 'All'}
            </button>
          ))}
        </div>
        <div className="chart-section-inner">
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
            <XAxis dataKey="day" stroke="rgba(255,255,255,0.25)" tick={{ fill: '#FFFFFF', fontSize: 10 }} interval={xAxisInterval} tickLine={false} padding={{ left: 10 }} />
            <YAxis yAxisId="left" stroke="rgba(255,255,255,0.25)" tick={{ fill: '#FFFFFF', fontSize: 10 }} allowDecimals={false} width={30} axisLine={false} tickLine={false} domain={[0, habits.length]} />
            <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.25)" tick={{ fill: '#FFFFFF', fontSize: 10 }} domain={(() => {
              const weights = chartData.map(d => d.weight).filter(Boolean) as number[];
              const preds   = chartData.map(d => d.prediction).filter(Boolean) as number[];
              const gw      = parseFloat(goalWeight) || 0;
              const allVals = [...weights, ...preds, ...(gw > 0 ? [gw] : [])];
              const floor   = allVals.length > 0 ? Math.floor(Math.min(...allVals)) - 3 : 55;
              return [floor, 'auto'] as [number, string];
            })()} width={50} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#0E0E14', border: `1px solid ${themeColor}`, color: themeColor }}
              labelStyle={{ color: themeColor }}
              itemStyle={{ color: themeColor }}
            />
            {parseFloat(goalWeight) > 0 && (
              <ReferenceLine
                yAxisId="right"
                y={parseFloat(goalWeight)}
                stroke="#FFD233"
                strokeWidth={1.5}
                strokeDasharray="8 4"
                label={{ value: `Goal: ${goalWeight}kg`, fill: '#FFD233', fontSize: 11, position: 'right' }}
              />
            )}
            {goalDayVisible && (
              <ReferenceLine
                yAxisId="left"
                x={goalDayVisible}
                stroke="#B84DFF"
                strokeWidth={1}
                strokeDasharray="8 4"
                label={{ value: `🎯 ${goalDayVisible}`, fill: '#B84DFF', fontSize: 11, position: 'top' }}
              />
            )}
            <Bar yAxisId="left" dataKey="completed" stackId="habits" fill="url(#barGradient)" name="Done" />
            <Bar yAxisId="left" dataKey="failed" stackId="habits" fill="rgba(255,69,58,0.75)" name="Failed" radius={[3,3,0,0]} />
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
              stroke="#FFD233"
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
              stroke="#FF8A00"
              strokeWidth={2}
              strokeDasharray="3 3"
              dot={false}
              name="Trend"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
        </div>
        </div>{/* /chart-section-inner */}
      </section>

      {/* ── KPI cards ── */}
      <div className="kpi-row">
        <div className="kpi-card">
          <p className="kpi-label">Consistency</p>
          <p className="kpi-value kpi-good">{consistencyPct}%</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Days logged</p>
          <p className="kpi-value">{daysLogged}</p>
        </div>
      </div>

      {/* ── Consistency heatmap (from start date → grows over time) ── */}
      <section className="report-card">
        <p className="report-eyebrow">Consistency · since {MONTH_SHORT[joinMonth]} {YEAR}</p>
        <div className="heatmap">
          <div className="heatmap-grid">
            {heatmapCells.map((c, i) => (
              <div
                key={i}
                className={`heatmap-cell${c.inactive ? ' inactive' : ''}`}
                style={{ '--lvl': c.inactive ? 0 : (c.ratio > 0 ? Math.max(c.ratio, 0.3) : 0) } as React.CSSProperties}
                title={`${c.ddmm}: ${Math.round(c.ratio * 100)}%`}
              />
            ))}
          </div>
          <div className="heatmap-months" style={{ gridTemplateColumns: `repeat(${heatmapCells.length / 7}, 1fr)` }}>
            {heatmapMonths.map(m => (
              <span key={m.idx + '-' + m.col} className="heatmap-month" style={{ gridColumn: `${m.col + 1} / span 1` }}>
                {MONTH_SHORT[m.idx]}
              </span>
            ))}
          </div>
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
        <div className="tracker-grid" style={{ gridTemplateColumns: `148px repeat(${visibleDays.length}, 56px)` }}>
          {/* Header row */}
          <div className="tracker-corner"></div>
          {visibleDays.map(day => (
            <div key={day} className={`tracker-header-cell ${day === todayKey ? 'today-col' : ''}`}>{day}</div>
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
                    checked={tracker[day]?.habits[habit] === true}
                    onChange={() => handleCheck(day, habit)}
                  />
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
        </div>
      </section>
      <div style={{ height: 100 }} />
      </div>{/* /dashboard-scroll */}
    </div>
  );
};

export default App;
