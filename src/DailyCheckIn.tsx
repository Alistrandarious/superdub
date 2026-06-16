import React, { useState, useEffect } from 'react';
import './App.css';
import { api } from './api';
import WheelPicker from './WheelPicker';

const CHECKIN_KEY = 'superdub.checkin';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

const WEIGHT_VALUES = Array.from({ length: 321 }, (_, i) => Math.round((40 + i * 0.5) * 10) / 10); // 40–200 in 0.5 steps
const STEP_VALUES   = Array.from({ length: 101 }, (_, i) => i * 500); // 0–50000 in 500 steps

const DailyCheckIn: React.FC = () => {
  const [show, setShow] = useState(false);
  const [weight, setWeight] = useState(75);
  const [steps, setSteps] = useState(8000);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(CHECKIN_KEY) === todayStr()) return;
    // Small delay so it doesn't flash on first render
    const t = setTimeout(() => setShow(true), 800);
    return () => clearTimeout(t);
  }, []);

  // Pre-fill weight from profile if available
  useEffect(() => {
    if (!show) return;
    api.getProfile().then((p: any) => {
      const w = parseFloat(p.weightKg);
      if (w > 0) setWeight(Math.round(w * 2) / 2); // snap to 0.5
    }).catch(() => {});
  }, [show]);

  const dismiss = () => {
    localStorage.setItem(CHECKIN_KEY, todayStr());
    setShow(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        api.updateTrackerDay(todayStr(), { weightKg: weight }),
        api.updateTrackerDay(yesterdayStr(), { steps }),
      ]);
      setDone(true);
      setTimeout(dismiss, 900);
    } catch {
      dismiss();
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div className="checkin-overlay">
      <div className="checkin-modal">
        <h2 className="checkin-title">Daily Check-in</h2>
        <p className="checkin-sub">Takes 5 seconds — keeps your data accurate.</p>

        <div className="checkin-wheels">
          <div className="checkin-wheel-col">
            <span className="checkin-wheel-label">Today's weight</span>
            <WheelPicker
              values={WEIGHT_VALUES}
              selected={weight}
              onSelect={setWeight}
              format={v => `${v} kg`}
            />
          </div>
          <div className="checkin-divider" />
          <div className="checkin-wheel-col">
            <span className="checkin-wheel-label">Yesterday's steps</span>
            <WheelPicker
              values={STEP_VALUES}
              selected={steps}
              onSelect={setSteps}
              format={v => v.toLocaleString()}
            />
          </div>
        </div>

        <div className="checkin-actions">
          {done ? (
            <div className="checkin-done">✓ Logged!</div>
          ) : (
            <>
              <button className="checkin-save-btn" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Log it'}
              </button>
              <button className="checkin-skip-btn" onClick={dismiss}>Skip for today</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyCheckIn;
