import React, { useState, useEffect } from 'react';
import './App.css';
import { api } from './api';
import { promptEnabled } from './promptPrefs';
import { getLoggingDay } from './day';
import { EVENING_REFLECTION } from './systemHabits';
import PromptShell from './PromptShell';
import { TEAL } from './theme';
import { lapsePending } from './LapseBanner';

// ── Evening reflection — the sleek end-of-day step: how the day felt (mood) and
// whether eating landed on plan. Time-locked to the evening (6 PM+, once/day) so
// you're rating a day that's actually over. The eating signal feeds the plan
// engine's confidence (churn / coaching / TDEE), so it stays even though calorie
// logging is gone. A push deep-links here (?prompt=evening).

const EVENING_KEY = 'superdub.evening.checkin';   // value = YYYY-MM-DD when done
const ENABLED_KEY = 'superdub.checkin.enabled';   // 'false' = disabled
const todayISO = () => new Date().toISOString().slice(0, 10);
const isEnabled = () => localStorage.getItem(ENABLED_KEY) !== 'false';

// True when the reflection is about to auto-show (evening, not done, enabled).
// Habits checks this so its day overlay waits its turn instead of stacking on top;
// 'superdub:evening-closed' / 'superdub:checkin-done' then let it open.
export const eveningPending = () =>
  isEnabled() && localStorage.getItem(EVENING_KEY) !== todayISO() && new Date().getHours() >= 18;

// 5-point eating scale → the 3-value enum the plan engine understands.
function adherenceEnum(level: number): 'below' | 'about' | 'above' {
  return level <= -1 ? 'below' : level >= 1 ? 'above' : 'about';
}
const EATING_BLOCKS: { level: number; sym: string; label: string }[] = [
  { level: -2, sym: '−−', label: 'Well under' },
  { level: -1, sym: '−', label: 'Under' },
  { level: 0, sym: '✓', label: 'About right' },
  { level: 1, sym: '+', label: 'Over' },
  { level: 2, sym: '++', label: 'Well over' },
];

const EveningPrompt: React.FC = () => {
  const moodOn = promptEnabled('mood');
  const [show, setShow] = useState(false);
  const [mood, setMood] = useState(6);
  const [moodTouched, setMoodTouched] = useState(false);
  const [adherenceLevel, setAdherenceLevel] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setMood(6); setMoodTouched(false); setAdherenceLevel(null);
    setDone(false); setError(null);
  };

  useEffect(() => {
    const open = () => { reset(); setShow(true); };
    window.addEventListener('superdub:show-evening', open);
    // Time-lock: evenings only (6 PM+), once/day, if daily check-ins are enabled.
    // The manual/push trigger ('superdub:show-evening') bypasses the hour gate.
    const alreadyDone = () => localStorage.getItem(EVENING_KEY) === todayISO();
    let t: ReturnType<typeof setTimeout> | undefined;
    // lapsePending: the return screen gets the first open back to itself.
    if (isEnabled() && !alreadyDone() && new Date().getHours() >= 18 && !lapsePending()) {
      t = setTimeout(open, 1500);
    }
    return () => { window.removeEventListener('superdub:show-evening', open); if (t) clearTimeout(t); };
  }, []);

  const dismiss = () => {
    localStorage.setItem(EVENING_KEY, todayISO());
    setShow(false);
    // Skipping still hands the stage over to the deferred habit overlay.
    window.dispatchEvent(new CustomEvent('superdub:evening-closed'));
  };

  const canSave = (moodOn ? moodTouched : true) && adherenceLevel !== null;
  const save = async () => {
    if (!canSave || adherenceLevel === null) return;
    setSaving(true); setError(null);
    try {
      await api.submitCheckIn({
        ...(moodOn ? { mood } : {}),  // stored 1–10, matching the slider
        adherence: adherenceEnum(adherenceLevel),
        adherenceLevel,
      });
      // Evening reflection earns XP via its system habit.
      api.toggleTrackerHabit(getLoggingDay(), EVENING_REFLECTION, 'done')
        .then(() => window.dispatchEvent(new CustomEvent('superdub:tracker-updated')))
        .catch(() => {});
      localStorage.setItem(EVENING_KEY, todayISO());
      window.dispatchEvent(new CustomEvent('superdub:tracker-updated'));
      window.dispatchEvent(new CustomEvent('superdub:checkin-done'));
      setDone(true);
      setTimeout(() => setShow(false), 900);
    } catch (e: any) {
      setError(e?.message ?? 'Could not save. Tap to retry.');
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <PromptShell
      accent={TEAL}
      eyebrow="Evening"
      title="How did today land?"
      subtitle="Be honest, no score kept."
      cta={done ? undefined : {
        label: saving ? 'Saving…' : error ? 'Retry' : canSave ? 'Log it' : moodOn ? 'Mood + eating' : 'Pick eating',
        onClick: save,
        disabled: saving || !canSave,
      }}
      onDismiss={dismiss}
    >
      {/* Mood, 1–10. No thumb until you tap and slide to lock it in. */}
      {moodOn && (
        <div className="vitals-step">
          <div className="vitals-label"><span>Mood today</span><span className="vitals-value">{moodTouched ? mood : '–'}<span className="vitals-of">/10</span></span></div>
          <input
            type="range" min={1} max={10} step={1} value={mood}
            className={`vitals-slider mood${moodTouched ? '' : ' untouched'}`}
            onChange={e => { setMood(parseInt(e.target.value, 10)); setMoodTouched(true); }}
            aria-label="Mood today"
          />
          <div className="vitals-scale"><span>rough</span><span>great</span></div>
        </div>
      )}

      {/* Eating, feeds the plan engine's confidence. Slides in once mood is set;
          shown straight away when mood is off. */}
      <div className={`adherence-section${moodOn ? ` vitals-reveal${moodTouched ? ' in' : ''}` : ''}`}>
        <p className="energy-label-row">
          Eating vs. your target today?
          {adherenceLevel !== null && (
            <span className="energy-selected-label"> · {EATING_BLOCKS.find(b => b.level === adherenceLevel)?.label}</span>
          )}
        </p>
        <div className="eating-blocks">
          {EATING_BLOCKS.map(b => (
            <button
              key={b.level}
              className={`eating-block${adherenceLevel === b.level ? ' selected' : ''}${b.level === 0 ? ' mid' : ''}`}
              onClick={() => setAdherenceLevel(b.level)}
              aria-label={b.label}
            >
              {b.sym}
            </button>
          ))}
        </div>
        <div className="energy-pip-labels">
          <span>Well under</span>
          <span>Well over</span>
        </div>
      </div>

      {done && <div className="checkin-done">✓ Logged! +5 XP</div>}
      {error && !done && <p className="checkin-error">{error}</p>}
    </PromptShell>
  );
};

export default EveningPrompt;
