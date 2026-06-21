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
  Cell,
  Brush,
} from 'recharts';
import './App.css';
import { api } from './api';
import WeeklyRecap from './WeeklyRecap';
import GoalSheet from './GoalSheet';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MONTH_COLORS: Record<number, string> = {
  0: '#FF4D8D',  // Jan - hot pink
  1: '#FFB928',  // Feb - violet
  2: '#2E8BFF',  // Mar - deep purple
  3: '#FF8A00',  // Apr - orange
  4: '#FFD233',  // May - gold
  5: '#FF4D8D',  // Jun - hot pink
  6: '#2E8BFF',  // Jul - deep purple
  7: '#FFB928',  // Aug - violet
  8: '#FFD233',  // Sep - gold
  9: '#FF8A00',  // Oct - orange
  10: '#FF4D8D', // Nov - hot pink
  11: '#FFD233', // Dec - gold
};

// ── Custom chart tick: day number only, month label at boundaries ─────────────
const ChartXTick: React.FC<any> = ({ x, y, payload }) => {
  const val = payload?.value as string;
  if (!val) return null;
  const parts = val.split('/');
  if (parts.length !== 2) return null;
  const dd = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10);
  const isMonthStart = dd === 1 || dd <= 7; // first week of month shows label
  const showMonth = dd === 1; // only first day of month gets the month label
  return (
    <g transform={`translate(${x},${y})`}>
      {showMonth && (
        <text x={0} y={-14} fill="rgba(255,255,255,0.85)" fontSize={9} fontWeight={700}
          fontFamily="'Space Mono', monospace" textAnchor="middle" letterSpacing="0.08em">
          {MONTH_SHORT[mm - 1].toUpperCase()}
        </text>
      )}
      <text x={0} y={0} dy={4}
        fill={showMonth ? '#fff' : 'rgba(255,255,255,0.38)'}
        fontSize={showMonth ? 10.5 : 9}
        fontWeight={showMonth ? 700 : 400}
        fontFamily="'Space Mono', monospace"
        textAnchor="middle">
        {dd}
      </text>
    </g>
  );
};

// ── Color-matched tooltip ─────────────────────────────────────────────────────
function makeChartTooltip(emaColor: string) {
  return ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const hasData = payload.some((e: any) => e.value != null && e.value !== 0);
    if (!hasData) return null;
    return (
      <div style={{ background: 'rgba(12,12,18,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '9px 13px', boxShadow: '0 12px 36px rgba(0,0,0,0.7)', minWidth: 140 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontFamily: "'Space Mono', monospace", fontSize: 11, marginBottom: 7 }}>{label}</div>
        {payload.map((entry: any, idx: number) => {
          if (entry.value == null || entry.value === 0) return null;
          const color = entry.color || entry.fill || emaColor;
          const isCount = entry.name === 'Done' || entry.name === 'Failed';
          const isProjection = entry.name === 'Projection';
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '2px 0' }}>
              <span style={{ width: 8, height: 8, borderRadius: isCount ? 2 : '50%', background: color, opacity: isProjection ? 0.5 : 1, flexShrink: 0 }} />
              <span style={{ color: 'rgba(255,255,255,0.45)', fontFamily: "'Sora', sans-serif", fontSize: 11 }}>{entry.name}</span>
              <span style={{ color, opacity: isProjection ? 0.65 : 1, fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, marginLeft: 'auto', paddingLeft: 12 }}>
                {isCount ? entry.value : `${entry.value} kg`}
              </span>
            </div>
          );
        })}
      </div>
    );
  };
}

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


interface AppProps { onLogout?: () => void; }

