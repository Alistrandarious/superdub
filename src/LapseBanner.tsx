// =====================================================================
// SUPERDUB — the comeback strip
// The one surface for someone who has fallen off. Sits above the habit list,
// says nothing about what they missed, and offers exactly one action: mark
// something, or take the streak back. Anything longer would be another thing
// to bounce off.
// =====================================================================
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, isLoggedIn } from './api';
import type { LapseSignalsResponse } from './api';
import { computeLapseState, isSoftened, lapseHeadline, LapseState } from './lapse';

type LapseValue = { state: LapseState; signals: LapseSignalsResponse } | null;

const LapseCtx = createContext<LapseValue>(null);

/** Set while the app is showing someone who has lapsed, so the daily prompts can
 *  stand down. sessionStorage rather than state: the prompts read it inside
 *  timers that fire before any of them subscribe to anything. */
const PENDING_KEY = 'superdub.lapse.pending';
export const lapsePending = (): boolean => sessionStorage.getItem(PENDING_KEY) === '1';
export const clearLapsePending = (): void => sessionStorage.removeItem(PENDING_KEY);

/**
 * One fetch of the lapse signals for the whole app. It has to be shared: the
 * softening reaches every habit card, so a per-component hook would fire a dozen
 * identical requests on the one app-open we are trying to make gentle.
 *
 * ponytail: between first paint and this fetch landing, useSoftened() is false,
 * so a softened surface can render unsoftened for a moment and then correct
 * itself. Only the streak hero is loud enough to matter and it waits on
 * useLapse() being non-null instead. Upgrade path if it ever spreads: seed the
 * state from the ?prompt=comeback param, which is already proof of a lapse.
 */
export const LapseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [signals, setSignals] = useState<LapseSignalsResponse | null>(null);

  const load = useCallback(() => {
    if (!isLoggedIn()) return;
    api.getLapse().then(setSignals).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  // The first mark of the day ends the lapse, so the strip must not outlive it.
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('superdub:tracker-updated', handler);
    return () => window.removeEventListener('superdub:tracker-updated', handler);
  }, [load]);

  const value = useMemo<LapseValue>(() => signals && {
    signals,
    state: computeLapseState({
      // null means "never logged", which the state machine reads as no history.
      daysSinceLog: signals.daysSinceLog ?? Infinity,
      hadPriorActivity: signals.hadPriorActivity,
      weekMarks: signals.weekMarks,
      weekDue: signals.weekDue,
      daysSinceReturn: signals.daysSinceReturn,
    }),
  }, [signals]);

  useEffect(() => {
    if (value?.state === 'lapsed') sessionStorage.setItem(PENDING_KEY, '1');
  }, [value?.state]);

  return <LapseCtx.Provider value={value}>{children}</LapseCtx.Provider>;
};

/** The shared state, or null while loading or on any failure — a broken endpoint
 *  must never block the page. */
export function useLapse(): LapseValue {
  return useContext(LapseCtx);
}

/** Should this surface hold its judgement? False while loading, so a broken
 *  /api/lapse fails toward the honest treatment rather than softening everyone. */
export function useSoftened(): boolean {
  const lapse = useLapse();
  return lapse ? isSoftened(lapse.state) : false;
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
