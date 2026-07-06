import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { api, StepEntry as StepEntryRow } from './api';

// YYYY-MM-DD for the date <input> (local time).
function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}
const pad = (n: number) => String(n).padStart(2, '0');

const SOURCE_LABEL: Record<string, string> = {
  health_connect: 'Health Connect',
  healthkit: 'Apple Health',
  manual: 'Manual',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const StepEntry: React.FC = () => {
  const [show, setShow] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [steps, setSteps] = useState('');
  const [existing, setExisting] = useState<StepEntryRow[]>([]);
  // Every day that has steps logged (YYYY-MM-DD) — drives the calendar's green cells.
  const [filledDays, setFilledDays] = useState<Set<string>>(new Set());
  const [monthOffset, setMonthOffset] = useState(0); // 0 = this month, -1 = last …
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExisting = useCallback((d: string) => {
    api.getSteps(d)
      .then(res => setExisting(res.entries ?? []))
      .catch(() => setExisting([]));
  }, []);

  // All logged days for the calendar. ponytail: step rows are keyed by the same
  // YYYY-MM-DD we send from addSteps, so no format juggling needed.
  const loadFilled = useCallback(() => {
    api.getSteps()
      .then(res => setFilledDays(new Set((res.entries ?? []).filter(e => e.steps > 0).map(e => e.day))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => {
      const d = todayISO();
      setDate(d);
      setSteps('');
      setDone(false);
      setError(null);
      setMonthOffset(0);
      loadExisting(d);
      loadFilled();
      setShow(true);
    };
    window.addEventListener('superdub:show-step-entry', handler);
    return () => window.removeEventListener('superdub:show-step-entry', handler);
  }, [loadExisting, loadFilled]);

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
      // Stay open so you can log several days in a row: refresh the calendar +
      // hint, clear the input, and flash a tick that clears itself.
      setDone(true);
      setSteps('');
      loadFilled();
      loadExisting(date);
      setTimeout(() => setDone(false), 1200);
    } catch (err: any) {
      console.error('[StepEntry] save failed:', err?.message ?? err);
      setError(err?.message ?? 'Could not save. Tap to retry.');
    } finally {
      setSaving(false);
    }
  };

  // ── Month calendar cells (Mon-first, like the habit heatmap) ──
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const y = base.getFullYear();
  const m = base.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // Mon = 0
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const cells: ({ d: number; iso: string; filled: boolean; future: boolean } | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
    const future = new Date(y, m, d).getTime() > todayStart.getTime();
    cells.push({ d, iso, filled: filledDays.has(iso), future });
  }

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
          Tap a day to log or override it — green means logged, red means missed.
          The window stays open so you can fill several days at once.
        </p>

        {/* Month calendar — green = has steps, red = past day with none */}
        <div className="hcard-month-nav">
          <button className="hcard-month-arrow" onClick={() => setMonthOffset(o => o - 1)} aria-label="Previous month">‹</button>
          <span className="hcard-month-label">{MONTHS[m]} {y}</span>
          <button className="hcard-month-arrow" disabled={monthOffset >= 0} onClick={() => setMonthOffset(o => Math.min(0, o + 1))} aria-label="Next month">›</button>
        </div>
        <div className="mini-hm">
          <div className="mini-hm-grid">
            {DOW.map((l, i) => <span key={`h${i}`} className="mini-hm-dow">{l}</span>)}
            {cells.map((c, i) => c === null
              ? <span key={`p${i}`} className="mini-hm-cell mini-hm-pad" />
              : (
                <button
                  key={c.iso}
                  className={`mini-hm-cell ${c.filled ? 'done' : c.future ? 'future' : 'failed'}`}
                  disabled={c.future}
                  onClick={() => !c.future && setDate(c.iso)}
                  style={c.iso === date ? { outline: '2px solid #fff', outlineOffset: 1 } : undefined}
                  title={`${c.iso}: ${c.filled ? 'logged' : c.future ? '—' : 'no steps'}`}
                >{c.d}</button>
              )
            )}
          </div>
        </div>

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
          {error && <p className="checkin-error">{error}</p>}
          <button className="checkin-save-btn" onClick={save} disabled={saving}>
            {done ? '✓ Logged!' : saving ? 'Saving…' : error ? 'Retry' : device ? 'Override' : 'Log it'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StepEntry;
