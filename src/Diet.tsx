import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './App.css';
import { api } from './api';
import SuperdubHeader from './SuperdubHeader';
import AdaptiveWeightPlanCard from './AdaptiveWeightPlanCard';
import WeightSparkline from './WeightSparkline';
import PlanGauge from './PlanGauge';
import { kcalPerStep } from './energy';
import { pageTheme, GROWTH, HEALTH } from './theme';
import { linearReg, localYMD, isoToDDMM, emaStep, sinceLastGap } from './weightMath';
import { useSoftened } from './LapseBanner';
import { DumbbellIc, SlidersIc, RunIc } from './icons';

interface ProfileData {
  dob: string;
  heightCm: string;
  weightKg: string;
  sex: 'male' | 'female';
  activity: string;
  steps: string;
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
  dob: '', heightCm: '', weightKg: '', sex: 'male', activity: '1.55', steps: '',
};
const DEFAULT_TARGET: MacroSet = { calories: 2003, protein: 150, carbs: 200, fats: 67 };
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
        type="text" inputMode="numeric"
        placeholder={saved ? '✓ Saved!' : "Yesterday's steps…"}
        value={saved ? '' : val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        disabled={saved}
      />
      {!saved && <button className="step-logger-btn" onClick={submit} disabled={!val}>Save</button>}
    </div>
  );
};

