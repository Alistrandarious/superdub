// =====================================================================
// SUPERDUB — the re-plan offer
// "Same goal, new date." Shown when the plan you're on has stopped being true,
// usually because a quiet stretch ate the runway.
//
// Lives in its own file because it has two homes: the Plan page, and the
// comeback screen. /plan has no bottom-nav entry, so the person this card was
// written for would otherwise never reach the page it lived on.
// =====================================================================
import React, { useState } from 'react';
import { api, PlanReplanProposal } from './api';
import { formatWeightKg, useWeightUnit } from './weightUnit';

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const ReplanCard: React.FC<{
  replan: PlanReplanProposal;
  /** The goal weight that isn't moving. Only the date changes. */
  targetWeightKg: number;
  /** Reload the caller once the new plan is in. */
  onAccepted: () => void | Promise<void>;
  /** Dismiss without changing anything. */
  onSkip: () => void;
  onError?: (message: string) => void;
}> = ({ replan, targetWeightKg, onAccepted, onSkip, onError }) => {
  const unit = useWeightUnit();
  const [saving, setSaving] = useState(false);

  // Same goal weight, honest new date. Goes through the ordinary goal endpoint,
  // which keeps the original start anchor — the journey so far is history, not a
  // mistake to be wiped.
  const accept = async () => {
    setSaving(true);
    try {
      await api.createPlanGoal(targetWeightKg, replan.newTargetDate);
      await onAccepted();
    } catch (err: any) {
      onError?.(err?.message ?? 'Could not start the new plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="plan-replan">
      <span className="plan-replan-eyebrow">
        {replan.gapDays >= 14 ? `Back after ${replan.gapDays} quiet days` : 'Your plan needs a new date'}
      </span>
      <p className="plan-replan-headline">{replan.headline}</p>
      <div className="plan-replan-figures">
        <div className="plan-replan-fig">
          <span className="plan-replan-fig-val">{formatWeightKg(replan.kgToGo, unit)}</span>
          <span className="plan-replan-fig-key">Still to go</span>
        </div>
        <div className="plan-replan-fig">
          <span className="plan-replan-fig-val">{replan.safeRate.toFixed(2)}<span className="plan-replan-fig-unit"> kg/wk</span></span>
          <span className="plan-replan-fig-key">New pace</span>
        </div>
        <div className="plan-replan-fig">
          <span className="plan-replan-fig-val">{shortDate(replan.newTargetDate)}</span>
          <span className="plan-replan-fig-key">New date</span>
        </div>
      </div>
      <p className="plan-replan-note">
        Your goal of {formatWeightKg(targetWeightKg, unit)} doesn't move, and everything you've logged stays on the chart.
      </p>
      <button className="plan-replan-btn" onClick={accept} disabled={saving}>
        {saving ? 'Starting…' : 'Start the new plan'}
      </button>
      <button className="plan-replan-skip" onClick={onSkip}>Keep the plan I've got</button>
    </div>
  );
};

export default ReplanCard;
