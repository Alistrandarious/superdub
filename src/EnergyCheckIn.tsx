import React, { useState, useEffect } from 'react';
import { api } from './api';

const ENERGY_KEY = 'superdub.energy.checkin';   // value = YYYY-MM-DD
const ENABLED_KEY = 'superdub.checkin.enabled';  // 'false' = disabled
const ENERGY_SNOOZE_KEY = 'superdub.energy.snooze'; // timestamp (ms) — "Log later" re-asks after 6 PM

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function snoozeUntilMs() {
  return parseInt(localStorage.getItem(ENERGY_SNOOZE_KEY) || '0', 10);
}

function isEnabled() {
  return localStorage.getItem(ENABLED_KEY) !== 'false';
}

const ENERGY_LABELS: Record<number, string> = {
  1: 'Exhausted', 2: 'Low', 3: 'Okay', 4: 'Good', 5: 'Great',
};
const MOOD_LABELS: Record<number, string> = {
  1: 'Rough', 2: 'Low', 3: 'Neutral', 4: 'Good', 5: 'Great',
};

type WorkoutIntensity = 'light' | 'moderate' | 'intense' | 'very_intense';

const INTENSITY_LABELS: Record<WorkoutIntensity, string> = {
  light: 'Light',
  moderate: 'Moderate',
  intense: 'Intense',
  very_intense: 'Very Intense',
};

const DURATION_OPTIONS = [20, 30, 45, 60, 90];

