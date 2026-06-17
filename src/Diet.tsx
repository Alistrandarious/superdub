import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css';
import { api } from './api';

interface ProfileData {
  dob: string;
  heightCm: string;
  weightKg: string;
  sex: 'male' | 'female';
  activity: string;
  steps: string;
  vestKg: string;
}

function ageFromDob(dob: string): number {
  if (!dob) return 0;
  const born = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const m = today.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < born.getDate())) age--;
  return Math.max(0, age);
}

interface MacroSet {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

const DEFAULT_PROFILE: ProfileData = {
  dob: '', heightCm: '', weightKg: '', sex: 'male', activity: '1.55', steps: '', vestKg: '',
};

const DEFAULT_TARGET: MacroSet = { calories: 2003, protein: 150, carbs: 200, fats: 67 };

const STRIDE_M = 0.762;

function ddmmToDate(ddmm: string): Date {
  const [dd, mm] = ddmm.split('/').map(Number);
  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, mm - 1, dd);
  candidate.setHours(0, 0, 0, 0);
  if (candidate > now) year--;
  return new Date(year, mm - 1, dd);
}

function linearReg(pts: { x: number; y: number }[]): { slope: number; weeklyRate: number } | null {
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  const num = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const den = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (den === 0) return null;
  const slope = num / den;
  return { slope, weeklyRate: slope * 7 };
}

function yesterdayIso() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}


const StepLogger: React.FC<{ onSaved: (steps: number) => void }> = ({ onSaved }) => {
  const [val, setVal] = useState('');
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    const n = parseInt(val);
    if (isNaN(n) || n < 0) return;
    await api.updateTrackerDay(yesterdayIso(), { steps: n }).catch(() => {});
    onSaved(n);
    setSaved(true);
    setTimeout(() => { setSaved(false); setVal(''); }, 2000);
  };

  return (
    <div className="step-logger-row">
      <input
        className="step-logger-input"
        type="text"
        inputMode="numeric"
        placeholder={saved ? '✓ Saved!' : "Yesterday's steps…"}
        value={saved ? '' : val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        disabled={saved}
      />
      {!saved && (
        <button className="step-logger-btn" onClick={submit} disabled={!val}>Save</button>
      )}
    </div>
  );
};

// ── PlanSummaryCard ───────────────────────────────────────────
const PlanSummaryCard: React.FC<{
  currentWeight: number;
  goalWeight: number;
  lossPerWeek: number;
  goal: 'cut' | 'maintain' | 'bulk';
  target: MacroSet;
  maintenance: number;
  onEdit: () => void;
}> = ({ currentWeight, goalWeight, lossPerWeek, goal, target, maintenance, onEdit }) => {
  const isBulk = goal === 'bulk' || (goalWeight > 0 && currentWeight > 0 && goalWeight > currentWeight);
  const diff = currentWeight > 0 && goalWeight > 0 ? Math.abs(currentWeight - goalWeight) : null;
  const weeksToGoal = diff && lossPerWeek > 0 ? Math.ceil(diff / lossPerWeek) : null;
  const macroCalories = target.protein * 4 + target.carbs * 4 + target.fats * 9;

  const goalMeta = {
    cut:      { icon: '🔥', label: 'Cut',      color: '#ff6b6b' },
    maintain: { icon: '⚖️', label: 'Maintain', color: '#30d158' },
    bulk:     { icon: '💪', label: 'Bulk',      color: '#00e5ff' },
  }[goal];

  return (
    <div className="diet-section plan-summary-card">
      <div className="plan-summary-header">
        <h2 className="diet-heading" style={{ marginBottom: 0 }}>Your Plan</h2>
        <button className="plan-summary-edit-btn" onClick={onEdit}>Edit →</button>
      </div>

      <div className="plan-summary-weights">
        <div className="psw-col">
          <span className="psw-label">Current</span>
          <span className="psw-val">{currentWeight > 0 ? currentWeight.toFixed(1) : '—'}<span className="psw-unit"> kg</span></span>
        </div>
        <div className="psw-arrow">{isBulk ? '↗' : '↘'}</div>
        <div className="psw-col">
          <span className="psw-label">Goal</span>
          <span className="psw-val psw-goal">{goalWeight > 0 ? goalWeight.toFixed(1) : '—'}<span className="psw-unit"> kg</span></span>
        </div>
      </div>

      {diff !== null && (
        <div className="plan-summary-togo">
          {diff.toFixed(1)} kg to {isBulk ? 'gain' : 'lose'}
          {lossPerWeek > 0 && ` · ${lossPerWeek} kg/week`}
          {weeksToGoal && ` · ~${weeksToGoal} weeks`}
        </div>
      )}

      <div className="plan-summary-strategy">
        <span className="plan-summary-goal-badge" style={{ color: goalMeta.color, borderColor: goalMeta.color + '55' }}>
          {goalMeta.icon} {goalMeta.label}
        </span>
        {maintenance > 0 && (
          <span className="plan-summary-maint">
            {macroCalories.toLocaleString()} kcal · maint. {maintenance.toLocaleString()}
          </span>
        )}
      </div>

      <div className="plan-summary-macros">
        {[
          { val: target.protein, lbl: 'protein', color: '#ff6ec7' },
          { val: target.carbs,   lbl: 'carbs',   color: '#00e5ff' },
          { val: target.fats,    lbl: 'fats',     color: '#ffd60a' },
        ].map(m => (
          <div key={m.lbl} className="psm-chip">
            <span className="psm-val" style={{ color: m.color }}>{m.val}g</span>
            <span className="psm-lbl">{m.lbl}</span>
          </div>
        ))}
        <div className="psm-chip">
          <span className="psm-val">{macroCalories.toLocaleString()}</span>
          <span className="psm-lbl">kcal</span>
        </div>
      </div>
    </div>
  );
};

