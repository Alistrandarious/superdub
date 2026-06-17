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

interface WeeklyActivity {
  id: string;
  name: string;
  sessionsPerWeek: number;
  minutesPerSession: number;
  intensity: 'light' | 'moderate' | 'hard';
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
const GYM_MET: Record<string, number> = { light: 4, moderate: 6, hard: 8 };

function ageFromDob(dob: string): number {
  if (!dob) return 0;
  const born = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const m = today.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < born.getDate())) age--;
  return Math.max(0, age);
}

function deduplicateDays(days: any[]): any[] {
  const map: Record<string, any> = {};
  for (const d of days) {
    const existing = map[d.day];
    if (!existing || (parseFloat(d.weight) > 0 && !(parseFloat(existing.weight) > 0))) {
      map[d.day] = d;
    }
  }
  return Object.values(map);
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

// ── PlanSummaryCard ───────────────────────────────────────────────────────────
const PlanSummaryCard: React.FC<{
  currentWeight: number;
  goalWeight: number;
  lossPerWeek: number;
  goal: 'cut' | 'maintain' | 'bulk';
  target: MacroSet;
  maintenance: number;
  onEdit: () => void;
}> = ({ currentWeight, goalWeight, lossPerWeek, goal, target, maintenance, onEdit }) => {
  const isBulk = goal === 'bulk';
  const diff = currentWeight > 0 && goalWeight > 0 ? Math.abs(currentWeight - goalWeight) : null;
  const weeksToGoal = diff && lossPerWeek > 0 ? Math.ceil(diff / lossPerWeek) : null;
  const macroCalories = target.protein * 4 + target.carbs * 4 + target.fats * 9;
  const deficit = maintenance > 0 ? macroCalories - maintenance : 0;

  const goalMeta = {
    cut:      { icon: '🔥', label: 'Cut',      color: '#ff6b6b' },
    maintain: { icon: '⚖️', label: 'Maintain', color: '#30d158' },
    bulk:     { icon: '💪', label: 'Bulk',      color: '#00e5ff' },
  }[goal];

  return (
    <div className="diet-section psc-card" style={{ '--psc-accent': goalMeta.color } as any}>
      <div className="psc-accent-bar" style={{ background: `linear-gradient(90deg, ${goalMeta.color}cc, ${goalMeta.color}44)` }} />

      <div className="psc-header">
        <span className="psc-badge" style={{ color: goalMeta.color, background: goalMeta.color + '18', borderColor: goalMeta.color + '44' }}>
          {goalMeta.icon} {goalMeta.label}
        </span>
        {weeksToGoal && (
          <span className="psc-eta">~{weeksToGoal} {weeksToGoal === 1 ? 'week' : 'weeks'} to goal</span>
        )}
        <button className="psc-edit-btn" onClick={onEdit}>Edit →</button>
      </div>

      <div className="psc-journey">
        <div className="psc-wblock">
          <span className="psc-wlabel">NOW</span>
          <span className="psc-wval">{currentWeight > 0 ? currentWeight.toFixed(1) : '—'}</span>
          <span className="psc-wunit">kg</span>
        </div>
        <div className="psc-journey-mid">
          {diff !== null ? (
            <>
              <div className="psc-journey-track">
                <div className="psc-jdot psc-jdot--start" />
                <div className="psc-jline" style={{ background: `linear-gradient(90deg, #ffffff25, ${goalMeta.color}88)` }} />
                <div className="psc-jdot psc-jdot--end" style={{ background: goalMeta.color, boxShadow: `0 0 8px ${goalMeta.color}88` }} />
              </div>
              <div className="psc-journey-diff">
                {isBulk ? '+' : '−'}{diff.toFixed(1)} kg
                {lossPerWeek > 0 && <span className="psc-journey-rate"> · {lossPerWeek} kg/wk</span>}
              </div>
            </>
          ) : (
            <div className="psc-journey-empty">Set goal weight in Profile →</div>
          )}
        </div>
        <div className="psc-wblock psc-wblock--goal">
          <span className="psc-wlabel">GOAL</span>
          <span className="psc-wval" style={{ color: goalMeta.color }}>{goalWeight > 0 ? goalWeight.toFixed(1) : '—'}</span>
          <span className="psc-wunit">kg</span>
        </div>
      </div>

      <div className="psc-cal-strip">
        <div className="psc-cal-item">
          <span className="psc-cal-num">{macroCalories.toLocaleString()}</span>
          <span className="psc-cal-lbl">target kcal</span>
        </div>
        {maintenance > 0 && (
          <>
            <div className="psc-cal-sep" />
            <div className="psc-cal-item">
              <span className="psc-cal-num">{maintenance.toLocaleString()}</span>
              <span className="psc-cal-lbl">maintenance</span>
            </div>
            <div className="psc-cal-sep" />
            <div className="psc-cal-item">
              <span className="psc-cal-num" style={{ color: deficit < 0 ? '#30d158' : deficit > 0 ? '#ff453a' : '#888' }}>
                {deficit === 0 ? '±0' : `${deficit > 0 ? '+' : ''}${deficit.toLocaleString()}`}
              </span>
              <span className="psc-cal-lbl">daily {deficit < 0 ? 'deficit' : deficit > 0 ? 'surplus' : 'balance'}</span>
            </div>
          </>
        )}
      </div>

      <div className="psc-macro-bar">
        {[
          { val: target.protein, lbl: 'Protein', color: '#ff6ec7' },
          { val: target.carbs,   lbl: 'Carbs',   color: '#00e5ff' },
          { val: target.fats,    lbl: 'Fats',     color: '#ffd60a' },
        ].map(m => (
          <div key={m.lbl} className="psc-mc" style={{ borderColor: m.color + '30' }}>
            <span className="psc-mc-val" style={{ color: m.color }}>{m.val}g</span>
            <span className="psc-mc-lbl">{m.lbl}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function localYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isoToDDMM(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// ── WeightSparkline ───────────────────────────────────────────────────────────
const WeightSparkline: React.FC<{
  allTrackerDays: any[];
  currentWeight: number;
  goalWeight: number;
  lossPerWeek: number;
}> = ({ allTrackerDays, currentWeight, goalWeight, lossPerWeek }) => {
  const isBulk = goalWeight > currentWeight && currentWeight > 0;
  const now = new Date();

  const dow = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  mon.setHours(0, 0, 0, 0);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    return localYMD(d);
  });

  const weekData = weekDays.map((iso, i) => {
    const ddmm = isoToDDMM(iso);
    const found = allTrackerDays.find((d: any) => d.day === ddmm);
    const actual = found && parseFloat(found.weight) > 0 ? parseFloat(found.weight) : undefined;
    const direction = isBulk ? 1 : -1;
    const expected = currentWeight > 0 && lossPerWeek > 0
      ? parseFloat((currentWeight + direction * (lossPerWeek / 7) * i).toFixed(2))
      : undefined;
    return { label: DAY_SHORT[i], actual, expected };
  });

  const histPts: { x: number; y: number }[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const ddmm = isoToDDMM(localYMD(d));
    const found = allTrackerDays.find((day: any) => day.day === ddmm);
    if (found && parseFloat(found.weight) > 0)
      histPts.push({ x: 27 - i, y: parseFloat(found.weight) });
  }

  const reg = linearReg(histPts);
  const weeklyRate = reg?.weeklyRate ?? null;

  let insightLevel: 'good' | 'great' | 'behind' | 'nodata' = 'nodata';
  let insightMsg = 'Log your weight for a few more days to unlock your trend analysis.';

  if (lossPerWeek <= 0) {
    insightMsg = 'Set a goal weight and weekly target in Profile to see your progress prediction.';
  } else if (histPts.length >= 3 && weeklyRate !== null) {
    if (isBulk) {
      const actualGain = weeklyRate;
      if (actualGain >= lossPerWeek + 0.1) {
        insightLevel = 'behind';
        insightMsg = `Gaining ${actualGain.toFixed(2)} kg/week — faster than your ${lossPerWeek} kg target. Slow bulk means more muscle, less fat. Check your surplus.`;
      } else if (actualGain >= lossPerWeek - 0.1) {
        insightLevel = 'great';
        insightMsg = `Right on track — gaining ${actualGain.toFixed(2)} kg/week matches your ${lossPerWeek} kg bulk target. Keep training heavy and hitting your protein.`;
      } else if (actualGain >= 0.05) {
        insightLevel = 'good';
        insightMsg = `Gaining ${actualGain.toFixed(2)} kg/week vs your ${lossPerWeek} kg target. A little more food or one extra gym session could close the gap.`;
      } else {
        insightLevel = 'behind';
        insightMsg = `Minimal weight change. To bulk, you need a consistent calorie surplus — make sure you're hitting your kcal target every day.`;
      }
    } else {
      const actualLoss = -weeklyRate;
      if (actualLoss >= lossPerWeek + 0.15) {
        insightLevel = 'great';
        insightMsg = `Losing ${actualLoss.toFixed(2)} kg/week — ahead of your ${lossPerWeek} kg target. Great progress! Keep hitting your protein to protect muscle.`;
      } else if (actualLoss >= lossPerWeek - 0.1) {
        insightLevel = 'good';
        insightMsg = `Right on track — ${actualLoss.toFixed(2)} kg/week matches your ${lossPerWeek} kg target. Keep the routine going.`;
      } else if (actualLoss >= 0.05) {
        insightLevel = 'behind';
        const gap = Math.round((lossPerWeek - actualLoss) * 7700 / 7);
        insightMsg = `Losing ${actualLoss.toFixed(2)} kg/week vs your ${lossPerWeek} kg target. Tighten up ~${gap} kcal/day to close the gap.`;
      } else {
        insightLevel = 'behind';
        insightMsg = `Minimal change recently. Consistency beats perfection — focus on hitting your calorie and protein targets this week.`;
      }
    }
  }

  const hasAny = weekData.some(d => d.actual !== undefined);
  const allVals = weekData.flatMap(d => [d.actual, d.expected].filter(v => v !== undefined) as number[]);
  const minW = allVals.length > 0 ? Math.floor(Math.min(...allVals) - 1) : 70;
  const maxW = allVals.length > 0 ? Math.ceil(Math.max(...allVals) + 1) : 90;

  return (
    <div className="diet-section weight-sparkline-card">
      <h2 className="diet-heading">Weight This Week</h2>

      {hasAny || weekData.some(d => d.expected !== undefined) ? (
        <ResponsiveContainer width="100%" height={150}>
          <ComposedChart data={weekData} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
            <XAxis dataKey="label" tick={{ fill: '#555', fontSize: 11 }} axisLine={false} tickLine={false} />
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
        <p className="diet-hint" style={{ marginTop: 8 }}>No weight data this week — log your morning weight via the daily check-in.</p>
      )}

      <div className={`insight-box insight-${insightLevel}`}>{insightMsg}</div>

      {weeklyRate !== null && (
        <div className="trend-stats">
          <div className="trend-stat">
            <span className="trend-stat-label">28-day trend</span>
            <span className="trend-stat-val">{(-weeklyRate) >= 0 ? '−' : '+'}{Math.abs(weeklyRate).toFixed(2)} kg/wk</span>
          </div>
          <div className="trend-stat">
            <span className="trend-stat-label">Your target</span>
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

// ── ActivityTargetsCard ───────────────────────────────────────────────────────
const ActivityTargetsCard: React.FC<{
  currentWeight: number;
  maintenance: number;
  macroCalories: number;
  lossPerWeek: number;
  goal: 'cut' | 'maintain' | 'bulk';
  stepTarget: number;
  yesterdaySteps: number | null;
  gymSessionsPerWeek: number;
  gymIntensity: 'light' | 'moderate' | 'hard';
  gymMinutes: number;
  weeklyActivities: WeeklyActivity[];
  onSaved: (steps: number) => void;
}> = ({
  currentWeight, maintenance, macroCalories, lossPerWeek, goal,
  stepTarget, yesterdaySteps, gymSessionsPerWeek, gymIntensity, gymMinutes,
  weeklyActivities, onSaved,
}) => {
  const met = GYM_MET[gymIntensity] ?? 6;
  const gymBurnPerSession = currentWeight > 0 && gymSessionsPerWeek > 0
    ? Math.round(met * currentWeight * gymMinutes / 60) : 0;
  const gymBurnPerDay = gymSessionsPerWeek > 0
    ? Math.round(gymSessionsPerWeek * gymBurnPerSession / 7) : 0;

  const activityBurnPerDay = weeklyActivities.reduce((sum, a) => {
    const aMet = GYM_MET[a.intensity] ?? 6;
    const bps = currentWeight > 0 ? Math.round(aMet * currentWeight * a.minutesPerSession / 60) : 0;
    return sum + Math.round(a.sessionsPerWeek * bps / 7);
  }, 0);

  const totalTrainingBurnPerDay = gymBurnPerDay + activityBurnPerDay;
  const kcalPerStep = currentWeight > 0 ? 0.04 * (currentWeight / 70) : 0.04;
  const stepTargetKcal = Math.round(stepTarget * kcalPerStep);

  const goalDeficit = goal === 'cut' && lossPerWeek > 0
    ? Math.round(lossPerWeek * 7700 / 7)
    : goal === 'bulk' && lossPerWeek > 0
    ? -Math.round(lossPerWeek * 7700 / 7)
    : 0;
  const foodDeficit = maintenance > 0 ? maintenance - macroCalories : 0;
  const gapKcal = goalDeficit - foodDeficit - totalTrainingBurnPerDay;
  const stepsNeeded = gapKcal > 0 ? Math.ceil(gapKcal / kcalPerStep) : 0;
  const alreadyCovered = gapKcal <= 0 && (goalDeficit !== 0 || goal === 'maintain') && maintenance > 0;

  const hasTraining = gymSessionsPerWeek > 0 || weeklyActivities.length > 0;

  return (
    <div className="diet-section atc-card">
      <h2 className="diet-heading">Activity Targets</h2>

      {hasTraining && (
        <div className="atc-training">
          <div className="atc-section-label">Training Burn</div>
          {gymSessionsPerWeek > 0 && (
            <div className="atc-burn-row">
              <div className="atc-burn-left">
                <span className="atc-burn-icon">🏋️</span>
                <div>
                  <div className="atc-burn-name">Gym</div>
                  <div className="atc-burn-detail">{gymSessionsPerWeek}×/week · {gymMinutes} min · {gymIntensity}</div>
                </div>
              </div>
              <div className="atc-burn-right">
                <span className="atc-burn-session">~{gymBurnPerSession.toLocaleString()} kcal/session</span>
                <span className="atc-burn-day">{gymBurnPerDay} kcal/day avg</span>
              </div>
            </div>
          )}
          {weeklyActivities.map(a => {
            const aMet = GYM_MET[a.intensity] ?? 6;
            const bps = currentWeight > 0 ? Math.round(aMet * currentWeight * a.minutesPerSession / 60) : 0;
            const bpd = Math.round(a.sessionsPerWeek * bps / 7);
            return (
              <div key={a.id} className="atc-burn-row">
                <div className="atc-burn-left">
                  <span className="atc-burn-icon">🏃</span>
                  <div>
                    <div className="atc-burn-name">{a.name}</div>
                    <div className="atc-burn-detail">{a.sessionsPerWeek}×/week · {a.minutesPerSession} min · {a.intensity}</div>
                  </div>
                </div>
                <div className="atc-burn-right">
                  <span className="atc-burn-session">~{bps.toLocaleString()} kcal/session</span>
                  <span className="atc-burn-day">{bpd} kcal/day avg</span>
                </div>
              </div>
            );
          })}
          {totalTrainingBurnPerDay > 0 && (
            <div className="atc-total-row">
              <span>Total training</span>
              <span className="atc-total-val">{totalTrainingBurnPerDay.toLocaleString()} kcal/day avg</span>
            </div>
          )}
        </div>
      )}

      {!hasTraining && (
        <div className="atc-no-training">
          <span>No training plan set.</span>
          <Link to="/profile" className="atc-set-link">Set it in Profile →</Link>
        </div>
      )}

      <div className="atc-steps">
        <div className="atc-section-label">Steps Today</div>
        {maintenance <= 0 ? (
          <p className="diet-hint">Complete your biographics in Profile to see personalised step targets.</p>
        ) : alreadyCovered ? (
          <div className="atc-covered">
            <div className="atc-covered-check" style={{ color: '#30d158' }}>✓</div>
            <div>
              <p className="atc-covered-main">Food{hasTraining ? ' + training' : ''} already covers your {goal} target.</p>
              <p className="atc-covered-sub">Every step is bonus burn — aim for {stepTarget.toLocaleString()} for health.</p>
            </div>
          </div>
        ) : (
          <div className="atc-steps-needed">
            <div className="atc-steps-big">{stepsNeeded > 0 ? stepsNeeded.toLocaleString() : stepTarget.toLocaleString()}</div>
            <div className="atc-steps-sub">
              {stepsNeeded > 0
                ? `steps to close the ${Math.round(Math.abs(gapKcal)).toLocaleString()} kcal gap`
                : `step target · ≈ ${stepTargetKcal.toLocaleString()} kcal`}
            </div>
          </div>
        )}
        <div className="atc-step-meta">
          <span>{stepTarget.toLocaleString()} step target · ≈ {stepTargetKcal.toLocaleString()} kcal</span>
        </div>
      </div>

      {yesterdaySteps !== null && (
        <div className="step-perf-yesterday">
          <div className="step-perf-bar-wrap">
            <div className="step-perf-bar">
              <div
                className="step-perf-fill"
                style={{
                  width: `${Math.min(100, (yesterdaySteps / stepTarget) * 100)}%`,
                  background: yesterdaySteps >= stepTarget ? '#30d158' : '#ff9f0a',
                }}
              />
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

// ── Diet page ─────────────────────────────────────────────────────────────────
const Diet: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [target, setTarget] = useState<MacroSet>(DEFAULT_TARGET);
  const [goal, setGoal] = useState<'cut' | 'maintain' | 'bulk'>('cut');
  const [stepTarget, setStepTarget] = useState(10000);
  const [yesterdaySteps, setYesterdaySteps] = useState<number | null>(null);
  const [allTrackerDays, setAllTrackerDays] = useState<any[]>([]);
  const [goalWeight, setGoalWeight] = useState(0);
  const [lossPerWeek, setLossPerWeek] = useState(0.5);
  const [gymSessionsPerWeek, setGymSessionsPerWeek] = useState(3);
  const [gymIntensity, setGymIntensity] = useState<'light' | 'moderate' | 'hard'>('moderate');
  const [gymMinutes, setGymMinutes] = useState(60);
  const [weeklyActivities, setWeeklyActivities] = useState<WeeklyActivity[]>([]);
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
      const unique = deduplicateDays(allDays);
      setAllTrackerDays(unique);

      const ws = weightSettingsData as any;
      if (ws.goalWeight) setGoalWeight(parseFloat(ws.goalWeight) || 0);
      if (ws.lossPerWeek) setLossPerWeek(parseFloat(ws.lossPerWeek) || 0.5);

      const yest = new Date(); yest.setDate(yest.getDate() - 1);
      const yestDDMM = `${String(yest.getDate()).padStart(2,'0')}/${String(yest.getMonth()+1).padStart(2,'0')}`;
      const yestDay = unique.find((d: any) => d.day === yestDDMM);
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

      const pa = profileData as any;
      if (pa.stepTarget) setStepTarget(Number(pa.stepTarget));
      if (pa.gymSessionsPerWeek != null) setGymSessionsPerWeek(Number(pa.gymSessionsPerWeek));
      if (pa.gymIntensity) setGymIntensity(pa.gymIntensity as 'light' | 'moderate' | 'hard');
      if (pa.gymMinutes) setGymMinutes(Number(pa.gymMinutes));
      if (Array.isArray(pa.weeklyActivities)) setWeeklyActivities(pa.weeklyActivities);

      setTarget(targetData as MacroSet);
      const s = settingsData as any;
      setGoal((s.goal as 'cut' | 'maintain' | 'bulk') ?? 'cut');
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const handler = () => {
      api.getTracker().then((td: any) => {
        const allDays: any[] = (td as any).days ?? [];
        const unique = deduplicateDays(allDays);
        setAllTrackerDays(unique);
        const yest = new Date(); yest.setDate(yest.getDate() - 1);
        const yestDDMM = `${String(yest.getDate()).padStart(2,'0')}/${String(yest.getMonth()+1).padStart(2,'0')}`;
        const yestDay = unique.find((d: any) => d.day === yestDDMM);
        if (yestDay?.steps != null) setYesterdaySteps(Number(yestDay.steps));
      }).catch(() => {});
    };
    window.addEventListener('superdub:tracker-updated', handler);
    return () => window.removeEventListener('superdub:tracker-updated', handler);
  }, []);

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
          <h1 className="title">Training Plan</h1>
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
        <PlanSummaryCard
          currentWeight={kg}
          goalWeight={goalWeight}
          lossPerWeek={lossPerWeek}
          goal={goal}
          target={target}
          maintenance={maintenance}
          onEdit={() => navigate('/profile')}
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
          goal={goal}
          stepTarget={stepTarget}
          yesterdaySteps={yesterdaySteps}
          gymSessionsPerWeek={gymSessionsPerWeek}
          gymIntensity={gymIntensity}
          gymMinutes={gymMinutes}
          weeklyActivities={weeklyActivities}
          onSaved={s => setYesterdaySteps(s)}
        />
      </div>
    </div>
  );
};

export default Diet;