const App: React.FC<AppProps> = ({ onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const cogRef = useRef<HTMLDivElement>(null);
  const trackerBodyRef = useRef<HTMLDivElement>(null);

  const scrollTrackerToToday = () => {
    setTimeout(() => {
      const el = trackerBodyRef.current?.querySelector('.today-col') as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, 60);
  };
  const jumpToToday = () => {
    setSelectedMonth(currentMonth);
    setSelectedWeek(currentWeek);
    scrollTrackerToToday();
  };
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
  const [trackerModalOpen, setTrackerModalOpen] = useState(false);
  const [trackerTab, setTrackerTab] = useState<'habits' | 'nutrition'>('habits');

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

  // Chart state
  const [chartRange, setChartRange] = useState<'7d' | '1m' | '3m' | '1y' | 'all'>('all');
  const [weightZoom, setWeightZoom] = useState(false);

  // Coaching message state
  const [coachingMsg, setCoachingMsg] = useState<{ message: string; churnRisk: string } | null>(null);

  // Plan engine state
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const [planStatus, setPlanStatus] = useState<{
    active: boolean;
    goal?: { goalType: string; startWeight: number; targetWeight: number; targetDate: string; ratePctBw: number };
    currentTarget?: { calories: number; reason: string; effectiveFrom: string };
    history?: { id: string; calories: number; previousCalories: number; reason: string; effectiveFrom: string }[];
  } | null>(null);
  const [planCycle, setPlanCycle] = useState<{
    onTrack: boolean; actualSlope: number | null; targetSlope: number; flaggedDays: string[];
  } | null>(null);

  // Weight plan state
  const [currentWeight, setCurrentWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [timeDays, setTimeDays] = useState('');
  const [lossPerWeek, setLossPerWeek] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [activityLevel, setActivityLevel] = useState('1.4');
  const [stepTarget, setStepTarget] = useState(10000);

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
      setStepTarget(parseInt(profile.stepTarget) || 10000);

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

  // Load plan status and write badge for BottomNav
  const loadPlanStatus = useCallback(() => {
    api.getPlanStatus()
      .then((d: any) => {
        setPlanStatus(d);
        const badge = {
          active: !!d.active,
          calories: d.currentTarget?.calories ?? null,
          onTrack: null as boolean | null,
        };
        localStorage.setItem('superdub.plan.badge', JSON.stringify(badge));
        window.dispatchEvent(new Event('superdub:plan-badge-updated'));
      })
      .catch(() => {});
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
      // Load plan and run adjustment cycle (cycle is idempotent — skips if <7 days)
      api.getCoachingMessage().then((d: any) => setCoachingMsg(d)).catch(() => {});
      loadPlanStatus();
      api.runPlanCycle()
        .then((c: any) => {
          if (c.ran) { setPlanCycle(c); loadPlanStatus(); }
          // Update badge with onTrack so BottomNav shows current pace
          try {
            const existing = JSON.parse(localStorage.getItem('superdub.plan.badge') ?? '{}');
            if (existing.active && c.onTrack !== undefined) {
              existing.onTrack = c.onTrack;
              localStorage.setItem('superdub.plan.badge', JSON.stringify(existing));
              window.dispatchEvent(new Event('superdub:plan-badge-updated'));
            }
          } catch {}
        })
        .catch(() => {});
    });
  }, [loadData, loadPlanStatus]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if      (chartRange === '7d')  { from = new Date(now); from.setDate(now.getDate() - 6); }
    else if (chartRange === '1m')  { from = new Date(now); from.setDate(now.getDate() - 29); }
    else if (chartRange === '3m')  { from = new Date(now); from.setDate(now.getDate() - 89); }
    else if (chartRange === '1y')  { from = new Date(now); from.setDate(now.getDate() - 364); }
    else                           { from = new Date(accountCreatedDate); } // 'all'
    if (from < accountCreatedDate) from = new Date(accountCreatedDate);
    return getChartDayRange(from, now);
  }, [chartRange, accountCreatedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // How much history exists → grey out ranges we don't have data for yet
  const daysSinceCreation = Math.max(1, Math.floor((now.getTime() - accountCreatedDate.getTime()) / 86400000) + 1);
  const rangeAvailable = (r: string) =>
    r === '7d' || r === 'all' ? true
    : r === '1m' ? daysSinceCreation > 7
    : r === '1y' ? daysSinceCreation > 30
    : true;

  // Days to reach goal (drives the macro/loss math)
  const daysToGoal = activeLoss > 0 && startWeight > goal && goal > 0
    ? Math.ceil((startWeight - goal) / (activeLoss / 7))
    : null;

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

  // EMA (α=0.25, same as backend engine)
  const chartEMA: Record<number, number> = {};
  {
    let ema: number | null = null;
    for (const { i, w } of weightPoints) {
      ema = ema === null ? w : 0.25 * w + 0.75 * ema;
      chartEMA[i] = +ema.toFixed(2);
    }
  }

  // Last EMA index/value — used for forward projection
  const lastEMAIndex = weightPoints.length > 0 ? weightPoints[weightPoints.length - 1].i : -1;
  const lastEMAValue: number | null = lastEMAIndex >= 0 ? (chartEMA[lastEMAIndex] ?? null) : null;

  // Plan goal info
  const planGoal = planStatus?.active ? planStatus.goal : null;

  // Map adjustment history to DD/MM keys for chart markers
  const adjustmentDDMMs = new Set<string>(
    (planStatus?.history ?? [])
      .filter(h => h.previousCalories != null)
      .map(h => {
        const d = new Date(h.effectiveFrom);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      })
  );

  // Weekly aggregation for Y / All views with >60 days of history
  const shouldAggregate = (chartRange === '1y' || chartRange === 'all') && chartDayRange.length > 60;

  // Build base (daily) chart data (trend = linear regression line, ema = smoothed signal)
  const dailyChartData = chartDayRange.map(({ ddmm }, i) => {
    const d = tracker[ddmm] ?? { weight: '', habits: {}, calories: '', protein: '', carbs: '', fats: '', steps: '' };
    const completed = habits.filter(h => d.habits[h] === true).length;
    const failed = habits.filter(h => d.habits[h] === 'failed').length;
    const ema = chartEMA[i] != null ? chartEMA[i] : null;
    // Only show trend line where we have real weight data nearby (within 3 days)
    const nearbyWeight = weightPoints.some(p => Math.abs(p.i - i) <= 3);
    const trend = hasTrend && nearbyWeight ? +(trendIntercept + trendSlope * i).toFixed(2) : null;
    return { day: ddmm, completed, failed, weight: d.weight ? Number(d.weight) : null, ema, trend, projection: null as number | null };
  });

  // Forward projection days (EMA slope extended past today)
  // Only project forward on longer views; short views (7d/1m) show no projection to avoid doubling apparent range
  const projectionLen = hasTrend && lastEMAValue !== null && !shouldAggregate && chartRange !== '7d' && chartRange !== '1m'
    ? (chartRange === '3m' ? 14 : 30)
    : 0;
  const futureChartData = projectionLen > 0
    ? Array.from({ length: projectionLen }, (_, f) => {
        const futureDate = new Date(now);
        futureDate.setDate(now.getDate() + f + 1);
        const dd = String(futureDate.getDate()).padStart(2, '0');
        const mm = String(futureDate.getMonth() + 1).padStart(2, '0');
        const futureIdx = chartDayRange.length + f;
        const proj = +(lastEMAValue! + trendSlope * (futureIdx - lastEMAIndex)).toFixed(1);
        return { day: `${dd}/${mm}`, completed: 0, failed: 0, weight: null as number | null, ema: null as number | null, projection: proj as number | null };
      })
    : [];

  // Weekly aggregated data for Y / All
  let weeklyChartData: typeof dailyChartData = [];
  if (shouldAggregate) {
    const weekMap = new Map<string, { weights: number[]; done: number; failed: number; order: number }>();
    let order = 0;
    chartDayRange.forEach(({ ddmm, date }) => {
      const mon = new Date(date);
      mon.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      const wk = `${String(mon.getDate()).padStart(2, '0')}/${String(mon.getMonth() + 1).padStart(2, '0')}`;
      if (!weekMap.has(wk)) { weekMap.set(wk, { weights: [], done: 0, failed: 0, order: order++ }); }
      const w = weekMap.get(wk)!;
      const wt = parseFloat(tracker[ddmm]?.weight ?? '');
      if (wt > 0) w.weights.push(wt);
      const d = tracker[ddmm];
      if (d) {
        w.done += habits.filter(h => d.habits[h] === true).length;
        w.failed += habits.filter(h => d.habits[h] === 'failed').length;
      }
    });
    weeklyChartData = Array.from(weekMap.entries())
      .sort((a, b) => a[1].order - b[1].order)
      .map(([wk, data]) => ({
        day: wk,
        weight: data.weights.length > 0 ? +(data.weights.reduce((a, b) => a + b, 0) / data.weights.length).toFixed(1) : null,
        completed: data.done,
        failed: data.failed,
        ema: null,
        projection: null,
      }));
  }

  const chartData = shouldAggregate ? weeklyChartData : [...dailyChartData, ...futureChartData];

  // XAxis tick density
  const displayInterval = chartData.length <= 10 ? 0
    : chartData.length <= 35 ? 2
    : chartData.length <= 60 ? 4
    : 7;

  // EMA colour (green if on track, red if off pace)
  const emaColor = planStatus?.active
    ? (planCycle?.onTrack === false ? '#FF5470' : '#2FD27E')
    : '#2FD27E';

  // Tooltip render function (colour-matched per series)
  const renderTooltip = makeChartTooltip(emaColor);

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

  // ── Walking stats (driven by tracker.steps — populated by phone sync or manual) ──
  const walkAll: { ddmm: string; steps: number }[] = [];
  {
    const wd = new Date(startDay);
    while (wd.getTime() <= hmEnd.getTime()) {
      const ddmm = `${String(wd.getDate()).padStart(2, '0')}/${String(wd.getMonth() + 1).padStart(2, '0')}`;
      walkAll.push({ ddmm, steps: parseInt(tracker[ddmm]?.steps ?? '') || 0 });
      wd.setDate(wd.getDate() + 1);
    }
  }
  const walkLogged = walkAll.filter(d => d.steps > 0);
  const walkTotal = walkLogged.reduce((s, d) => s + d.steps, 0);
  const walkAvg = walkLogged.length ? Math.round(walkTotal / walkLogged.length) : 0;
  const walkDaysHit = walkLogged.filter(d => d.steps >= stepTarget).length;
  const walkDaysMissed = walkLogged.length - walkDaysHit;
  // current streak: consecutive completed days hitting target.
  // Skip today (last entry) if steps haven't synced yet — the day isn't over.
  let walkStreak = 0;
  const todayDDMM = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}`;
  const startFrom = walkAll.length > 0 && walkAll[walkAll.length - 1].ddmm === todayDDMM && walkAll[walkAll.length - 1].steps === 0
    ? walkAll.length - 2   // today has no data yet — start from yesterday
    : walkAll.length - 1;
  for (let i = startFrom; i >= 0; i--) {
    if (walkAll[i].steps > 0 && walkAll[i].steps >= stepTarget) walkStreak++;
    else break;
  }
  // chart: last 14 days, coloured by hit/miss
  const walkChart = walkAll.slice(-14).map(d => ({ day: d.ddmm, steps: d.steps, hit: d.steps >= stepTarget }));
  const walkHasData = walkLogged.length > 0;

  // ── New KPIs for the Progress page ────────────────────────────────────────
  // Total steps for the selected period (month)
  const periodStepTotal = monthDays.reduce((sum, day) => {
    return sum + (parseInt(tracker[day]?.steps ?? '') || 0);
  }, 0);
  const periodStepKm = +(periodStepTotal * 0.00075).toFixed(1);

  // Period habit consistency (within selected month only)
  let periodDone = 0, periodPossible = 0;
  monthDays.forEach(day => {
    const d = tracker[day];
    if (!d || !habits.some(h => d.habits[h] === true || d.habits[h] === ('failed' as any))) return;
    periodDone += habits.filter(h => d.habits[h] === true).length;
    periodPossible += habits.length;
  });
  const periodConsistencyPct = periodPossible > 0 ? Math.round((periodDone / periodPossible) * 100) : null;

  // Current habit streak — consecutive non-future days with ≥1 habit done (from heatmap cells)
  const habitStreak = (() => {
    const cells = heatmapCells.filter(c => !c.inactive);
    let streak = 0;
    for (let i = cells.length - 1; i >= 0; i--) {
      if (cells[i].ratio > 0) streak++;
      else break;
    }
    return streak;
  })();

  // Weekly weight trend from linear regression (kg/week, signed)
  const weeklyWeightTrend = hasTrend ? +(trendSlope * 7).toFixed(2) : null;

  // KPI: days since journey start (Day N counter)
  const daysSinceStart = Math.max(1, Math.floor((Date.now() - accountCreatedDate.getTime()) / 86400000) + 1);

  // KPI: weight change — EMA vs goal start weight (or earliest logged weight)
  const weightLoss: number | null = (() => {
    if (lastEMAValue === null) return null;
    if (planStatus?.active && planStatus.goal) {
      return +(lastEMAValue - planStatus.goal.startWeight).toFixed(1);
    }
    // No active goal: vs. first ever logged weight
    for (const day of ALL_DAYS) {
      const w = parseFloat(tracker[day]?.weight ?? '');
      if (w > 0) return +(lastEMAValue - w).toFixed(1);
    }
    return null;
  })();

  const totalXP = (() => {
    const XP_GATES: [number, number][] = [
      [0, 10], [7, 15], [14, 20], [30, 25], [60, 30], [100, 35], [200, 40], [365, 50],
    ];
    let xp = 0;
    const streakMap: Record<string, number> = {};
    const allDays = Object.keys(tracker).sort((a, b) => {
      const [ad, am] = a.split('/').map(Number);
      const [bd, bm] = b.split('/').map(Number);
      return am !== bm ? am - bm : ad - bd;
    });
    allDays.forEach(day => {
      const d = tracker[day];
      if (!d) return;
      habits.forEach(h => {
        if (d.habits?.[h] === true) {
          streakMap[h] = (streakMap[h] ?? 0) + 1;
          const streak = streakMap[h];
          const gateIdx = XP_GATES.filter(([t]) => t > 0 && streak >= t).length;
          xp += XP_GATES[Math.min(gateIdx, XP_GATES.length - 1)][1];
        } else if (d.habits?.[h] === 'failed') {
          streakMap[h] = 0;
        }
      });
    });
    return xp;
  })();

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
      <div className="app" style={{ '--theme': '#3B9EFF', '--theme-dim': '#3B9EFF66', '--theme-glow': '#3B9EFF14' } as React.CSSProperties}>
        <div className="sd-loader-wrap"><div className="sd-loader"><img className="sd-loader-logo" src="/superdub-logo.png" alt="" /></div></div>
      </div>
    );
  }

  return (
    <div className="app" style={{ '--theme': themeColor, '--theme-dim': themeColor + '66', '--theme-glow': themeColor + '14' } as React.CSSProperties}>
      <div className="hb-topbar">
        <div className="hb-brand">
          <img className="hb-brand-logo" src="/superdub-logo.png" alt="" />
          <span className="hb-brand-name">super<span className="hb-brand-dub">dub</span></span>
        </div>

        {/* Period picker — compact pill between brand and cog */}
        <div className="progress-period-pill" style={{ position: 'relative' }}>
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

        {/* Cog dropdown — top right */}
        <div className="hb-topbar-actions" ref={cogRef} style={{ position: 'relative' }}>
          <button className="hb-cog" onClick={() => setMenuOpen(o => !o)} aria-label="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="19" height="19">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className="cog-menu-overlay" onClick={() => setMenuOpen(false)} />
              <div className="cog-menu">
                <button className="cog-menu-item" onClick={() => { setMenuOpen(false); setHabitsModalOpen(true); }}>
                  <span>✎</span> Edit Habits
                </button>
                <button className="cog-menu-item" onClick={() => { setMenuOpen(false); setGoalSheetOpen(true); }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg> Weight Goal
                </button>
                <button className="cog-menu-item" onClick={() => { setMenuOpen(false); setWeightPlanOpen(true); }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg> Weight Calculator
                </button>
                <button className="cog-menu-item" onClick={() => { setMenuOpen(false); window.dispatchEvent(new CustomEvent('superdub:show-checkin')); }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><polyline points="3 18 4 19 6 17"/></svg> Log Weight
                </button>
                <button className="cog-menu-item" onClick={() => { setMenuOpen(false); window.dispatchEvent(new CustomEvent('superdub:show-step-entry')); }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4h-2L9 9H5l-1 5h14l-1-5h-4z"/><path d="M5 14v5h14v-5"/></svg> Log Steps
                </button>
                <button className="cog-menu-item" onClick={() => { setMenuOpen(false); setTrackerModalOpen(true); }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> Habits &amp; Nutrition
                </button>
              </div>
            </>
          )}
        </div>
      </div>

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

      {/* ── Plan engine goal sheet ── */}
      <GoalSheet
        open={goalSheetOpen}
        onClose={() => setGoalSheetOpen(false)}
        latestWeight={(() => {
          // Find most recent logged weight from the full tracker
          for (let i = ALL_DAYS.length - 1; i >= 0; i--) {
            const w = parseFloat(tracker[ALL_DAYS[i]]?.weight ?? '');
            if (w > 0) return w;
          }
          return null;
        })()}
        onGoalSaved={() => { loadPlanStatus(); api.runPlanCycle().then((c: any) => { if (c.ran) setPlanCycle(c); }).catch(() => {}); }}
      />

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

      <div className="dashboard-scroll">

      <section className="chart-section">
        <div className="chart-range-tabs">
          <button className={`chart-expand-btn${weightZoom ? ' active' : ''}`} onClick={() => setWeightZoom(z => !z)}>
            {weightZoom ? 'Habits' : 'Weight trend'} <span aria-hidden>{weightZoom ? '✕' : '⤢'}</span>
          </button>
          <div className="chart-range-group">
            {(['7d', '1m', '3m', '1y', 'all'] as const).map(r => {
              const enabled = rangeAvailable(r);
              return (
                <button
                  key={r}
                  disabled={!enabled}
                  className={`chart-range-btn ${chartRange === r ? 'active' : ''}${enabled ? '' : ' chart-range-btn--locked'}`}
                  onClick={() => enabled && setChartRange(r)}
                  title={enabled ? undefined : 'Not enough history yet'}
                >
                  {r === '7d' ? '7D' : r === '1m' ? '1M' : r === '3m' ? '3M' : r === '1y' ? '1Y' : 'All'}
                </button>
              );
            })}
          </div>
        </div>
        <div className="chart-section-inner">
        <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 20 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={themeColor + '22'} />
                <stop offset="50%" stopColor={themeColor + '88'} />
                <stop offset="100%" stopColor={themeColor} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={themeColor + '1a'} strokeDasharray="3 3" />
            <XAxis dataKey="day" stroke="rgba(255,255,255,0.25)" tick={{ fill: '#FFFFFF', fontSize: 10 }} interval={displayInterval} tickLine={false} padding={{ left: 10 }} />
            <YAxis yAxisId="left" hide={weightZoom} stroke="rgba(255,255,255,0.25)" tick={{ fill: '#FFFFFF', fontSize: 10 }} allowDecimals={false} width={30} axisLine={false} tickLine={false} domain={[0, habits.length]} />
            <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.25)" tick={{ fill: '#FFFFFF', fontSize: 10 }} allowDecimals={false} tickCount={5} domain={(() => {
              const weights = chartData.map(d => d.weight).filter(Boolean) as number[];
              const emas    = chartData.map((d: any) => d.ema).filter(Boolean) as number[];
              const projs   = chartData.map((d: any) => d.projection).filter(Boolean) as number[];
              const gw      = parseFloat(goalWeight) || 0;
              const allVals = [...weights, ...emas, ...projs, ...(gw > 0 ? [gw] : [])];
              if (allVals.length === 0) return [55, 60] as [number, number];
              const lo = Math.floor((Math.min(...allVals) - 1) / 2) * 2;
              const hi = Math.ceil((Math.max(...allVals) + 1) / 2) * 2;
              return [lo, hi] as [number, number];
            })()} width={42} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              contentStyle={{ background: 'rgba(14,14,20,0.96)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.55)', padding: '9px 12px' }}
              labelStyle={{ color: '#FFFFFF', fontWeight: 700, fontFamily: "'Space Mono', monospace", fontSize: 12, marginBottom: 5 }}
              itemStyle={{ color: '#C4C4D0', fontFamily: "'Sora', sans-serif", fontSize: 12, padding: '2px 0' }}
            />
            {(() => {
              // Prefer adaptive plan target weight, fall back to weight-settings goal
              const goalKg = planStatus?.goal?.targetWeight ?? (parseFloat(goalWeight) > 0 ? parseFloat(goalWeight) : null);
              if (!goalKg) return null;
              return (
                <ReferenceLine
                  yAxisId="right"
                  y={goalKg}
                  stroke="#2E8BFF"
                  strokeWidth={1.5}
                  strokeDasharray="8 4"
                  label={{ value: `Goal ${goalKg}kg`, fill: '#2E8BFF', fontSize: 11, fontWeight: 700, position: 'insideTopRight' }}
                />
              );
            })()}
            {/* ── Habit bars: green for done, red for failed, rounded tops ── */}
            {!weightZoom && <Bar yAxisId="left" dataKey="completed" stackId="habits" fill="#2FD27E" name="Done" radius={[4,4,0,0]} isAnimationActive={false} />}
            {!weightZoom && <Bar yAxisId="left" dataKey="failed" stackId="habits" fill="#FF5470" name="Failed" radius={[4,4,0,0]} isAnimationActive={false} />}
            {/* ── Forward projection (weight zoom only) ── */}
            {weightZoom && (
              <Line yAxisId="right" type="monotone" dataKey="projection" stroke="#2E8BFF" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Projection" connectNulls isAnimationActive={false} />
            )}
            {/* ── Actual weight line ── */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="weight"
              stroke="#FFFFFF"
              strokeWidth={weightZoom ? 3 : 2.5}
              style={{ cursor: 'pointer' }}
              onClick={() => setWeightZoom(z => !z)}
              dot={(props: any) => {
                const { cx, cy, payload, index } = props;
                if (payload.weight == null) return <g key={`dot-empty-${index}`} />;
                return <circle key={`dot-${index}`} cx={cx} cy={cy} r={weightZoom ? 5 : 4} fill="#0E0E14" stroke="#FFFFFF" strokeWidth={2} style={{ cursor: 'pointer' }} onClick={() => setWeightZoom(z => !z)} />;
              }}
              name="Weight (kg)"
              connectNulls
              isAnimationActive={false}
            />
            {/* ── Linear regression trend line — shows direction across logged points ── */}
            {hasTrend && (
              <Line yAxisId="right" type="linear" dataKey="trend" stroke="rgba(255,255,255,0.28)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Trend" connectNulls isAnimationActive={false} />
            )}
            {/* ── EMA smoothed trend (primary engine signal) ── */}
            {hasTrend && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="ema"
                stroke={planStatus?.active
                  ? (planCycle?.onTrack === false ? '#FF5470' : '#2FD27E')
                  : '#2FD27E'}
                strokeWidth={3}
                dot={false}
                name="EMA trend"
                connectNulls
                isAnimationActive={false}
              />
            )}
            {/* ── Calorie adjustment markers ── */}
            {Array.from(adjustmentDDMMs).map(ddmm => (
              <ReferenceLine
                key={`adj-${ddmm}`}
                yAxisId="left"
                x={ddmm}
                stroke="rgba(255,255,255,0.18)"
                strokeDasharray="3 3"
                label={{ value: '⟳', fill: '#9aa0a6', position: 'insideTop', fontSize: 10 }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
        </div>
        </div>{/* /chart-section-inner */}
      </section>

      {/* ── KPI cards ── */}
      <div className="kpi-section">
        <p className="kpi-group-label">Weight</p>
        <div className="kpi-group">
          <div className="kpi-card kpi-row-layout">
            <span className="kpi-label">Change</span>
            <span className={`kpi-value ${weightLoss !== null && ((planStatus?.goal?.goalType === 'bulk' ? weightLoss > 0 : weightLoss < 0)) ? 'kpi-good' : ''}`}>
              {weightLoss !== null ? `${weightLoss > 0 ? '+' : ''}${weightLoss} kg` : '—'}
            </span>
          </div>
          <div className="kpi-card kpi-row-layout">
            <span className="kpi-label">Trend</span>
            <span className={`kpi-value ${weeklyWeightTrend !== null && (planStatus?.goal?.goalType === 'bulk' ? weeklyWeightTrend > 0 : weeklyWeightTrend < 0) ? 'kpi-good' : ''}`}>
              {weeklyWeightTrend !== null ? `${weeklyWeightTrend > 0 ? '+' : ''}${weeklyWeightTrend} kg/wk` : '—'}
            </span>
          </div>
        </div>
        <p className="kpi-group-label">Activity</p>
        <div className="kpi-group">
          <div className="kpi-card kpi-row-layout">
            <span className="kpi-label">{MONTH_SHORT[selectedMonth]} steps</span>
            <span className="kpi-value">
              {periodStepTotal > 0
                ? <>{periodStepKm} <span className="kpi-unit">km</span> <span className="kpi-sub-inline">({periodStepTotal.toLocaleString()})</span></>
                : '—'}
            </span>
          </div>
          <div className="kpi-card kpi-row-layout">
            <span className="kpi-label">Walk streak</span>
            <span className="kpi-value kpi-good">
              {walkStreak}d{walkStreak > 0 ? <svg viewBox="0 0 24 24" width="13" height="13" style={{verticalAlign:'middle',marginLeft:2}} fill="#FF8A00"><path d="M12 1C12 1 7 8 7 13a5 5 0 0 0 10 0c0-5-5-12-5-12zm0 16a3 3 0 0 1-3-3c0-2.5 2-6 3-8 1 2 3 5.5 3 8a3 3 0 0 1-3 3z"/></svg> : ''}
            </span>
          </div>
        </div>
        <p className="kpi-group-label">Engagement</p>
        <div className="kpi-group">
          <div className="kpi-card kpi-row-layout">
            <span className="kpi-label">Habit streak</span>
            <span className="kpi-value kpi-good">
              {habitStreak}d{habitStreak > 0 ? <svg viewBox="0 0 24 24" width="13" height="13" style={{verticalAlign:'middle',marginLeft:2}} fill="#FF8A00"><path d="M12 1C12 1 7 8 7 13a5 5 0 0 0 10 0c0-5-5-12-5-12zm0 16a3 3 0 0 1-3-3c0-2.5 2-6 3-8 1 2 3 5.5 3 8a3 3 0 0 1-3 3z"/></svg> : ''}
            </span>
          </div>
          <div className="kpi-card kpi-row-layout">
            <span className="kpi-label">{MONTH_SHORT[selectedMonth]} consistency</span>
            <span className={`kpi-value ${periodConsistencyPct !== null && periodConsistencyPct >= 70 ? 'kpi-good' : ''}`}>
              {periodConsistencyPct !== null ? `${periodConsistencyPct}%` : '—'}
            </span>
          </div>
          <div className="kpi-card kpi-row-layout">
            <span className="kpi-label">Days logged</span>
            <span className="kpi-value">{daysLogged}</span>
          </div>
          <div className="kpi-card kpi-row-layout">
            <span className="kpi-label">Total XP</span>
            <span className="kpi-value kpi-gold">{totalXP.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ── Plan engine surfacing ── */}
      {planStatus?.active && planStatus.currentTarget && (() => {
        const target = planStatus.currentTarget!;
        const g = planStatus.goal!;
        const onTrack = planCycle?.onTrack ?? true;
        const slope = planCycle?.actualSlope;
        const weeksLeft = Math.round((new Date(g.targetDate).getTime() - Date.now()) / (7 * 86400000));
        const daysAgo = Math.round((Date.now() - new Date(target.effectiveFrom).getTime()) / 86400000);
        return (
          <div className="plan-engine-card">
            <div className="plan-engine-header">
              <span className="plan-engine-title">Weight Plan</span>
              <span className={`plan-engine-badge ${onTrack ? 'badge-on' : 'badge-off'}`}>
                {onTrack ? 'On pace' : 'Adjusting'}
              </span>
            </div>
            <div className="plan-engine-row">
              <div className="plan-kpi">
                <span className="plan-kpi-label">Prescribed</span>
                <span className="plan-kpi-value">{target.calories} kcal/day</span>
              </div>
              <div className="plan-kpi">
                <span className="plan-kpi-label">Target</span>
                <span className="plan-kpi-value">{g.targetWeight} kg</span>
              </div>
              <div className="plan-kpi">
                <span className="plan-kpi-label">Weeks left</span>
                <span className="plan-kpi-value">{Math.max(weeksLeft, 0)}</span>
              </div>
              {slope != null && (
                <div className="plan-kpi">
                  <span className="plan-kpi-label">Trend</span>
                  <span className={`plan-kpi-value ${slope < 0 && g.goalType === 'lose' ? 'kpi-good' : ''}`}>
                    {slope > 0 ? '+' : ''}{slope.toFixed(2)} kg/wk
                  </span>
                </div>
              )}
            </div>
            <p className="plan-engine-reason">
              {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`} — {target.reason}
            </p>
          </div>
        );
      })()}

      {/* ── Coaching message ── */}
      {coachingMsg && (
        <div className={`coaching-card${coachingMsg.churnRisk === 'HIGH' || coachingMsg.churnRisk === 'CRITICAL' ? ' coaching-empathy' : ''}`}>
          <span className="coaching-eyebrow">
            {coachingMsg.churnRisk === 'HIGH' || coachingMsg.churnRisk === 'CRITICAL'
              ? 'A note for today'
              : 'Today\'s insight'}
          </span>
          <p className="coaching-msg">{coachingMsg.message}</p>
        </div>
      )}

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

      {/* ── Walking stats (steps from phone sync or manual entry) ── */}
      <section className="report-card walk-card">
        <p className="report-eyebrow">Walking · target {stepTarget.toLocaleString()} steps</p>
        {walkHasData ? (
          <>
            <div className="walk-kpi-row">
              <div className="walk-kpi">
                <span className="walk-kpi-val">{walkAvg.toLocaleString()}</span>
                <span className="walk-kpi-label">Avg / day</span>
              </div>
              <div className="walk-kpi">
                <span className="walk-kpi-val kpi-good">{walkDaysHit}</span>
                <span className="walk-kpi-label">Days hit</span>
              </div>
              <div className="walk-kpi">
                <span className="walk-kpi-val">{walkDaysMissed}</span>
                <span className="walk-kpi-label">Days missed</span>
              </div>
              <div className="walk-kpi">
                <span className="walk-kpi-val">{walkStreak}{walkStreak > 0 ? <svg viewBox="0 0 24 24" width="14" height="14" style={{verticalAlign:'middle',marginLeft:2}} fill="#FF8A00"><path d="M12 1C12 1 7 8 7 13a5 5 0 0 0 10 0c0-5-5-12-5-12zm0 16a3 3 0 0 1-3-3c0-2.5 2-6 3-8 1 2 3 5.5 3 8a3 3 0 0 1-3 3z"/></svg> : ''}</span>
                <span className="walk-kpi-label">Streak</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={170}>
              <ComposedChart data={walkChart} margin={{ left: 0, right: 10, top: 8, bottom: 4 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.25)" tick={{ fill: '#FFFFFF', fontSize: 9 }} interval="preserveStartEnd" tickLine={false} padding={{ left: 6, right: 6 }} />
                <YAxis stroke="rgba(255,255,255,0.25)" tick={{ fill: '#FFFFFF', fontSize: 9 }} width={36} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{ background: '#0E1418', border: '1px solid #132820', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: '#9aa' }}
                  formatter={(v: any) => [Number(v).toLocaleString() + ' steps', '']}
                />
                <ReferenceLine y={stepTarget} stroke="#FFD233" strokeDasharray="4 4" label={{ value: 'Target', fill: '#FFD233', fontSize: 10, position: 'insideTopRight' }} />
                <Bar dataKey="steps" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {walkChart.map((d, i) => (
                    <Cell key={i} fill={d.hit ? '#2FD27E' : '#2E8BFF'} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </>
        ) : (
          <p className="walk-empty">No step data yet. Once steps sync from your phone (or you add them manually), your walking stats appear here.</p>
        )}
      </section>

      {/* ── Weekly Recap share card ── */}
      <WeeklyRecap habits={habits} tracker={tracker} />

      {/* Habits & Nutrition tracker — moved into the cog (opens as a modal) */}
      {trackerModalOpen && (
      <div className="modal-overlay" onClick={() => setTrackerModalOpen(false)}>
      <div className="modal tracker-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Habits &amp; Nutrition</span>
          <button className="modal-close" onClick={() => setTrackerModalOpen(false)}>✕</button>
        </div>
      {/* Week selector — filters the tracker below */}
      <div className="week-bar">
        <button
          className="week-btn today-jump-btn"
          onClick={jumpToToday}
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
        <div className="tracker-body" ref={trackerBodyRef}>
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
      </div>
      </div>
      )}
      <div style={{ height: 100 }} />
      </div>{/* /dashboard-scroll */}
    </div>
  );
};

export default App;
