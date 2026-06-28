import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { api } from './api';

const CHECKIN_KEY = 'superdub.weight.checkin';
const SNOOZE_KEY = 'superdub.weight.snooze';   // timestamp (ms) to re-ask after "Ask me later"
const SNOOZE_MS = 2 * 60 * 60 * 1000;           // 2 hours

function todayStr() {
  const n = new Date();
  return `${String(n.getDate()).padStart(2, '0')}/${String(n.getMonth() + 1).padStart(2, '0')}`;
}

// DD/MM → sortable number (this-year data) so we can find the most recent entry.
function ddmmNum(ddmm: string): number {
  const [d, m] = ddmm.split('/').map(Number);
  return (m || 0) * 100 + (d || 0);
}

const DailyCheckIn: React.FC = () => {
  const [show, setShow] = useState(false);
  const [weight, setWeight] = useState('');   // the typed value
  const [saving, setSaving] = useState(false);
  const [done, setDone]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Prefill with the most recent weight the user has logged (yesterday's carries
  // over to today), falling back to their profile weight.
  const prefillWeight = async () => {
    try {
      const data: any = await api.getTracker();
      const today = ddmmNum(todayStr());
      const weighed = (data?.days ?? [])
        .filter((d: any) => d.weight && ddmmNum(d.day) <= today)
        .sort((a: any, b: any) => ddmmNum(b.day) - ddmmNum(a.day));
      if (weighed.length > 0) {
        setWeight(String(Math.round(parseFloat(weighed[0].weight) * 100) / 100));
        return;
      }
    } catch {}
    try {
      const p: any = await api.getProfile();
      const w = parseFloat(p.weightKg);
      if (w > 0) setWeight(String(Math.round(w * 100) / 100));
    } catch {}
  };

  useEffect(() => {
    if (localStorage.getItem(CHECKIN_KEY) === todayStr()) return;
    let cancelled = false;
    let tid: ReturnType<typeof setTimeout>;
    api.getTracker().then((data: any) => {
      if (cancelled) return;
      const today = todayStr();
      const todayEntry = data?.days?.find((d: any) => d.day === today);
      if (todayEntry?.weight) {
        localStorage.setItem(CHECKIN_KEY, today);
        return;
      }
      // Prefill from the latest prior weight in the same payload.
      const todayN = ddmmNum(today);
      const weighed = (data?.days ?? [])
        .filter((d: any) => d.weight && ddmmNum(d.day) <= todayN)
        .sort((a: any, b: any) => ddmmNum(b.day) - ddmmNum(a.day));
      if (weighed.length > 0) setWeight(String(Math.round(parseFloat(weighed[0].weight) * 100) / 100));
      else prefillWeight();
      const snooze = parseInt(localStorage.getItem(SNOOZE_KEY) || '0', 10);
      const delay = snooze > Date.now() ? (snooze - Date.now()) : 800;
      tid = setTimeout(() => setShow(true), delay);
    }).catch(() => {
      if (!cancelled) { prefillWeight(); tid = setTimeout(() => setShow(true), 800); }
    });
    return () => { cancelled = true; clearTimeout(tid); };
  }, []);

  useEffect(() => {
    const handler = () => {
      setDone(false);
      setError(null);
      prefillWeight();
      setShow(true);
    };
    window.addEventListener('superdub:show-checkin', handler);
    return () => window.removeEventListener('superdub:show-checkin', handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(CHECKIN_KEY, todayStr());
    localStorage.removeItem(SNOOZE_KEY);
    setShow(false);
  };

  // Snooze: hide now, re-ask in ~2h. Does NOT mark the day done.
  const askLater = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    setShow(false);
    setTimeout(() => {
      if (localStorage.getItem(CHECKIN_KEY) !== todayStr()) setShow(true);
    }, SNOOZE_MS);
  };

  const save = async () => {
    const parsed = Math.round(parseFloat(weight) * 100) / 100;
    if (!parsed || parsed < 20 || parsed > 400) {
      setError('Enter a weight between 20 and 400 kg.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.updateTrackerDay(todayStr(), { weight: parsed });
      await api.updateProfile({ weightKg: parsed }).catch(() => {});
      window.dispatchEvent(new CustomEvent('superdub:tracker-updated'));
      window.dispatchEvent(new CustomEvent('superdub:checkin-done'));
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

  return (
    <div className="checkin-overlay">
      <div className="checkin-modal">
        <h2 className="checkin-title">Morning Check-in</h2>
        <p className="checkin-subtitle">Weigh yourself first thing in the morning, after using the bathroom and before eating — this gives you the most consistent reading.</p>

        {/* Tap-to-type weight */}
        <div className="checkin-weight-input-wrap" onClick={() => inputRef.current?.focus()}>
          <input
            ref={inputRef}
            className="checkin-weight-input"
            type="text"
            inputMode="decimal"
            value={weight}
            autoFocus
            onChange={e => setWeight(e.target.value.replace(/[^0-9.]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="0.0"
            aria-label="Weight in kilograms"
          />
          <span className="checkin-weight-unit">kg</span>
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
              <button className="checkin-later-btn" onClick={askLater} disabled={saving}>
                Ask me later
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
