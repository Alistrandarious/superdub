import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { enablePush, disablePush, pushIsEnabled, pushSupported, getReminderHour, setReminderHour, getEveningHour, setEveningHour, getWorkoutHour, setWorkoutHour } from './push';
import { clearToken } from './api';
import { BUILD_TAG } from './version';

function readPlanBadge(): { active: boolean; calories: number | null; onTrack: boolean | null } | null {
  try {
    const raw = localStorage.getItem('superdub.plan.badge');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function readCheckinEnabled(): boolean {
  return localStorage.getItem('superdub.checkin.enabled') !== 'false';
}

// Stroke icon wrapper — 15px feather-style line icons; the menu uses these
// instead of emoji (style guide: no emoji in UI chrome).
const Ic: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

// 12 AM … 11 PM options, shared by the three reminder-time selects.
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => (
  <option key={h} value={h}>{h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}</option>
));

// The single settings/menu surface, shared on every page header. Bundles the
// quick-log actions, navigation, and app settings that used to be split between
// the Habits cog and the bottom-nav "More" menu.
const CogMenu: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [checkinEnabled, setCheckinEnabled] = useState(readCheckinEnabled);
  const [pushOn, setPushOn] = useState(pushIsEnabled);
  const [pushBusy, setPushBusy] = useState(false);
  const [reminderHour, setReminderHourState] = useState(getReminderHour);
  const [eveningHour, setEveningHourState] = useState(getEveningHour);
  const [workoutHour, setWorkoutHourState] = useState<number | null>(getWorkoutHour);
  const planBadge = readPlanBadge();

  const logout = () => { clearToken(); window.location.href = '/'; };

  const close = () => setOpen(false);
  const go = (path: string) => { close(); navigate(path); };
  const fire = (evt: string) => { close(); window.dispatchEvent(new CustomEvent(evt)); };
  const addHabit = () => {
    close();
    navigate('/');
    setTimeout(() => window.dispatchEvent(new CustomEvent('superdub:open-add-habit')), 60);
  };
  // The full data-table modal lives on the (lazily-loaded) Progress page. A one-shot
  // event can fire before that chunk mounts its listener, so set a flag that survives
  // the navigation; the event also covers the already-on-Progress case.
  const openTracker = () => {
    close();
    sessionStorage.setItem('superdub.openTracker', '1');
    navigate('/dashboard');
    window.dispatchEvent(new CustomEvent('superdub:open-tracker'));
  };

  const togglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    if (pushOn) { await disablePush(); setPushOn(false); }
    else {
      const res = await enablePush();
      if (res.ok) setPushOn(true);
      else alert(res.reason || 'Could not enable notifications.');
    }
    setPushBusy(false);
  };
  const changeReminderHour = (hour: number) => { setReminderHourState(hour); setReminderHour(hour); };
  const changeEveningHour = (hour: number) => { setEveningHourState(hour); setEveningHour(hour); };
  const changeWorkoutHour = (v: string) => {
    const hour = v === 'off' ? null : parseInt(v, 10);
    setWorkoutHourState(hour); setWorkoutHour(hour);
  };
  const toggleCheckin = () => {
    const next = !checkinEnabled;
    setCheckinEnabled(next);
    localStorage.setItem('superdub.checkin.enabled', next ? 'true' : 'false');
  };

  return (
    <div style={{ position: 'relative' }}>
      <button className="hb-cog" onClick={() => setOpen(o => !o)} aria-label="Menu & settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="19" height="19">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <>
          <div className="cog-menu-overlay" onClick={close} />
          <div className="cog-menu cog-menu--full">
            <div className="cog-menu-label">Quick log</div>
            <button className="cog-menu-item" onClick={() => fire('superdub:show-coach')}><span className="cog-mi-ico"><Ic><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></Ic></span> Talk to Dub</button>
            <button className="cog-menu-item" onClick={addHabit}><span className="cog-mi-ico"><Ic><path d="M12 5v14M5 12h14" /></Ic></span> Add Habit</button>
            <button className="cog-menu-item" onClick={() => fire('superdub:show-weight')}>
              <span className="cog-mi-ico"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2v6M18 2v6M3 10h18M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></span> Log Weight
            </button>
            <button className="cog-menu-item" onClick={() => fire('superdub:show-step-entry')}><span className="cog-mi-ico"><Ic><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></Ic></span> Log Steps</button>
            <button className="cog-menu-item" onClick={() => fire('superdub:show-vitals')}><span className="cog-mi-ico"><Ic><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></Ic></span> Log Check-in</button>

            <div className="cog-menu-sep" />
            <div className="cog-menu-label">Go to</div>
            <button className="cog-menu-item" onClick={openTracker}><span className="cog-mi-ico"><Ic><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></Ic></span> Data Table</button>
            <button className="cog-menu-item" onClick={() => go('/plan')}>
              <span className="cog-mi-ico"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span>
              Adaptive Weight Plan
              {planBadge?.active && (
                <span className={`plan-nav-badge ${planBadge.onTrack === true ? 'badge-on' : planBadge.onTrack === false ? 'badge-off' : 'badge-neutral'}`} style={{ marginLeft: 'auto' }}>
                  {planBadge.onTrack === true ? 'on pace' : planBadge.onTrack === false ? 'off pace' : '●'}
                </span>
              )}
            </button>
            <button className="cog-menu-item" onClick={() => go('/archived')}><span className="cog-mi-ico"><Ic><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" /></Ic></span> Archived Habits</button>

            <div className="cog-menu-sep" />
            <div className="cog-menu-label">Settings</div>
            <button className="cog-menu-item" onClick={() => go('/level')}><span className="cog-mi-ico"><Ic><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></Ic></span> Personalise</button>
            <button className="cog-menu-item" onClick={toggleCheckin}>
              <span className="cog-mi-ico"><Ic><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" /></Ic></span> Daily Check-in
              <span className={`checkin-toggle-pill ${checkinEnabled ? 'on' : 'off'}`} style={{ marginLeft: 'auto' }}>{checkinEnabled ? 'ON' : 'OFF'}</span>
            </button>
            {pushSupported() && (
              <button className="cog-menu-item" onClick={togglePush}>
                <span className="cog-mi-ico"><Ic><path d="M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6" /></Ic></span> Notifications
                <span className={`checkin-toggle-pill ${pushOn ? 'on' : 'off'}`} style={{ marginLeft: 'auto' }}>{pushBusy ? '…' : pushOn ? 'ON' : 'OFF'}</span>
              </button>
            )}
            {pushSupported() && pushOn && (
              <>
                <div className="cog-menu-item" style={{ cursor: 'default' }}>
                  <span className="cog-mi-ico"><Ic><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></Ic></span> Morning
                  <select className="reminder-time-select" style={{ marginLeft: 'auto' }} value={reminderHour} onChange={e => changeReminderHour(parseInt(e.target.value, 10))}>
                    {HOUR_OPTIONS}
                  </select>
                </div>
                <div className="cog-menu-item" style={{ cursor: 'default' }}>
                  <span className="cog-mi-ico"><Ic><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z" /></Ic></span> Evening
                  <select className="reminder-time-select" style={{ marginLeft: 'auto' }} value={eveningHour} onChange={e => changeEveningHour(parseInt(e.target.value, 10))}>
                    {HOUR_OPTIONS}
                  </select>
                </div>
                <div className="cog-menu-item" style={{ cursor: 'default' }}>
                  <span className="cog-mi-ico"><Ic><path d="M6.5 6.5l11 11M21 21l-1-1M3 3l1 1M18 22l4-4M2 6l4-4M6 18l-4 4M22 18l-4 4" /></Ic></span> Workout
                  <select className="reminder-time-select" style={{ marginLeft: 'auto' }} value={workoutHour == null ? 'off' : workoutHour} onChange={e => changeWorkoutHour(e.target.value)}>
                    <option value="off">Off</option>
                    {HOUR_OPTIONS}
                  </select>
                </div>
              </>
            )}

            <div className="cog-menu-sep" />
            <button className="cog-menu-item" onClick={() => go('/profile')}><span className="cog-mi-ico"><Ic><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Ic></span> Profile &amp; Settings</button>
            <button className="cog-menu-item" onClick={() => go('/about')}><span className="cog-mi-ico"><Ic><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></Ic></span> About Superdub</button>
            <button className="cog-menu-item" onClick={() => go('/maths')}><span className="cog-mi-ico"><Ic><path d="M19 5L5 19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></Ic></span> The Maths</button>
            <button className="cog-menu-item" onClick={() => go('/privacy')}><span className="cog-mi-ico"><Ic><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Ic></span> Privacy Policy</button>
            <button className="cog-menu-item cog-menu-item--danger" onClick={logout}><span className="cog-mi-ico"><Ic><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Ic></span> Log out</button>

            <div className="cog-menu-version">superdub {BUILD_TAG}</div>
          </div>
        </>
      )}
    </div>
  );
};

export default CogMenu;
