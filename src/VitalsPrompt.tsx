import React, { useState, useEffect } from 'react';
import './App.css';
import { api } from './api';
import SleepRangeSlider, { axisToHHMM, DEFAULT_BED, DEFAULT_WAKE } from './SleepRangeSlider';
import { promptEnabled } from './promptPrefs';
import { getLoggingDay } from './day';
import { MORNING_VITALS } from './systemHabits';
import PromptShell from './PromptShell';
import { TEAL } from './theme';

// ── Vitals prompt — the sleek morning "how did you sleep & feel?" step from the
// prompt-system spec. One focused pop-up (not the old combined check-in): a
// two-thumb "between" sleep slider (bedtime → wake, capturing both), then mood
// and energy on 1–10 sliders that reveal one after another. Stored as
// sleepHours + bedtime/waketime (feeds the candlestick) + energy/mood (mapped
// to the engine's 1–5 scale, which the coaching + step-target logic expects).

const VITALS_KEY = 'superdub.vitals.checkin'; // value = YYYY-MM-DD when done
const todayISO = () => new Date().toISOString().slice(0, 10);
const to5 = (v: number) => Math.max(1, Math.min(5, Math.round(v / 2))); // 1–10 → 1–5

const VitalsPrompt: React.FC = () => {
  const sleepOn = promptEnabled('sleep');
  const energyOn = promptEnabled('energy');
  const [show, setShow] = useState(false);
  const [bed, setBed] = useState(DEFAULT_BED);   // axis: hours after 6pm
  const [wake, setWake] = useState(DEFAULT_WAKE);
  const [sleepTouched, setSleepTouched] = useState(false);
  const [energy, setEnergy] = useState(6);
  const [energyTouched, setEnergyTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setBed(DEFAULT_BED); setWake(DEFAULT_WAKE); setSleepTouched(false);
    setEnergy(6); setEnergyTouched(false);
    setDone(false); setError(null);
  };

  useEffect(() => {
    const open = () => { reset(); setShow(true); };
    window.addEventListener('superdub:show-vitals', open);

    // Time-lock: this is the morning step. Roll in after the weight prompt saves
    // (its checkin-done), or on open if weight's already handled — mornings only,
    // once/day. The VITALS_KEY guard stops our own save from re-triggering it.
    // Auto-open only if at least one of its fields is wanted (manual trigger above
    // always opens so the cog "Log Check-in" still works).
    const done = () => localStorage.getItem(VITALS_KEY) === todayISO();
    const morning = () => new Date().getHours() < 12;
    const morningAuto = () => { if ((sleepOn || energyOn) && !done() && morning()) open(); };
    window.addEventListener('superdub:checkin-done', morningAuto);
    let t: ReturnType<typeof setTimeout> | undefined;
    if (!done() && morning() && localStorage.getItem('superdub.weight.checkin') === todayISO()) {
      t = setTimeout(morningAuto, 1500);
    }
    return () => {
      window.removeEventListener('superdub:show-vitals', open);
      window.removeEventListener('superdub:checkin-done', morningAuto);
      if (t) clearTimeout(t);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = () => { localStorage.setItem(VITALS_KEY, todayISO()); setShow(false); };

  const canSave = (sleepOn ? sleepTouched : true) && (energyOn ? energyTouched : true) && (sleepOn || energyOn);
  const save = async () => {
    if (!canSave) return;
    setSaving(true); setError(null);
    try {
      await api.submitCheckIn({
        ...(energyOn ? { energy: to5(energy) } : {}),
        ...(sleepOn ? {
          sleepHours: +(wake - bed).toFixed(1),
          sleepBedtime: axisToHHMM(bed), sleepWaketime: axisToHHMM(wake),
        } : {}),
      });
      // Morning vitals earns XP via its system habit.
      api.toggleTrackerHabit(getLoggingDay(), MORNING_VITALS, 'done')
        .then(() => window.dispatchEvent(new CustomEvent('superdub:tracker-updated')))
        .catch(() => {});
      localStorage.setItem(VITALS_KEY, todayISO());
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
      eyebrow="Vitals · Morning"
      title="How did you sleep?"
      subtitle="This sets how hard to push today."
      cta={done ? undefined : { label: saving ? 'Saving…' : error ? 'Retry' : 'Save vitals', onClick: save, disabled: saving || !canSave }}
      onDismiss={dismiss}
    >
      {done ? (
        <div className="checkin-done">✓ Logged! +5 XP</div>
      ) : (
        <>
          {/* Sleep, a two-thumb "between" slider: drag bedtime and wake time */}
          {sleepOn && (
            <div className="vitals-step">
              <div className="vitals-label"><span>Sleep last night</span></div>
              <SleepRangeSlider
                bed={bed} wake={wake}
                onChange={(b, w) => { setBed(b); setWake(w); setSleepTouched(true); }}
              />
            </div>
          )}

          {/* Energy, 1–10. No thumb until you tap and slide to lock it in. Slides in
              after sleep when both are on; shown straight away when sleep is off. */}
          {energyOn && (
            <div className={`vitals-step${sleepOn ? ` vitals-reveal${sleepTouched ? ' in' : ''}` : ''}`}>
              <div className="vitals-label"><span>Energy</span><span className="vitals-value">{energyTouched ? energy : '–'}<span className="vitals-of">/10</span></span></div>
              <input
                type="range" min={1} max={10} step={1} value={energy}
                className={`vitals-slider${energyTouched ? '' : ' untouched'}`}
                onChange={e => { setEnergy(parseInt(e.target.value, 10)); setEnergyTouched(true); }}
                aria-label="Energy"
              />
              <div className="vitals-scale"><span>drained</span><span>peak</span></div>
            </div>
          )}

          {error && <p className="checkin-error">{error}</p>}
        </>
      )}
    </PromptShell>
  );
};

export default VitalsPrompt;
