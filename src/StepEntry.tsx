import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { api, StepEntry as StepEntryRow } from './api';
import { getLoggingISO, getLoggingDay } from './day';
import { LOGGED_STEPS } from './systemHabits';

// YYYY-MM-DD for the date <input> (local time). Uses the logging day so a
// pre-2 AM entry defaults to yesterday, matching where habits/weight land.
function todayISO() {
  return getLoggingISO();
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
  // Active step count per logged day, keyed by DD/MM (the format the server stores and
  // returns) — drives the calendar's hit / miss / unlogged colouring.
  const [stepsByDay, setStepsByDay] = useState<Map<string, number>>(new Map());
  const [stepTarget, setStepTarget] = useState(10000);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = this month, -1 = last …
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load a day's entries AND recall its logged value into the input, so tapping a
  // day in the calendar shows what you logged (not a blank box).
  const loadExisting = useCallback((d: string) => {
    api.getSteps(d)
      .then(res => {
        const entries = res.entries ?? [];
        setExisting(entries);
        const winner = entries.find(e => e.active && e.steps > 0) ?? entries.find(e => e.steps > 0);
        setSteps(winner ? String(winner.steps) : '');
      })
      .catch(() => setExisting([]));
  }, []);

  // Active step count per day for the calendar. The server keys step rows by DD/MM
  // (dayToDDMM), and returns them that way, so we match calendar cells on DD/MM too —
  // NOT the YYYY-MM-DD we post in (the old bug: DD/MM never matched an ISO key).
  // Prefer each day's active entry; fall back to the most recent one so a missing
  // `active` flag never leaves a logged day uncoloured.
  const loadFilled = useCallback(() => {
    api.getSteps()
      .then(res => {
        const byDay = new Map<string, number>();
        for (const e of (res.entries ?? [])) {
          if (!(e.steps > 0)) continue;
          if (e.active || !byDay.has(e.day)) byDay.set(e.day, e.steps);
        }
        setStepsByDay(byDay);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      // Callers can pre-set the day (e.g. the Steps tile opens on yesterday, since
      // step totals lag a day). Falls back to today.
      const d = (e as CustomEvent).detail?.date || todayISO();
      setDate(d);
      setSteps('');
      setDone(false);
      setError(null);
      setMonthOffset(0);
      loadExisting(d);
      loadFilled();
      api.getProfile().then((p: any) => setStepTarget(parseInt(p?.stepTarget) || 10000)).catch(() => {});
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
      // Logging TODAY's steps earns XP via the "Logged steps" system habit. Only
      // today counts — backfilling past days shouldn't farm XP.
      if (date === todayISO()) {
        api.toggleTrackerHabit(getLoggingDay(), LOGGED_STEPS, 'done')
          .then(() => window.dispatchEvent(new CustomEvent('superdub:tracker-updated')))
          .catch(() => {});
      }
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
  const cells: ({ d: number; iso: string; steps: number; future: boolean } | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
    const ddmm = `${pad(d)}/${pad(m + 1)}`;
    const future = new Date(y, m, d).getTime() > todayStart.getTime();
    cells.push({ d, iso, steps: stepsByDay.get(ddmm) ?? 0, future });
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
          Tap a day to log or override it. Green means you hit your goal, orange means under it,
          grey means nothing logged. The window stays open so you can fill several days at once.
        </p>

        {/* Month calendar, green = hit goal, orange = under goal, grey = unlogged */}
        <div className="hcard-month-nav">
          <button className="hcard-month-arrow" onClick={() => setMonthOffset(o => o - 1)} aria-label="Previous month">‹</button>
          <span className="hcard-month-label">{MONTHS[m]} {y}</span>
          <button className="hcard-month-arrow" disabled={monthOffset >= 0} onClick={() => setMonthOffset(o => Math.min(0, o + 1))} aria-label="Next month">›</button>
        </div>
        <div className="mini-hm">
          <div className="mini-hm-grid">
            {DOW.map((l, i) => <span key={`h${i}`} className="mini-hm-dow">{l}</span>)}
            {cells.map((c, i) => {
              if (c === null) return <span key={`p${i}`} className="mini-hm-cell mini-hm-pad" />;
              const hit = c.steps > 0 && c.steps >= stepTarget;
              // '' (base cell) = unlogged grey; miss = orange; done = green.
              const state = c.future ? 'future' : hit ? 'done' : c.steps > 0 ? 'miss' : '';
              const label = c.future ? '—'
                : hit ? `${c.steps.toLocaleString()} · hit goal`
                : c.steps > 0 ? `${c.steps.toLocaleString()} · under goal`
                : 'not logged';
              return (
                <button
                  key={c.iso}
                  className={`mini-hm-cell ${state}`}
                  disabled={c.future}
                  onClick={() => !c.future && setDate(c.iso)}
                  style={c.iso === date ? { outline: '2px solid #fff', outlineOffset: 1 } : undefined}
                  title={`${c.iso}: ${label}`}
                >{c.d}</button>
              );
            })}
          </div>
        </div>

        <div className="step-entry-field">
          <label>Steps · {(() => { const [, mm, dd] = date.split('-').map(Number); return `${dd} ${MONTHS[mm - 1]}`; })()}</label>
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
