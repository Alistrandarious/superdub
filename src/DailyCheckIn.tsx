import React, { useState, useEffect } from 'react';
import './App.css';
import { api } from './api';
import WheelPicker from './WheelPicker';

const CHECKIN_KEY = 'superdub.weight.checkin';

function todayStr() {
  const n = new Date();
  return `${String(n.getDate()).padStart(2, '0')}/${String(n.getMonth() + 1).padStart(2, '0')}`;
}


const KG_VALUES  = Array.from({ length: 161 }, (_, i) => 40 + i);
const DEC_VALUES = Array.from({ length: 20  }, (_, i) => Math.round(i * 0.05 * 100) / 100);

const DailyCheckIn: React.FC = () => {
  const [show, setShow] = useState(false);
  const [wholeKg, setWholeKg] = useState(75);
  const [decKg, setDecKg]   = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone]     = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const applyProfileWeight = () => {
    api.getProfile().then((p: any) => {
      const w = parseFloat(p.weightKg);
      if (w > 0) {
        setWholeKg(Math.floor(w));
        setDecKg(Math.round((w % 1) / 0.05) * 0.05);
      }
    }).catch(() => {});
  };

  useEffect(() => {
    if (localStorage.getItem(CHECKIN_KEY) === todayStr()) return;
    applyProfileWeight();
    const t = setTimeout(() => setShow(true), 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = () => {
      setDone(false);
      setError(null);
      applyProfileWeight();
      setShow(true);
    };
    window.addEventListener('superdub:show-checkin', handler);
    return () => window.removeEventListener('superdub:show-checkin', handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(CHECKIN_KEY, todayStr());
    setShow(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const weight = Math.round((wholeKg + decKg) * 100) / 100;
    try {
      await api.updateTrackerDay(todayStr(), { weight });
      await api.updateProfile({ weightKg: weight }).catch(() => {});
      window.dispatchEvent(new CustomEvent('superdub:tracker-updated'));
      setDone(true);
      setTimeout(dismiss, 900);
    } catch (err: any) {
      console.error('[DailyCheckIn] save failed:', err?.message ?? err);
      setError(err?.message ?? 'Could not save. Tap to retry.');
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  const displayWeight = (wholeKg + decKg).toFixed(2);

  return (
    <div className="checkin-overlay">
      <div className="checkin-modal">
        <h2 className="checkin-title">Morning Check-in</h2>
        <p className="checkin-subtitle">Weigh yourself first thing in the morning, after using the bathroom and before eating — this gives you the most consistent reading.</p>

        <div className="checkin-weight-display">{displayWeight} <span>kg</span></div>

        <div className="checkin-wheels">
          <div className="checkin-wheel-col">
            <label>kg</label>
            <WheelPicker
              values={KG_VALUES}
              selected={wholeKg}
              onSelect={setWholeKg}
              format={v => String(v)}
            />
          </div>
          <div className="checkin-weight-dot">.</div>
          <div className="checkin-wheel-col">
            <label>+kg</label>
            <WheelPicker
              values={DEC_VALUES}
              selected={decKg}
              onSelect={setDecKg}
              format={v => v.toFixed(2).slice(1)}
            />
          </div>
        </div>

        <div className="checkin-actions">
          {done ? (
            <div className="checkin-done">✓ Logged!</div>
          ) : (
            <>
              {error && <p className="checkin-error">{error}</p>}
              <button className="checkin-save-btn" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : error ? 'Retry' : 'Log it'}
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

export default DailyCheckIn;
