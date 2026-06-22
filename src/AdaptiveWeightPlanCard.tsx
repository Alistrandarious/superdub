import React, { useState, useEffect } from 'react';
import { api } from './api';

// Self-contained Adaptive Weight Plan engine card.
// Fetches its own plan status, runs the weekly cycle, pulls the coaching
// signal, and derives the EMA of logged weight — so it can live on any page.
const AdaptiveWeightPlanCard: React.FC = () => {
  const [planStatus, setPlanStatus] = useState<any>(null);
  const [planCycle, setPlanCycle] = useState<any>(null);
  const [coachingMsg, setCoachingMsg] = useState<any>(null);
  const [lastEMAValue, setLastEMAValue] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [status, tracker] = await Promise.all([api.getPlanStatus(), api.getTracker()]);
        if (!active) return;
        setPlanStatus(status);
        // EMA (alpha=0.25) over logged weights, chronological → most-recent value
        const days: any[] = tracker?.days ?? [];
        let ema: number | null = null;
        for (const d of days) {
          const w = parseFloat(d.weight);
          if (w > 0) ema = ema == null ? w : 0.25 * w + 0.75 * ema;
        }
        setLastEMAValue(ema);
      } catch { /* page can render nothing if status fails */ }

      // Cycle + coaching are non-fatal extras
      try { const c = await api.runPlanCycle(); if (active) setPlanCycle(c); } catch { /* noop */ }
      try { const m = await api.getCoachingMessage(); if (active) setCoachingMsg(m); } catch { /* noop */ }
    })();
    return () => { active = false; };
  }, []);

  if (!planStatus?.active || !planStatus.currentTarget) return null;

  const target = planStatus.currentTarget!;
  const g = planStatus.goal!;
  const onTrack = planCycle?.onTrack ?? null;
  const slope = planCycle?.actualSlope ?? null;
  const targetSlope = planCycle?.targetSlope ?? null;
  const weeksLeft = Math.max(0, Math.round((new Date(g.targetDate).getTime() - Date.now()) / (7 * 86400000)));
  const daysAgo = Math.round((Date.now() - new Date(target.effectiveFrom).getTime()) / 86400000);
  const kgLeft = lastEMAValue != null ? Math.abs(lastEMAValue - g.targetWeight) : null;

  const paceDesc = (() => {
    if (slope == null || targetSlope == null) return null;
    const diff = Math.abs(slope) - Math.abs(targetSlope);
    const direction = g.goalType === 'lose' ? (slope < 0 ? 'losing' : 'gaining') : (slope > 0 ? 'gaining' : 'losing');
    if (Math.abs(diff) < 0.03) return `${direction} at target pace`;
    if (g.goalType === 'lose')
      return slope < targetSlope
        ? `losing ${Math.abs(diff).toFixed(2)} kg/wk faster than needed`
        : `${Math.abs(diff).toFixed(2)} kg/wk behind target pace`;
    return slope > targetSlope
      ? `gaining ${Math.abs(diff).toFixed(2)} kg/wk faster than needed`
      : `${Math.abs(diff).toFixed(2)} kg/wk behind target pace`;
  })();

  const signalLabel = coachingMsg?.churnRisk === 'LOW' ? 'Strong' : coachingMsg?.churnRisk === 'MEDIUM' ? 'Moderate' : coachingMsg?.churnRisk ? 'Low' : null;
  const signalColor = coachingMsg?.churnRisk === 'LOW' ? '#2FD27E' : coachingMsg?.churnRisk === 'MEDIUM' ? '#FFD233' : '#FF5470';

  return (
    <div className={`plan-engine-card plan-engine-card--top ${onTrack === false ? 'plan-engine-card--off' : ''}`}>
      {/* Header row */}
      <div className="plan-engine-header">
        <div className="plan-engine-title-group">
          <span className="plan-engine-eyebrow">Adaptive Weight Plan</span>
          <div className="plan-engine-cal-row">
            <span className="plan-engine-cal">{target.calories}</span>
            <span className="plan-engine-cal-unit">kcal / day</span>
          </div>
        </div>
        <span className={`plan-engine-badge ${onTrack === true ? 'badge-on' : onTrack === false ? 'badge-off' : 'badge-neutral'}`}>
          {onTrack === true ? 'On pace' : onTrack === false ? 'Off pace' : '●'}
        </span>
      </div>

      {/* Trend vs target row */}
      {slope != null && targetSlope != null && (
        <div className="plan-engine-pace-row">
          <div className="plan-engine-pace-item">
            <span className="plan-engine-pace-label">Your trend</span>
            <span className={`plan-engine-pace-val ${onTrack === false ? 'color-danger' : 'color-health'}`}>
              {slope > 0 ? '+' : ''}{slope.toFixed(2)} kg/wk
            </span>
          </div>
          <div className="plan-engine-pace-sep">vs</div>
          <div className="plan-engine-pace-item">
            <span className="plan-engine-pace-label">Needed pace</span>
            <span className="plan-engine-pace-val">
              {targetSlope > 0 ? '+' : ''}{targetSlope.toFixed(2)} kg/wk
            </span>
          </div>
          {kgLeft != null && (
            <>
              <div className="plan-engine-pace-sep">·</div>
              <div className="plan-engine-pace-item">
                <span className="plan-engine-pace-label">Remaining</span>
                <span className="plan-engine-pace-val">{kgLeft.toFixed(1)} kg</span>
              </div>
            </>
          )}
          <div className="plan-engine-pace-sep">·</div>
          <div className="plan-engine-pace-item">
            <span className="plan-engine-pace-label">Weeks left</span>
            <span className="plan-engine-pace-val">{weeksLeft}</span>
          </div>
        </div>
      )}

      {/* Prose summary of what the engine is doing */}
      <div className="plan-engine-reasoning">
        {paceDesc && <span className="plan-engine-reasoning-pace">{paceDesc}. </span>}
        {daysAgo === 0 ? 'Updated today' : daysAgo === 1 ? 'Updated yesterday' : `Updated ${daysAgo}d ago`} — {target.reason}
      </div>

      {/* Check-in signal indicator */}
      {signalLabel && (
        <div className="plan-engine-signal">
          <span className="plan-engine-signal-dot" style={{ background: signalColor }} />
          <span className="plan-engine-signal-text">Check-in signal: <strong style={{ color: signalColor }}>{signalLabel}</strong> — engine confidence {signalLabel === 'Strong' ? 'high' : signalLabel === 'Moderate' ? 'moderate' : 'reduced'}</span>
        </div>
      )}
      {/* Metabolic Protection alert */}
      {planCycle?.metabolicProtection && (
        <div className="plan-engine-metabolic-warning">
          <span className="plan-engine-metabolic-icon">⚡</span>
          <span className="plan-engine-metabolic-text">
            <strong>Metabolic Protection</strong> — weight velocity has exceeded 1.5% of body weight/week for 2+ consecutive weeks. Consider a calorie maintenance boost to protect lean mass.
          </span>
        </div>
      )}
    </div>
  );
};

export default AdaptiveWeightPlanCard;
