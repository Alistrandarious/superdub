import React from 'react';

// ── Live Target Matrix — the "Today" visualization on Progress. Four live
// engine gauges in a fixed 280px 2×2 grid so the block is pixel-frozen against
// the trend charts (no container shift on tab switch). Every metric is a
// computed pace/buffer, not a raw readout. Data is passed in from App.tsx (the
// page already computes it) so this stays a single source of truth.
//
// Palette (per the Today spec): gold #FFD233 + flame #FF8A00 for progress/XP;
// violet #7C3AED → #B84DFF for critical overages; muted obsidian for empty state.

export interface LiveTargetMatrixProps {
  targetCalories: number;
  caloriesConsumed: number;       // today's logged intake (kcal)
  steps: number;                  // today's steps
  stepTarget: number;             // effective (energy-adjusted) daily target
  sleepHours: number | null;      // last night, bounded 4–12 for the gauge
  energyScore: number | null;     // today's self-rated energy 1–5 (from coaching engine)
  priorityHabit: string | null;   // most at-risk uncompleted habit, or null if all clear
  onToggleHabit: (habit: string) => void;
}

// Fraction of the active waking day elapsed (07:00–22:00), for step pacing.
function activeDayFraction(d = new Date()): number {
  const mins = d.getHours() * 60 + d.getMinutes();
  const start = 7 * 60, end = 22 * 60;
  return Math.max(0, Math.min(1, (mins - start) / (end - start)));
}

// Predicted afternoon energy: this morning's energy nudged by last night's
// sleep (a short night pulls the afternoon peak down; a full one lifts it).
// Deterministic, mirrors the coaching engine's "sleep feeds energy" logic.
function predictedAfternoonEnergy(energy: number | null, sleep: number | null): number | null {
  if (energy == null) return null;
  let e = energy;
  if (sleep != null) { if (sleep >= 7.5) e += 0.5; else if (sleep < 6) e -= 1; }
  return Math.max(1, Math.min(5, Math.round(e * 10) / 10));
}
const ENERGY_LABEL = (e: number) => e >= 4.5 ? 'Peak' : e >= 3.5 ? 'Strong' : e >= 2.5 ? 'Steady' : e >= 1.5 ? 'Low' : 'Drained';

// A clean SVG progress ring. `over` flips it to the violet critical gradient.
const Ring: React.FC<{ pct: number; over: boolean; children: React.ReactNode }> = ({ pct, over, children }) => {
  const R = 34, C = 2 * Math.PI * R;
  const dash = Math.max(0, Math.min(1, pct)) * C;
  return (
    <svg viewBox="0 0 80 80" className="ltm-ring">
      <defs>
        <linearGradient id="ltm-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFD233" /><stop offset="100%" stopColor="#FF8A00" />
        </linearGradient>
        <linearGradient id="ltm-violet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C3AED" /><stop offset="100%" stopColor="#B84DFF" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r={R} className="ltm-ring-track" />
      <circle
        cx="40" cy="40" r={R}
        className={`ltm-ring-fill${over ? ' over' : ''}`}
        stroke={over ? 'url(#ltm-violet)' : 'url(#ltm-gold)'}
        strokeDasharray={`${dash} ${C}`}
        transform="rotate(-90 40 40)"
      />
      <foreignObject x="6" y="6" width="68" height="68">
        <div className="ltm-ring-center">{children}</div>
      </foreignObject>
    </svg>
  );
};

