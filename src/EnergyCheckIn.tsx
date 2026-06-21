import React, { useState, useEffect } from 'react';
import { api } from './api';

const ENERGY_KEY = 'superdub.energy.checkin';   // value = YYYY-MM-DD
const ENABLED_KEY = 'superdub.checkin.enabled';  // 'false' = disabled

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isEnabled() {
  return localStorage.getItem(ENABLED_KEY) !== 'false';
}

const ENERGY_LABELS: Record<number, string> = {
  1: 'Exhausted',
  2: 'Low',
  3: 'Okay',
  4: 'Good',
  5: 'Great',
};

const EnergyCheckIn: React.FC = () => {
  const [show, setShow] = useState(false);
  const [energy, setEnergy] = useState<number | null>(null);
  const [adherence, setAdherence] = useState<'below' | 'about' | 'above' | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shouldShowToday = () =>
    isEnabled() && localStorage.getItem(ENERGY_KEY) !== todayISO();

  const dismiss = () => {
    localStorage.setItem(ENERGY_KEY, todayISO());
    setShow(false);
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
      setAdherence(null);
      setShow(true);
    };
    window.addEventListener('superdub:show-energy-checkin', handler);
    return () => window.removeEventListener('superdub:show-energy-checkin', handler);
  }, []);

  const save = async () => {
    if (!energy || !adherence) return;
    setSaving(true);
    setError(null);
    try {
      await api.submitCheckIn(energy, adherence);
      setDone(true);
      setTimeout(dismiss, 1000);
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
            Energy level
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

        {/* Actions */}
        <div className="checkin-actions">
          {done ? (
            <div className="checkin-done">✓ Logged! +5 XP</div>
          ) : (
            <>
              {error && <p className="checkin-error">{error}</p>}
              <button
                className="checkin-save-btn"
                onClick={save}
                disabled={saving || !energy || !adherence}
              >
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

export default EnergyCheckIn;
