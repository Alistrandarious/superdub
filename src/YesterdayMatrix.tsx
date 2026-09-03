import React, { useState } from 'react';

// ── Yesterday Matrix — yesterday's actual KPIs at a glance, in the same fixed
// 2×2 grid that fills the locked visualization height. Retrospective, not a
// target: what you ate, how far you walked, how you slept/felt, and how many
// habits you closed. Data is passed in from App.tsx (single source of truth).
//
// Palette: gold #FFD233 + flame #FF8A00 for progress/hits; DANGER #FF5470 for
// going over target (semantic per DESIGN_SYSTEM); muted obsidian for empty state.

export interface YesterdayMatrixProps {
  intake: number | null;          // central estimate (mid of the range)
  intakeLow?: number | null;      // range low
  intakeHigh?: number | null;     // range high
  wide?: boolean;                 // band is wide (big overnight swing → mostly water)
  targetCalories: number;
  delta: number | null;           // central − target (null when no estimate)
  steps: number;
  stepTarget: number;
  sleepHours: number | null;
  mood: number | null;            // 1–10
  habitsDone: number;
  habitsTotal: number;
  onLogSteps?: () => void;         // tap the Steps cell to log yesterday's steps
  // Expenditure breakdown (all kcal): burned ≈ maintenance + stepBurn + gymBurn.
  maintenance?: number | null;       // what your body burns (TDEE)
  stepBurnKcal?: number | null;      // energy from yesterday's steps vs your average
  gymBurnKcal?: number | null;       // energy from a logged gym session
  adherenceLevel?: number | null;    // −2..+2 evening "eating vs target" self-report
}