const LiveTargetMatrix: React.FC<LiveTargetMatrixProps> = ({
  targetCalories, caloriesConsumed, steps, stepTarget, sleepHours, energyScore,
  priorityHabit, onToggleHabit,
}) => {
  // ── Intake · calorie runway ──
  const runway = targetCalories - caloriesConsumed;
  const over = runway < 0;
  const intakePct = targetCalories > 0 ? caloriesConsumed / targetCalories : 0;

  // ── Activity · step pace ──
  const expectedByNow = Math.round(stepTarget * activeDayFraction());
  const paceDelta = steps - expectedByNow;
  const stepPct = stepTarget > 0 ? steps / stepTarget : 0;
  const ahead = paceDelta >= 0;

  // ── Vitals · sleep + predicted energy ──
  const sleepBounded = sleepHours != null ? Math.max(4, Math.min(12, sleepHours)) : null;
  const sleepPct = sleepBounded != null ? (sleepBounded - 4) / 8 : 0; // 4h→0, 12h→1
  const predEnergy = predictedAfternoonEnergy(energyScore, sleepHours);

  return (
    <div className="ltm">
      {/* Intake · Calorie Runway ring */}
      <div className="ltm-cell">
        <span className="ltm-eyebrow">INTAKE</span>
        <Ring pct={intakePct} over={over}>
          {over ? (
            <><span className="ltm-ring-num over">{Math.abs(runway).toLocaleString()}</span><span className="ltm-ring-unit">over</span></>
          ) : (
            <><span className="ltm-ring-num">{runway.toLocaleString()}</span><span className="ltm-ring-unit">kcal left</span></>
          )}
        </Ring>
        {over
          ? <span className="ltm-alert">CRITICAL BUFFER: -{Math.abs(runway).toLocaleString()} kcal</span>
          : <span className="ltm-sub">runway to {targetCalories.toLocaleString()}</span>}
      </div>

      {/* Activity · Step Pace tracker */}
      <div className="ltm-cell">
        <span className="ltm-eyebrow">ACTIVITY</span>
        <div className="ltm-metric">{steps.toLocaleString()}<span className="ltm-metric-unit">steps</span></div>
        <div className="ltm-bar"><span className={`ltm-bar-fill${ahead ? '' : ' behind'}`} style={{ width: `${Math.min(100, stepPct * 100)}%` }} /></div>
        <span className={`ltm-sub${ahead ? ' good' : ' warn'}`}>
          {ahead ? '+' : '−'}{Math.abs(paceDelta).toLocaleString()} steps {ahead ? 'ahead of' : 'behind'} pace
        </span>
      </div>

      {/* Vitals · Sleep & Energy vector */}
      <div className="ltm-cell">
        <span className="ltm-eyebrow">VITALS</span>
        {sleepBounded != null ? (
          <div className="ltm-metric">{sleepBounded % 1 === 0 ? sleepBounded : sleepBounded.toFixed(1)}<span className="ltm-metric-unit">h slept</span></div>
        ) : (
          <div className="ltm-metric ltm-empty">—<span className="ltm-metric-unit">no sleep log</span></div>
        )}
        <div className="ltm-bar"><span className="ltm-bar-fill" style={{ width: `${Math.min(100, sleepPct * 100)}%` }} /></div>
        {predEnergy != null
          ? <span className="ltm-sub">PM energy: <strong className="ltm-energy">{ENERGY_LABEL(predEnergy)}</strong> ({predEnergy}/5)</span>
          : <span className="ltm-sub ltm-empty">rate energy in the check-in</span>}
      </div>

      {/* Focus · Priority Habit token */}
      <div className="ltm-cell">
        <span className="ltm-eyebrow">FOCUS</span>
        {priorityHabit ? (
          <button className="ltm-focus" onClick={() => onToggleHabit(priorityHabit)} aria-label={`Complete ${priorityHabit}`}>
            <span className="ltm-focus-ring" aria-hidden />
            <span className="ltm-focus-label">{priorityHabit}</span>
            <span className="ltm-focus-cta">tap to complete</span>
          </button>
        ) : (
          <div className="ltm-focus done" aria-label="All habits complete">
            <span className="ltm-focus-tick" aria-hidden>✓</span>
            <span className="ltm-focus-label">All clear</span>
            <span className="ltm-focus-cta">every routine done</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveTargetMatrix;
