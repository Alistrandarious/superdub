import React, { useState, useEffect } from 'react';
import './App.css';
import { api } from './api';
import WheelPicker from './WheelPicker';

const CHECKIN_KEY = 'superdub.weight.checkin';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

// 40–200 kg in 0.1 steps = 1601 values
const WEIGHT_VALUES = Array.from({ length: 1601 }, (_, i) => Math.round((40 + i * 0.1) * 10) / 10);

const DailyCheckIn: React.FC = () => {
  const [show, setShow] = useState(false);
  const [weight, setWeight] = useState(75);
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
      if (w > 0) setWeight(Math.round(w * 10) / 10); // snap to 0.1
    }).catch(() => {});
  }, [show]);

  const dismiss = () => {
    localStorage.setItem(CHECKIN_KEY, todayStr());
    setShow(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.updateTrackerDay(todayStr(), { weightKg: weight });
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
        <h2 className="checkin-title">Morning Check-in</h2>
        <p className="checkin-subtitle">Log your weight — steps can be added later.</p>

        <div className="checkin-wheels checkin-wheels-single">
          <div className="checkin-wheel-col">
            <label>Today's weight</label>
            <WheelPicker
              values={WEIGHT_VALUES}
              selected={weight}
              onSelect={setWeight}
              format={v => `${v} kg`}
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
