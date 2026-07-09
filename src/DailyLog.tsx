import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import { loggingNow } from './day';
import { useWeightUnit, formatWeightKg } from './weightUnit';
import { HEALTH, GROWTH, TEAL } from './theme';
import { pickDayLog } from './dailyLogPick';

// ── Daily Log — the "Daily Superdub" vitals strip ───────────────────────────
// These are the app's OWN inputs (weigh-in, steps, check-in) that feed the
// reverse-calorie engine — a different species from user habits, so they get
// their own compact data-chip UI. One slim line: Weight · Steps · Check-in.
//
// The strip follows the week strip's selected day: no `day` prop = today's
// logging day; a 'DD/MM' key = that past day (read-only review).

// Default arg is the current logging day (2 AM boundary): a no-arg call before
// 2 AM returns yesterday's key. Callers that pass an explicit date are unaffected.
function todayDDMM(d = loggingNow()): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function todayISO(): string { return loggingNow().toISOString().slice(0, 10); }

const ScaleIc = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 8h6M12 8v3" /><circle cx="12" cy="14.5" r="0.6" fill="currentColor" />
  </svg>
);
const StepIc = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);
const MoodIc = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);

interface DailyLogProps {
  // Selected week-strip day as 'DD/MM', or null/undefined for today.
  day?: string | null;
  // Check-in state for a past day (mandatory-habit "done"). Only read when `day`
  // is set — today computes its own from the recent-check-ins endpoint.
  checkedInDay?: boolean;
}

const DailyLog: React.FC<DailyLogProps> = ({ day = null, checkedInDay }) => {
  const unit = useWeightUnit();
  const [weight, setWeight] = useState<string | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);

  const load = useCallback(async () => {
    try {
      const dayKey = day ?? todayDDMM();
      const [tracker, recent] = await Promise.all([
        api.getTracker(),
        day ? Promise.resolve({ today: null } as any) : api.getRecentCheckIns().catch(() => ({ today: null } as any)),
      ]);
      const { weight: w, steps: s } = pickDayLog((tracker.days ?? []) as any, dayKey);
      setWeight(w); setSteps(s);
      // Past day: trust the mandatory-habit signal the week strip already has.
      // Today: recent endpoint's `today`, or either prompt's stamp (morning
      // vitals or the evening reflection).
      if (day) {
        setCheckedIn(!!checkedInDay);
      } else {
        setCheckedIn(!!recent?.today
          || localStorage.getItem('superdub.vitals.checkin') === todayISO()
          || localStorage.getItem('superdub.evening.checkin') === todayISO());
      }
    } catch { /* non-critical */ }
  }, [day, checkedInDay]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('superdub:tracker-updated', h);
    window.addEventListener('superdub:checkin-done', h);
    return () => {
      window.removeEventListener('superdub:tracker-updated', h);
      window.removeEventListener('superdub:checkin-done', h);
    };
  }, [load]);

  const fire = (evt: string) => window.dispatchEvent(new CustomEvent(evt));
  const allDone = weight != null && steps != null && checkedIn;
  // Past days are a read-only review; only today's chips open their editors.
  const interactive = !day;

  const heading = day
    ? new Date(loggingNow().getFullYear(), parseInt(day.slice(3), 10) - 1, parseInt(day.slice(0, 2), 10))
        .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()
    : "TODAY'S LOG";

  // One slim chip: icon + value, sitting on the hairline row. `metric` is the
  // semantic accent (theme.ts) the chip takes once logged.
  const row = (done: boolean, ico: React.ReactNode, label: string, val: string | null, evt: string, metric: string) => {
    const cls = `dl-row${done ? ' done' : ''}${allDone ? ' all-done' : ''}${interactive ? '' : ' dl-row-static'}`;
    const style = { '--metric': metric } as React.CSSProperties;
    const inner = (
      <>
        <span className="dl-row-ico">{ico}</span>
        <span className="dl-row-val">{done && val ? val : '–'}</span>
      </>
    );
    const aria = `${label}: ${done && val ? val : 'not logged'}`;
    return interactive
      ? <button className={cls} style={style} onClick={() => fire(evt)} aria-label={aria}>{inner}</button>
      : <div className={cls} style={style} aria-label={aria}>{inner}</div>;
  };

  return (
    <div className={`daily-log${allDone ? ' all-done' : ''}`}>
      <div className="daily-log-head">
        <span className="daily-log-title">{heading}</span>
      </div>
      <div className="daily-log-rows">
        {row(weight != null, <ScaleIc />, 'Weight', weight != null ? formatWeightKg(parseFloat(weight), unit) : null, 'superdub:show-checkin', HEALTH)}
        {row(steps != null, <StepIc />, 'Steps', steps != null ? steps.toLocaleString() : null, 'superdub:show-step-entry', GROWTH)}
        {row(checkedIn, <MoodIc />, 'Check-in', 'Logged', 'superdub:show-vitals', TEAL)}
      </div>
    </div>
  );
};

export default DailyLog;
