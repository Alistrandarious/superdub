import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { api } from './api';
import { getLoggingISO, getLoggingDay } from './day';
import { WEIGHED_IN } from './systemHabits';
import { useWeightUnit, formatWeightKg } from './weightUnit';
import WeightInput from './WeightInput';
import WeightTrendStrip from './WeightTrendStrip';

// Log Weight modal with a month calendar of the days you've weighed in, mirroring
// the Steps logger. Green = weighed in, grey = nothing logged. Tap a day to see
// and edit that day's weight. Opened from the cog ('superdub:show-weight').

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const pad = (n: number) => String(n).padStart(2, '0');
const todayISO = () => getLoggingISO();
const isoToDDMM = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const WeightEntry: React.FC = () => {
  const unit = useWeightUnit();
  const [show, setShow] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [weightKg, setWeightKg] = useState('');   // canonical kg string
  const [byDay, setByDay] = useState<Map<string, number>>(new Map()); // DD/MM -> kg
  const [days, setDays] = useState<any[]>([]);                        // raw rows, for the trend strip
  const [goalKg, setGoalKg] = useState<number | undefined>(undefined);
  const [monthOffset, setMonthOffset] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load every logged weight (DD/MM -> kg) for the calendar, and recall the focused
  // day's weight into the input so tapping a day shows what you logged.
  const load = useCallback((focusIso?: string) => {
    api.getTracker().then((data: any) => {
      setDays(data?.days ?? []);
      const map = new Map<string, number>();
      for (const d of (data?.days ?? [])) {
        const w = parseFloat(d.weight);
        if (w > 0) map.set(d.day, w);
      }
      setByDay(map);
      if (focusIso) {
        const w = map.get(isoToDDMM(focusIso));
        setWeightKg(w != null ? String(w) : '');
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => {
      const d = todayISO();
      setDate(d); setDone(false); setError(null); setMonthOffset(0);
      load(d);
      setShow(true);
    };
    window.addEventListener('superdub:show-weight', handler);
    return () => window.removeEventListener('superdub:show-weight', handler);
  }, [load]);

  // Goal weight only decides which direction the trend dots call progress.
  useEffect(() => {
    let live = true;
    api.getWeightSettings().then(ws => {
      const g = parseFloat(ws?.goalWeight ?? '');
      if (live && g > 0) setGoalKg(g);
    }).catch(() => {});
    return () => { live = false; };
  }, []);

  const dismiss = () => setShow(false);
  const pickDay = (iso: string) => {
    setDate(iso);
    const w = byDay.get(isoToDDMM(iso));
    setWeightKg(w != null ? String(w) : '');
  };

  const save = async () => {
    const parsed = Math.round(parseFloat(weightKg) * 100) / 100;
    if (!parsed || parsed < 20 || parsed > 400) {
      setError(`Enter a weight between ${formatWeightKg(20, unit)} and ${formatWeightKg(400, unit)}.`);
      return;
    }
    setSaving(true); setError(null);
    try {
      await api.updateTrackerDay(isoToDDMM(date), { weight: String(parsed) });
      // Only sync the profile's "current" weight when logging today, so editing a
      // past day never overwrites your latest reading. Logging today also earns XP
      // via the "Weighed in" system habit (past-day backfill shouldn't farm XP).
      if (date === todayISO()) {
        await api.updateProfile({ weightKg: parsed }).catch(() => {});
        api.toggleTrackerHabit(getLoggingDay(), WEIGHED_IN, 'done')
          .then(() => window.dispatchEvent(new CustomEvent('superdub:tracker-updated')))
          .catch(() => {});
      }
      window.dispatchEvent(new CustomEvent('superdub:tracker-updated'));
      window.dispatchEvent(new CustomEvent('superdub:checkin-done'));
      setDone(true);
      load(date);
      setTimeout(() => setDone(false), 1200);
    } catch (err: any) {
      console.error('[WeightEntry] save failed:', err?.message ?? err);
      setError(err?.message ?? 'Could not save. Tap to retry.');
    } finally { setSaving(false); }
  };

  // ── Month calendar cells (Mon-first, like the habit heatmap) ──
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const y = base.getFullYear();
  const m = base.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // Mon = 0
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const cells: ({ d: number; iso: string; kg: number; future: boolean } | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
    const ddmm = `${pad(d)}/${pad(m + 1)}`;
    const future = new Date(y, m, d).getTime() > todayStart.getTime();
    cells.push({ d, iso, kg: byDay.get(ddmm) ?? 0, future });
  }

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={dismiss}>
      <div className="modal step-entry-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Log Weight</span>
          <button className="modal-close" aria-label="Close" onClick={dismiss}>✕</button>
        </div>
        <WeightTrendStrip days={days} goalKg={goalKg} />
        <p className="step-entry-sub">
          Tap a day to log or edit it. Green means you weighed in, grey means nothing logged.
          The window stays open so you can fill several days at once.
        </p>

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
              const logged = c.kg > 0;
              const state = c.future ? 'future' : logged ? 'done' : '';
              return (
                <button
                  key={c.iso}
                  className={`mini-hm-cell ${state}`}
                  disabled={c.future}
                  onClick={() => !c.future && pickDay(c.iso)}
                  style={c.iso === date ? { outline: '2px solid #fff', outlineOffset: 1 } : undefined}
                  title={`${c.iso}: ${logged ? formatWeightKg(c.kg, unit) : 'not logged'}`}
                >{c.d}</button>
              );
            })}
          </div>
        </div>

        <div className="step-entry-field">
          <label>Weight · {(() => { const [, mm, dd] = date.split('-').map(Number); return `${dd} ${MONTHS[mm - 1]}`; })()}</label>
          <WeightInput valueKg={weightKg} onChangeKg={setWeightKg} unit={unit} inputClassName="step-entry-input" ariaLabel="Weight" autoFocus />
        </div>

        <div className="checkin-actions">
          {error && <p className="checkin-error">{error}</p>}
          <button className="checkin-save-btn" onClick={save} disabled={saving}>
            {done ? '✓ Logged!' : saving ? 'Saving…' : 'Log it'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeightEntry;
