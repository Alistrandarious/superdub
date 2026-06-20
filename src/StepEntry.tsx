import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { api, StepEntry as StepEntryRow } from './api';

// YYYY-MM-DD for the date <input> (local time).
function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

const SOURCE_LABEL: Record<string, string> = {
  health_connect: 'Health Connect',
  healthkit: 'Apple Health',
  manual: 'Manual',
};

const StepEntry: React.FC = () => {
  const [show, setShow] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [steps, setSteps] = useState('');
  const [existing, setExisting] = useState<StepEntryRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExisting = useCallback((d: string) => {
    api.getSteps(d)
      .then(res => setExisting(res.entries ?? []))
      .catch(() => setExisting([]));
  }, []);

  useEffect(() => {
    const handler = () => {
      const d = todayISO();
      setDate(d);
      setSteps('');
      setDone(false);
      setError(null);
      loadExisting(d);
      setShow(true);
    };
    window.addEventListener('superdub:show-step-entry', handler);
    return () => window.removeEventListener('superdub:show-step-entry', handler);
  }, [loadExisting]);

  // Refresh the "already recorded" hint when the chosen date changes.
  useEffect(() => {
    if (show) loadExisting(date);
  }, [date, show, loadExisting]);

  const dismiss = () => setShow(false);

  const save = async () => {
    const n = Math.round(Number(steps));
    if (!Number.isFinite(n) || n < 0) {
      setError('Enter a valid step count.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.addSteps(date, n, 'manual');
      window.dispatchEvent(new CustomEvent('superdub:tracker-updated'));
      setDone(true);
      setTimeout(dismiss, 900);
    } catch (err: any) {
      console.error('[StepEntry] save failed:', err?.message ?? err);
      setError(err?.message ?? 'Could not save. Tap to retry.');
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  const device = existing.find(e => e.source !== 'manual');
  const active = existing.find(e => e.active);

  return (
    <div className="modal-overlay" onClick={dismiss}>
      <div className="modal step-entry-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Log Steps</span>
          <button className="modal-close" onClick={dismiss}>✕</button>
        </div>
        <p className="step-entry-sub">
          Enter your step count for a day. If your phone is synced, a manual entry
          overrides the device value for that day.
        </p>

        <div className="step-entry-field">
          <label>Date</label>
          <input
            type="date"
            className="step-entry-date"
            value={date}
            max={todayISO()}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        <div className="step-entry-field">
          <label>Steps</label>
          <input
            type="number"
            inputMode="numeric"
            className="step-entry-input"
            placeholder="0"
            min={0}
            value={steps}
            onChange={e => setSteps(e.target.value)}
            autoFocus
          />
        </div>

        {device && (
          <p className="step-entry-hint">
            Synced from {SOURCE_LABEL[device.source]}: <strong>{device.steps.toLocaleString()}</strong> steps
            {active && active.source === 'manual' && ' · currently overridden by your manual entry'}
          </p>
        )}

        <div className="checkin-actions">
          {done ? (
            <div className="checkin-done">✓ Logged!</div>
          ) : (
            <>
              {error && <p className="checkin-error">{error}</p>}
              <button className="checkin-save-btn" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : error ? 'Retry' : device ? 'Override' : 'Log it'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StepEntry;
