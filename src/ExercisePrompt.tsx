import React, { useState, useEffect } from 'react';
import './App.css';
import { api } from './api';
import { getWorkoutHour } from './push';

// ── Exercise prompt (#3) — the one-tap "did you close your loop?" from the spec.
// Time-locked: auto-appears once you're past your set workout hour (cog menu →
// Notifications → Workout), and its push notification deep-links straight here
// (?prompt=exercise). One tap writes workoutDone and it's gone.

const EX_KEY = 'superdub.exercise.checkin'; // YYYY-MM-DD once answered/skipped
const todayISO = () => new Date().toISOString().slice(0, 10);

const ExercisePrompt: React.FC = () => {
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<null | 'yes' | 'no'>(null);

  useEffect(() => {
    const open = () => { setResult(null); setShow(true); };
    window.addEventListener('superdub:show-exercise', open);
    // Time-lock: only if the user opted into a workout hour and it's passed.
    const wh = getWorkoutHour();
    let t: ReturnType<typeof setTimeout> | undefined;
    if (wh != null && localStorage.getItem(EX_KEY) !== todayISO() && new Date().getHours() >= wh) {
      t = setTimeout(open, 1500);
    }
    return () => { window.removeEventListener('superdub:show-exercise', open); if (t) clearTimeout(t); };
  }, []);

  const answer = async (did: boolean) => {
    setSaving(true);
    try {
      await api.submitCheckIn({ workoutDone: did });
      localStorage.setItem(EX_KEY, todayISO());
      window.dispatchEvent(new CustomEvent('superdub:tracker-updated'));
      setResult(did ? 'yes' : 'no');
      setTimeout(() => setShow(false), 1100);
    } catch {
      setSaving(false);
    }
  };

  const dismiss = () => { localStorage.setItem(EX_KEY, todayISO()); setShow(false); };
  if (!show) return null;

  return (
    <div className="checkin-overlay">
      <div className="checkin-modal exercise-modal">
        <h2 className="checkin-title">Exercise loop</h2>
        <p className="checkin-subtitle">Did you close your exercise loop today?</p>
        {result ? (
          <div className="checkin-done">{result === 'yes' ? '💪 Nice — logged!' : 'No worries — tomorrow.'}</div>
        ) : (
          <>
            <div className="exercise-btns">
              <button className="exercise-btn yes" onClick={() => answer(true)} disabled={saving}>Yes</button>
              <button className="exercise-btn no" onClick={() => answer(false)} disabled={saving}>No</button>
            </div>
            <button className="checkin-skip-btn" onClick={dismiss} disabled={saving}>Ask me later</button>
          </>
        )}
      </div>
    </div>
  );
};

export default ExercisePrompt;
