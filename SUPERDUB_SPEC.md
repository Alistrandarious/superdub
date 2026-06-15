# Superdub — Build Spec

Build a single-page **habit + weight + nutrition tracker** PWA-style web app. Recreate it entirely from this file.

## Stack
- Create React App (`react-scripts` 5), **React 18 + TypeScript**.
- `react-router-dom` v7 (`BrowserRouter`).
- `recharts` v3 for charts.
- localStorage for ALL persistence (no backend). Year is hardcoded to **2026**.
- Deps: `react react-dom react-router-dom recharts typescript web-vitals @types/{node,react,react-dom}`.

## Files
```
public/index.html        # CRA default, <div id="root">
src/index.tsx            # BrowserRouter + Routes
src/index.css            # global reset, monospace font, black bg
src/App.tsx              # "/"  Home dashboard (the big one)
src/Diet.tsx             # "/diet"
src/Tasks.tsx            # "/tasks"
src/Profile.tsx          # "/profile"
src/useLocalStorage.ts   # persistence hook
src/App.css              # ALL component styles (shared by every page)
```

### Routes (src/index.tsx)
`/`→App, `/diet`→Diet, `/tasks`→Tasks, `/profile`→Profile. Wrap in `<React.StrictMode><BrowserRouter>`.

### useLocalStorage.ts
```ts
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw !== null ? JSON.parse(raw) as T : initial; }
    catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]);
  return [value, setValue] as const;
}
```
NOTE: `initial` is a direct value (not lazy fn) — pass module-level constants for big objects.

## localStorage keys (shared across pages)
- `superdub.profile.name` : string (used by App hero greeting + Profile)
- `superdub.habits` : string[] — default `['Walking','Praying','Duolingo']` (shared App + Profile)
- `superdub.tracker` : `Record<dd/mm, DayData>` — full year 2026 map
- `superdub.tasks` : `Task[]`
- `superdub.diet.profile` : `ProfileData` (Diet + Profile share)
- `superdub.diet.target` : `MacroSet` — default `{calories:2003,protein:150,carbs:200,fats:67}`
- `superdub.diet.locks`, `superdub.diet.plans`, `superdub.diet.calorieLock` : Diet-only

## Theme system
Each page sets CSS vars on its root `.app` element via inline style:
`{'--theme':C,'--theme-dim':C+'66','--theme-glow':C+'33'} as React.CSSProperties`.
- Home: per-selected-month color (see MONTH_COLORS). Diet `#00e5ff`. Tasks `#bf5af2`. Profile `#ff9f0a`.
- MONTH_COLORS[0..11]: `#00ff41 #ff6ec7 #00e5ff #ff9500 #b4ff00 #ff2d55 #bf5af2 #64d2ff #ffd60a #ff453a #30d158 #ac8e68`.

## Aesthetic (App.css)
Dark cyberpunk/terminal. `body`/`.app` bg `#0a0a0a`, text = `var(--theme)`, **monospace** font everywhere. Neon glow via `text-shadow:0 0 10px var(--theme-dim),0 0 20px var(--theme-glow)`. Borders use `--theme-dim`. Hover fills use `--theme-glow`. `.app{height:100vh;overflow:hidden;display:flex;flex-direction:column}`.
- `.header`: flex, padding 14px 24px, bottom border `--theme-dim`, gradient `#111→#0a0a0a`. `.title` absolutely centered, `letter-spacing:.2em`, `text-transform:capitalize`.
- `.title` text is literal per page: "Superdub" / "Diet" / "Tasks" / "Hello {name}" or "Profile".
- Non-home pages have a `.back-link` "← Back" `<Link to="/">` in `.header-left`.

## Data model
```ts
interface DayData { weight:string; habits:Record<string,boolean>; calories:string; protein:string; carbs:string; fats:string; steps:string }
interface Task { id:string; text:string; done:boolean }
interface MacroSet { calories:number; protein:number; carbs:number; fats:number }
interface ProfileData { heightCm:string; weightKg:string; age:string; sex:'male'|'female'; activity:string; steps:string; vestKg:string }
```
DEFAULT_PROFILE: all '' except `sex:'male', activity:'1.55'`.

### Date helpers (App.tsx)
- Keys are **`dd/mm`** strings. `getYearDays(2026)` → every day of the year (use `new Date(y,m+1,0).getDate()` for days-in-month), zero-padded.
- `ALL_DAYS` = all 365 keys. `getMonthDays(m)` filters by `.slice(3)===mm`. `getWeekOfMonth(d)=Math.ceil(parseInt(d.slice(0,2))/7)` (1–5).
- `INITIAL_TRACKER` = module const: every day → blank DayData with each default habit `false`.
- `todayKey`, `todayLabel` (`Weekday, D Month`), greeting by hour (`<12` morning, `<18` afternoon, else evening).

---
## PAGE 1 — Home `src/App.tsx`
Layout: `.app` (theme=selected month color) → fixed `.header` → `.home-scroll`(flex:1, overflow-y:auto) containing: hero check-in → week-bar → chart → tracker.

**Header**: hamburger button (3 spans) toggles slide-out menu; `.calendar-picker` button shows `{MonthName} 2026 ·W{n}` and opens a 4×3 month grid dropdown (each month tinted with its color, marks selected+current). Title "Superdub" centered.

**Slide-out menu** (`.menu-overlay`+`.menu`, click-outside closes): links Home/Diet/Additional Tasks/Profile + buttons "Habits" (open habits modal) and "Settings" (open weight modal).

**Hero check-in card** (`.checkin-card.hero`, min-height `calc(100dvh - 58px)`): glass card with eyebrow date, big "`{greeting}, {name}` 👋", a **conic-gradient progress ring** (`--pct` = % habits done today), count `done/total`. Below: habit **pills** (`.checkin-habit`) — tap toggles `tracker[todayKey].habits[h]`; done pills show ✓ else +. Footer: all-done message or hint, plus "View dashboard ▾" button that smooth-scrolls a `dashboardRef` (on the week-bar) into view. Handle edge cases: today not in tracker, zero habits.

**Week-bar** (`ref=dashboardRef`): "All" + W1..W{weeksInMonth} buttons set `selectedWeek` (null=whole month). Mark current week. Plus an `i` legend tooltip (Habits Completed/Weight/Goal Curve/Trend) and a ⚖ button opening weight settings.

**Chart** (`recharts ComposedChart`, ResponsiveContainer h=300): X=day (interval 6), left Y-axis hidden (domain `[0,habits.length]`), right Y-axis weight (domain `[60,'auto']`).
- **Bar** `completed` (habits done that day) with vertical gradient `barGradient` of themeColor.
- **Line** `weight` (themeColor): custom dots colored by deviation from prediction — above prediction → red-ish `rgb(255, 255*(1-ratio), 0)`, below → green `rgb(0, 150+105*ratio, 65*(1-ratio))`, ratio=`min(|diff|/5,1)`.
- **Line** `prediction` dashed `#ccff00` "Goal Curve".
- **Line** `trend` dashed `#ff6600` "Trend".
- ReferenceLines: horizontal magenta at goalWeight, vertical magenta `🎯` at goal-hit day if visible.

**Tracker** (`.tracker`): tabs Habits/Nutrition + edit (✎) / nutrition (🍎) action buttons. Grid `gridTemplateColumns:'120px repeat(N,60px)'`, 120px sticky label column with green right-border. Header row = day keys. Always-visible **Weight** row of text inputs. Habits tab: one checkbox row per habit. Nutrition tab: Calories/Protein/Carbs/Fats/Steps rows of numeric inputs with **per-day target placeholders**; cell turns `cell-over` (red) when value>target, Steps `cell-under` when <10000.

