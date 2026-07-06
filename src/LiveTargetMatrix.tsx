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

// Sleep Optimizer — how many hours to aim for TONIGHT so tomorrow's energy
// bands sit in the good zone. Baseline 8h, nudged by how today actually went:
// a low-energy day (running on a debt) earns more recovery; a short night last
// night compounds it. Deterministic, mirrors the "sleep feeds energy" logic.
function recommendedSleepTonight(energy: number | null, lastNight: number | null): number {
  let target = 8;
  if (energy != null && energy <= 2) target += 0.5;      // ran low today → bank recovery
  if (lastNight != null && lastNight < 6.5) target += 0.5; // short last night → repay debt
  return Math.min(9, Math.round(target * 2) / 2);
}

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

  // ── Activity · step aim (steps still needed today to clear the target) ──
  const stepsToGo = Math.max(0, stepTarget - steps);
  const stepPct = stepTarget > 0 ? steps / stepTarget : 0;
  const stepCleared = stepsToGo === 0;

  // ── Vitals · sleep optimizer (hours to aim for tonight) ──
  const recSleep = recommendedSleepTonight(energyScore, sleepHours);
  const recPct = (recSleep - 4) / 8; // 4h→0, 12h→1, for the gauge bar

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

      {/* Activity · Step Aim — steps still needed today to clear the target */}
      <div className="ltm-cell">
        <span className="ltm-eyebrow">ACTIVITY</span>
        {stepCleared ? (
          <div className="ltm-metric ltm-cleared">✓<span className="ltm-metric-unit">target hit</span></div>
        ) : (
          <div className="ltm-metric">{stepsToGo.toLocaleString()}<span className="ltm-metric-unit">to go</span></div>
        )}
        <div className="ltm-bar"><span className="ltm-bar-fill" style={{ width: `${Math.min(100, stepPct * 100)}%` }} /></div>
        <span className={`ltm-sub${stepCleared ? ' good' : ''}`}>
          {stepCleared ? `${steps.toLocaleString()} steps — above ${stepTarget.toLocaleString()}` : `aim ${stepTarget.toLocaleString()} today · ${steps.toLocaleString()} so far`}
        </span>
      </div>

      {/* Vitals · Sleep Optimizer — hours to aim for tonight */}
      <div className="ltm-cell">
        <span className="ltm-eyebrow">VITALS</span>
        <div className="ltm-metric">{recSleep % 1 === 0 ? recSleep : recSleep.toFixed(1)}<span className="ltm-metric-unit">h tonight</span></div>
        <div className="ltm-bar"><span className="ltm-bar-fill" style={{ width: `${Math.min(100, recPct * 100)}%` }} /></div>
        <span className="ltm-sub">
          {sleepHours != null ? `last night ${sleepHours % 1 === 0 ? sleepHours : sleepHours.toFixed(1)}h · ` : ''}aim here to steady tomorrow
        </span>
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
