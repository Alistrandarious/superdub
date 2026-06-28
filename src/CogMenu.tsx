import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { enablePush, disablePush, pushIsEnabled, pushSupported, getReminderHour, setReminderHour } from './push';

function readPlanBadge(): { active: boolean; calories: number | null; onTrack: boolean | null } | null {
  try {
    const raw = localStorage.getItem('superdub.plan.badge');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function readCheckinEnabled(): boolean {
  return localStorage.getItem('superdub.checkin.enabled') !== 'false';
}

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
  const planBadge = readPlanBadge();

  const close = () => setOpen(false);
  const go = (path: string) => { close(); navigate(path); };
  const fire = (evt: string) => { close(); window.dispatchEvent(new CustomEvent(evt)); };
  const addHabit = () => {
    close();
    navigate('/');
    setTimeout(() => window.dispatchEvent(new CustomEvent('superdub:open-add-habit')), 60);
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
            <button className="cog-menu-item" onClick={addHabit}><span className="cog-mi-ico">＋</span> Add Habit</button>
            <button className="cog-menu-item" onClick={() => fire('superdub:show-checkin')}>
              <span className="cog-mi-ico"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2v6M18 2v6M3 10h18M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></span> Log Weight
            </button>
            <button className="cog-menu-item" onClick={() => fire('superdub:show-step-entry')}><span className="cog-mi-ico">👟</span> Log Steps</button>

            <div className="cog-menu-sep" />
            <div className="cog-menu-label">Go to</div>
            <button className="cog-menu-item" onClick={() => go('/plan')}>
              <span className="cog-mi-ico"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span>
              Weight Goal
              {planBadge?.active && (
                <span className={`plan-nav-badge ${planBadge.onTrack === true ? 'badge-on' : planBadge.onTrack === false ? 'badge-off' : 'badge-neutral'}`} style={{ marginLeft: 'auto' }}>
                  {planBadge.onTrack === true ? 'on pace' : planBadge.onTrack === false ? 'off pace' : '●'}
                </span>
              )}
            </button>
            <button className="cog-menu-item" onClick={() => go('/success-kit')}><span className="cog-mi-ico">📚</span> Success Kit</button>
            <button className="cog-menu-item" onClick={() => go('/level')}><span className="cog-mi-ico">⭐</span> Level &amp; XP</button>
            <button className="cog-menu-item" onClick={() => go('/archived')}><span className="cog-mi-ico">📦</span> Archived Habits</button>
            <button className="cog-menu-item" onClick={() => go('/profile')}><span className="cog-mi-ico">👤</span> Profile &amp; Settings</button>
            <button className="cog-menu-item" onClick={() => go('/about')}><span className="cog-mi-ico">ℹ️</span> About Superdub</button>
            <button className="cog-menu-item" onClick={() => go('/privacy')}><span className="cog-mi-ico">🔒</span> Privacy Policy</button>

            <div className="cog-menu-sep" />
            <div className="cog-menu-label">Settings</div>
            <button className="cog-menu-item" onClick={toggleCheckin}>
              <span className="cog-mi-ico">🔔</span> Daily Check-in
              <span className={`checkin-toggle-pill ${checkinEnabled ? 'on' : 'off'}`} style={{ marginLeft: 'auto' }}>{checkinEnabled ? 'ON' : 'OFF'}</span>
            </button>
            {pushSupported() && (
              <button className="cog-menu-item" onClick={togglePush}>
                <span className="cog-mi-ico">📣</span> Notifications
                <span className={`checkin-toggle-pill ${pushOn ? 'on' : 'off'}`} style={{ marginLeft: 'auto' }}>{pushBusy ? '…' : pushOn ? 'ON' : 'OFF'}</span>
              </button>
            )}
            {pushSupported() && pushOn && (
              <div className="cog-menu-item" style={{ cursor: 'default' }}>
                <span className="cog-mi-ico">⏰</span> Reminder
                <select className="reminder-time-select" style={{ marginLeft: 'auto' }} value={reminderHour} onChange={e => changeReminderHour(parseInt(e.target.value, 10))}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CogMenu;