**Modals** (`.modal-overlay`+`.modal`, click-outside closes):
- *Customize Habits*: list with remove ✕, add-row input (Enter or +). Adding writes `false` into every tracker day's habits; removing deletes the key from every day.
- *Weight Settings*: inputs Current/Goal weight, Loss/week, Time(days) — each missing one is auto-computed as placeholder.
- *Nutrition Calculator*: Height, Age, Activity(select 1.2/1.4/1.55/1.7/1.9), shows daily kcal+P/C/F targets.

### Home calculation logic
- **Maintenance**: Mifflin-St Jeor male `BMR=10*kg+6.25*cm-5*age+5`; `TDEE=round(BMR*activity)`.
- **Deficit**: `dailyDeficit=round(lossPerWeek*7700/7)` (7700 kcal/kg fat). `targetCalories=max(TDEE-deficit,1200)`.
- **Macros**: protein=`round(kg*2.0)`, fats=`round(kg*0.8)`, carbs=`max(round((cal-p*4-f*9)/4),50)`.
- **Loss/week ↔ time** two-way derive: `loss=(cw-gw)/(days/7)`; `days=ceil((cw-gw)/loss*7)`.
- **Prediction curve** = exponential decay `weight(t)=goal+(start-goal)*e^(-k·t)` where `k=(loss/7)/(start-goal)`, t = global day index. Goal-hit index `= ceil(-ln(0.5/(start-goal))/k)`.
- **Trend line** = linear regression over recorded weights in visible range (need ≥2 points), extend ~7 days past last point.
- **Per-day targets** `getDayTargets(i)`: use most recent actual weight before day i (else prediction) → recompute BMR/TDEE for that weight, recompute required loss/week to still hit goal by goalDay (cap 1.0 kg/wk), derive cal+macros. Targets shown as input placeholders.
- Numeric inputs: weight/decimals validated `/^\d*\.?\d*$/`, macros/steps integer `/^\d*$/`.

---
## PAGE 2 — Diet `src/Diet.tsx` (theme #00e5ff)
No food log. Sections:
1. **User Profile** — height/weight/age/sex/activity (+ steps, vest kg). Computes Mifflin-St Jeor maintenance (`female: -161` instead of `+5`) + walking burn.
2. **Daily Targets** — calorie goal field + Protein/Carbs/Fats, each with a **lock toggle** and ▲▼ steppers (`MACRO_STEP=5`, `CAL_STEP=10`, also ArrowUp/Down keys). `calories` is DERIVED from macros via `macroCalories=p*4+c*4+f*9` (not stored independently). When the calorie lock is on, editing one macro **rebalances the other unlocked macros** to hold the calorie total; each shows "max N g". Persists `superdub.diet.locks`, `superdub.diet.calorieLock`.
3. **Macro Split** — recharts `PieChart` of macros by kcal contribution.
4. **Diet Classification** — derived labels: macro style, energy balance vs maintenance, protein g/kg.
5. **Meal Plans** — a local generator that distributes target macros across meals (Breakfast 25% / Lunch 30% / Snack 15% / Dinner 30%). For each slot pick a protein+carb+fat food from `MEAL_TEMPLATES`, scale portions to hit protein→carbs→fats in turn, round to each food's `step`/`min`/`max`. Saved plans persist to `superdub.diet.plans`; also a few preset ideas.

**Walking burn**: `STRIDE_M=0.762`, `KCAL_PER_KG_KM=0.5`; `km=steps*STRIDE/1000`; `burn=round(km*(bodyKg+vestKg)*0.5)`.

**FOODS table** (macros per `base`: 100g for `measure:'g'`, 1 for `measure:'unit'` with `gramsPerUnit`,`one`,`many`). Include: chicken(p31c0f3.6), turkey(21/0/5), salmon(20/0/13), whitefish(18/0/1), steak(26/0/8), tofu(12/2/7), yoghurt 0%(10/4/0.4), cottage(11/3.4/4.3), eggs unit 50g(6/0.5/5), whey unit 30g(24/2/1.5), oats(13/66/7), rice(2.7/28/0.3), pasta(5/30/1.1), quinoa(4.4/21/1.9), sweetpotato(1.6/20/0.1), potato(2/17/0.1), noodles(2/25/0.2), banana unit 120g(1.3/27/0.4), bread unit 40g(4/18/1.2), peanutbutter unit 16g(4/3/8), almonds(21/22/49), oliveoil unit 14g(0/0/14), avocado(2/9/15), seeds unit 12g(2/3/5), beef(21/0/5), tortilla unit 62g(8/32/4), cheese(25/0.1/33). Helpers: `macrosFor(food,qty)`, `roundQty`, `portionLabel` ("150 g chicken breast" / "3 whole eggs (150 g)").
ESLint gotcha: never name a non-hook fn with `use` prefix.

---
## PAGE 3 — Tasks `src/Tasks.tsx` (theme #bf5af2)
Simple to-do list persisted to `superdub.tasks`. `.diet-section` with heading "Additional Tasks", input + `+` button (Enter adds), id=`${Date.now()}-${rand}`. List of `.task-item` with checkbox toggle, strike-through when done, ✕ remove. Empty state message.

---
## PAGE 4 — Profile `src/Profile.tsx` (theme #ff9f0a)
Title "Hello {name}" or "Profile". Sections: **Name** (`superdub.profile.name`), **Biographics** (the ProfileData fields → `superdub.diet.profile`), **Targets** (calorie goal + P/C/F draft inputs committed on Enter/blur; "advisable split" button = protein kg*2, fat kg*0.8, carbs fill remainder; persists `superdub.diet.target`), **Habits** (add/remove on shared `superdub.habits`). ACTIVITY_LEVELS select: 1.2 Sedentary / 1.375 Light / 1.55 Moderate / 1.725 Very active / 1.9 Extra active.

---
## Acceptance
App runs with `npm start`. All 4 routes work, slide-out nav navigates, every input persists across reload via the listed localStorage keys, the home chart renders bars+weight+prediction+trend with the deviation-colored dots, week/month selectors filter the tracker+chart, and adding/removing a habit updates every tracker day. Match the dark neon monospace aesthetic with per-page theme colors.

---
# Reference Implementation (verbatim)

The two files below are the **exact source** for the home page and ALL shared styling. Reproduce them as-is. The Diet/Tasks/Profile pages are not pasted — build them from the prose spec above, and they will be styled correctly by this `App.css`.

