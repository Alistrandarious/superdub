// =====================================================================
// SUPERDUB — the comeback strip
// The one surface for someone who has fallen off. Sits above the habit list,
// says nothing about what they missed, and offers exactly one action: mark
// something, or take the streak back. Anything longer would be another thing
// to bounce off.
// =====================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { LapseSignalsResponse } from './api';
import { computeLapseState, lapseHeadline, LapseState } from './lapse';

/** Fetches the raw signals and folds them into a state. Returns null while
 *  loading or on any failure — a broken endpoint must never block the page. */
export function useLapse(): { state: LapseState; signals: LapseSignalsResponse } | null {
  const [signals, setSignals] = useState<LapseSignalsResponse | null>(null);

  useEffect(() => {
    let live = true;
    api.getLapse().then(s => { if (live) setSignals(s); }).catch(() => {});
    return () => { live = false; };
  }, []);

  if (!signals) return null;
  return {
    signals,
    state: computeLapseState({
      // null means "never logged", which the state machine reads as no history.
      daysSinceLog: signals.daysSinceLog ?? Infinity,
      hadPriorActivity: signals.hadPriorActivity,
      weekMarks: signals.weekMarks,
      weekDue: signals.weekDue,
      daysSinceReturn: signals.daysSinceReturn,
    }),
  };
}

const LapseBanner: React.FC = () => {
  const lapse = useLapse();
  const [restored, setRestored] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const restore = useCallback(async () => {
    setRestoring(true);
    try {
      const { daysRestored } = await api.restoreStreak();
      setRestored(daysRestored);
      // The streak is recomputed from the tracker, so the page has to reload it.
      window.dispatchEvent(new CustomEvent('superdub:tracker-updated'));
    } catch { /* the strip just stays as it was */ } finally { setRestoring(false); }
  }, []);

  if (!lapse || dismissed) return null;
  const { state, signals } = lapse;
  const headline = lapseHeadline(state, signals.daysSinceLog ?? 0);
  if (!headline) return null;

  return (
    <section className="lapse-strip" aria-live="polite">
      <div className="lapse-strip-body">
        <p className="lapse-strip-head">{restored != null ? 'Streak picked back up' : headline}</p>
        <p className="lapse-strip-sub">
          {restored != null
            ? `${restored} ${restored === 1 ? 'day' : 'days'} marked as skipped, so the run holds. Nothing else changed.`
            : 'Nothing is lost and nothing is counted against you. Mark one thing below and today is a good day again.'}
        </p>
      </div>
      {restored == null && signals.restoreAvailable && (
        <button className="lapse-strip-btn" onClick={restore} disabled={restoring}>
          {restoring ? 'Restoring' : `Keep my ${signals.lastGapDays}-day gap off the record`}
        </button>
      )}
      <button className="lapse-strip-x" onClick={() => setDismissed(true)} aria-label="Dismiss">×</button>
    </section>
  );
};

export default LapseBanner;