// ── WeightSparkline ───────────────────────────────────────────
const WeightSparkline: React.FC<{
  allTrackerDays: any[];
  currentWeight: number;
  goalWeight: number;
  lossPerWeek: number;
}> = ({ allTrackerDays, currentWeight, goalWeight, lossPerWeek }) => {
  const isBulk = goalWeight > currentWeight && currentWeight > 0;
  const now = new Date(); now.setHours(0, 0, 0, 0);

  // All days with weight logged, sorted oldest → newest
  const weightDays = allTrackerDays
    .filter(d => parseFloat(d.weight) > 0)
    .map(d => ({ day: d.day as string, weight: parseFloat(d.weight), date: ddmmToDate(d.day) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const firstDate = weightDays.length > 0 ? weightDays[0].date : null;
  const startWeight = weightDays.length > 0 ? weightDays[0].weight : 0;
  const direction = isBulk ? 1 : -1;

  // Build chart: one point per logged day + today (for expected line endpoint)
  const loggedSet = new Set(weightDays.map(d => d.day));
  const todayDDMM = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}`;

  const points = [...weightDays.map(d => ({ day: d.day, weight: d.weight, date: d.date }))];
  if (firstDate && !loggedSet.has(todayDDMM) && now > firstDate) {
    points.push({ day: todayDDMM, weight: 0, date: new Date(now) });
  }

  const chartData = points.map(p => {
    const daysSince = firstDate ? Math.round((p.date.getTime() - firstDate.getTime()) / 86400000) : 0;
    const actual = p.weight > 0 ? p.weight : undefined;
    const expected = lossPerWeek > 0 && startWeight > 0
      ? parseFloat((startWeight + direction * (lossPerWeek / 7) * daysSince).toFixed(2))
      : undefined;
    return { label: p.day, actual, expected };
  });

  // Regression over all available data for insight
  const histPts: { x: number; y: number }[] = weightDays.map((d, i) => ({ x: i, y: d.weight }));
  const reg = linearReg(histPts);
  const weeklyRate = reg ? reg.weeklyRate : null;

  let insightLevel: 'good' | 'great' | 'behind' | 'nodata' = 'nodata';
  let insightMsg = 'Log your weight for a few more days to unlock your trend analysis.';

  if (lossPerWeek <= 0) {
    insightMsg = 'Set a goal weight and weekly target in Profile to see your progress prediction.';
  } else if (histPts.length >= 3 && weeklyRate !== null) {
    if (isBulk) {
      const actualGain = weeklyRate;
      if (actualGain >= lossPerWeek + 0.1) {
        insightLevel = 'behind';
        insightMsg = `You're gaining ${actualGain.toFixed(2)} kg/week — faster than your ${lossPerWeek} kg target. Slow bulk means more muscle, less fat. Check your surplus.`;
      } else if (actualGain >= lossPerWeek - 0.1) {
        insightLevel = 'great';
        insightMsg = `Right on track — gaining ${actualGain.toFixed(2)} kg/week matches your ${lossPerWeek} kg bulk target. Keep training heavy and hitting your protein.`;
      } else if (actualGain >= 0.05) {
        insightLevel = 'good';
        insightMsg = `Gaining ${actualGain.toFixed(2)} kg/week vs your ${lossPerWeek} kg target. A little more food or one extra gym session could close the gap.`;
      } else {
        insightLevel = 'behind';
        insightMsg = `Minimal weight change detected. To bulk, you need a consistent calorie surplus — make sure you're hitting your kcal target every day.`;
      }
    } else {
      const actualLoss = -weeklyRate;
      if (actualLoss >= lossPerWeek + 0.15) {
        insightLevel = 'great';
        insightMsg = `You're losing ${actualLoss.toFixed(2)} kg/week — ahead of your ${lossPerWeek} kg target. Great progress! Make sure you're eating enough protein to protect muscle.`;
      } else if (actualLoss >= lossPerWeek - 0.1) {
        insightLevel = 'good';
        insightMsg = `Right on track — ${actualLoss.toFixed(2)} kg/week matches your ${lossPerWeek} kg target. Keep the routine going.`;
      } else if (actualLoss >= 0.05) {
        insightLevel = 'behind';
        const gap = Math.round((lossPerWeek - actualLoss) * 7700 / 7);
        insightMsg = `You're losing ${actualLoss.toFixed(2)} kg/week vs your ${lossPerWeek} kg target. Tighten up ~${gap} kcal/day to close the gap — you've got this.`;
      } else {
        insightLevel = 'behind';
        insightMsg = `Minimal change detected recently. That's okay — consistency beats perfection. Focus on hitting your calorie and protein targets this week.`;
      }
    }
  }

  const hasAny = chartData.some(d => d.actual !== undefined);
  const allVals = chartData.flatMap(d => [d.actual, d.expected].filter(v => v !== undefined) as number[]);
  const minW = allVals.length > 0 ? Math.floor(Math.min(...allVals) - 1) : 60;
  const maxW = allVals.length > 0 ? Math.ceil(Math.max(...allVals) + 1) : 100;
  const tickInterval = chartData.length > 10 ? Math.floor(chartData.length / 5) : 0;

  return (
    <div className="diet-section weight-sparkline-card">
      <h2 className="diet-heading">Weight Progress</h2>

      {hasAny || chartData.some(d => d.expected !== undefined) ? (
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
            <XAxis dataKey="label" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} interval={tickInterval} />
            <YAxis domain={[minW, maxW]} tick={{ fill: '#444', fontSize: 10 }} axisLine={false} tickLine={false} width={38} />
            <Tooltip
              contentStyle={{ background: '#0d0d1a', border: '1px solid #1e2a3a', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#888' }}
              formatter={((val: any, name: string) => [`${val} kg`, name === 'actual' ? 'Logged' : 'Expected']) as any}
            />
            <Line type="linear" dataKey="expected" stroke="#00e5ff33" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls name="expected" />
            <Line type="monotone" dataKey="actual" stroke="#00e5ff" strokeWidth={2.5} dot={{ fill: '#00e5ff', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls={false} name="actual" />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <p className="diet-hint" style={{ marginTop: 8 }}>No weight logged yet — use the morning check-in to start tracking.</p>
      )}

      <div className={`insight-box insight-${insightLevel}`}>{insightMsg}</div>

      {weeklyRate !== null && histPts.length >= 2 && (
        <div className="trend-stats">
          <div className="trend-stat">
            <span className="trend-stat-label">Trend</span>
            <span className="trend-stat-val">{weeklyRate >= 0 ? '+' : '−'}{Math.abs(weeklyRate).toFixed(2)} kg/wk</span>
          </div>
          <div className="trend-stat">
            <span className="trend-stat-label">Target</span>
            <span className="trend-stat-val">{isBulk ? '+' : '−'}{lossPerWeek} kg/wk</span>
          </div>
          <div className="trend-stat">
            <span className="trend-stat-label">Data points</span>
            <span className="trend-stat-val">{histPts.length} days</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ── ActivityTargetsCard ───────────────────────────────────────
const ActivityTargetsCard: React.FC<{
  currentWeight: number;
  maintenance: number;
  macroCalories: number;
  lossPerWeek: number;
  stepTarget: number;
  yesterdaySteps: number | null;
  onSaved: (steps: number) => void;
}> = ({ currentWeight, maintenance, macroCalories, lossPerWeek, stepTarget, yesterdaySteps, onSaved }) => {

  const targetDeficit = lossPerWeek > 0 ? Math.round(lossPerWeek * 7700 / 7) : 0;
  const dietDeficit = maintenance > 0 ? Math.max(0, maintenance - macroCalories) : 0;
  const exerciseGap = Math.max(0, targetDeficit - dietDeficit);

  const kcalPerStep = currentWeight > 0 ? 0.04 * (currentWeight / 70) : 0.04;
  const extraSteps = exerciseGap > 0 ? Math.round(exerciseGap / kcalPerStep) : 0;
  const recommendedSteps = Math.max(8000, stepTarget + extraSteps);
  const cardioBurn = exerciseGap > 0
    ? Math.max(0, exerciseGap - Math.round(stepTarget * kcalPerStep))
    : Math.round(200 * (currentWeight > 0 ? currentWeight / 80 : 1));

  return (
    <div className="diet-section activity-card">
      <h2 className="diet-heading">Activity Targets</h2>

      <div className="activity-row">
        <div className="activity-item">
          <span className="activity-label">Recommended steps</span>
          <span className="activity-value">{recommendedSteps.toLocaleString()}</span>
          <span className="activity-sub">≈ {Math.round(recommendedSteps * kcalPerStep)} kcal from walking</span>
        </div>
        <div className="activity-item">
          <span className="activity-label">Cardio to burn</span>
          <span className="activity-value">{cardioBurn > 0 ? cardioBurn.toLocaleString() : '—'} <span style={{ fontSize: '0.8rem' }}>kcal</span></span>
          <span className="activity-sub">{exerciseGap > 0 ? 'needed to hit weekly target' : 'bonus burn for faster results'}</span>
        </div>
      </div>

      {yesterdaySteps !== null && (
        <div className="step-perf-yesterday">
          <div className="step-perf-bar-wrap">
            <div className="step-perf-bar">
              <div className="step-perf-fill" style={{ width: `${Math.min(100, (yesterdaySteps / stepTarget) * 100)}%`, background: yesterdaySteps >= stepTarget ? '#30d158' : '#ff9f0a' }} />
            </div>
          </div>
          <div className="step-perf-row">
            <span className="step-perf-count">{yesterdaySteps.toLocaleString()} yesterday</span>
            <span className={`step-perf-badge${yesterdaySteps >= stepTarget ? ' hit' : ' miss'}`}>
              {yesterdaySteps >= stepTarget ? '✓ Target hit' : `${(stepTarget - yesterdaySteps).toLocaleString()} short`}
            </span>
          </div>
        </div>
      )}

      <StepLogger onSaved={onSaved} />
    </div>
  );
};

// ── WeeklyPlanCard ────────────────────────────────────────────
const WeeklyPlanCard: React.FC<{
  goal: 'cut' | 'maintain' | 'bulk';
  kg: number;
  stepTarget: number;
  gymSessions: number;
  onStepTargetChange: (val: number) => void;
  onGymSessionsChange: (val: number) => void;
}> = ({ goal, kg, stepTarget, gymSessions, onStepTargetChange, onGymSessionsChange }) => {
  const [localStep, setLocalStep] = useState(stepTarget);
  useEffect(() => setLocalStep(stepTarget), [stepTarget]);

  const proteinG = kg > 0 ? Math.round(kg * (goal === 'cut' ? 2.0 : goal === 'bulk' ? 1.8 : 1.7)) : 0;

  const gymAdvice = gymSessions === 0
    ? 'Try adding at least 2 gym sessions this week — resistance training protects muscle.'
    : gymSessions < 3
    ? `${gymSessions} gym session${gymSessions > 1 ? 's' : ''} this week is a solid start. Mix strength and cardio.`
    : gymSessions >= 5
    ? `${gymSessions} sessions this week — strong commitment. Make sure you're recovering well too.`
    : `${gymSessions} gym sessions keeps you on track. Prioritise compound lifts for best results.`;

  const stepAdvice = localStep >= 10000
    ? `Your ${Math.round(localStep / 1000)}k step target adds a great daily calorie burn.`
    : `Aim for 10,000 steps/day — the extra movement makes a real difference over time.`;

  const proteinAdvice = kg > 0
    ? ` Hit ${proteinG}g protein daily to ${goal === 'cut' ? 'protect muscle while cutting' : goal === 'bulk' ? 'fuel your muscle growth' : 'stay lean and strong'}.`
    : '';

  const goalLabel = goal === 'cut' ? 'cut fat' : goal === 'bulk' ? 'build muscle' : 'maintain your weight';

  return (
    <div className="diet-section weekly-plan-card">
      <h2 className="diet-heading">Weekly Plan</h2>

      <div className="weekly-plan-row">
        <span className="weekly-plan-label">Gym sessions this week</span>
        <div className="gym-stepper">
          <button className="gym-step-btn" onClick={() => onGymSessionsChange(Math.max(0, gymSessions - 1))}>−</button>
          <span className="gym-step-val">{gymSessions}<span className="gym-step-x">×</span></span>
          <button className="gym-step-btn" onClick={() => onGymSessionsChange(Math.min(7, gymSessions + 1))}>+</button>
        </div>
      </div>

      <div className="weekly-plan-row">
        <span className="weekly-plan-label">Daily step target</span>
        <div className="step-target-inline">
          <input
            className="step-target-input"
            type="text"
            inputMode="numeric"
            value={localStep}
            onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n)) setLocalStep(n); }}
            onBlur={() => onStepTargetChange(localStep)}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
          <span className="weekly-plan-unit">steps</span>
        </div>
      </div>

      <div className="plan-advice-box">
        <span className="plan-advice-icon">💡</span>
        <p className="plan-advice-text">To {goalLabel}: {gymAdvice} {stepAdvice}{proteinAdvice}</p>
      </div>
    </div>
  );
};

const Diet: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [target, setTarget] = useState<MacroSet>(DEFAULT_TARGET);
  const [goal, setGoal] = useState<'cut' | 'maintain' | 'bulk'>('cut');
  const [gymSessions, setGymSessions] = useState<number>(() => parseInt(localStorage.getItem('superdub.gym.sessions') || '3'));
  const [stepTarget, setStepTarget] = useState(10000);
  const [yesterdaySteps, setYesterdaySteps] = useState<number | null>(null);
  const [allTrackerDays, setAllTrackerDays] = useState<any[]>([]);
  const [goalWeight, setGoalWeight] = useState(0);
  const [lossPerWeek, setLossPerWeek] = useState(0.5);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getProfile(),
      api.getDietTarget(),
      api.getDietSettings(),
      api.getTracker(),
      api.getWeightSettings(),
    ]).then(([profileData, targetData, settingsData, trackerData, weightSettingsData]) => {
      const td = trackerData as any;
      const allDays: any[] = td.days ?? [];
      setAllTrackerDays(allDays);
      const ws = weightSettingsData as any;
      if (ws.goalWeight) setGoalWeight(parseFloat(ws.goalWeight) || 0);
      if (ws.lossPerWeek) setLossPerWeek(parseFloat(ws.lossPerWeek) || 0.5);

      // Yesterday's steps — tracker stores days in DD/MM format
      const yest = new Date(); yest.setDate(yest.getDate() - 1);
      const yestDDMM = `${String(yest.getDate()).padStart(2,'0')}/${String(yest.getMonth()+1).padStart(2,'0')}`;
      const yestDay = allDays.find((d: any) => d.day === yestDDMM);
      if (yestDay?.steps != null) setYesterdaySteps(Number(yestDay.steps));

      const p = profileData as ProfileData & { name: string };
      setProfile({
        dob: p.dob ?? '',
        heightCm: p.heightCm ?? '',
        weightKg: p.weightKg ?? '',
        sex: p.sex ?? 'male',
        activity: p.activity ?? '1.55',
        steps: p.steps ?? '',
        vestKg: p.vestKg ?? '',
      });
      setTarget(targetData as MacroSet);
      const s = settingsData as any;
      setGoal((s.goal as 'cut' | 'maintain' | 'bulk') ?? 'cut');
      const pa = profileData as any;
      if (pa.stepTarget) setStepTarget(Number(pa.stepTarget));
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  // Derived
  const macroCalories = target.protein * 4 + target.carbs * 4 + target.fats * 9;

  const kg = parseFloat(profile.weightKg) || 0;
  const cm = parseFloat(profile.heightCm) || 0;
  const age = ageFromDob(profile.dob) || 0;
  const activity = parseFloat(profile.activity) || 1.55;
  const steps = parseFloat(profile.steps) || 0;
  const vestKg = parseFloat(profile.vestKg) || 0;

  const bmr = kg > 0 && cm > 0 && age > 0
    ? profile.sex === 'male'
      ? 10 * kg + 6.25 * cm - 5 * age + 5
      : 10 * kg + 6.25 * cm - 5 * age - 161
    : 0;
  const tdee = bmr > 0 ? Math.round(bmr * activity) : 0;
  const walkKm = steps * STRIDE_M / 1000;
  const walkBurn = steps > 0 && kg > 0 ? Math.round(walkKm * (kg + vestKg) * 0.5) : 0;
  const maintenance = tdee + walkBurn;

  if (!loaded) {
    return (
      <div className="app" style={{ '--theme': '#00e5ff', '--theme-dim': '#00e5ff66', '--theme-glow': '#00e5ff33' } as React.CSSProperties}>
        <header className="header">
          <div className="header-left"><Link to="/" className="back-link">← Back</Link></div>
          <h1 className="title">Macro Split & Performance</h1>
        </header>
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '4rem', color: '#00e5ff' }}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="app" style={{ '--theme': '#00e5ff', '--theme-dim': '#00e5ff66', '--theme-glow': '#00e5ff33' } as React.CSSProperties}>
      <header className="header">
        <div className="header-left">
          <Link to="/" className="back-link">← Back</Link>
        </div>
        <h1 className="title">Training Plan</h1>
      </header>

      <div className="diet-content page-content">

        {(<>

        <PlanSummaryCard
          currentWeight={kg}
          goalWeight={goalWeight}
          lossPerWeek={lossPerWeek}
          goal={goal}
          target={target}
          maintenance={maintenance}
          onEdit={() => navigate('/profile')}
        />

        {/* Gym sessions + step target + personalised advice */}
        <WeeklyPlanCard
          goal={goal}
          kg={kg}
          stepTarget={stepTarget}
          gymSessions={gymSessions}
          onStepTargetChange={val => {
            setStepTarget(val);
            api.updateProfile({ stepTarget: val }).catch(() => {});
          }}
          onGymSessionsChange={val => {
            setGymSessions(val);
            localStorage.setItem('superdub.gym.sessions', String(val));
          }}
        />

        <WeightSparkline
          allTrackerDays={allTrackerDays}
          currentWeight={kg}
          goalWeight={goalWeight}
          lossPerWeek={lossPerWeek}
        />

        <ActivityTargetsCard
          currentWeight={kg}
          maintenance={maintenance}
          macroCalories={macroCalories}
          lossPerWeek={lossPerWeek}
          stepTarget={stepTarget}
          yesterdaySteps={yesterdaySteps}
          onSaved={steps => setYesterdaySteps(steps)}
        />

        </>)}


      </div>
    </div>
  );
};

export default Diet;
