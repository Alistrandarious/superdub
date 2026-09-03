import React from 'react';
import { useWeightUnit, formatWeightKg } from './weightUnit';
import { ZapIc, AlertIc } from './icons';

// Adaptive Weight Plan engine card — pure render.
// Its data (plan status, weekly cycle, coaching signal, weight EMA) is fetched
// by the parent page as part of its load gate, so the card never pops in after
// the page reveals.
const AdaptiveWeightPlanCard: React.FC<{
  planStatus: any;
  planCycle: any;
  coachingMsg: any;
  lastEMAValue: number | null;
  /** Someone who has drifted or lapsed. Hides the check-in signal row: churn risk
   *  goes CRITICAL on absence alone, so it would tell a returning user their data
   *  is poor when the truth is there is simply no data. */
  softened?: boolean;
}> = ({ planStatus, planCycle, coachingMsg, lastEMAValue, softened }) => {
  const unit = useWeightUnit();
  // No active plan — teach instead of vanishing.
  if (!planStatus?.active || !planStatus.currentTarget) {
    return (
      <div className="plan-engine-card plan-engine-card--empty">
        <span className="plan-engine-eyebrow">Adaptive Weight Plan</span>
        <p className="plan-engine-empty-text">Set a weight goal to switch this on. It retunes your daily calorie target every week from your real weight trend.</p>
      </div>
    );
  }

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
    if (Math.abs(diff) < 0.03) return `${direction} right on pace`;
    if (g.goalType === 'lose')
      return slope < targetSlope
        ? `losing ${Math.abs(diff).toFixed(2)} kg/wk faster than you need`
        : `${Math.abs(diff).toFixed(2)} kg/wk behind the pace you need`;
    return slope > targetSlope
      ? `gaining ${Math.abs(diff).toFixed(2)} kg/wk faster than you need`
      : `${Math.abs(diff).toFixed(2)} kg/wk behind the pace you need`;
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
            <span className="plan-engine-pace-label">Pace you need</span>
            <span className="plan-engine-pace-val">
              {targetSlope > 0 ? '+' : ''}{targetSlope.toFixed(2)} kg/wk
            </span>
          </div>
          {kgLeft != null && (
            <>
              <div className="plan-engine-pace-sep">·</div>
              <div className="plan-engine-pace-item">
                <span className="plan-engine-pace-label">Remaining</span>
                <span className="plan-engine-pace-val">{formatWeightKg(kgLeft, unit)}</span>
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
        {daysAgo === 0 ? 'Updated today' : daysAgo === 1 ? 'Updated yesterday' : `Updated ${daysAgo}d ago`}. {target.reason}
      </div>

      {/* Check-in signal indicator */}
      {signalLabel && !softened && (
        <div className="plan-engine-signal">
          <span className="plan-engine-signal-dot" style={{ background: signalColor }} />
          <span className="plan-engine-signal-text">Check-in signal: <strong style={{ color: signalColor }}>{signalLabel}</strong> · confidence {signalLabel === 'Strong' ? 'high' : signalLabel === 'Moderate' ? 'moderate' : 'reduced'}</span>
        </div>
      )}
      {/* Metabolic Protection alert */}
      {planCycle?.metabolicProtection && (
        <div className="plan-engine-metabolic-warning">
          <span className="plan-engine-metabolic-icon"><ZapIc size={14} /></span>
          <span className="plan-engine-metabolic-text">
            <strong>Protecting muscle.</strong> You've been losing weight fast for two weeks running, so your target is nudging up a little to keep the loss coming from fat, not muscle.
          </span>
        </div>
      )}

      {/* Learned personal maintenance (TDEE) */}
      {planStatus.tdee && planStatus.tdee.observedTDEE != null && (
        <div className="plan-engine-ml-row">
          <span className="plan-engine-ml-label">What you actually burn</span>
          <span className="plan-engine-ml-val">
            {planStatus.tdee.blendedTDEE.toLocaleString()} kcal
            <span className="plan-engine-ml-sub">
              {' '}· {Math.round(planStatus.tdee.confidence * 100)}% confident
              {planStatus.tdee.blendedTDEE !== planStatus.tdee.formulaTDEE && ` · formula says ${planStatus.tdee.formulaTDEE.toLocaleString()}`}
            </span>
          </span>
        </div>
      )}

      {/* Plateau / stall prediction + the one thing to do about it */}
      {planStatus.stall && planStatus.stall.risk !== 'none' && (
        <div className={`plan-engine-stall stall-${planStatus.stall.risk}`}>
          <span className="plan-engine-stall-icon"><AlertIc size={16} /></span>
          <span className="plan-engine-stall-body">
            <span className="plan-engine-stall-text">{planStatus.stall.message}</span>
            {planStatus.stall.action && (
              <span className="plan-engine-stall-action">→ {planStatus.stall.action}</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
};

export default AdaptiveWeightPlanCard;