const MOOD_LABEL = (m: number) => m >= 8.5 ? 'great' : m >= 6.5 ? 'good' : m >= 4.5 ? 'okay' : m >= 2.5 ? 'low' : 'rough';
const ADH_LABEL = (l: number) => l <= -2 ? 'well under' : l === -1 ? 'under' : l === 0 ? 'about right' : l === 1 ? 'over' : 'well over';
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString()}`;

// Each cell carries its chart slide's accent (Intake flame, Steps blue, Sleep violet,
// Habits green) so the Yesterday grid reads as a legend for the charts that follow.
export const KPI_ACCENT = { cal: '#FF8A00', steps: '#2E8BFF', vitals: '#8B5CF6', habits: '#2FD27E' } as const;
const cellStyle = (c: string) => ({ ['--cell' as any]: c }) as React.CSSProperties;

// Tiny goal-hit tick, shown beside the eyebrow when the cell's goal was met.
const WinTick: React.FC = () => (
  <svg className="ltm-win-tick" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-label="goal hit"><polyline points="20 6 9 17 4 12" /></svg>
);

const YesterdayMatrix: React.FC<YesterdayMatrixProps> = ({
  intake, intakeLow, intakeHigh, wide, targetCalories, delta, steps, stepTarget, sleepHours, mood, habitsDone, habitsTotal, onLogSteps,
  maintenance, stepBurnKcal, gymBurnKcal, adherenceLevel,
}) => {
  const [explain, setExplain] = useState(false);
  const over = delta != null && delta > 0;

  // ── Energy ledger: maintenance + activity = burned, set against the intake
  // estimate for a NET figure, plus an honest read on how predictive it is.
  // stepBurnKcal is steps burn RELATIVE to your usual day (maintenance already
  // includes average activity), so the sum never double-counts.
  const activityKcal = (stepBurnKcal ?? 0) + (gymBurnKcal ?? 0);
  const burned = maintenance != null ? maintenance + activityKcal : null;
  const net = burned != null && intake != null ? intake - burned : null;
  // Reliability comes from behaviour: which inputs actually got logged yesterday.
  const haveWeighIn = intake != null;               // the range needs the weigh-in pair
  const haveSteps = steps > 0;
  const haveReport = adherenceLevel != null;        // evening "eating vs target"
  const reliable = haveWeighIn && haveSteps && haveReport && !wide;
  const kgWk = net != null ? (net * 7) / 7700 : null;
  const missing = [
    !haveWeighIn ? 'weigh in daily' : null,
    !haveSteps ? 'log steps' : null,
    !haveReport ? 'do the evening check-in' : null,
  ].filter(Boolean).join(', ');
  const verdictText = net == null
    ? 'Weigh in tomorrow morning to complete this picture.'
    : reliable
      ? Math.abs(kgWk!) < 0.05
        ? 'Holding steady. Solid read: weight, steps and eating all logged.'
        : `On pace to ${kgWk! < 0 ? 'lose' : 'gain'} about ${Math.abs(kgWk!).toFixed(1)} kg a week if this behaviour holds. Solid read: weight, steps and eating all logged.`
      : `Take this loosely${wide ? ' (your scale jumped overnight, mostly water)' : ''}. To make it predictive: ${missing || 'keep logging daily'}.`;
  const intakePct = intake != null && targetCalories > 0 ? intake / targetCalories : 0;
  const stepsHit = steps >= stepTarget && steps > 0;
  const stepPct = stepTarget > 0 ? steps / stepTarget : 0;
  const sleepBounded = sleepHours != null ? Math.max(0, Math.min(12, sleepHours)) : null;
  const sleepPct = sleepBounded != null ? sleepBounded / 12 : 0;
  const habitPct = habitsTotal > 0 ? habitsDone / habitsTotal : 0;
  // Wins — did each metric hit its goal yesterday? Drives the tick + tinted cell.
  const winCal = delta != null && delta <= 0;
  const winSleep = sleepBounded != null && sleepBounded >= 7;
  const winHabits = habitsTotal > 0 && habitsDone === habitsTotal;

  return (
    <div className={`ltm${maintenance != null ? ' ltm--energy' : ''}`}>
      {/* Energy ledger — maintenance + activity = burned, vs intake for a net */}
      {maintenance != null && (
        <div className="ltm-energy-row">
          <div className="ler-flow">
            <span className="ler-item"><span className="ler-num">{maintenance.toLocaleString()}</span><span className="ler-lbl">maintenance</span></span>
            <span className="ler-op">+</span>
            <span className="ler-item"><span className="ler-num">{signed(activityKcal)}</span><span className="ler-lbl">activity vs usual</span></span>
            <span className="ler-op">=</span>
            <span className="ler-item"><span className="ler-num">{burned!.toLocaleString()}</span><span className="ler-lbl">burned</span></span>
            {net != null && (
              <>
                <span className="ler-op">·</span>
                <span className="ler-item"><span className={`ler-num${net < 0 ? ' deficit' : net > 0 ? ' surplus' : ''}`}>{signed(net)}</span><span className="ler-lbl">net kcal</span></span>
              </>
            )}
          </div>
          <span className={`ler-verdict${net != null && reliable ? ' good' : ''}`}>{verdictText}</span>
        </div>
      )}

      {/* Calories eaten */}
      <div className={`ltm-cell${winCal ? ' ltm-cell--win' : ''}`} style={cellStyle(KPI_ACCENT.cal)}>
        <span className="ltm-eyebrow">CALORIES{winCal && <WinTick />}</span>
        {/* Tap-to-explain — the number is an estimate from weight + steps, not
            logged food; nothing else on screen says so. */}
        <button className="ltm-info" onClick={() => setExplain(v => !v)} aria-label="How is this worked out?">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="11" x2="12" y2="16" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </button>
        {intake != null && intakeLow != null && intakeHigh != null ? (
          <>
            {/* A RANGE, not a false-precise number — one day's intake can't be pinned
                from one weigh-in. Shown big like the other cells; ⓘ has the breakdown. */}
            <div className={`ltm-metric ltm-metric--range${over ? ' over' : ''}`}>
              {(intakeLow / 1000).toFixed(1)}–{(intakeHigh / 1000).toFixed(1)}k<span className="ltm-metric-unit">kcal</span>
            </div>
            <div className="ltm-bar"><span className="ltm-bar-fill" style={{ width: `${Math.min(100, intakePct * 100)}%` }} /></div>
            <span className={over ? 'ltm-alert' : 'ltm-sub good'}>
              vs {targetCalories.toLocaleString()} target
              {adherenceLevel != null ? ` · ate ${ADH_LABEL(adherenceLevel)}` : ''}
            </span>
          </>
        ) : targetCalories > 0 ? (
          // No estimate yet — still surface the daily goal so it's always visible.
          <><div className="ltm-metric">{targetCalories.toLocaleString()}<span className="ltm-metric-unit">kcal goal</span></div>
            <span className="ltm-sub ltm-empty">weigh in or log a check-in for an estimate</span></>
        ) : (
          <><div className="ltm-metric ltm-empty">—<span className="ltm-metric-unit">no goal set</span></div>
            <span className="ltm-sub ltm-empty">set your plan to see a goal</span></>
        )}
        {explain && (
          <button className="ltm-explain" onClick={() => setExplain(false)}>
            {maintenance != null ? (
              <>
                Burned ~{(maintenance + (stepBurnKcal ?? 0) + (gymBurnKcal ?? 0)).toLocaleString()} kcal
                (maintenance {maintenance.toLocaleString()}{stepBurnKcal ? `, steps ${signed(stepBurnKcal)}` : ''}{gymBurnKcal ? `, gym +${gymBurnKcal.toLocaleString()}` : ''}),
                set against your weigh-in and evening “eating vs target”.
                {wide ? ' Your scale jumped overnight, mostly water, so the band is wide.' : ' One day’s scale move is mostly water, so it’s a band, not a single number.'}
              </>
            ) : (
              <>A range from your body’s burn set against your weigh-in and evening “eating vs target”. One day’s scale move is mostly water, so it’s a band, not a single number.</>
            )}
          </button>
        )}
      </div>

      {/* Steps taken — tap to log yesterday's steps */}
      {onLogSteps ? (
        <button className={`ltm-cell ltm-cell-btn${stepsHit ? ' ltm-cell--win' : ''}`} style={cellStyle(KPI_ACCENT.steps)} onClick={onLogSteps} aria-label="Log yesterday's steps">
          <span className="ltm-eyebrow">STEPS{stepsHit && <WinTick />}</span>
          <div className="ltm-metric">{steps.toLocaleString()}</div>
          <div className="ltm-bar"><span className="ltm-bar-fill" style={{ width: `${Math.min(100, stepPct * 100)}%` }} /></div>
          <span className={`ltm-sub${stepsHit ? ' good' : ''}`}>
            {steps > 0 ? `of ${stepTarget.toLocaleString()} target${stepsHit ? ' · hit' : ''}` : 'tap to log steps'}
          </span>
        </button>
      ) : (
        <div className={`ltm-cell${stepsHit ? ' ltm-cell--win' : ''}`} style={cellStyle(KPI_ACCENT.steps)}>
          <span className="ltm-eyebrow">STEPS{stepsHit && <WinTick />}</span>
          <div className="ltm-metric">{steps.toLocaleString()}</div>
          <div className="ltm-bar"><span className="ltm-bar-fill" style={{ width: `${Math.min(100, stepPct * 100)}%` }} /></div>
          <span className={`ltm-sub${stepsHit ? ' good' : ''}`}>
            {steps > 0 ? `of ${stepTarget.toLocaleString()} target${stepsHit ? ' · hit' : ''}` : 'no steps logged'}
          </span>
        </div>
      )}

      {/* Vitals, sleep + mood */}
      <div className={`ltm-cell${winSleep ? ' ltm-cell--win' : ''}`} style={cellStyle(KPI_ACCENT.vitals)}>
        <span className="ltm-eyebrow">VITALS{winSleep && <WinTick />}</span>
        {sleepBounded != null ? (
          <div className="ltm-metric">{sleepBounded % 1 === 0 ? sleepBounded : sleepBounded.toFixed(1)}<span className="ltm-metric-unit">h slept</span></div>
        ) : (
          <div className="ltm-metric ltm-empty">—<span className="ltm-metric-unit">no sleep log</span></div>
        )}
        <div className="ltm-bar"><span className="ltm-bar-fill" style={{ width: `${Math.min(100, sleepPct * 100)}%` }} /></div>
        {mood != null
          ? <span className="ltm-sub">mood <strong className="ltm-energy">{MOOD_LABEL(mood)}</strong> ({mood}/10)</span>
          : <span className="ltm-sub ltm-empty">no mood logged</span>}
      </div>

      {/* Habits closed */}
      <div className={`ltm-cell${winHabits ? ' ltm-cell--win' : ''}`} style={cellStyle(KPI_ACCENT.habits)}>
        <span className="ltm-eyebrow">HABITS{winHabits && <WinTick />}</span>
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