## src/App.tsx (verbatim)
```tsx
import React, { useState, useMemo, useRef } from 'react';
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
import { useLocalStorage } from './useLocalStorage';

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

// Generate all days for a given year as dd/mm keys
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

// Get days for a specific month (0-indexed)
function getMonthDays(month: number): string[] {
  const mm = String(month + 1).padStart(2, '0');
  return ALL_DAYS.filter(d => d.slice(3) === mm);
}

// Get week number (1-5) for a day within its month
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

const App: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [weightPlanOpen, setWeightPlanOpen] = useState(false);
  const [habitsModalOpen, setHabitsModalOpen] = useState(false);
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [trackerTab, setTrackerTab] = useState<'habits' | 'nutrition'>('habits');
  const [name] = useLocalStorage<string>('superdub.profile.name', '');
  const [habits, setHabits] = useLocalStorage<string[]>('superdub.habits', DEFAULT_HABITS);
  const [newHabit, setNewHabit] = useState('');
  const [tracker, setTracker] = useLocalStorage<Record<string, DayData>>('superdub.tracker', INITIAL_TRACKER);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Calendar state
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null); // null = full month, 1-5 = week
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Theme color for selected month
  const themeColor = MONTH_COLORS[selectedMonth];

  // Compute visible days based on month + week selection
  const monthDays = useMemo(() => getMonthDays(selectedMonth), [selectedMonth]);
  const visibleDays = useMemo(() => {
    if (selectedWeek === null) return monthDays;
    return monthDays.filter(d => getWeekOfMonth(d) === selectedWeek);
  }, [monthDays, selectedWeek]);

  // How many weeks in the selected month
  const weeksInMonth = Math.ceil(monthDays.length / 7);
  const currentWeek = selectedMonth === currentMonth ? Math.ceil(now.getDate() / 7) : null;

  // Today's check-in: dd/mm key, friendly date label and a time-of-day greeting.
  const todayKey = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const todayLabel = `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTH_NAMES[now.getMonth()]}`;
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Weight plan state
  const [currentWeight, setCurrentWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [timeDays, setTimeDays] = useState('');
  const [lossPerWeek, setLossPerWeek] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [activityLevel, setActivityLevel] = useState('1.4'); // sedentary + walking

  // Compute loss/week from current, goal, time
  const computedLossPerWeek = (() => {
    const cw = parseFloat(currentWeight);
    const gw = parseFloat(goalWeight);
    const td = parseFloat(timeDays);
    if (cw && gw && td && td > 0 && cw > gw) {
      return ((cw - gw) / (td / 7)).toFixed(2);
    }
    return '';
  })();

  // Compute time from current, goal, loss/week
  const computedTimeDays = (() => {
    const cw = parseFloat(currentWeight);
    const gw = parseFloat(goalWeight);
    const lpw = parseFloat(lossPerWeek);
    if (cw && gw && lpw && lpw > 0 && cw > gw) {
      return Math.ceil(((cw - gw) / lpw) * 7).toString();
    }
    return '';
  })();

  const handleNumericInput = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === '' || /^\d*\.?\d*$/.test(v)) setter(v);
  };

  // Build chart data from tracker state with prediction line
  const activeLoss = parseFloat(lossPerWeek) || parseFloat(computedLossPerWeek) || 0;
  const startWeight = parseFloat(currentWeight) || 0;
  const goal = parseFloat(goalWeight) || 0;

  // Calorie & macro targets (Mifflin-St Jeor for males + activity + deficit)
  const ht = parseFloat(height) || 0;
  const ag = parseFloat(age) || 0;
  const al = parseFloat(activityLevel) || 1.4;
  const bmr = startWeight > 0 && ht > 0 && ag > 0 ? (10 * startWeight) + (6.25 * ht) - (5 * ag) + 5 : 0;
  const tdee = Math.round(bmr * al);
  const dailyDeficit = activeLoss > 0 ? Math.round((activeLoss * 7700) / 7) : 0; // 7700kcal per kg fat
  const targetCalories = tdee > 0 ? Math.max(tdee - dailyDeficit, 1200) : 0;
  // Evidence-based: Protein 2g/kg, Fat 0.8g/kg, Carbs fill remainder
  const targetProtein = startWeight > 0 ? Math.round(startWeight * 2.0) : 0;
  const targetFats = startWeight > 0 ? Math.round(startWeight * 0.8) : 0;
  const targetCarbCals = targetCalories - (targetProtein * 4) - (targetFats * 9);
  const targetCarbs = targetCalories > 0 ? Math.max(Math.round(targetCarbCals / 4), 50) : 0;

  // Find the day index where prediction hits goal weight (exponential decay)
  // Real weight loss follows exponential decay: weight(t) = goal + (start - goal) * e^(-kt)
  // k is derived from desired loss rate: at day 0, loss/day = k*(start-goal) = activeLoss/7
  const kRate = (startWeight > goal && activeLoss > 0) ? (activeLoss / 7) / (startWeight - goal) : 0;

  // Goal day index relative to ALL_DAYS
  let goalDayIndex = ALL_DAYS.length;
  if (startWeight > 0 && goal > 0 && kRate > 0) {
    goalDayIndex = Math.ceil(-Math.log(0.5 / (startWeight - goal)) / kRate);
    if (goalDayIndex >= ALL_DAYS.length) goalDayIndex = ALL_DAYS.length;
  }

  // Goal day label (if it falls within current visible days)
  const goalDayStr = goalDayIndex < ALL_DAYS.length ? ALL_DAYS[goalDayIndex] : null;
  const goalDayVisible = goalDayStr && visibleDays.includes(goalDayStr) ? goalDayStr : null;

  // Compute trend line from actual recorded weights within visible range (linear regression)
  const weightPoints: { i: number; w: number }[] = [];
  visibleDays.forEach((day, i) => {
    const w = parseFloat(tracker[day].weight);
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
    const d = tracker[day];
    const completed = habits.filter(h => d.habits[h]).length;
    // Prediction uses the day's global index in ALL_DAYS for accurate exponential decay
    const globalIdx = ALL_DAYS.indexOf(day);
    const prediction = (startWeight > 0 && kRate > 0)
      ? +(goal + (startWeight - goal) * Math.exp(-kRate * globalIdx)).toFixed(1)
      : null;
    // Trend: show across visible range
    const lastDataIndex = hasTrend ? weightPoints[weightPoints.length - 1].i : 0;
    const trend = hasTrend && i >= weightPoints[0].i && i <= lastDataIndex + 7
      ? +(trendIntercept + trendSlope * i).toFixed(1)
      : null;
    return { day, completed, weight: d.weight ? Number(d.weight) : null, prediction, trend };
  });

  const handleWeight = (day: string, value: string) => {
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
    setTracker(prev => ({ ...prev, [day]: { ...prev[day], weight: value } }));
  };

  const handleMacro = (day: string, field: 'calories' | 'protein' | 'carbs' | 'fats' | 'steps', value: string) => {
    if (value !== '' && !/^\d*$/.test(value)) return;
    setTracker(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  };

  // Per-day calorie targets that adjust based on yesterday's actual weight
  // dayIndex is relative to visibleDays
  const getDayTargets = (dayIndex: number) => {
    const htVal = parseFloat(height) || 0;
    const agVal = parseFloat(age) || 0;
    const alVal = parseFloat(activityLevel) || 1.4;
    if (htVal === 0 || agVal === 0 || startWeight === 0) return null;

    const day = visibleDays[dayIndex];
    const globalIdx = ALL_DAYS.indexOf(day);

    // Use yesterday's actual weight if available, otherwise fall back to prediction
    let dayWeight = (kRate > 0) ? goal + (startWeight - goal) * Math.exp(-kRate * globalIdx) : startWeight;
    // Look for most recent actual weight before this day
    for (let d = dayIndex - 1; d >= 0; d--) {
      const w = parseFloat(tracker[visibleDays[d]]?.weight);
      if (w > 0) {
        dayWeight = w;
        break;
      }
    }

    const dayBmr = (10 * dayWeight) + (6.25 * htVal) - (5 * agVal) + 5;
    const dayTdee = Math.round(dayBmr * alVal);

    // Recalculate deficit based on where you actually are vs goal
    // How many days remain from this day to goalDayIndex
    const daysRemaining = Math.max(goalDayIndex - globalIdx, 7); // minimum 1 week
    const weightToLose = Math.max(dayWeight - goal, 0);
    // Required loss/week to hit goal on time
    const requiredLossPerWeek = (weightToLose / daysRemaining) * 7;
    // Cap at healthy max: 1kg/week (min 500 deficit, max ~1100 deficit)
    const safeLossPerWeek = Math.min(requiredLossPerWeek, 1.0);
    const deficit = Math.round((safeLossPerWeek * 7700) / 7);
    const cal = Math.max(dayTdee - deficit, 1200);

    // Evidence-based macros for fat loss (preserving muscle):
    const protein = Math.round(dayWeight * 2.0);
    const fats = Math.round(dayWeight * 0.8);
    const carbCals = cal - (protein * 4) - (fats * 9);
    const carbs = Math.max(Math.round(carbCals / 4), 50);
    return { calories: cal, protein, carbs, fats };
  };

  const handleCheck = (day: string, habit: string) => {
    setTracker(prev => ({
      ...prev,
      [day]: { ...prev[day], habits: { ...prev[day].habits, [habit]: !prev[day].habits[habit] } }
    }));
  };

  const addHabit = () => {
    const name = newHabit.trim();
    if (!name || habits.includes(name)) return;
    setHabits(prev => [...prev, name]);
    setTracker(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(day => {
        updated[day] = { ...updated[day], habits: { ...updated[day].habits, [name]: false } };
      });
      return updated;
    });
    setNewHabit('');
  };

  const removeHabit = (name: string) => {
    setHabits(prev => prev.filter(h => h !== name));
    setTracker(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(day => {
        const { [name]: _, ...rest } = updated[day].habits;
        updated[day] = { ...updated[day], habits: rest };
      });
      return updated;
    });
  };

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
        <h1 className="title">Superdub</h1>
      </header>

      {menuOpen && (
        <div className="menu-overlay" onClick={() => setMenuOpen(false)}>
          <nav className="menu" onClick={e => e.stopPropagation()}>
            <div className="menu-header">
              <span className="menu-title">menu</span>
              <button className="menu-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">✕</button>
            </div>
            <Link to="/" onClick={() => setMenuOpen(false)}>Home</Link>
            <Link to="/diet" onClick={() => setMenuOpen(false)}>Diet</Link>
            <Link to="/tasks" onClick={() => setMenuOpen(false)}>Additional Tasks</Link>
            <Link to="/profile" onClick={() => setMenuOpen(false)}>Profile</Link>
            <button type="button" onClick={() => { setHabitsModalOpen(true); setMenuOpen(false); }}>Habits</button>
            <button type="button" onClick={() => { setWeightPlanOpen(true); setMenuOpen(false); }}>Settings</button>
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
        <div className="modal-overlay" onClick={() => setWeightPlanOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Weight Settings</span>
              <button className="modal-close" onClick={() => setWeightPlanOpen(false)}>✕</button>
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
        <div className="modal-overlay" onClick={() => setNutritionOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Nutrition Calculator</span>
              <button className="modal-close" onClick={() => setNutritionOpen(false)}>✕</button>
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

      <div className="home-scroll">
      <section className="checkin-card hero">
        {(() => {
          const todayEntry = tracker[todayKey];
          const doneCount = todayEntry ? habits.filter(h => todayEntry.habits[h]).length : 0;
          const total = habits.length;
          const allDone = total > 0 && doneCount === total;
          const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
          return (
            <div className="checkin-inner">
              <div className="checkin-head">
                <div className="checkin-greet-wrap">
                  <p className="checkin-eyebrow">{todayLabel}</p>
                  <h2 className="checkin-greeting">
                    {greeting}{name.trim() ? `, ${name.trim()}` : ''} <span className="checkin-wave">👋</span>
                  </h2>
                  <p className="checkin-sub">Welcome back — here's your check-in for today.</p>
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
                <p className="checkin-empty">No habits yet — add some from the menu to start checking in.</p>
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
                  ? <p className="checkin-done-msg">All habits done for today — nice work! 🎉</p>
                  : total > 0 && <p className="checkin-hint-msg">Tap a habit to check it off. It updates your dashboard below.</p>}
                <button
                  type="button"
                  className="checkin-scroll-hint"
                  onClick={() => dashboardRef.current?.scrollIntoView({ behavior: 'smooth' })}
                >
                  View dashboard <span className="checkin-chevron">▾</span>
                </button>
              </div>
            </div>
          );
        })()}
      </section>

      {/* Week selector bar */}
      <div className="week-bar" ref={dashboardRef}>
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
                value={tracker[day].weight}
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
            const val = parseInt(tracker[day].calories) || 0;
            const over = t && val > t.calories;
            return (
              <div key={`cal-${day}`} className={`tracker-cell ${over ? 'cell-over' : ''}`}>
                <input
                  className="macro-input"
                  type="text"
                  inputMode="numeric"
                  value={tracker[day].calories}
                  onChange={e => handleMacro(day, 'calories', e.target.value)}
                  placeholder={t ? String(t.calories) : '—'}
                />
              </div>
            );
          })}
          <div className="tracker-label">Protein (g)</div>
          {visibleDays.map((day, i) => {
            const t = getDayTargets(i);
            const val = parseInt(tracker[day].protein) || 0;
            const over = t && val > t.protein;
            return (
              <div key={`pro-${day}`} className={`tracker-cell ${over ? 'cell-over' : ''}`}>
                <input
                  className="macro-input"
                  type="text"
                  inputMode="numeric"
                  value={tracker[day].protein}
                  onChange={e => handleMacro(day, 'protein', e.target.value)}
                  placeholder={t ? String(t.protein) : '—'}
                />
              </div>
            );
          })}
          <div className="tracker-label">Carbs (g)</div>
          {visibleDays.map((day, i) => {
            const t = getDayTargets(i);
            const val = parseInt(tracker[day].carbs) || 0;
            const over = t && val > t.carbs;
            return (
              <div key={`carb-${day}`} className={`tracker-cell ${over ? 'cell-over' : ''}`}>
                <input
                  className="macro-input"
                  type="text"
                  inputMode="numeric"
                  value={tracker[day].carbs}
                  onChange={e => handleMacro(day, 'carbs', e.target.value)}
                  placeholder={t ? String(t.carbs) : '—'}
                />
              </div>
            );
          })}
          <div className="tracker-label">Fats (g)</div>
          {visibleDays.map((day, i) => {
            const t = getDayTargets(i);
            const val = parseInt(tracker[day].fats) || 0;
            const over = t && val > t.fats;
            return (
              <div key={`fat-${day}`} className={`tracker-cell ${over ? 'cell-over' : ''}`}>
                <input
                  className="macro-input"
                  type="text"
                  inputMode="numeric"
                  value={tracker[day].fats}
                  onChange={e => handleMacro(day, 'fats', e.target.value)}
                  placeholder={t ? String(t.fats) : '—'}
                />
              </div>
            );
          })}          <div className="tracker-label">Steps</div>
          {visibleDays.map((day) => {
            const val = parseInt(tracker[day].steps) || 0;
            const target = 10000;
            const under = val > 0 && val < target;
            return (
              <div key={`steps-${day}`} className={`tracker-cell ${under ? 'cell-under' : ''}`}>
                <input
                  className="macro-input"
                  type="text"
                  inputMode="numeric"
                  value={tracker[day].steps}
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
                    checked={tracker[day].habits[habit] || false}
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
  );
};

export default App;
```

