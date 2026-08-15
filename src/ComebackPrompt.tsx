// =====================================================================
// SUPERDUB — the return screen
// What the comeback notification actually opens. One full screen, one thing to
// read, one thing to do. Everything it says already existed somewhere in the app:
// the headline comes from the lapse protocol, the restore is the same endpoint the
// comeback strip calls, and the re-plan card is the one stranded on /plan, which
// has no bottom-nav entry and so never reached the person it was written for.
//
// Opens two ways: the ?prompt=comeback deep link (which used to be a no-op), and
// on its own for someone who just opens the app after three quiet weeks. Once per
// lapse, keyed off the day the lapse began — see shouldShowComeback in lapse.ts.
//
// This screen is the door. The Return Review is the room: an opt-in walk through
// what held, the weight, the mood and the habits they were quitting, reached from
// the one link below and never forced on anyone. Keeping it behind a link is the
// point — someone fragile enough to bounce off a wall of numbers never sees one.
// =====================================================================
import React, { useCallback, useEffect, useState } from 'react';
import PromptShell from './PromptShell';
import ReplanCard from './ReplanCard';
import ReturnReview from './ReturnReview';
import { api, PlanReplanProposal } from './api';
import { clearLapsePending, useLapse } from './LapseBanner';
import { lapseHeadline, lapseStartKey, shouldShowComeback } from './lapse';
import { localYMD } from './weightMath';
import { GROWTH } from './theme';

const SHOWN_KEY = 'superdub.comeback.shown';

const ComebackPrompt: React.FC = () => {
  const lapse = useLapse();
  const [open, setOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restored, setRestored] = useState<number | null>(null);
  const [replan, setReplan] = useState<PlanReplanProposal | null>(null);
  const [goalKg, setGoalKg] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    // The daily prompts stood down while this was pending; let them resume.
    clearLapsePending();
  }, []);

  // Auto-open for someone who just opens the app, and stamp it so a refresh or a
  // second visit later the same lapse stays quiet.
  useEffect(() => {
    if (!lapse) return;
    const stamp = localStorage.getItem(SHOWN_KEY);
    const days = lapse.signals.daysSinceLog ?? Infinity;
    if (!shouldShowComeback(lapse.state, days, stamp, localYMD(new Date()))) return;
    localStorage.setItem(SHOWN_KEY, lapseStartKey(days, localYMD(new Date())));
    setOpen(true);
  }, [lapse]);

  // The push deep link. Opens regardless of the once-per-lapse stamp: they tapped
  // a notification and are owed the screen it promised.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('superdub:show-comeback', handler);
    return () => window.removeEventListener('superdub:show-comeback', handler);
  }, []);

  // The re-plan offer, only once the screen is actually up.
  useEffect(() => {
    if (!open) return;
    api.getPlanStatus().then(s => {
      if (!s.active) return;
      setReplan(s.replan ?? null);
      setGoalKg(s.goal?.targetWeight ?? null);
    }).catch(() => { /* the screen still works without it */ });
  }, [open]);

  const restore = async () => {
    setRestoring(true);
    try {
      const { daysRestored } = await api.restoreStreak();
      setRestored(daysRestored);
      window.dispatchEvent(new CustomEvent('superdub:tracker-updated'));
    } catch { /* leave the screen as it was */ } finally { setRestoring(false); }
  };

  if (!open || !lapse) return null;
  const { signals, state } = lapse;
  const headline = lapseHeadline(state, signals.daysSinceLog ?? 0) ?? 'Been a while. Nothing was lost.';

  // The room. Finishing it comes back here rather than closing outright, because
  // the door still holds the one action and the re-plan offer.
  if (reviewing) {
    return (
      <ReturnReview
        gapDays={signals.lastGapDays}
        daysSinceReturn={signals.daysSinceReturn}
        onDone={() => setReviewing(false)}
      />
    );
  }

  // Exactly one action. Take the streak back if that is on the table, otherwise
  // just go and mark something. Never both: two asks is a decision, not a welcome.
  const cta = restored == null && signals.restoreAvailable
    ? { label: restoring ? 'Restoring' : `Keep my ${signals.lastGapDays}-day gap off the record`, onClick: restore, disabled: restoring }
    : { label: 'Pick one thing for today', onClick: close };

  return (
    <PromptShell
      accent={GROWTH}
      eyebrow="Welcome back"
      title={restored != null ? 'Streak picked back up' : headline}
      subtitle={restored != null
        ? `${restored} ${restored === 1 ? 'day' : 'days'} marked as skipped, so the run holds. Nothing else changed.`
        : 'Nothing is lost and nothing is counted against you. Mark one thing today and the run starts again.'}
      cta={cta}
      secondary={{ label: 'Show me where I stand', onClick: () => setReviewing(true) }}
      onDismiss={close}
      dismissLabel="Not now"
    >
      {replan && goalKg != null && (
        <ReplanCard
          replan={replan}
          targetWeightKg={goalKg}
          onAccepted={close}
          onSkip={() => setReplan(null)}
        />
      )}
    </PromptShell>
  );
};

export default ComebackPrompt;