const EnergyCheckIn: React.FC = () => {
  const [show, setShow] = useState(false);
  const [energy, setEnergy] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [adherence, setAdherence] = useState<'below' | 'about' | 'above' | null>(null);
  const [workoutDone, setWorkoutDone] = useState<boolean | null>(null);
  const [workoutIntensity, setWorkoutIntensity] = useState<WorkoutIntensity | null>(null);
  const [workoutDuration, setWorkoutDuration] = useState<number | null>(null);
  const [workoutCalories, setWorkoutCalories] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shouldShowToday = () =>
    isEnabled() && localStorage.getItem(ENERGY_KEY) !== todayISO() && Date.now() >= snoozeUntilMs();

  const dismiss = () => {
    localStorage.setItem(ENERGY_KEY, todayISO());
    localStorage.removeItem(ENERGY_SNOOZE_KEY);
    setShow(false);
  };

  // "Log later" — re-ask this evening (after 6 PM), when you can actually rate the day.
  const logLater = () => {
    const now = new Date();
    const six = new Date(now); six.setHours(18, 0, 0, 0);
    const until = now < six ? six.getTime() : now.getTime() + 2 * 60 * 60 * 1000;
    localStorage.setItem(ENERGY_SNOOZE_KEY, String(until));
    setShow(false);
    setTimeout(() => { if (shouldShowToday()) setShow(true); }, until - now.getTime());
  };

  // Show after weight check-in completes (weight dispatches tracker-updated),
  // or fall back to a 10-second delay on first load.
  useEffect(() => {
    if (!shouldShowToday()) return;

    // Listen for weight check-in completion
    const onWeightSaved = () => {
      if (shouldShowToday()) setShow(true);
    };
    window.addEventListener('superdub:checkin-done', onWeightSaved);

    // Fallback: if they skipped weight or already had it logged, show after 10s
    const fallback = setTimeout(() => {
      if (shouldShowToday()) setShow(true);
    }, 10000);

    return () => {
      window.removeEventListener('superdub:checkin-done', onWeightSaved);
      clearTimeout(fallback);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual trigger (e.g. from a settings page)
  useEffect(() => {
    const handler = () => {
      setDone(false);
      setError(null);
      setEnergy(null);
      setMood(null);
      setAdherence(null);
      setWorkoutDone(null);
      setWorkoutIntensity(null);
      setWorkoutDuration(null);
      setWorkoutCalories(null);
      setShow(true);
    };
    window.addEventListener('superdub:show-energy-checkin', handler);
    return () => window.removeEventListener('superdub:show-energy-checkin', handler);
  }, []);

  const canSave = !!(energy && mood && adherence && workoutDone !== null &&
    (workoutDone === false || (workoutIntensity && workoutDuration)));

  const save = async () => {
    if (!canSave || !energy || !mood || !adherence) return;
    setSaving(true);
    setError(null);
    try {
      const result: any = await api.submitCheckIn(
        energy, adherence, mood,
        workoutDone ?? false,
        workoutDone ? workoutIntensity ?? undefined : undefined,
        workoutDone ? workoutDuration ?? undefined : undefined,
      );
      if (result?.workoutCalories) setWorkoutCalories(result.workoutCalories);
      setDone(true);
      setTimeout(dismiss, 2000);
    } catch (err: any) {
      setError(err?.message ?? 'Could not save. Tap to retry.');
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div className="checkin-overlay">
      <div className="checkin-modal energy-checkin-modal">
        <h2 className="checkin-title">How's today feeling?</h2>
        <p className="checkin-subtitle">Two quick taps — no logging required.</p>

        {/* Energy scale */}
        <div className="energy-section">
          <p className="energy-label-row">
            Energy
            {energy !== null && (
              <span className="energy-selected-label"> — {ENERGY_LABELS[energy]}</span>
            )}
          </p>
          <div className="energy-pips">
            {[1, 2, 3, 4, 5].map(v => (
              <button
                key={v}
                className={`energy-pip${energy === v ? ' selected' : ''}`}
                onClick={() => setEnergy(v)}
                aria-label={ENERGY_LABELS[v]}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="energy-pip-labels">
            <span>Exhausted</span>
            <span>Great</span>
          </div>
        </div>

        {/* Mood scale */}
        <div className="energy-section">
          <p className="energy-label-row">
            Mood
            {mood !== null && (
              <span className="energy-selected-label"> — {MOOD_LABELS[mood]}</span>
            )}
          </p>
          <div className="energy-pips">
            {[1, 2, 3, 4, 5].map(v => (
              <button
                key={v}
                className={`energy-pip mood-pip${mood === v ? ' selected-mood' : ''}`}
                onClick={() => setMood(v)}
                aria-label={MOOD_LABELS[v]}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="energy-pip-labels">
            <span>Rough</span>
            <span>Great</span>
          </div>
        </div>

        {/* Adherence — eating relative to target */}
        <div className="adherence-section">
          <p className="energy-label-row">Eating vs. your target today?</p>
          <div className="adherence-btns">
            {(['below', 'about', 'above'] as const).map(a => {
              const labels = { below: 'Below target', about: 'About right', above: 'Above target' };
              return (
                <button
                  key={a}
                  className={`adherence-btn${adherence === a ? ' selected' : ''}`}
                  onClick={() => setAdherence(a)}
                >
                  {labels[a]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Workout section */}
        <div className="adherence-section">
          <p className="energy-label-row">Did you work out today?</p>
          <div className="adherence-btns">
            <button
              className={`adherence-btn${workoutDone === true ? ' selected' : ''}`}
              onClick={() => setWorkoutDone(true)}
            >Yes</button>
            <button
              className={`adherence-btn${workoutDone === false ? ' selected' : ''}`}
              onClick={() => { setWorkoutDone(false); setWorkoutIntensity(null); setWorkoutDuration(null); }}
            >No</button>
          </div>
        </div>

        {workoutDone === true && (
          <>
            <div className="adherence-section">
              <p className="energy-label-row">Intensity</p>
              <div className="workout-intensity-btns">
                {(['light', 'moderate', 'intense', 'very_intense'] as WorkoutIntensity[]).map(lvl => (
                  <button
                    key={lvl}
                    className={`workout-intensity-btn${workoutIntensity === lvl ? ' selected' : ''}`}
                    onClick={() => setWorkoutIntensity(lvl)}
                  >{INTENSITY_LABELS[lvl]}</button>
                ))}
              </div>
            </div>
            <div className="adherence-section">
              <p className="energy-label-row">Duration</p>
              <div className="workout-duration-btns">
                {DURATION_OPTIONS.map(d => (
                  <button
                    key={d}
                    className={`workout-duration-btn${workoutDuration === d ? ' selected' : ''}`}
                    onClick={() => setWorkoutDuration(d)}
                  >{d === 90 ? '90+ min' : `${d} min`}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="checkin-actions">
          {done ? (
            <div className="checkin-done">
              ✓ Logged! +5 XP
              {workoutCalories != null && (
                <span className="checkin-workout-cal"> · ~{workoutCalories} kcal burned</span>
              )}
            </div>
          ) : (
            <>
              {error && <p className="checkin-error">{error}</p>}
              <button
                className="checkin-save-btn"
                onClick={save}
                disabled={saving || !canSave}
              >
                {saving ? 'Saving…' : error ? 'Retry' : 'Log it'}
              </button>
              <button className="checkin-later-btn" onClick={logLater} disabled={saving}>
                Log later
              </button>
              <button className="checkin-skip-btn" onClick={dismiss} disabled={saving}>
                Skip today
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnergyCheckIn;