// ── PlanSummaryCard (unused — inlined into Diet render) ──────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PlanSummaryCard: React.FC<{
  currentWeight: number;
  todayWeight: number | null;
  goalWeight: number;
  lossPerWeek: number;
  goal: 'cut' | 'maintain' | 'bulk';
  target: MacroSet;
  maintenance: number;
  gymSessionsPerWeek: number;
  gymIntensity: 'light' | 'moderate' | 'hard';
  weeklyActivities: WeeklyActivity[];
  onEdit: () => void;
}> = ({ currentWeight, todayWeight, goalWeight, lossPerWeek, goal, target, maintenance,
        gymSessionsPerWeek, gymIntensity, weeklyActivities, onEdit }) => {
  const GOAL_META: Record<string, { label: string; color: string }> = {
    cut:      { label: 'Fat Loss',    color: HEALTH },
    maintain: { label: 'Maintain',    color: HEALTH },
    bulk:     { label: 'Muscle Gain', color: GROWTH },
  };
  const meta = GOAL_META[goal] ?? GOAL_META.cut;
  const accent = meta.color;

  const displayWeight = todayWeight ?? currentWeight;
  const diff = displayWeight > 0 && goalWeight > 0 ? Math.abs(displayWeight - goalWeight) : null;
  const weeksToGoal = diff && lossPerWeek > 0 ? Math.ceil(diff / lossPerWeek) : null;
  const isBulk = goal === 'bulk';

  const targetKcal = target.calories;
  const deficit = maintenance > 0 ? targetKcal - maintenance : 0;

  const trainingParts: string[] = [];
  if (gymSessionsPerWeek > 0) trainingParts.push(`${gymSessionsPerWeek}× gym (${gymIntensity})`);
  weeklyActivities.slice(0, 2).forEach(a => trainingParts.push(a.name));
  if (weeklyActivities.length > 2) trainingParts.push(`+${weeklyActivities.length - 2} more`);

  return (
    <div style={{
      background: 'linear-gradient(150deg, #0c1220 0%, #0a0d18 100%)',
      border: `1px solid ${accent}22`,
      borderRadius: 18,
      overflow: 'hidden',
      fontFamily: 'inherit',
    }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px 12px' }}>
        <span style={{
          fontSize: '0.72rem', fontWeight: 700, color: accent,
          background: accent + '18', border: `1px solid ${accent}44`,
          borderRadius: 20, padding: '4px 12px', letterSpacing: '0.04em',
        }}>
          {meta.label}
        </span>
        {weeksToGoal && (
          <span style={{ fontSize: '0.72rem', color: '#666', flex: 1 }}>
            ~{weeksToGoal} {weeksToGoal === 1 ? 'week' : 'weeks'} to goal
          </span>
        )}
        <button onClick={onEdit} style={{
          marginLeft: 'auto', background: 'none', border: '1px solid #252532',
          color: '#888', padding: '5px 14px', borderRadius: 8, fontSize: '0.75rem',
          fontWeight: 600, cursor: 'pointer',
        }}>
          Edit →
        </button>
      </div>

      {/* Weight journey */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '4px 20px 20px' }}>
        {/* Current */}
        <div style={{ minWidth: 70 }}>
          <div style={{ fontSize: '0.58rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
            {todayWeight !== null ? 'Today' : 'Current'}
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#e0e4f0', lineHeight: 1 }}>
            {displayWeight > 0 ? displayWeight.toFixed(1) : '—'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#555', display: 'flex', alignItems: 'center', gap: 5 }}>
            kg
            {todayWeight !== null && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2FD27E', display: 'inline-block', boxShadow: '0 0 6px #2FD27E88' }} />
            )}
          </div>
        </div>

        {/* Arrow / diff */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 26 }}>
          {diff !== null ? (
            <>
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 0 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#2a3a4a', flexShrink: 0 }} />
                <div style={{ flex: 1, height: 2, background: `linear-gradient(90deg, #ffffff15, ${accent}60)` }} />
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: accent, flexShrink: 0, boxShadow: `0 0 8px ${accent}80` }} />
              </div>
              <div style={{ fontSize: '0.72rem', color: '#555', marginTop: 5, textAlign: 'center' }}>
                {isBulk ? '+' : '−'}{diff.toFixed(1)} kg
                {lossPerWeek > 0 && <span style={{ color: '#444' }}> · {lossPerWeek} kg/wk</span>}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '0.7rem', color: '#444', textAlign: 'center' }}>
              Set goal weight in Profile →
            </div>
          )}
        </div>

        {/* Goal */}
        <div style={{ minWidth: 70, textAlign: 'right' }}>
          <div style={{ fontSize: '0.58rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
            Goal
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: accent, lineHeight: 1 }}>
            {goalWeight > 0 ? goalWeight.toFixed(1) : '—'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#555' }}>kg</div>
        </div>
      </div>

      {/* Calorie strip */}
      <div style={{
        display: 'flex', background: 'rgba(0,0,0,0.3)',
        borderTop: '1px solid #111c28', borderBottom: '1px solid #111c28',
        padding: '14px 0',
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#dde', lineHeight: 1 }}>
            {targetKcal.toLocaleString()}
          </span>
          <span style={{ fontSize: '0.6rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            target kcal
          </span>
        </div>
        {maintenance > 0 && (
          <>
            <div style={{ width: 1, background: '#252532', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#dde', lineHeight: 1 }}>
                {maintenance.toLocaleString()}
              </span>
              <span style={{ fontSize: '0.6rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                maintenance
              </span>
            </div>
            <div style={{ width: 1, background: '#252532', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{
                fontSize: '1.1rem', fontWeight: 800, lineHeight: 1,
                color: deficit < 0 ? '#2FD27E' : deficit > 0 ? '#ff453a' : '#888',
              }}>
                {deficit === 0 ? '±0' : `${deficit > 0 ? '+' : ''}${deficit.toLocaleString()}`}
              </span>
              <span style={{ fontSize: '0.6rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {deficit < 0 ? 'deficit' : deficit > 0 ? 'surplus' : 'balance'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Training footer */}
      {trainingParts.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 20px 16px', borderTop: '1px solid #2A2D3A',
          fontSize: '0.72rem', color: '#555',
        }}>
          <DumbbellIc size={14} />
          <span>{trainingParts.join(' · ')}</span>
        </div>
      )}
    </div>
  );
};

// ── SmartAdjustCard — calories only; macros are gone ─────────────────────────
const SmartAdjustCard: React.FC<{
  goal: 'cut' | 'maintain' | 'bulk';
  lossPerWeek: number;
  allTrackerDays: any[];
  targetCalories: number;
  target: MacroSet;
  onApply: (newTarget: MacroSet) => void;
}> = ({ goal, lossPerWeek, allTrackerDays, targetCalories, target, onApply }) => {
  const [applied, setApplied] = useState(false);

  const now = new Date();
  const histPts: { x: number; y: number }[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const ddmm = isoToDDMM(localYMD(d));
    const found = allTrackerDays.find((day: any) => day.day === ddmm);
    if (found && parseFloat(found.weight) > 0)
      histPts.push({ x: 27 - i, y: parseFloat(found.weight) });
  }

  // Judge the run since the last real break, not the raw 28 days. Five weigh-ins
  // before a gap and two after is not seven days of evidence, and "Behind" drawn
  // through three weeks nobody logged is a verdict on nothing.
  const run = sinceLastGap(histPts);
  if (run.length < 7 || lossPerWeek <= 0 || goal === 'maintain') return null;

  const reg = linearReg(run);
  if (!reg) return null;

  const actualWeeklyKg = reg.weeklyRate;
  const targetWeeklyKg = goal === 'cut' ? -lossPerWeek : lossPerWeek;
  const deviation = actualWeeklyKg - targetWeeklyKg;
  const THRESHOLD = 0.12;

  if (Math.abs(deviation) < THRESHOLD) return null;

  const calorieAdj = Math.round(-deviation * 7700 / 7);
  const cappedAdj = Math.max(-500, Math.min(500, calorieAdj));
  const newCalories = Math.max(1200, Math.min(5000, targetCalories + cappedAdj));

  if (newCalories === targetCalories) return null;

  // Calories-only: keep the stored macro fields untouched (legacy data), just
  // move the calorie target.
  const buildTarget = (): MacroSet => ({ ...target, calories: newCalories });

  const isBehind = goal === 'cut'
    ? actualWeeklyKg > targetWeeklyKg   // cutting but not losing fast enough
    : actualWeeklyKg < targetWeeklyKg;  // bulking but not gaining fast enough

  // Plain, real-direction display: + = gaining, − = losing (no sign-flipping)
  const dirWord = actualWeeklyKg > 0.02 ? 'gaining' : actualWeeklyKg < -0.02 ? 'losing' : 'holding steady';
  const actualSigned = `${actualWeeklyKg > 0 ? '+' : ''}${actualWeeklyKg.toFixed(2)}`;
  const statusColor = isBehind ? '#FFD233' : '#2FD27E';
  const adjPhrase = cappedAdj < 0 ? `eat about ${Math.abs(cappedAdj)} fewer kcal a day` : `add about ${cappedAdj} kcal a day`;
  const explain = `Your weight is ${dirWord} ${Math.abs(actualWeeklyKg).toFixed(2)} kg/wk, but your goal is to ${goal === 'cut' ? 'lose' : 'gain'} ${lossPerWeek} kg/wk. ${isBehind ? `To get on track, ${adjPhrase}.` : `You're ahead of pace, so ${adjPhrase} to ease off.`}`;

  const handleApply = () => {
    const newTarget = buildTarget();
    onApply(newTarget);
    setApplied(true);
    setTimeout(() => setApplied(false), 3000);
  };

  return (
    <div className="diet-section sa-card">
      <div className="sa-header">
        <div className="sa-icon-wrap">
          <span className="sa-icon"><SlidersIc size={16} /></span>
        </div>
        <div className="sa-titles">
          <span className="sa-title">Adjust your target</span>
          <span className="sa-subtitle">From your {run.length}-day weight trend</span>
        </div>
        <span className="sa-status-pill" style={{ color: statusColor, borderColor: statusColor + '40', background: statusColor + '12' }}>
          {isBehind ? 'Behind' : 'Ahead'}
        </span>
      </div>

      <p className="sa-explain">{explain}</p>

      <div className="sa-rates">
        <div className="sa-rate">
          <span className="sa-rate-lbl">Goal</span>
          <span className="sa-rate-val">{goal === 'cut' ? '−' : '+'}{lossPerWeek} kg/wk</span>
        </div>
        <div className="sa-rate-arrow">→</div>
        <div className="sa-rate">
          <span className="sa-rate-lbl">Your trend</span>
          <span className="sa-rate-val" style={{ color: statusColor }}>{actualSigned} kg/wk</span>
          <span className="sa-rate-dir" style={{ color: statusColor }}>{dirWord}</span>
        </div>
      </div>

      <div className="sa-rec-box">
        <div className="sa-rec-row">
          <span className="sa-rec-lbl">Adjustment</span>
          <span className="sa-rec-val" style={{ color: cappedAdj < 0 ? '#FFD233' : '#2FD27E' }}>
            {cappedAdj > 0 ? '+' : ''}{cappedAdj} kcal/day
          </span>
        </div>
        <div className="sa-rec-row">
          <span className="sa-rec-lbl">New daily target</span>
          <span className="sa-rec-val">
            {newCalories.toLocaleString()} kcal
            <span className="sa-rec-was"> (was {targetCalories.toLocaleString()})</span>
          </span>
        </div>
      </div>

      <button className={`sa-apply-btn${applied ? ' sa-applied' : ''}`} onClick={handleApply} disabled={applied}>
        {applied ? '✓ Applied' : 'Apply Adjustment'}
      </button>
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
  const stepTargetKcal = Math.round(stepTarget * kcalPerStep(currentWeight));

  const goalDeficit = goal === 'cut' && lossPerWeek > 0
    ? Math.round(lossPerWeek * 7700 / 7)
    : goal === 'bulk' && lossPerWeek > 0
    ? -Math.round(lossPerWeek * 7700 / 7)
    : 0;
  const foodDeficit = maintenance > 0 ? maintenance - macroCalories : 0;
  const gapKcal = goalDeficit - foodDeficit - totalTrainingBurnPerDay;
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
                <span className="atc-burn-icon"><DumbbellIc size={16} /></span>
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
                  <span className="atc-burn-icon"><RunIc size={16} /></span>
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
        <div className="atc-section-label">Daily Step Goal</div>
        {maintenance <= 0 ? (
          <p className="diet-hint">Complete your biographics in Profile to see personalised step targets.</p>
        ) : (
          <>
            {/* Always headline the health-based step goal, never the tiny
                "steps left to close today's calorie gap" figure, which made the
                target look absurdly low when food + training already covered it. */}
            <div className="atc-steps-needed">
              <div className="atc-steps-big">{stepTarget.toLocaleString()}</div>
              <div className="atc-steps-sub">steps/day · ≈ {stepTargetKcal.toLocaleString()} kcal burn</div>
            </div>
            <div className="atc-step-context">
              {alreadyCovered
                ? `Food${hasTraining ? ' + training' : ''} already covers your ${goal} target, these steps are bonus burn.`
                : `You're ~${Math.round(Math.abs(gapKcal)).toLocaleString()} kcal short of today's ${goal} target, moving more helps close the gap.`}
            </div>
          </>
        )}
      </div>

      {yesterdaySteps !== null && (
        <div className="step-perf-yesterday">
          <div className="step-perf-bar-wrap">
            <div className="step-perf-bar">
              <div className="step-perf-fill" style={{
                width: `${Math.min(100, (yesterdaySteps / stepTarget) * 100)}%`,
                background: yesterdaySteps >= stepTarget ? '#2FD27E' : '#FFD233',
              }} />
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
  const softened = useSoftened();
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
  const [latestPlan, setLatestPlan] = useState<any | null>(null);
  const [planGoal, setPlanGoal] = useState<any | null>(null);
  // Adaptive Weight Plan card data — fetched here so it's part of the load gate
  // (the card itself is now a pure render, so it can't pop in after reveal).
  const [planStatusFull, setPlanStatusFull] = useState<any | null>(null);
  const [planCycle, setPlanCycle] = useState<any | null>(null);
  const [coachingMsg, setCoachingMsg] = useState<any | null>(null);
  const [lastEMAValue, setLastEMAValue] = useState<number | null>(null);

  useEffect(() => {
    // These feed the hero (plan goal drives the progress bars + latest plan card).
    // Run them alongside the main load and only reveal once everything has settled,
    // so the page appears fully formed instead of elements popping in one by one.
    const plans = api.getDietPlans().then((p: any[]) => { if (p.length > 0) setLatestPlan(p[0]); }).catch(() => {});
    const status = api.getPlanStatus().then((s: any) => { setPlanStatusFull(s); if (s?.active) setPlanGoal(s.goal); }).catch(() => {});
    // Adaptive plan card extras — also part of the gate so the card is complete on reveal.
    const cycle = api.runPlanCycle().then((c: any) => setPlanCycle(c)).catch(() => {});
    const coaching = api.getCoachingMessage().then((m: any) => setCoachingMsg(m)).catch(() => {});

    const main = Promise.all([
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

      // EMA (alpha=0.25) of logged weights → most-recent value, for the plan card.
      let ema: number | null = null;
      let prevDay: number | null = null;
      for (const d of unique) {
        const w = parseFloat(d.weight);
        if (!(w > 0)) continue;
        const [dd, mm] = String(d.day).split('/').map(Number);
        const dayNum = mm ? Math.round(Date.UTC(new Date().getFullYear(), mm - 1, dd) / 86400000) : null;
        ema = emaStep(ema, w, dayNum != null && prevDay != null ? dayNum - prevDay : 1);
        prevDay = dayNum;
      }
      setLastEMAValue(ema);

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
    }).catch(() => {});

    // Reveal only after the main data AND every card's data has settled.
    Promise.allSettled([main, plans, status, cycle, coaching]).then(() => setLoaded(true));
    const failsafe = setTimeout(() => setLoaded(true), 8000);
    return () => clearTimeout(failsafe);
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

  // Today's logged weight (if available)
  const today = new Date();
  const todayDDMM = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}`;
  const todayEntry = allTrackerDays.find((d: any) => d.day === todayDDMM);
  const todayWeight = todayEntry && parseFloat(todayEntry.weight) > 0 ? parseFloat(todayEntry.weight) : null;

  // Most recent tracker weight as fallback when profile.weightKg is not set
  const latestTrackerKg = (() => {
    for (let i = 0; i < 60; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ddmm = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
      const entry = allTrackerDays.find((x: any) => x.day === ddmm);
      if (entry && parseFloat(entry.weight) > 0) return parseFloat(entry.weight);
    }
    return 0;
  })();

  const profileKg = parseFloat(profile.weightKg) || 0;
  const kg = profileKg || latestTrackerKg;
  const cm = parseFloat(profile.heightCm) || 0;
  const age = ageFromDob(profile.dob) || 0;
  const activity = parseFloat(profile.activity) || 1.55;
  const steps = parseFloat(profile.steps) || 0;

  const bmr = kg > 0 && cm > 0 && age > 0
    ? profile.sex === 'male'
      ? 10 * kg + 6.25 * cm - 5 * age + 5
      : 10 * kg + 6.25 * cm - 5 * age - 161
    : 0;
  const tdee = bmr > 0 ? Math.round(bmr * activity) : 0;
  const walkBurn = steps > 0 && kg > 0 ? Math.round(steps * kcalPerStep(kg)) : 0;
  const maintenance = tdee + walkBurn;

  const handleSmartApply = (newTarget: MacroSet) => {
    setTarget(newTarget);
    api.updateDietTarget(newTarget).catch(() => {});
  };

  if (!loaded) {
    return (
      <div className="app flush" style={pageTheme(GROWTH, '33')}>
        <div className="sd-loader-wrap"><div className="sd-loader"><img className="sd-loader-logo" src="/superdub-logo.png" alt="" /></div></div>
      </div>
    );
  }

  const GOAL_COLORS: Record<string, string> = { cut: HEALTH, maintain: HEALTH, bulk: GROWTH };
  const GOAL_LABELS: Record<string, string> = { cut: 'Fat Loss', maintain: 'Maintain', bulk: 'Muscle Gain' };
  const accent = GOAL_COLORS[goal] ?? HEALTH;
  const goalText = GOAL_LABELS[goal] ?? 'Fat Loss';
  const displayWeight = todayWeight ?? kg;

  // Inputs for the weight-journey arc gauge (rendered by <PlanGauge/>). Prefer the
  // actual earliest logged weight as the start reference — the stored plan start
  // weight can be stale and misrepresent real progress.
  const firstLoggedW = (() => {
    const e = allTrackerDays.find((d: any) => parseFloat(d.weight) > 0);
    return e ? parseFloat(e.weight) : null;
  })();
  const startW = firstLoggedW ?? planGoal?.startWeight ?? null;
  // Single source of truth: the active Plan's target weight when a plan exists,
  // otherwise fall back to the simple Profile goal weight.
  const targetW = planGoal?.targetWeight ?? (goalWeight > 0 ? goalWeight : null);
  const weightDiff = displayWeight > 0 && targetW != null ? Math.abs(displayWeight - targetW) : null;
  const weeksLeft = weightDiff && lossPerWeek > 0 ? Math.ceil(weightDiff / lossPerWeek) : null;
  const startMs = planGoal?.startDate ? new Date(planGoal.startDate).getTime() : null;
  const targetMs = planGoal?.targetDate ? new Date(planGoal.targetDate).getTime() : null;

  return (
    <div className="app flush" style={pageTheme(GROWTH, '33')}>
      {/* ── Full scrollable content ── */}
      <div className="diet-content page-content">

      <SuperdubHeader />

      {/* Plan summary hero */}
      <section className="plan-hero">
        <div className="plan-hero-head">
          <span className="plan-goal-pill" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, boxShadow: `0 4px 16px ${accent}40` }}>
            {goalText}
          </span>
          {weeksLeft && <span className="plan-hero-eta">~{weeksLeft}w to goal</span>}
          <button className="plan-hero-edit" onClick={() => navigate(planGoal ? '/plan' : '/profile')}>Edit →</button>
        </div>

        {/* ── Weight journey arc gauge: start → goal, big current number at centre ── */}
        <PlanGauge
          displayWeight={displayWeight}
          startW={startW}
          targetW={targetW}
          startMs={startMs}
          targetMs={targetMs}
          accent={accent}
          weeksLeft={weeksLeft}
        />

      </section>

        {/* Adaptive Weight Plan, engine reasoning (moved here from Progress) */}
        <AdaptiveWeightPlanCard
          planStatus={planStatusFull}
          planCycle={planCycle}
          coachingMsg={coachingMsg}
          lastEMAValue={lastEMAValue}
          softened={softened}
        />

        {/* Weight This Week, prominent, with corridor + trend */}
        <WeightSparkline
          allTrackerDays={allTrackerDays}
          currentWeight={todayWeight ?? kg}
          goalWeight={targetW ?? goalWeight}
          lossPerWeek={lossPerWeek}
        />

        {/* Steps & activity, moved up; adaptive targets */}
        <ActivityTargetsCard
          currentWeight={todayWeight ?? kg}
          maintenance={maintenance}
          macroCalories={target.calories}
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

        {/* Today's Meal Plan */}
        {latestPlan && (
          <div className="plan-card">
            <div className="plan-card-head">
              <span className="plan-card-title">Today's Meal Plan</span>
              <span className="plan-card-sub">{latestPlan.label}</span>
            </div>
            {(latestPlan.meals ?? []).map((m: any) => (
              <div key={m.slot} className="plan-meal-row">
                <span className="plan-meal-slot">{m.slot}</span>
                <span className="plan-meal-name">{m.recipe?.title ?? 'Protein Shake'}</span>
                <span className="plan-meal-cal">{m.macros?.calories} kcal</span>
              </div>
            ))}
            <div className="plan-meal-total">
              <span className="plan-meal-total-lbl">Total</span>
              <span className="plan-meal-total-val">{latestPlan.totals?.calories} kcal</span>
            </div>
          </div>
        )}

        <SmartAdjustCard
          goal={goal}
          lossPerWeek={lossPerWeek}
          allTrackerDays={allTrackerDays}
          targetCalories={target.calories}
          target={target}
          onApply={handleSmartApply}
        />
      </div>
    </div>
  );
};

export default Diet;
