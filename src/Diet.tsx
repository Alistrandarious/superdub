import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css';
import { api } from './api';
import AdaptiveWeightPlanCard from './AdaptiveWeightPlanCard';

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

function linearReg(pts: { x: number; y: number }[]): { slope: number; weeklyRate: number; intercept: number } | null {
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  const num = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const den = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (den === 0) return null;
  const slope = num / den;
  return { slope, weeklyRate: slope * 7, intercept: my - slope * mx };
}

function localYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isoToDDMM(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
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
  const GOAL_META: Record<string, { icon: string; label: string; color: string }> = {
    cut:      { icon: '🔥', label: 'Fat Loss',  color: '#2FD27E' },
    maintain: { icon: '⚖️', label: 'Maintain',  color: '#2FD27E' },
    bulk:     { icon: '💪', label: 'Muscle Gain', color: '#2E8BFF' },
  };
  const meta = GOAL_META[goal] ?? GOAL_META.cut;
  const accent = meta.color;

  const displayWeight = todayWeight ?? currentWeight;
  const diff = displayWeight > 0 && goalWeight > 0 ? Math.abs(displayWeight - goalWeight) : null;
  const weeksToGoal = diff && lossPerWeek > 0 ? Math.ceil(diff / lossPerWeek) : null;
  const isBulk = goal === 'bulk';

  const macroCalories = target.protein * 4 + target.carbs * 4 + target.fats * 9;
  const deficit = maintenance > 0 ? macroCalories - maintenance : 0;

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
      {/* Accent bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${accent}, ${accent}33)` }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px 12px' }}>
        <span style={{
          fontSize: '0.72rem', fontWeight: 700, color: accent,
          background: accent + '18', border: `1px solid ${accent}44`,
          borderRadius: 20, padding: '4px 12px', letterSpacing: '0.04em',
        }}>
          {meta.icon} {meta.label}
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
            {macroCalories.toLocaleString()}
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

      {/* Macro chips */}
      <div style={{ display: 'flex', gap: 8, padding: '14px 20px 18px' }}>
        {[
          { val: target.protein, lbl: 'Protein', color: '#ff6ec7' },
          { val: target.carbs,   lbl: 'Carbs',   color: '#2E8BFF' },
          { val: target.fats,    lbl: 'Fats',     color: '#ffd60a' },
        ].map(m => (
          <div key={m.lbl} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'rgba(255,255,255,0.03)', border: `1px solid ${m.color}28`,
            borderRadius: 10, padding: '10px 8px', gap: 3,
          }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: m.color, lineHeight: 1 }}>{m.val}g</span>
            <span style={{ fontSize: '0.58rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.lbl}</span>
          </div>
        ))}
      </div>

      {/* Training footer */}
      {trainingParts.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 20px 16px', borderTop: '1px solid #2A2D3A',
          fontSize: '0.72rem', color: '#555',
        }}>
          <span style={{ fontSize: '0.9rem' }}>🏋️</span>
          <span>{trainingParts.join(' · ')}</span>
        </div>
      )}
    </div>
  );
};

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DayCircleTick = (props: any) => {
  const { x, y, payload, doneFlags } = props;
  const letter = (payload.value as string)?.[0] ?? '';
  const done = Array.isArray(doneFlags) ? !!doneFlags[payload.index] : false;
  return (
    <g transform={`translate(${x},${y + 16})`}>
      <circle r={10} fill={done ? '#2FD27E' : '#2A2D3A'} stroke={done ? '#2FD27E' : '#252532'} strokeWidth={1} />
      <text textAnchor="middle" dominantBaseline="central" fill={done ? '#06210F' : '#555'} fontSize={10} fontWeight={700}>
        {letter}
      </text>
    </g>
  );
};

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

  // 28-day history → linear-reg trend + an EMA(α=0.25) smoothed series,
  // mirroring the Progress weight chart logic.
  const histPts: { x: number; y: number }[] = [];
  const emaByDDMM: Record<string, number> = {};
  let emaAcc: number | null = null;
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const ddmm = isoToDDMM(localYMD(d));
    const found = allTrackerDays.find((day: any) => day.day === ddmm);
    const w = found ? parseFloat(found.weight) : NaN;
    if (w > 0) {
      histPts.push({ x: 27 - i, y: w });
      emaAcc = emaAcc === null ? w : 0.25 * w + 0.75 * emaAcc;
      emaByDDMM[ddmm] = parseFloat(emaAcc.toFixed(2));
    }
  }

  const reg = linearReg(histPts);
  const weeklyRate = reg?.weeklyRate ?? null;

  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const ZONE_HALF = 0.75; // ±0.75 kg safe corridor around the ideal weekly path
  const weekData = weekDays.map((iso, i) => {
    const ddmm = isoToDDMM(iso);
    const found = allTrackerDays.find((d: any) => d.day === ddmm);
    const actual = found && parseFloat(found.weight) > 0 ? parseFloat(found.weight) : undefined;
    const ema = emaByDDMM[ddmm];
    const direction = isBulk ? 1 : -1;
    const expected = currentWeight > 0 && lossPerWeek > 0
      ? parseFloat((currentWeight + direction * (lossPerWeek / 7) * i).toFixed(2))
      : undefined;
    // Trendline: the 28-day regression evaluated at this day's position in that window
    const dayDate = new Date(iso + 'T00:00:00');
    const daysFromToday = Math.round((todayStart.getTime() - dayDate.getTime()) / 86400000);
    const x = 27 - daysFromToday;
    const trend = reg ? parseFloat((reg.intercept + reg.slope * x).toFixed(2)) : undefined;
    // Corridor band around the ideal path
    const zoneLow = expected !== undefined ? parseFloat((expected - ZONE_HALF).toFixed(2)) : undefined;
    const zoneBand = expected !== undefined ? ZONE_HALF * 2 : undefined;
    const zoneHigh = expected !== undefined ? parseFloat((expected + ZONE_HALF).toFixed(2)) : undefined;
    // "Done" = logged that day (weight or a completed habit), and not in the future
    const isFuture = dayDate.getTime() > todayStart.getTime();
    const done = !isFuture && !!found && (
      (parseFloat(found.weight) > 0) ||
      (found.habits && Object.values(found.habits).some((v: any) => v === true))
    );
    return { label: DAY_SHORT[i], actual, expected, ema, emaHalo: ema, trend, zoneLow, zoneBand, zoneHigh, done };
  });
  const weekDone = weekData.map(d => d.done);

  let insightLevel: 'good' | 'great' | 'behind' | 'nodata' = 'nodata';
  let insightMsg = 'Log your weight for a few more days to unlock your trend analysis.';

  if (lossPerWeek <= 0) {
    insightMsg = 'Set a goal weight and weekly target in Profile to see your progress prediction.';
  } else if (histPts.length >= 3 && weeklyRate !== null) {
    if (isBulk) {
      const g = weeklyRate;
      if (g >= lossPerWeek + 0.1) { insightLevel = 'behind'; insightMsg = `Gaining ${g.toFixed(2)} kg/week — faster than your ${lossPerWeek} kg target. Slow bulk means more muscle, less fat. Check your surplus.`; }
      else if (g >= lossPerWeek - 0.1) { insightLevel = 'great'; insightMsg = `Right on track — gaining ${g.toFixed(2)} kg/week matches your ${lossPerWeek} kg bulk target.`; }
      else if (g >= 0.05) { insightLevel = 'good'; insightMsg = `Gaining ${g.toFixed(2)} kg/week vs your ${lossPerWeek} kg target. A little more food or one extra gym session could close the gap.`; }
      else { insightLevel = 'behind'; insightMsg = `Minimal weight change. To bulk, you need a consistent calorie surplus every day.`; }
    } else {
      const l = -weeklyRate;
      if (l >= lossPerWeek + 0.15) { insightLevel = 'great'; insightMsg = `Losing ${l.toFixed(2)} kg/week — ahead of your ${lossPerWeek} kg target. Keep hitting protein to protect muscle.`; }
      else if (l >= lossPerWeek - 0.1) { insightLevel = 'good'; insightMsg = `Right on track — ${l.toFixed(2)} kg/week matches your ${lossPerWeek} kg target. Keep the routine going.`; }
      else if (l >= 0.05) { insightLevel = 'behind'; const gap = Math.round((lossPerWeek - l) * 7700 / 7); insightMsg = `Losing ${l.toFixed(2)} kg/week vs your ${lossPerWeek} kg target. Tighten up ~${gap} kcal/day to close the gap.`; }
      else { insightLevel = 'behind'; insightMsg = `Minimal change recently. Focus on hitting your calorie and protein targets this week.`; }
    }
  }

  const hasAny = weekData.some(d => d.actual !== undefined);
  // Tight domain from the real weight line only (logged + smoothed) so the small
  // weekly change is visible — not a flat line stuck in a huge 0–90 range.
  const wVals = weekData.flatMap(d => [d.actual, d.ema].filter(v => v !== undefined) as number[]);
  const minW = wVals.length > 0 ? Math.floor(Math.min(...wVals) - 1) : 70;
  const maxW = wVals.length > 0 ? Math.ceil(Math.max(...wVals) + 1) : 90;

  // Tooltip mirroring the Progress chart (Logged / Smoothed / Expected)
  const renderTip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const HIDE = ['emaHalo', 'zoneLow', 'zoneHigh', 'zoneBand'];
    const rows = payload.filter((e: any) => !HIDE.includes(e.dataKey) && e.value != null);
    if (!rows.length) return null;
    return (
      <div style={{ background: 'rgba(12,12,18,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 11px', minWidth: 120 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontFamily: "'Space Mono', monospace", fontSize: 11, marginBottom: 5 }}>{label}</div>
        {rows.map((e: any, i: number) => {
          const nm = e.dataKey === 'actual' ? 'Logged' : e.dataKey === 'ema' ? 'Smoothed' : e.dataKey === 'trend' ? 'Trend' : 'Expected';
          const swatch = e.dataKey === 'ema' ? '#E8ECF4' : e.dataKey === 'actual' ? '#FFFFFF' : e.dataKey === 'trend' ? '#FF8A00' : '#2E8BFF';
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '1px 0' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: swatch, flexShrink: 0 }} />
              <span style={{ color: '#c8ccd8', fontSize: 11, fontFamily: "'Sora', sans-serif" }}>{nm}</span>
              <span style={{ marginLeft: 'auto', paddingLeft: 12, color: '#fff', fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700 }}>{e.value} kg</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="diet-section weight-sparkline-card">
      <div className="ws-head">
        <h2 className="diet-heading">Weight This Week</h2>
        {lossPerWeek > 0 && (
          <span className="ws-potential">
            <strong>{isBulk ? '+' : '−'}{lossPerWeek}kg</strong> possible
          </span>
        )}
      </div>

      {hasAny || weekData.some(d => d.expected !== undefined) ? (
        <ResponsiveContainer width="100%" height={132}>
          <ComposedChart data={weekData} margin={{ top: 8, right: 14, bottom: 0, left: -8 }}>
            <XAxis dataKey="label" tick={(p: any) => <DayCircleTick {...p} doneFlags={weekDone} />} axisLine={false} tickLine={false} height={40} interval={0} padding={{ left: 16, right: 16 }} />
            <YAxis domain={[minW, maxW]} tick={{ fill: '#444', fontSize: 10 }} axisLine={false} tickLine={false} width={34} />
            <Tooltip content={renderTip} />
            {/* Golden safe-zone corridor: light fill + gold edge lines (no vertical cap) */}
            <Area type="linear" dataKey="zoneLow" stackId="zone" stroke="none" fill="none" connectNulls={false} dot={false} activeDot={false} isAnimationActive={false} />
            <Area type="linear" dataKey="zoneBand" stackId="zone" stroke="none" fill="rgba(255,190,30,0.16)" connectNulls={false} dot={false} activeDot={false} isAnimationActive={false} />
            <Line type="linear" dataKey="zoneLow" stroke="rgba(255,200,60,0.8)" strokeWidth={1.5} dot={false} activeDot={false} connectNulls isAnimationActive={false} />
            <Line type="linear" dataKey="zoneHigh" stroke="rgba(255,200,60,0.8)" strokeWidth={1.5} dot={false} activeDot={false} connectNulls isAnimationActive={false} />
            {/* Expected/ideal path — faint blue dashed */}
            <Line type="linear" dataKey="expected" stroke="#2E8BFF55" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls name="expected" isAnimationActive={false} />
            {/* Trendline — amber regression of your last 28 days */}
            <Line type="linear" dataKey="trend" stroke="#FF8A00" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls name="trend" isAnimationActive={false} />
            {/* EMA smoothed — black line with a white halo */}
            <Line type="monotone" dataKey="emaHalo" stroke="rgba(255,255,255,0.6)" strokeWidth={5} dot={false} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="ema" stroke="#000000" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} name="ema" />
            {/* Actual logged weight — white line with hollow dots */}
            <Line type="monotone" dataKey="actual" stroke="#FFFFFF" strokeWidth={2.5} dot={{ r: 4, fill: '#0E0E14', stroke: '#FFFFFF', strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls={false} name="actual" />
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

// ── SmartAdjustCard ───────────────────────────────────────────────────────────
const SmartAdjustCard: React.FC<{
  goal: 'cut' | 'maintain' | 'bulk';
  lossPerWeek: number;
  allTrackerDays: any[];
  macroCalories: number;
  target: MacroSet;
  currentWeight: number;
  locks: { protein: boolean; carbs: boolean; fats: boolean };
  onApply: (newTarget: MacroSet) => void;
}> = ({ goal, lossPerWeek, allTrackerDays, macroCalories, target, currentWeight, locks, onApply }) => {
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

  if (histPts.length < 7 || lossPerWeek <= 0 || goal === 'maintain') return null;

  const reg = linearReg(histPts);
  if (!reg) return null;

  const actualWeeklyKg = reg.weeklyRate;
  const targetWeeklyKg = goal === 'cut' ? -lossPerWeek : lossPerWeek;
  const deviation = actualWeeklyKg - targetWeeklyKg;
  const THRESHOLD = 0.12;

  if (Math.abs(deviation) < THRESHOLD) return null;

  const calorieAdj = Math.round(-deviation * 7700 / 7);
  const cappedAdj = Math.max(-500, Math.min(500, calorieAdj));
  const newCalories = Math.max(1200, Math.min(5000, macroCalories + cappedAdj));

  if (newCalories === macroCalories) return null;

  const buildTarget = (): MacroSet => {
    const kg = currentWeight || 75;
    const p = locks.protein ? target.protein : Math.round(kg * (goal === 'cut' ? 2.0 : goal === 'bulk' ? 1.8 : 1.7));
    const f = locks.fats ? target.fats : Math.round(kg * (goal === 'cut' ? 0.8 : goal === 'bulk' ? 1.1 : 0.9));
    const carbCals = Math.max(0, newCalories - p * 4 - f * 9);
    const c = locks.carbs ? target.carbs : Math.round(carbCals / 4);
    return { calories: p * 4 + c * 4 + f * 9, protein: p, carbs: c, fats: f };
  };

  const isBehind = goal === 'cut'
    ? actualWeeklyKg > targetWeeklyKg   // cutting but not losing fast enough
    : actualWeeklyKg < targetWeeklyKg;  // bulking but not gaining fast enough

  // Plain, real-direction display: + = gaining, − = losing (no sign-flipping)
  const dirWord = actualWeeklyKg > 0.02 ? 'gaining' : actualWeeklyKg < -0.02 ? 'losing' : 'holding steady';
  const actualSigned = `${actualWeeklyKg > 0 ? '+' : ''}${actualWeeklyKg.toFixed(2)}`;
  const statusColor = isBehind ? '#FFD233' : '#2FD27E';
  const adjPhrase = cappedAdj < 0 ? `eat about ${Math.abs(cappedAdj)} fewer kcal a day` : `add about ${cappedAdj} kcal a day`;
  const explain = `Your weight is ${dirWord} ${Math.abs(actualWeeklyKg).toFixed(2)} kg/wk, but your goal is to ${goal === 'cut' ? 'lose' : 'gain'} ${lossPerWeek} kg/wk. ${isBehind ? `To get on track, ${adjPhrase}.` : `You're ahead of pace — ${adjPhrase} to ease off.`}`;

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
          <span className="sa-icon">🤖</span>
        </div>
        <div className="sa-titles">
          <span className="sa-title">Smart Adjust</span>
          <span className="sa-subtitle">Based on your {histPts.length}-day weight trend</span>
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
            <span className="sa-rec-was"> (was {macroCalories.toLocaleString()})</span>
          </span>
        </div>
        {(locks.protein || locks.carbs || locks.fats) && (
          <div className="sa-locked-note">
            Locked macros will be preserved
            {locks.protein && ' · Protein'}
            {locks.carbs && ' · Carbs'}
            {locks.fats && ' · Fats'}
          </div>
        )}
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
            <div className="atc-covered-check" style={{ color: '#2FD27E' }}>✓</div>
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
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [target, setTarget] = useState<MacroSet>(DEFAULT_TARGET);
  const [goal, setGoal] = useState<'cut' | 'maintain' | 'bulk'>('cut');
  const [locks, setLocks] = useState({ protein: false, carbs: false, fats: false });
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

  useEffect(() => {
    api.getDietPlans().then((plans: any[]) => {
      if (plans.length > 0) setLatestPlan(plans[0]);
    }).catch(() => {});
    // Plan goal drives the time-vs-weight progress bars in the hero
    api.getPlanStatus().then((s: any) => { if (s?.active) setPlanGoal(s.goal); }).catch(() => {});
  }, []);

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
      setLocks({ protein: !!s.lockProtein, carbs: !!s.lockCarbs, fats: !!s.lockFats });
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

  const handleSmartApply = (newTarget: MacroSet) => {
    setTarget(newTarget);
    api.updateDietTarget(newTarget).catch(() => {});
  };

  if (!loaded) {
    return (
      <div className="app flush" style={{ '--theme': '#2E8BFF', '--theme-dim': '#2E8BFF66', '--theme-glow': '#2E8BFF33' } as React.CSSProperties}>
        <div className="sd-loader-wrap"><div className="sd-loader"><img className="sd-loader-logo" src="/superdub-logo.png" alt="" /></div></div>
      </div>
    );
  }

  const GOAL_COLORS: Record<string, string> = { cut: '#2FD27E', maintain: '#2FD27E', bulk: '#2E8BFF' };
  const GOAL_LABELS: Record<string, string> = { cut: '🔥 Fat Loss', maintain: '⚖️ Maintain', bulk: '💪 Muscle Gain' };
  const accent = GOAL_COLORS[goal] ?? '#2FD27E';
  const goalLabel = GOAL_LABELS[goal] ?? '🔥 Fat Loss';
  const displayWeight = todayWeight ?? kg;
  const weightDiff = displayWeight > 0 && goalWeight > 0 ? Math.abs(displayWeight - goalWeight) : null;
  const weeksLeft = weightDiff && lossPerWeek > 0 ? Math.ceil(weightDiff / lossPerWeek) : null;

  // ── Two progress tracks for the hero: time elapsed (flame) vs weight done (accent) ──
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
  // Prefer the actual earliest logged weight as the start reference — the stored plan
  // start weight can be stale and misrepresent real progress.
  const firstLoggedW = (() => {
    const e = allTrackerDays.find((d: any) => parseFloat(d.weight) > 0);
    return e ? parseFloat(e.weight) : null;
  })();
  const startW = firstLoggedW ?? planGoal?.startWeight ?? null;
  const targetW = planGoal?.targetWeight ?? (goalWeight > 0 ? goalWeight : null);
  const startMs = planGoal?.startDate ? new Date(planGoal.startDate).getTime() : null;
  const targetMs = planGoal?.targetDate ? new Date(planGoal.targetDate).getTime() : null;
  const weightPct = (startW != null && targetW != null && startW !== targetW && displayWeight > 0)
    ? clamp01((startW - displayWeight) / (startW - targetW)) : null;
  const timePct = (startMs != null && targetMs != null && targetMs > startMs)
    ? clamp01((Date.now() - startMs) / (targetMs - startMs)) : null;

  // ── Arc gauge geometry (top semicircle): the weight journey, start → goal ──
  const GA = { cx: 130, cy: 124, r: 104 };
  const arcPoint = (p: number) => {
    const t = (180 - clamp01(p) * 180) * Math.PI / 180;
    return { x: GA.cx + GA.r * Math.cos(t), y: GA.cy - GA.r * Math.sin(t) };
  };
  const wp = weightPct ?? 0;
  const gp = arcPoint(wp);
  const gaugeTrack = `M ${GA.cx - GA.r} ${GA.cy} A ${GA.r} ${GA.r} 0 0 1 ${GA.cx + GA.r} ${GA.cy}`;
  const gaugeProg = `M ${GA.cx - GA.r} ${GA.cy} A ${GA.r} ${GA.r} 0 0 1 ${gp.x.toFixed(1)} ${gp.y.toFixed(1)}`;

  return (
    <div className="app flush" style={{ '--theme': '#2E8BFF', '--theme-dim': '#2E8BFF66', '--theme-glow': '#2E8BFF33' } as React.CSSProperties}>
      {/* ── Full scrollable content ── */}
      <div className="diet-content page-content">

      <div className="plan-topbar">
        <div className="hb-brand">
          <img className="hb-brand-logo" src="/superdub-logo.png" alt="" />
          <span className="hb-brand-name">super<span className="hb-brand-dub">dub</span></span>
        </div>
      </div>

      {/* Plan summary hero */}
      <section className="plan-hero">
        <div className="plan-hero-accent" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}22)` }} />

        <div className="plan-hero-head">
          <span className="plan-goal-pill" style={{ color: accent, background: accent + '18', borderColor: accent + '40' }}>{goalLabel}</span>
          {weeksLeft && <span className="plan-hero-eta">~{weeksLeft}w to goal</span>}
          <button className="plan-hero-edit" onClick={() => navigate('/profile')}>Edit →</button>
        </div>

        {/* ── Weight journey arc gauge: start → goal, big current number at centre ── */}
        <div className="plan-gauge">
          <svg viewBox="0 0 260 138" className="plan-gauge-svg">
            <defs>
              <linearGradient id="planGaugeGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={accent} stopOpacity={0.5} />
                <stop offset="100%" stopColor={accent} />
              </linearGradient>
            </defs>
            <path d={gaugeTrack} stroke="rgba(255,255,255,0.07)" strokeWidth={12} fill="none" strokeLinecap="round" />
            {weightPct !== null && wp > 0.001 && (
              <path d={gaugeProg} stroke="url(#planGaugeGrad)" strokeWidth={12} fill="none" strokeLinecap="round" />
            )}
            {weightPct !== null && (
              <circle cx={gp.x} cy={gp.y} r={7} fill="#0E0E14" stroke={accent} strokeWidth={3} />
            )}
          </svg>
          <div className="plan-gauge-center">
            <span className="plan-gauge-now">{displayWeight > 0 ? displayWeight.toFixed(1) : '—'}</span>
            <span className="plan-gauge-now-unit">kg now</span>
            {weightPct !== null && (
              <span className="plan-gauge-pct" style={{ color: accent }}>{Math.round(weightPct * 100)}% there</span>
            )}
          </div>
          <div className="plan-gauge-ends">
            <div className="plan-gauge-end">
              <span className="plan-gauge-end-val">{startW != null ? startW.toFixed(1) : (displayWeight > 0 ? displayWeight.toFixed(1) : '—')}</span>
              <span className="plan-gauge-end-lbl">Start</span>
            </div>
            <div className="plan-gauge-end right">
              <span className="plan-gauge-end-val" style={{ color: accent }}>{goalWeight > 0 ? goalWeight.toFixed(1) : '—'}</span>
              <span className="plan-gauge-end-lbl">Goal</span>
            </div>
          </div>
        </div>

        {/* Time pacing — small caption under the gauge */}
        {timePct !== null && (
          <div className="plan-gauge-time">
            <span className="plan-gauge-time-bar"><span className="plan-gauge-time-fill" style={{ width: `${Math.round(timePct * 100)}%` }} /></span>
            <span className="plan-gauge-time-lbl">{Math.round(timePct * 100)}% of time used{weeksLeft ? ` · ~${weeksLeft}w left` : ''}</span>
          </div>
        )}

      </section>

        {/* Adaptive Weight Plan — engine reasoning (moved here from Progress) */}
        <AdaptiveWeightPlanCard />

        {/* Weight This Week — prominent, with corridor + trend */}
        <WeightSparkline
          allTrackerDays={allTrackerDays}
          currentWeight={todayWeight ?? kg}
          goalWeight={goalWeight}
          lossPerWeek={lossPerWeek}
        />

        {/* Steps & activity — moved up; adaptive targets */}
        <ActivityTargetsCard
          currentWeight={todayWeight ?? kg}
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
              <span className="plan-meal-total-val">
                {latestPlan.totals?.calories} kcal · P {latestPlan.totals?.protein}g · C {latestPlan.totals?.carbs}g · F {latestPlan.totals?.fat}g
              </span>
            </div>
          </div>
        )}

        <SmartAdjustCard
          goal={goal}
          lossPerWeek={lossPerWeek}
          allTrackerDays={allTrackerDays}
          macroCalories={macroCalories}
          target={target}
          currentWeight={todayWeight ?? kg}
          locks={locks}
          onApply={handleSmartApply}
        />
      </div>
    </div>
  );
};

export default Diet;