## src/App.css (verbatim)
```css
.app {
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #0a0a0a;
  color: var(--theme, #00ff41);
}

/* Header */
.header {
  display: flex;
  align-items: center;
  padding: 14px 24px;
  border-bottom: 1px solid var(--theme-dim, rgba(0, 255, 65, 0.3));
  position: relative;
  background: linear-gradient(180deg, #111 0%, #0a0a0a 100%);
  box-shadow: 0 2px 12px var(--theme-glow, rgba(0, 255, 65, 0.05));
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 10;
}

.hamburger {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 6px;
  border-radius: 4px;
  transition: background 0.2s;
}

.hamburger:hover {
  background: var(--theme-glow);
}

.hamburger span {
  display: block;
  width: 22px;
  height: 2px;
  background: var(--theme);
  border-radius: 1px;
  transition: transform 0.2s, opacity 0.2s;
}

.title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  font-size: 1.5rem;
  letter-spacing: 0.2em;
  text-transform: capitalize;
  text-shadow: 0 0 10px var(--theme-dim), 0 0 20px var(--theme-glow);
}

/* Calendar Picker */
.calendar-picker {
  position: relative;
}

.calendar-btn {
  background: none;
  border: 1px solid var(--theme-dim);
  color: var(--theme);
  font-family: inherit;
  font-size: 0.8rem;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s, border-color 0.2s;
  white-space: nowrap;
}

.calendar-btn:hover {
  background: var(--theme-glow);
  border-color: var(--theme);
}

.calendar-arrow {
  font-size: 0.6rem;
  opacity: 0.7;
}

.calendar-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: #111;
  border: 1px solid var(--theme-dim);
  border-radius: 8px;
  padding: 12px;
  z-index: 50;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 6px;
}

.calendar-month {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #aaa;
  font-family: inherit;
  font-size: 0.75rem;
  padding: 10px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}

.calendar-month:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--month-color);
  border-color: var(--month-color);
}

.calendar-month.selected {
  background: var(--theme-glow);
  border-color: var(--theme);
  color: var(--theme);
  font-weight: 600;
}

.calendar-month.current {
  box-shadow: inset 0 0 0 1px var(--month-color);
}

/* Week Bar */
.week-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  background: #0d0d0d;
  border-bottom: 1px solid var(--theme-dim);
  flex-shrink: 0;
}

.week-bar-spacer {
  flex: 1;
}

.week-btn {
  background: none;
  border: 1px solid transparent;
  color: var(--theme-dim);
  font-family: inherit;
  font-size: 0.75rem;
  padding: 5px 14px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  letter-spacing: 0.05em;
}

.week-btn:hover {
  border-color: var(--theme-dim);
  color: var(--theme);
}

.week-btn.active {
  background: var(--theme-glow);
  border-color: var(--theme);
  color: var(--theme);
}

.week-btn.current:not(.active) {
  border-color: var(--theme-dim);
  box-shadow: inset 0 0 0 1px var(--theme-dim);
}

/* Side menu */
.menu-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  animation: menu-fade 0.2s ease;
}

@keyframes menu-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.menu {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 260px;
  max-width: 80vw;
  display: flex;
  flex-direction: column;
  gap: 0;
  background: #0d0d0d;
  border-right: 1px solid var(--theme-dim);
  box-shadow: 4px 0 24px var(--theme-glow);
  animation: menu-slide 0.22s ease;
}

@keyframes menu-slide {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

.menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--theme-dim);
}

.menu-title {
  font-size: 1.1rem;
  letter-spacing: 0.2em;
  text-transform: lowercase;
  color: var(--theme);
}

.menu-close {
  background: none;
  border: none;
  color: var(--theme);
  cursor: pointer;
  font-size: 1rem;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.15s;
}

.menu-close:hover {
  background: var(--theme-glow);
}

.menu a,
.menu button {
  color: var(--theme);
  text-decoration: none;
  text-align: left;
  background: none;
  border: none;
  font: inherit;
  cursor: pointer;
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  padding: 14px 24px;
  transition: background 0.15s, padding-left 0.15s;
  border-bottom: 1px solid var(--theme-glow);
}

.menu a:hover,
.menu button:hover {
  background: var(--theme-glow);
  padding-left: 32px;
  text-decoration: none;
}

/* New page */
.back-link {
  color: var(--theme);
  text-decoration: none;
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  transition: opacity 0.15s;
}

.back-link:hover {
  opacity: 0.7;
}

.page-content {
  padding: 24px 32px;
  min-height: 60vh;
}

/* Diet page */
.diet .app,
.diet {
  overflow-y: auto;
}

.diet-content {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding-bottom: 48px;
}

.diet-section {
  border: 1px solid var(--theme-dim);
  border-radius: 10px;
  padding: 18px 20px;
  background: #0d0d0d;
}

.diet-heading {
  margin: 0 0 14px;
  font-size: 1rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--theme);
}

.target-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.target-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.78rem;
  letter-spacing: 0.05em;
  color: #aaa;
}

.target-field input {
  background: #111;
  border: 1px solid var(--theme-dim);
  border-radius: 6px;
  color: var(--theme);
  padding: 10px 12px;
  font-size: 0.95rem;
}

.target-field input:focus {
  outline: none;
  border-color: var(--theme);
  box-shadow: 0 0 0 2px var(--theme-glow);
}

.target-field select {
  background: #111;
  border: 1px solid var(--theme-dim);
  border-radius: 6px;
  color: var(--theme);
  padding: 10px 12px;
  font-size: 0.95rem;
}

.target-field select:focus {
  outline: none;
  border-color: var(--theme);
  box-shadow: 0 0 0 2px var(--theme-glow);
}

.activity-field {
  grid-column: 1 / -1;
}

.maintenance-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding: 12px 16px;
  border: 1px solid var(--theme-dim);
  border-radius: 8px;
  background: #111;
  font-size: 0.85rem;
  color: #ccc;
}

.maintenance-box strong {
  color: var(--theme);
  font-size: 1rem;
}

/* Calorie goal + macro locks */
.calorie-goal {
  max-width: 260px;
  margin-bottom: 8px;
}

.diet-hint {
  margin: 0 0 14px;
  font-size: 0.78rem;
  color: #888;
}

.macro-input-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

/* Number field with up/down nudge buttons */
.stepper {
  position: relative;
  flex: 1;
  display: flex;
}

.stepper input {
  flex: 1;
  padding-right: 30px;
}

.stepper-btns {
  position: absolute;
  top: 4px;
  bottom: 4px;
  right: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stepper-btns button {
  flex: 1;
  width: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--theme-glow);
  border: 1px solid var(--theme-dim);
  border-radius: 4px;
  color: var(--theme);
  font-size: 0.6rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s, border-color 0.15s;
}

.stepper-btns button:hover:not(:disabled) {
  background: var(--theme-dim);
  border-color: var(--theme);
}

.stepper-btns button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.macro-max {
  display: block;
  margin-top: 6px;
  font-size: 0.72rem;
  color: var(--theme);
  opacity: 0.8;
}

.macro-input-row input {
  flex: 1;
  background: #111;
  border: 1px solid var(--theme-dim);
  border-radius: 6px;
  color: var(--theme);
  padding: 10px 12px;
  font-size: 0.95rem;
}

.macro-input-row input:focus {
  outline: none;
  border-color: var(--theme);
  box-shadow: 0 0 0 2px var(--theme-glow);
}

.macro-input-row input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.macro-field.locked span {
  color: var(--theme);
}

.lock-btn {
  background: #111;
  border: 1px solid var(--theme-dim);
  border-radius: 6px;
  cursor: pointer;
  width: 42px;
  font-size: 1rem;
  transition: background 0.15s, border-color 0.15s;
}

.lock-btn:hover {
  background: var(--theme-glow);
}

.lock-btn.on {
  border-color: var(--theme);
  background: var(--theme-glow);
}

/* Macro split pie */
.macro-split {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.pie-wrap {
  flex: 1 1 240px;
  min-width: 220px;
}

.macro-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 140px;
}

.macro-legend li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.88rem;
  color: #ddd;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.legend-name {
  flex: 1;
}

.legend-val {
  color: var(--theme);
  font-weight: 600;
}

/* Diet classification */
.class-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.class-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid var(--theme-dim);
  border-radius: 8px;
  background: #111;
}

.class-label {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #888;
}

.class-value {
  font-size: 1.1rem;
  color: var(--theme);
}

.class-value.good {
  color: #30d158;
}

.class-sub {
  font-size: 0.75rem;
  color: #999;
}

/* Target action buttons + deficit */
.target-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.plan-apply:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.deficit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

/* Macro split + classification side by side */
.split-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
}

.split-row .diet-section {
  margin: 0;
}

@media (max-width: 720px) {
  .split-row {
    grid-template-columns: 1fr;
  }
}

/* Plan section header */
.plan-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.plan-head-row .diet-heading {
  margin: 0;
}

.plan-subhead {
  margin: 18px 0 12px;
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #999;
}

/* Progress bars */
.progress-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.82rem;
  margin-bottom: 6px;
  color: #ccc;
}

.progress-labels .over {
  color: #ff453a;
}

.progress-track {
  height: 8px;
  background: #1a1a1a;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--theme);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-fill.over {
  background: #ff453a;
}

/* Food log */
.food-add {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.food-add input {
  background: #111;
  border: 1px solid var(--theme-dim);
  border-radius: 6px;
  color: var(--theme);
  padding: 10px 12px;
  font-size: 0.9rem;
}

.food-add input:focus {
  outline: none;
  border-color: var(--theme);
  box-shadow: 0 0 0 2px var(--theme-glow);
}

.food-name {
  flex: 1 1 160px;
  min-width: 140px;
}

.food-num {
  width: 64px;
}

.food-add-btn {
  background: var(--theme);
  color: #000;
  border: none;
  border-radius: 6px;
  width: 40px;
  font-size: 1.2rem;
  cursor: pointer;
  transition: opacity 0.15s;
}

.food-add-btn:hover {
  opacity: 0.85;
}

.food-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.food-table th,
.food-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--theme-glow);
}

.food-table th:not(:first-child),
.food-table td:not(:first-child) {
  text-align: right;
}

.food-table thead th {
  color: var(--theme);
  text-transform: uppercase;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
}

.food-table tfoot td {
  color: var(--theme);
  font-weight: 600;
  border-top: 1px solid var(--theme-dim);
  border-bottom: none;
}

.food-remove {
  background: none;
  border: none;
  color: #ff453a;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.food-remove:hover {
  background: rgba(255, 69, 58, 0.15);
}

.diet-empty {
  color: #888;
  font-size: 0.85rem;
  margin: 0;
}

/* Meal plan cards */
.plan-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.plan-card {
  border: 1px solid var(--theme-dim);
  border-radius: 8px;
  padding: 16px;
  background: #111;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.plan-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.plan-card-head h3 {
  margin: 0;
  font-size: 0.95rem;
  color: var(--theme);
}

.plan-apply {
  background: none;
  border: 1px solid var(--theme);
  color: var(--theme);
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 0.78rem;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.plan-apply:hover {
  background: var(--theme-glow);
}

.plan-desc {
  margin: 0;
  font-size: 0.8rem;
  color: #999;
}

.plan-meals {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.plan-meals li {
  display: grid;
  grid-template-columns: 80px 1fr auto;
  gap: 8px;
  font-size: 0.78rem;
  color: #ccc;
  align-items: baseline;
}

.plan-meals li.plan-meal {
  display: block;
}

.plan-meal-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}

.meal-breakdown {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 4px;
}

.meal-breakdown td {
  padding: 2px 0;
  font-size: 0.74rem;
  color: #aaa;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.meal-breakdown .mb-item {
  width: 100%;
  color: #ddd;
}

.meal-breakdown .mb-macro {
  text-align: right;
  white-space: nowrap;
  padding-left: 10px;
  color: #888;
  font-variant-numeric: tabular-nums;
}

.plan-meal-name {
  color: var(--theme);
}

.plan-meal-items {
  color: #aaa;
}

.plan-meal-kcal {
  color: #888;
  white-space: nowrap;
}

.plan-total {
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--theme-glow);
  font-size: 0.82rem;
  color: var(--theme);
  font-weight: 600;
}

/* Tasks page */
.tasks-content {
  overflow-y: auto;
  padding-bottom: 48px;
}

.task-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  background: #111;
  border: 1px solid var(--theme-dim);
  border-radius: 6px;
}

.task-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  color: #ddd;
  cursor: pointer;
  flex: 1;
}

.task-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--theme);
  cursor: pointer;
}

.task-item.done .task-label span {
  text-decoration: line-through;
  color: #777;
}

/* Weight Plan */
.weight-plan {
  padding: 12px 32px;
  border-bottom: 1px solid rgba(0, 255, 65, 0.3);
  background: #0d0d0d;
  flex-shrink: 0;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(4px);
}

.modal {
  background: #111;
  border: 1px solid var(--theme-dim);
  border-radius: 8px;
  padding: 24px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 0 30px var(--theme-glow);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.modal-title {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.8;
}

.modal-close {
  background: none;
  border: none;
  color: var(--theme);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: inherit;
}

.modal-close:hover {
  background: var(--theme-glow);
}

.header-btn {
  background: none;
  border: 1px solid var(--theme-dim);
  color: var(--theme);
  font-size: 1rem;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  font-family: inherit;
  transition: background 0.2s, border-color 0.2s;
}

.header-btn:hover {
  background: var(--theme-glow);
  border-color: var(--theme);
}

/* Habits Modal */
.habits-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.habit-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border: 1px solid var(--theme-glow);
  border-radius: 4px;
  font-size: 0.85rem;
}

.habit-remove {
  background: none;
  border: none;
  color: #ff4444;
  font-size: 1rem;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: inherit;
}

.habit-remove:hover {
  background: rgba(255, 68, 68, 0.15);
}

.habit-add-row {
  display: flex;
  gap: 8px;
}

.habit-add-input {
  flex: 1;
  background: var(--theme-glow);
  border: 1px solid var(--theme-dim);
  color: var(--theme);
  font-family: inherit;
  font-size: 0.85rem;
  padding: 8px 12px;
  border-radius: 6px;
  outline: none;
}

.habit-add-input:focus {
  border-color: var(--theme);
  box-shadow: 0 0 8px var(--theme-dim);
}

.habit-add-input::placeholder {
  color: var(--theme-dim);
}

.habit-add-btn {
  background: var(--theme-glow);
  border: 1px solid var(--theme-dim);
  color: var(--theme);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 6px 14px;
  border-radius: 6px;
  font-family: inherit;
}

.habit-add-btn:hover {
  background: var(--theme-dim);
}

.plan-row {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.plan-row label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 140px;
}

.plan-row label span {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.7;
}

.plan-row input {
  background: var(--theme-glow);
  border: 1px solid var(--theme-dim);
  color: var(--theme);
  font-family: inherit;
  font-size: 1rem;
  padding: 10px 12px;
  border-radius: 6px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}

.plan-row input:hover {
  border-color: var(--theme);
}

.plan-row input::placeholder {
  color: var(--theme-dim);
}

.plan-row input:focus {
  border-color: var(--theme);
  box-shadow: 0 0 8px var(--theme-dim);
  background: var(--theme-glow);
}

.plan-select {
  background: var(--theme-glow);
  border: 1px solid var(--theme-dim);
  color: var(--theme);
  font-family: inherit;
  font-size: 0.85rem;
  padding: 10px 12px;
  border-radius: 6px;
  outline: none;
}

.plan-select option {
  background: #111;
  color: var(--theme);
}

.macro-targets {
  margin-top: 16px;
  padding: 12px;
  border: 1px solid var(--theme-dim);
  border-radius: 6px;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 0.8rem;
}

.macro-targets strong {
  color: var(--theme);
}

/* Chart */
.chart-section {
  padding: 16px 16px 16px 0;
  border-bottom: 1px solid var(--theme-glow);
  flex-shrink: 0;
  display: flex;
  align-items: stretch;
}

.chart-labels-spacer {
  width: 120px;
  min-width: 120px;
  flex-shrink: 0;
  border-right: 2px solid var(--theme-dim);
}

.chart-container {
  flex: 1;
  min-width: 0;
  margin-left: -30px;
  overflow: visible;
}

/* Tracker */
.tracker {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--theme-glow);
}

.tracker-tabs {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  border-bottom: 1px solid var(--theme-glow);
  background: #0d0d0d;
  padding-right: 12px;
}

.tracker-tabs-spacer {
  flex: 1;
}

.tab-action-btn {
  background: none;
  border: none;
  color: var(--theme-dim);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: inherit;
  transition: color 0.2s, background 0.2s;
}

.tab-action-btn:hover {
  color: var(--theme);
  background: var(--theme-glow);
}

.tracker-tab {
  background: none;
  border: none;
  color: var(--theme-dim);
  font-family: inherit;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 10px 24px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.2s, border-color 0.2s;
}

.tracker-tab:hover {
  color: var(--theme);
}

.tracker-tab.active {
  color: var(--theme);
  border-bottom-color: var(--theme);
}

.tracker-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.tracker-grid {
  display: grid;
  grid-auto-rows: 36px;
  width: max-content;
}

.tracker-label {
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 36px;
  min-height: 36px;
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
  border-bottom: 1px solid var(--theme-glow);
  border-right: 2px solid var(--theme-dim);
  box-sizing: border-box;
  background: #0a0a0a;
  position: sticky;
  left: 0;
  z-index: 3;
}

.tracker-header-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--theme-glow);
  border-right: 1px solid var(--theme-glow);
  box-sizing: border-box;
  background: #0a0a0a;
  position: sticky;
  top: 0;
  z-index: 2;
}

.tracker-corner {
  position: sticky;
  left: 0;
  top: 0;
  z-index: 4;
  background: #0a0a0a;
  border-bottom: 1px solid var(--theme-glow);
  border-right: 2px solid var(--theme-dim);
}

.tracker-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--theme-glow);
  border-right: 1px solid var(--theme-glow);
  box-sizing: border-box;
}

.weight-input {
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--theme-dim);
  color: var(--theme);
  font-family: inherit;
  font-size: 0.85rem;
  width: 48px;
  text-align: center;
  outline: none;
  padding: 4px 2px;
  transition: border-color 0.2s;
}

.weight-input:focus {
  border-bottom-color: var(--theme);
}

.weight-input::placeholder {
  color: var(--theme-dim);
}

.macro-input {
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--theme-dim);
  color: var(--theme);
  font-family: inherit;
  font-size: 0.7rem;
  width: 48px;
  text-align: center;
  outline: none;
  padding: 4px 2px;
  transition: border-color 0.2s;
}

.macro-input:focus {
  border-bottom-color: var(--theme);
}

.macro-input::placeholder {
  color: var(--theme-dim);
  font-size: 0.65rem;
}

.cell-over {
  background: rgba(255, 50, 50, 0.12);
}

.cell-over .macro-input {
  color: #ff4444;
  border-bottom-color: rgba(255, 68, 68, 0.5);
}

.cell-under {
  background: rgba(255, 165, 0, 0.1);
}

.cell-under .macro-input {
  color: #ff9900;
  border-bottom-color: rgba(255, 153, 0, 0.5);
}

.habit-check {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid var(--theme-dim);
  border-radius: 50%;
  cursor: pointer;
  position: relative;
  vertical-align: middle;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
}

.habit-check:hover {
  border-color: var(--theme);
  box-shadow: 0 0 6px var(--theme-dim);
}

.habit-check:checked {
  background: var(--theme);
  border-color: var(--theme);
  box-shadow: 0 0 8px var(--theme-dim);
}

.habit-check:checked::after {
  content: '✓';
  position: absolute;
  top: 0px;
  left: 3px;
  color: #000;
  font-size: 0.75rem;
  font-weight: bold;
}

/* Chart Legend Info */
.chart-legend-wrapper {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
}

.legend-info-btn {
  position: relative;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid var(--theme-dim);
  background: transparent;
  color: var(--theme);
  font-size: 0.75rem;
  font-weight: 700;
  font-style: italic;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.legend-info-btn:hover {
  background: var(--theme-glow);
}

.legend-tooltip {
  display: none;
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 6px;
  background: #111;
  border: 1px solid var(--theme-dim);
  border-radius: 4px;
  padding: 8px 12px;
  white-space: nowrap;
  z-index: 20;
}

.legend-info-btn:hover .legend-tooltip {
  display: block;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  padding: 3px 0;
  font-style: normal;
}

.legend-swatch {
  width: 14px;
  height: 10px;
  border-radius: 2px;
}

.legend-bar {
  background: linear-gradient(to top, #003300, #00ff41);
}

.legend-weight {
  background: #00ff41;
}

.legend-prediction {
  background: #ccff00;
  height: 3px;
  border-style: dashed;
}

.legend-trend {
  background: #ff6600;
  height: 3px;
  border-style: dashed;
}

/* Scrollbar */
.tracker-body::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.tracker-body::-webkit-scrollbar-track {
  background: #0a0a0a;
}

.tracker-body::-webkit-scrollbar-thumb {
  background: var(--theme-dim);
  border-radius: 4px;
  border: 2px solid #0a0a0a;
}

.tracker-body::-webkit-scrollbar-thumb:hover {
  background: var(--theme);
}

.tracker-body::-webkit-scrollbar-corner {
  background: #0a0a0a;
}

/* =====================================================================
   GLASSMORPHIC THEME LAYER
   Appended last so it overrides the flat surfaces above via cascade.
   Each page sets --theme / --theme-dim / --theme-glow, so the ambient
   glow is tinted per page automatically.
   ===================================================================== */

:root {
  --glass-bg: rgba(255, 255, 255, 0.055);
  --glass-bg-strong: rgba(255, 255, 255, 0.09);
  --glass-border: rgba(255, 255, 255, 0.12);
  --glass-border-strong: rgba(255, 255, 255, 0.2);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  --glass-blur: blur(16px) saturate(150%);
}

/* Ambient gradient backdrop, tinted by the active page theme. */
.app {
  height: 100dvh;
  background:
    radial-gradient(1100px 760px at 8% -12%, var(--theme-glow), transparent 60%),
    radial-gradient(1000px 720px at 112% 6%, var(--theme-glow), transparent 55%),
    radial-gradient(900px 900px at 50% 124%, var(--theme-glow), transparent 60%),
    linear-gradient(165deg, #0c0f15 0%, #070809 55%, #060708 100%);
  background-attachment: fixed;
}

/* Header as a frosted bar */
.header {
  background: rgba(255, 255, 255, 0.045);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border-bottom: 1px solid var(--glass-border);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
}

/* Slide-out menu as a deep glass panel */
.menu {
  background: rgba(16, 18, 24, 0.6);
  -webkit-backdrop-filter: blur(24px) saturate(150%);
  backdrop-filter: blur(24px) saturate(150%);
  border-right: 1px solid var(--glass-border);
  box-shadow: 8px 0 40px rgba(0, 0, 0, 0.45);
}

.menu-overlay {
  background: rgba(0, 0, 0, 0.4);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
}

/* Generic frosted surfaces */
.diet-section,
.plan-card,
.class-card,
.maintenance-box,
.task-item,
.modal,
.calendar-dropdown,
.legend-tooltip,
.macro-targets {
  background: var(--glass-bg);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
}

.diet-section {
  border-radius: 18px;
  padding: 22px 24px;
}

.plan-card,
.modal,
.calendar-dropdown {
  border-radius: 16px;
}

.class-card,
.maintenance-box,
.task-item {
  border-radius: 14px;
}

/* Nested cards sit on a slightly brighter pane so they read as layered glass */
.diet-section .class-card,
.diet-section .plan-card {
  background: var(--glass-bg-strong);
}

/* Frosted inputs & selects */
.target-field input,
.target-field select,
.macro-input-row input,
.calorie-goal input,
.food-add input,
.habit-add input,
.habit-add-input,
.plan-row input,
.plan-select,
.lock-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border-radius: 11px;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}

.target-field input:focus,
.target-field select:focus,
.macro-input-row input:focus,
.food-add input:focus {
  background: rgba(255, 255, 255, 0.08);
}

/* Frosted pill buttons */
.plan-apply,
.header-btn,
.calendar-btn,
.lock-btn,
.week-btn,
.plan-toggle,
.food-add-btn {
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border-radius: 11px;
}

.plan-apply,
.header-btn,
.calendar-btn {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border-strong);
}

.plan-apply:hover,
.header-btn:hover,
.calendar-btn:hover,
.lock-btn:hover {
  background: var(--theme-glow);
  border-color: var(--theme);
  box-shadow: 0 0 16px var(--theme-glow);
}

/* View-meals toggle */
.plan-toggle {
  align-self: flex-start;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border-strong);
  color: var(--theme);
  font: inherit;
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  padding: 7px 14px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
}

.plan-toggle:hover {
  background: var(--theme-glow);
  border-color: var(--theme);
  box-shadow: 0 0 16px var(--theme-glow);
}

.plan-target-note {
  color: #8a8a8a;
  font-weight: 400;
  font-size: 0.74rem;
}

/* Profile page: reuse the diet content scroll + habit editor */
.profile-content {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding-bottom: 48px;
}

.habit-list {
  list-style: none;
  margin: 0 0 14px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.habit-list .habit-item {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 10px 14px;
  color: #ddd;
}

.habit-add {
  display: flex;
  gap: 8px;
}

.habit-add input {
  flex: 1;
  color: var(--theme);
  padding: 10px 12px;
  font-size: 0.9rem;
  outline: none;
}

.habit-add input:focus {
  border-color: var(--theme);
  box-shadow: 0 0 0 2px var(--theme-glow);
}

/* Glass scrollbars for the scrolling pages */
.diet-content::-webkit-scrollbar,
.tasks-content::-webkit-scrollbar,
.profile-content::-webkit-scrollbar {
  width: 10px;
}

.diet-content::-webkit-scrollbar-thumb,
.tasks-content::-webkit-scrollbar-thumb,
.profile-content::-webkit-scrollbar-thumb {
  background: var(--theme-dim);
  border-radius: 6px;
  border: 3px solid transparent;
  background-clip: padding-box;
}

/* =====================================================================
   DAILY CHECK-IN / WELCOME HERO (home dashboard)
   ===================================================================== */
/* Home becomes a vertical scroll region: full-screen hero, then dashboard. */
.home-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

.home-scroll .chart-section,
.home-scroll .tracker {
  flex: 0 0 auto;
}

.home-scroll .tracker {
  min-height: 50vh;
}

/* Full-viewport welcome hero */
.checkin-card.hero {
  flex: 0 0 auto;
  min-height: calc(100dvh - 58px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  position: relative;
}

.checkin-card.hero::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 18px;
  width: 26px;
  height: 26px;
  transform: translateX(-50%);
  background: radial-gradient(circle, var(--theme-glow), transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.checkin-inner {
  width: 100%;
  max-width: 760px;
  padding: 40px;
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-border-strong);
  border-radius: 28px;
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--glass-shadow), 0 0 80px -30px var(--theme-glow);
}

.checkin-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.checkin-eyebrow {
  margin: 0 0 8px;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--theme);
  opacity: 0.85;
}

.checkin-greeting {
  margin: 0;
  font-size: 2.4rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.01em;
  line-height: 1.1;
}

.checkin-wave {
  display: inline-block;
  transform-origin: 70% 70%;
  animation: checkin-wave 2.4s ease-in-out infinite;
}

@keyframes checkin-wave {
  0%, 60%, 100% { transform: rotate(0deg); }
  10% { transform: rotate(14deg); }
  20% { transform: rotate(-8deg); }
  30% { transform: rotate(14deg); }
  40% { transform: rotate(-4deg); }
  50% { transform: rotate(10deg); }
}

.checkin-sub {
  margin: 10px 0 0;
  font-size: 0.95rem;
  color: #9aa0a6;
}

/* Circular progress ring */
.checkin-ring {
  flex-shrink: 0;
  width: 108px;
  height: 108px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: conic-gradient(var(--theme) calc(var(--pct) * 1%), rgba(255, 255, 255, 0.08) 0);
  box-shadow: 0 0 28px -6px var(--theme-glow);
  transition: background 0.4s ease;
}

.checkin-ring-inner {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  background: rgba(12, 15, 21, 0.82);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.checkin-count {
  font-size: 1.7rem;
  font-weight: 800;
  color: var(--theme);
  line-height: 1;
}

.checkin-count-total {
  font-size: 0.95rem;
  font-weight: 600;
  opacity: 0.6;
}

.checkin-progress-label {
  margin-top: 3px;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #9aa0a6;
}

/* Habit pills — wrap freely and scroll if there are very many */
.checkin-habits {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
  max-height: 42vh;
  overflow-y: auto;
  padding: 2px;
}

.checkin-habit {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  color: #e6e9ec;
  font-size: 0.98rem;
  cursor: pointer;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  transition: background 0.18s, border-color 0.18s, color 0.18s, box-shadow 0.18s, transform 0.06s;
}

.checkin-habit:hover {
  border-color: var(--theme);
  transform: translateY(-1px);
}

.checkin-habit:active {
  transform: scale(0.96);
}

.checkin-habit.done {
  background: var(--theme-glow);
  border-color: var(--theme);
  color: var(--theme);
  box-shadow: 0 0 16px var(--theme-glow);
}

.checkin-tick {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--glass-border-strong);
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1;
}

.checkin-habit.done .checkin-tick {
  background: var(--theme);
  border-color: var(--theme);
  color: #07080b;
}

.checkin-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 26px;
}

.checkin-done-msg {
  margin: 0;
  font-size: 0.95rem;
  color: var(--theme);
  font-weight: 700;
}

.checkin-hint-msg {
  margin: 0;
  font-size: 0.85rem;
  color: #9aa0a6;
}

.checkin-empty {
  margin: 24px 0 0;
  font-size: 0.9rem;
  color: #9aa0a6;
}

.checkin-scroll-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  border-radius: 999px;
  background: var(--theme-glow);
  border: 1px solid var(--theme-dim);
  color: var(--theme);
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s, box-shadow 0.18s;
}

.checkin-scroll-hint:hover {
  background: var(--theme-dim);
  border-color: var(--theme);
  box-shadow: 0 0 16px var(--theme-glow);
}

.checkin-chevron {
  display: inline-block;
  animation: checkin-bounce 1.8s ease-in-out infinite;
}

@keyframes checkin-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(3px); }
}

/* =====================================================================
   MOBILE / RESPONSIVE
   ===================================================================== */
@media (max-width: 640px) {
  .header {
    padding: 12px 16px;
  }

  .title {
    font-size: 1.15rem;
    letter-spacing: 0.12em;
  }

  .checkin-card.hero {
    min-height: calc(100dvh - 52px);
    padding: 24px 14px;
  }

  .checkin-inner {
    padding: 24px 20px;
    border-radius: 22px;
  }

  .checkin-head {
    flex-direction: column-reverse;
    align-items: flex-start;
    gap: 16px;
  }

  .checkin-greeting {
    font-size: 1.7rem;
  }

  .checkin-ring {
    width: 88px;
    height: 88px;
  }

  .checkin-ring-inner {
    width: 68px;
    height: 68px;
  }

  .checkin-count {
    font-size: 1.4rem;
  }

  .checkin-habits {
    max-height: 38vh;
    gap: 10px;
  }

  .checkin-habit {
    font-size: 0.9rem;
    padding: 11px 15px;
  }

  .home-scroll .tracker {
    min-height: 60vh;
  }

  .page-content {
    padding: 16px 14px;
  }

  .diet-content,
  .profile-content,
  .tasks-content {
    gap: 18px;
    padding-bottom: 36px;
  }

  .diet-section {
    padding: 16px 16px;
    border-radius: 16px;
  }

  .split-row {
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .target-grid {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 10px;
  }

  .class-grid,
  .deficit-grid {
    grid-template-columns: 1fr 1fr;
  }

  .plan-cards {
    grid-template-columns: 1fr;
  }

  .macro-split {
    flex-direction: column;
    align-items: stretch;
  }

  .macro-legend {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
  }

  .calorie-goal {
    max-width: none;
  }

  .plan-card-head h3 {
    font-size: 0.9rem;
  }

  .meal-breakdown .mb-macro {
    padding-left: 6px;
  }

  /* Home page: let the chart + tracker breathe on small screens */
  .chart-labels-spacer {
    width: 64px;
    min-width: 64px;
  }

  .tracker-tab {
    padding: 10px 14px;
    font-size: 0.72rem;
  }

  .modal {
    padding: 18px;
  }
}

@media (max-width: 400px) {
  .class-grid,
  .deficit-grid {
    grid-template-columns: 1fr;
  }

  .target-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .target-actions .plan-apply {
    text-align: center;
  }
}
```
