import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';

// ── Daily Log — the "Daily Superdub" vitals strip ───────────────────────────
// These are the app's OWN inputs (weigh-in, steps, check-in) that feed the
// reverse-calorie engine — a different species from user habits, so they get
// their own compact data-chip UI + a logging streak to reinforce feeding data.

function todayDDMM(d = new Date()): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function todayISO(): string { return new Date().toISOString().slice(0, 10); }

// Consecutive days (ending today or yesterday) with any core log — weight or
// steps. Days are 'DD/MM'; walk back one calendar day at a time.
function loggingStreak(logged: Set<string>): number {
  let streak = 0;
  const d = new Date();
  if (!logged.has(todayDDMM(d))) d.setDate(d.getDate() - 1); // grace: today not yet logged
  for (let i = 0; i < 400; i++) {
    if (logged.has(todayDDMM(d))) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

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
const TickIc = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const FlameIc = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
    <path d="M12 2s5 4.5 5 9a5 5 0 0 1-10 0c0-1.4.6-2.7 1.3-3.7C8.7 8.9 9 10 10 10c0-2.5 2-4.5 2-8z" />
  </svg>
);

const DailyLog: React.FC = () => {
  const [weight, setWeight] = useState<string | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [streak, setStreak] = useState(0);

  const load = useCallback(async () => {
    try {
      const [tracker, recent] = await Promise.all([
        api.getTracker(),
        api.getRecentCheckIns().catch(() => ({ today: null } as any)),
      ]);
      const today = todayDDMM();
      const logged = new Set<string>();
      let tW: string | null = null; let tS: number | null = null;
      for (const row of (tracker.days ?? [])) {
        const w = parseFloat(row.weight); const s = parseInt(row.steps, 10);
        if (w > 0 || s > 0) logged.add(row.day);
        if (row.day === today) { if (w > 0) tW = row.weight; if (s > 0) tS = s; }
      }
      setWeight(tW); setSteps(tS);
      setStreak(loggingStreak(logged));
      // check-in done today: recent endpoint's `today`, or the ritual's localStorage stamp
      setCheckedIn(!!recent?.today || localStorage.getItem('superdub.energy.checkin') === todayISO());
    } catch { /* non-critical */ }
  }, []);

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

  return (
    <div className="daily-log">
      <div className="daily-log-head">
        <span className="daily-log-title">TODAY'S LOG</span>
        {streak > 0 && (
          <span className="daily-log-streak"><FlameIc /> {streak}-day logging streak</span>
        )}
      </div>
      <div className="daily-log-chips">
        <button className={`dl-chip${weight != null ? ' done' : ''}`} onClick={() => fire('superdub:show-checkin')}>
          <span className="dl-chip-ico"><ScaleIc /></span>
          <span className="dl-chip-body">
            <span className="dl-chip-label">Weigh-in</span>
            <span className="dl-chip-val">{weight != null ? `${weight} kg` : 'Tap to log'}</span>
          </span>
          {weight != null && <span className="dl-chip-tick"><TickIc /></span>}
        </button>

        <button className={`dl-chip${steps != null ? ' done' : ''}`} onClick={() => fire('superdub:show-step-entry')}>
          <span className="dl-chip-ico"><StepIc /></span>
          <span className="dl-chip-body">
            <span className="dl-chip-label">Steps</span>
            <span className="dl-chip-val">{steps != null ? steps.toLocaleString() : 'Tap to log'}</span>
          </span>
          {steps != null && <span className="dl-chip-tick"><TickIc /></span>}
        </button>

        <button className={`dl-chip${checkedIn ? ' done' : ''}`} onClick={() => fire('superdub:show-energy-checkin')}>
          <span className="dl-chip-ico"><MoodIc /></span>
          <span className="dl-chip-body">
            <span className="dl-chip-label">Check-in</span>
            <span className="dl-chip-val">{checkedIn ? 'Logged' : 'Tap to log'}</span>
          </span>
          {checkedIn && <span className="dl-chip-tick"><TickIc /></span>}
        </button>
      </div>
    </div>
  );
};

export default DailyLog;
