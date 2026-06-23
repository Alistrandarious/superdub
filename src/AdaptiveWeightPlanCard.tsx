import React from 'react';

// Adaptive Weight Plan engine card — pure render.
// Its data (plan status, weekly cycle, coaching signal, weight EMA) is fetched
// by the parent page as part of its load gate, so the card never pops in after
// the page reveals.
const AdaptiveWeightPlanCard: React.FC<{
  planStatus: any;
  planCycle: any;
  coachingMsg: any;
  lastEMAValue: number | null;
}> = ({ planStatus, planCycle, coachingMsg, lastEMAValue }) => {
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

      {/* Learned personal maintenance (TDEE) */}
      {planStatus.tdee && planStatus.tdee.observedTDEE != null && (
        <div className="plan-engine-ml-row">
          <span className="plan-engine-ml-label">Learned maintenance</span>
          <span className="plan-engine-ml-val">
            {planStatus.tdee.blendedTDEE.toLocaleString()} kcal
            <span className="plan-engine-ml-sub">
              {' '}· {Math.round(planStatus.tdee.confidence * 100)}% confident
              {planStatus.tdee.blendedTDEE !== planStatus.tdee.formulaTDEE && ` · formula est. ${planStatus.tdee.formulaTDEE.toLocaleString()}`}
            </span>
          </span>
        </div>
      )}

      {/* Plateau / stall prediction + the one thing to do about it */}
      {planStatus.stall && planStatus.stall.risk !== 'none' && (
        <div className={`plan-engine-stall stall-${planStatus.stall.risk}`}>
          <span className="plan-engine-stall-icon">{planStatus.stall.risk === 'high' ? '🟠' : '🟡'}</span>
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
