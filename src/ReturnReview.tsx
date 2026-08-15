// =====================================================================
// SUPERDUB — the Return Review
// The room behind the comeback screen's door. The door stays exactly one thing
// to read and one thing to do; this is what opens if someone taps "Show me where
// I stand", and nobody is ever pushed through it.
//
// Four steps, and only the ones there is data for: what held, weight, mood, and
// the habits they were quitting. There is deliberately no fifth "where next"
// step — finishing hands them back to the door, which already carries the streak
// restore and the re-plan card. Rebuilding those here would be two copies of one
// screen.
//
// Each step is its own <PromptShell key=...>. The key is load-bearing: the shell
// focuses its CTA in a mount-only effect (PromptShell.tsx:65), so swapping props
// on one element would leave focus stranded on the first step's button.
// =====================================================================
import React, { useEffect, useMemo, useState } from 'react';
import './ReturnReview.css';
import PromptShell from './PromptShell';
import { api } from './api';
import { buildReturnReview, quitAsk, type ReturnReview as Review } from './returnMath';
import { GROWTH } from './theme';

const YEAR = new Date().getFullYear();
function buildAllDays(): string[] {
  const d: string[] = [];
  for (let m = 0; m < 12; m++) {
    const n = new Date(YEAR, m + 1, 0).getDate();
    for (let day = 1; day <= n; day++) d.push(`${String(day).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}`);
  }
  return d;
}
function todayKey(): string {
  const n = new Date();
  return `${String(n.getDate()).padStart(2, '0')}/${String(n.getMonth() + 1).padStart(2, '0')}`;
}

type StepId = 'held' | 'weight' | 'mood' | 'quit';

