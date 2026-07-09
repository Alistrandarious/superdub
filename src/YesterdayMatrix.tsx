import React from 'react';

// ── Yesterday Matrix — yesterday's actual KPIs at a glance, in the same fixed
// 2×2 grid that fills the locked visualization height. Retrospective, not a
// target: what you ate, how far you walked, how you slept/felt, and how many
// habits you closed. Data is passed in from App.tsx (single source of truth).
//
// Palette: gold #FFD233 + flame #FF8A00 for progress/hits; DANGER #FF5470 for
// going over target (semantic per DESIGN_SYSTEM); muted obsidian for empty state.

export interface YesterdayMatrixProps {
  intake: number | null;          // yesterday's estimated kcal
  targetCalories: number;
  delta: number | null;           // intake − target (null when no estimate)
  steps: number;
  stepTarget: number;
  sleepHours: number | null;
  mood: number | null;            // 1–5
  habitsDone: number;
  habitsTotal: number;
}

const MOOD_LABEL = (m: number) => m >= 4.5 ? 'great' : m >= 3.5 ? 'good' : m >= 2.5 ? 'okay' : m >= 1.5 ? 'low' : 'rough';

// SVG progress ring; `over` flips it to the danger gradient (over target = warning).
const Ring: React.FC<{ pct: number; over: boolean; children: React.ReactNode }> = ({ pct, over, children }) => {
  const R = 34, C = 2 * Math.PI * R;
  const dash = Math.max(0, Math.min(1, pct)) * C;
  return (
    <svg viewBox="0 0 80 80" className="ltm-ring">
      <defs>
        <linearGradient id="ym-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFD233" /><stop offset="100%" stopColor="#FF8A00" />
        </linearGradient>
        <linearGradient id="ym-over" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF5470" /><stop offset="100%" stopColor="#B23048" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r={R} className="ltm-ring-track" />
      <circle
        cx="40" cy="40" r={R} className="ltm-ring-fill"
        stroke={over ? 'url(#ym-over)' : 'url(#ym-gold)'}
        strokeDasharray={`${dash} ${C}`} transform="rotate(-90 40 40)"
      />
      <foreignObject x="6" y="6" width="68" height="68">
        <div className="ltm-ring-center">{children}</div>
      </foreignObject>
    </svg>
  );
};

const YesterdayMatrix: React.FC<YesterdayMatrixProps> = ({
  intake, targetCalories, delta, steps, stepTarget, sleepHours, mood, habitsDone, habitsTotal,
}) => {
  const over = delta != null && delta > 0;
  const intakePct = intake != null && targetCalories > 0 ? intake / targetCalories : 0;
  const stepsHit = steps >= stepTarget && steps > 0;
  const stepPct = stepTarget > 0 ? steps / stepTarget : 0;
  const sleepBounded = sleepHours != null ? Math.max(0, Math.min(12, sleepHours)) : null;
  const sleepPct = sleepBounded != null ? sleepBounded / 12 : 0;
  const habitPct = habitsTotal > 0 ? habitsDone / habitsTotal : 0;

  return (
    <div className="ltm">
      {/* Calories eaten */}
      <div className="ltm-cell">
        <span className="ltm-eyebrow">CALORIES</span>
        {intake != null ? (
          <>
            <Ring pct={intakePct} over={over}>
              <span className={`ltm-ring-num${over ? ' over' : ''}`}>{intake.toLocaleString()}</span>
              <span className="ltm-ring-unit">kcal</span>
            </Ring>
            {delta != null
              ? <span className={over ? 'ltm-alert' : 'ltm-sub good'}>est. {Math.abs(delta).toLocaleString()} {over ? 'over' : 'under'} target</span>
              : <span className="ltm-sub">vs {targetCalories.toLocaleString()} target</span>}
          </>
        ) : (
          <><div className="ltm-metric ltm-empty">—<span className="ltm-metric-unit">no estimate</span></div>
            <span className="ltm-sub ltm-empty">log weight + steps to unlock</span></>
        )}
      </div>

      {/* Steps taken */}
      <div className="ltm-cell">
        <span className="ltm-eyebrow">STEPS</span>
        <div className="ltm-metric">{steps.toLocaleString()}{stepsHit && <span className="ltm-metric-unit"> ✓</span>}</div>
        <div className="ltm-bar"><span className="ltm-bar-fill" style={{ width: `${Math.min(100, stepPct * 100)}%` }} /></div>
        <span className={`ltm-sub${stepsHit ? ' good' : ''}`}>
          {steps > 0 ? `of ${stepTarget.toLocaleString()} target${stepsHit ? ' · hit' : ''}` : 'no steps logged'}
        </span>
      </div>

      {/* Vitals, sleep + mood */}
      <div className="ltm-cell">
        <span className="ltm-eyebrow">VITALS</span>
        {sleepBounded != null ? (
          <div className="ltm-metric">{sleepBounded % 1 === 0 ? sleepBounded : sleepBounded.toFixed(1)}<span className="ltm-metric-unit">h slept</span></div>
        ) : (
          <div className="ltm-metric ltm-empty">—<span className="ltm-metric-unit">no sleep log</span></div>
        )}
        <div className="ltm-bar"><span className="ltm-bar-fill" style={{ width: `${Math.min(100, sleepPct * 100)}%` }} /></div>
        {mood != null
          ? <span className="ltm-sub">mood <strong className="ltm-energy">{MOOD_LABEL(mood)}</strong> ({mood}/5)</span>
          : <span className="ltm-sub ltm-empty">no mood logged</span>}
      </div>

      {/* Habits closed */}
      <div className="ltm-cell">
        <span className="ltm-eyebrow">HABITS</span>
        {habitsTotal > 0 ? (
          <>
            <div className="ltm-metric">{habitsDone}<span className="ltm-metric-unit">/ {habitsTotal}</span></div>
            <div className="ltm-bar"><span className="ltm-bar-fill" style={{ width: `${Math.min(100, habitPct * 100)}%` }} /></div>
            <span className={`ltm-sub${habitsDone === habitsTotal ? ' good' : ''}`}>
              {habitsDone === habitsTotal ? 'all done · clean sweep' : `${habitsDone === 1 ? 'habit' : 'habits'} closed`}
            </span>
          </>
        ) : (
          <><div className="ltm-metric ltm-empty">—<span className="ltm-metric-unit">no habits</span></div>
            <span className="ltm-sub ltm-empty">add a habit to track it</span></>
        )}
      </div>
    </div>
  );
};

export default YesterdayMatrix;
