import React, { useState, useEffect } from 'react';
import { api } from './api';

const ENERGY_KEY = 'superdub.energy.checkin';   // value = YYYY-MM-DD
const ENABLED_KEY = 'superdub.checkin.enabled';  // 'false' = disabled
const ENERGY_SNOOZE_KEY = 'superdub.energy.snooze'; // timestamp (ms) — "Log later" re-asks after 6 PM

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function todayDDMM() {
  const n = new Date();
  return `${String(n.getDate()).padStart(2, '0')}/${String(n.getMonth() + 1).padStart(2, '0')}`;
}

// Hours between last night's bedtime and this morning's wake time (handles
// crossing midnight). Returns null if either is missing/invalid.
function sleepHoursFrom(bed: string, wake: string): number | null {
  if (!bed || !wake) return null;
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  if ([bh, bm, wh, wm].some(n => isNaN(n))) return null;
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 10) / 10;
}

// 5-point eating scale → the 3-value enum the plan engine understands
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
  // Eating adherence as a 5-point scale (-2..+2); the 3-value enum for the
  // plan engine is derived from it.
  const [adherenceLevel, setAdherenceLevel] = useState<number | null>(null);
  const [workoutDone, setWorkoutDone] = useState<boolean | null>(null);
  const [workoutIntensity, setWorkoutIntensity] = useState<WorkoutIntensity | null>(null);
  const [workoutDuration, setWorkoutDuration] = useState<number | null>(null);
  const [workoutCalories, setWorkoutCalories] = useState<number | null>(null);
  const [bedtime, setBedtime] = useState('');   // 'HH:MM' last night
  const [waketime, setWaketime] = useState(''); // 'HH:MM' this morning
  const [weight, setWeight] = useState(''); // optional morning weigh-in
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only auto-prompt in the evening (6 PM+) — you can't rate a day that isn't over.
  // The manual cog trigger ('superdub:show-energy-checkin') bypasses this.
  const shouldShowToday = () =>
    isEnabled() && localStorage.getItem(ENERGY_KEY) !== todayISO()
    && Date.now() >= snoozeUntilMs() && new Date().getHours() >= 18;

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
      setAdherenceLevel(null);
      setWorkoutDone(null);
      setWorkoutIntensity(null);
      setWorkoutDuration(null);
      setWorkoutCalories(null);
      setBedtime('');
      setWaketime('');
      setWeight('');
      setShow(true);
    };
    window.addEventListener('superdub:show-energy-checkin', handler);
    return () => window.removeEventListener('superdub:show-energy-checkin', handler);
  }, []);

  const sleepHours = sleepHoursFrom(bedtime, waketime);
  const canSave = !!(energy && mood && adherenceLevel !== null && workoutDone !== null &&
    (workoutDone === false || (workoutIntensity && workoutDuration)));

  const save = async () => {
    if (!canSave || !energy || !mood || adherenceLevel === null) return;
    setSaving(true);
    setError(null);
    try {
      const result: any = await api.submitCheckIn({
        energy,
        adherence: adherenceEnum(adherenceLevel),
        adherenceLevel,
        mood,
        workoutDone: workoutDone ?? false,
        workoutIntensity: workoutDone ? workoutIntensity ?? undefined : undefined,
        workoutDurationMin: workoutDone ? workoutDuration ?? undefined : undefined,
        sleepHours: sleepHours ?? undefined,
        sleepBedtime: bedtime || undefined,
        sleepWaketime: waketime || undefined,
      });
      // Optional morning weigh-in — write today's tracker weight alongside
      const w = parseFloat(weight);
      if (w > 0) {
        await api.updateTrackerDay(todayDDMM(), { weight: String(w) }).catch(() => {});
        window.dispatchEvent(new CustomEvent('superdub:tracker-updated'));
      }
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
        <p className="checkin-subtitle">Your daily ritual — thirty seconds, all of it optional but the taps.</p>

        {/* Optional morning weigh-in — saves to the tracker with everything else */}
        <div className="energy-section">
          <p className="energy-label-row">Weigh-in <span className="ritual-optional">optional</span></p>
          <div className="ritual-weight-row">
            <input
              type="text" inputMode="decimal" className="ritual-weight-input"
              placeholder="—" value={weight}
              onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setWeight(v); }}
            />
            <span className="ritual-weight-unit">kg</span>
          </div>
        </div>

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

        {/* Sleep — two points: when you went to bed and when you woke */}
        <div className="energy-section">
          <p className="energy-label-row">
            Sleep last night
            {sleepHours != null && (
              <span className="energy-selected-label"> — {sleepHours % 1 === 0 ? sleepHours : sleepHours.toFixed(1)} h</span>
            )}
          </p>
          <div className="sleep-times">
            <label className="sleep-time-field">
              <span className="sleep-time-label">Bed</span>
              <input type="time" className="sleep-time-input" value={bedtime} onChange={e => setBedtime(e.target.value)} />
            </label>
            <span className="sleep-time-arrow">→</span>
            <label className="sleep-time-field">
              <span className="sleep-time-label">Woke</span>
              <input type="time" className="sleep-time-input" value={waketime} onChange={e => setWaketime(e.target.value)} />
            </label>
          </div>
        </div>

        {/* Eating — 5-block scale from well-under to well-over */}
        <div className="adherence-section">
          <p className="energy-label-row">
            Eating vs. your target today?
            {adherenceLevel !== null && (
              <span className="energy-selected-label"> — {EATING_BLOCKS.find(b => b.level === adherenceLevel)?.label}</span>
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