const ReturnReview: React.FC<{
  gapDays: number;
  daysSinceReturn: number | null;
  /** Back to the door, which owns the one action. */
  onDone: () => void;
}> = ({ gapDays, daysSinceReturn, onDone }) => {
  const [review, setReview] = useState<Review | null>(null);
  const [failed, setFailed] = useState(false);
  const [at, setAt] = useState(0);
  const [quitAnswered, setQuitAnswered] = useState<Record<string, 'held' | 'reset'>>({});

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [tracker, habits, moods] = await Promise.all([
          api.getTracker(),
          api.getHabits(),
          api.getCheckInHistory(180).catch(() => ({ entries: [] })),
        ]);
        if (!live) return;
        const quitStarts: Record<string, number> = {};
        for (const h of habits) {
          const t = h.quitStartedAt ? Date.parse(h.quitStartedAt) : NaN;
          if (Number.isFinite(t)) quitStarts[h.name] = t;
        }
        setReview(buildReturnReview({
          gapDays,
          daysSinceReturn,
          habits,
          trackerHabits: tracker.habits ?? [],
          allDays: buildAllDays(),
          today: todayKey(),
          weights: (tracker.days ?? [])
            .filter(d => d.weight)
            .map(d => ({ day: d.day, weight: Number(d.weight) })),
          moods: moods.entries ?? [],
          quitStarts,
          nowMs: Date.now(),
        }));
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => { live = false; };
  }, [gapDays, daysSinceReturn]);

  // Only the steps there is something to say about. On a thin account this can
  // be a single step, which is correct: an empty step is worse than no step.
  const steps = useMemo<StepId[]>(() => {
    if (!review) return [];
    const s: StepId[] = [];
    if (review.held.length) s.push('held');
    if (review.weight) s.push('weight');
    if (review.mood) s.push('mood');
    if (review.quit.length) s.push('quit');
    return s;
  }, [review]);

  if (failed) {
    return (
      <PromptShell
        accent={GROWTH}
        eyebrow="Where you stand"
        title="Could not load that just now."
        subtitle="Nothing is wrong with your data. Try again in a moment."
        cta={{ label: 'Back to today', onClick: onDone }}
        onDismiss={onDone}
        dismissLabel="Close"
      />
    );
  }

  if (!review) {
    return (
      <PromptShell
        accent={GROWTH}
        eyebrow="Where you stand"
        title="Having a look at your data."
        onDismiss={onDone}
        dismissLabel="Close"
      />
    );
  }

  if (!steps.length) {
    return (
      <PromptShell
        accent={GROWTH}
        eyebrow="Where you stand"
        title="Not enough logged yet to show you much."
        subtitle="Mark one thing today and there will be something here next time."
        cta={{ label: 'Back to today', onClick: onDone }}
        onDismiss={onDone}
        dismissLabel="Close"
      />
    );
  }

  const step = steps[Math.min(at, steps.length - 1)];
  const last = at >= steps.length - 1;
  const next = () => (last ? onDone() : setAt(a => a + 1));
  const dots = (
    <div className="rv-dots" aria-hidden="true">
      {steps.map((s, i) => <i key={s} className={i <= at ? 'on' : undefined} />)}
    </div>
  );
  const common = {
    accent: GROWTH,
    onDismiss: onDone,
    dismissLabel: 'Close',
    art: dots,
  };
  const nextCta = { label: last ? 'Back to today' : 'Next', onClick: next };

  if (step === 'held') {
    return (
      <PromptShell
        key="held" {...common}
        eyebrow="What held"
        title="Your levels are where you left them."
        subtitle="Nothing reset while you were away."
        cta={nextCta}
      >
        <div className="rv-list">
          {review.held.map(h => (
            <div className="rv-row" key={h.name}>
              <span className="rv-lvl">{h.level}</span>
              <span className="rv-nm">
                {h.name}
                <small>LEVEL {h.level} &middot; {h.doneDays} {h.doneDays === 1 ? 'DAY' : 'DAYS'} BANKED</small>
              </span>
              {h.held && <span className="rv-tag">held</span>}
              <span className="rv-pct">{Math.round(h.adherence * 100)}%</span>
            </div>
          ))}
        </div>
        <p className="rv-note">
          Habit levels are built on days banked for good, so a gap cannot take one off you.
          The percentages only count days you were here, which is why they did not fall either.
        </p>
      </PromptShell>
    );
  }

  if (step === 'weight' && review.weight) {
    const w = review.weight;
    const up = w.delta > 0;
    const size = Math.abs(w.delta);
    return (
      <PromptShell
        key="weight" {...common}
        eyebrow="Your weight"
        title={size < 0.2
          ? 'Almost exactly where you left it.'
          : `${up ? 'Up' : 'Down'} ${size.toFixed(1)}kg while you were gone.`}
        subtitle="A fact, not a verdict. The plan moves to meet it."
        cta={nextCta}
      >
        <div className="rv-big">
          <div className="rv-big-n">{up ? '+' : ''}{w.delta.toFixed(1)}<small>kg</small></div>
          <div className="rv-big-c">over {gapDays} {gapDays === 1 ? 'day' : 'days'} away</div>
        </div>
        <div className="rv-pair">
          <div><div className="rv-v">{w.before.toFixed(1)}</div><div className="rv-l">When you left</div></div>
          <div><div className="rv-v">{w.after.toFixed(1)}</div><div className="rv-l">Now</div></div>
        </div>
        <p className="rv-note">
          Measured between your last weigh-in before the gap and your first one back.
          Nothing in between is guessed at.
        </p>
      </PromptShell>
    );
  }

  if (step === 'mood' && review.mood) {
    const m = review.mood;
    const down = m.delta < -0.3;
    return (
      <PromptShell
        key="mood" {...common}
        eyebrow="Your mood"
        title={down ? 'It dipped, and then you came back.' : 'It held steady.'}
        subtitle="From the check-ins either side of the gap."
        cta={nextCta}
      >
        <div className="rv-pair">
          <div><div className="rv-v">{m.before.toFixed(1)}</div><div className="rv-l">Before the gap</div></div>
          <div>
            <div className={`rv-v ${down ? 'rv-warn' : 'rv-good'}`}>{m.after.toFixed(1)}</div>
            <div className="rv-l">Since you are back</div>
          </div>
        </div>
        <p className="rv-note">
          Out of 10, averaged over the check-ins on each side. Days you did not check in are
          left out rather than counted as bad ones.
        </p>
      </PromptShell>
    );
  }

  // The one the app cannot answer. The clean clock is wall time, so it advanced
  // through the gap on its own. Ask, never assert.
  const q = review.quit[0];
  const answered = quitAnswered[q.name];
  const resetClock = async () => {
    setQuitAnswered(p => ({ ...p, [q.name]: 'reset' }));
    try { await api.setQuitStart(q.name, new Date().toISOString()); } catch { /* the answer still stands */ }
  };
  return (
    <PromptShell
      key="quit" {...common}
      eyebrow={`The one you were quitting`}
      title={answered === 'reset' ? 'Clock restarted. Today is day one.' : 'The clock kept running. Did you?'}
      subtitle={answered
        ? undefined
        : 'We genuinely do not know, so we are asking rather than assuming.'}
      cta={nextCta}
    >
      <div className="rv-clock">
        <div className="rv-clock-d">{answered === 'reset' ? 0 : q.days}</div>
        <div className="rv-l">Days on the clock &middot; {q.name}</div>
      </div>
      {!answered && (
        <div className="rv-ask">
          <p>{quitAsk(q.days)}</p>
          <div className="rv-ask-btns">
            <button className="rv-yes" onClick={() => setQuitAnswered(p => ({ ...p, [q.name]: 'held' }))}>
              It held
            </button>
            <button onClick={resetClock}>Reset it</button>
          </div>
        </div>
      )}
      <p className="rv-note">
        {answered === 'held' && 'Kept as it was. Nothing else changed.'}
        {answered === 'reset' && 'An honest number beats a long one. Nothing else changed.'}
        {!answered && 'Resetting costs you nothing but the number, and an honest number is worth more than a long one.'}
      </p>
    </PromptShell>
  );
};

export default ReturnReview;
