import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api';

// ── Core Habits Matrix — the four daily tracking loops, as illuminating tokens.
// Sits under the level ring + XP bar on The Ascension. Each slot lights gold the
// moment its loop is closed for the day (violet dim = still pending). Read-only
// status; tapping a pending slot jumps to the action that closes it.
//
// Data mirrors DailyLog.tsx's sources so the two never disagree:
//   weight/steps ← getTracker() (today's row), check-in ← getRecentCheckIns(),
//   calories ← getFoodLogsToday() (any entry today = loop closed).

function todayDDMM(d = new Date()): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function todayISO(): string { return new Date().toISOString().slice(0, 10); }

const WeightIc = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 8h6M12 8v3" /><circle cx="12" cy="14.5" r="0.6" fill="currentColor" />
  </svg>
);
const SleepIc = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z" />
  </svg>
);
const StepIc = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);
const CalorieIc = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.6" fill="currentColor" />
  </svg>
);
const TickIc = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

interface Slot {
  key: string;
  label: string;
  ico: React.ReactNode;
  done: boolean;
  act: () => void;
}

const CoreHabitsMatrix: React.FC = () => {
  const navigate = useNavigate();
  const [weight, setWeight] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [steps, setSteps] = useState(false);
  const [calories, setCalories] = useState(false);

  const load = useCallback(async () => {
    try {
      const [tracker, recent, food] = await Promise.all([
        api.getTracker(),
        api.getRecentCheckIns().catch(() => ({ today: null } as any)),
        api.getFoodLogsToday().catch(() => [] as any[]),
      ]);
      const today = todayDDMM();
      const row = (tracker.days ?? []).find((d: any) => d.day === today);
      setWeight(parseFloat(row?.weight) > 0);
      setSteps(parseInt(row?.steps, 10) > 0);
      setCheckedIn(!!recent?.today || localStorage.getItem('superdub.energy.checkin') === todayISO());
      setCalories(Array.isArray(food) && food.length > 0);
    } catch { /* non-critical — leave slots dim */ }
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

  const slots: Slot[] = [
    { key: 'weight', label: 'Weight', ico: <WeightIc />, done: weight, act: () => fire('superdub:show-checkin') },
    { key: 'vitals', label: 'Sleep · Energy', ico: <SleepIc />, done: checkedIn, act: () => fire('superdub:show-energy-checkin') },
    { key: 'steps', label: 'Steps', ico: <StepIc />, done: steps, act: () => fire('superdub:show-step-entry') },
    { key: 'calories', label: 'Calories', ico: <CalorieIc />, done: calories, act: () => navigate('/food-log') },
  ];
  const doneCount = slots.filter(s => s.done).length;

  return (
    <div className="chm">
      <div className="chm-head">
        <span className="chm-title">CORE HABITS</span>
        <span className="chm-count">{doneCount}/4 today</span>
      </div>
      <div className="chm-grid">
        {slots.map(s => (
          <button
            key={s.key}
            className={`chm-slot${s.done ? ' lit' : ''}`}
            onClick={s.act}
            aria-label={`${s.label}${s.done ? ' — logged today' : ' — tap to log'}`}
          >
            <span className="chm-slot-ico">{s.ico}</span>
            <span className="chm-slot-label">{s.label}</span>
            <span className={`chm-slot-tick${s.done ? ' on' : ''}`}>{s.done && <TickIc />}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CoreHabitsMatrix;
