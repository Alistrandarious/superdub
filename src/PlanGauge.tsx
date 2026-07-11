import React from 'react';
import { useWeightUnit, kgToUnitValue, unitLabel } from './weightUnit';

// The weight-journey arc gauge (top semicircle): start → goal, with the current
// weight big at the centre, "% there", the two end weights, and a time-pacing bar
// underneath. Extracted from the Plan page so Progress→Today shares it verbatim.

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const PlanGauge: React.FC<{
  displayWeight: number;
  startW: number | null;
  targetW: number | null;
  startMs: number | null;
  targetMs: number | null;
  accent: string;
  weeksLeft: number | null;
}> = ({ displayWeight, startW, targetW, startMs, targetMs, accent, weeksLeft }) => {
  const unit = useWeightUnit();

  const weightPct = (startW != null && targetW != null && startW !== targetW && displayWeight > 0)
    ? clamp01((startW - displayWeight) / (startW - targetW)) : null;
  const timePct = (startMs != null && targetMs != null && targetMs > startMs)
    ? clamp01((Date.now() - startMs) / (targetMs - startMs)) : null;

  // Arc geometry (top semicircle): the weight journey, start → goal.
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
    <>
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
          <span className="plan-gauge-now">{displayWeight > 0 ? kgToUnitValue(displayWeight, unit).toFixed(1) : '—'}</span>
          <span className="plan-gauge-now-unit">{unitLabel(unit)} now</span>
          {weightPct !== null && (
            <span className="plan-gauge-pct" style={{ color: accent }}>{Math.round(weightPct * 100)}% there</span>
          )}
        </div>
        <div className="plan-gauge-ends">
          <div className="plan-gauge-end">
            <span className="plan-gauge-end-val">{startW != null ? kgToUnitValue(startW, unit).toFixed(1) : (displayWeight > 0 ? kgToUnitValue(displayWeight, unit).toFixed(1) : '—')}</span>
            <span className="plan-gauge-end-lbl">Start</span>
          </div>
          <div className="plan-gauge-end right">
            <span className="plan-gauge-end-val" style={{ color: accent }}>{targetW != null ? kgToUnitValue(targetW, unit).toFixed(1) : '—'}</span>
            <span className="plan-gauge-end-lbl">Goal</span>
          </div>
        </div>
      </div>

      {timePct !== null && (
        <div className="plan-gauge-time">
          <span className="plan-gauge-time-bar"><span className="plan-gauge-time-fill" style={{ width: `${Math.round(timePct * 100)}%` }} /></span>
          <span className="plan-gauge-time-lbl">{Math.round(timePct * 100)}% of time used{weeksLeft ? ` · ~${weeksLeft}w left` : ''}</span>
        </div>
      )}
    </>
  );
};

export default PlanGauge;
