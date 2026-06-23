import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [planBadge, setPlanBadge] = useState(readPlanBadge);
  const [checkinEnabled, setCheckinEnabled] = useState(readCheckinEnabled);
  const [pushOn, setPushOn] = useState(pushIsEnabled);
  const [pushBusy, setPushBusy] = useState(false);
  const [reminderHour, setReminderHourState] = useState(getReminderHour);

  const changeReminderHour = (hour: number) => {
    setReminderHourState(hour);
    setReminderHour(hour);
  };

  const togglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    if (pushOn) {
      await disablePush();
      setPushOn(false);
    } else {
      const res = await enablePush();
      if (res.ok) setPushOn(true);
      else alert(res.reason || 'Could not enable notifications.');
    }
    setPushBusy(false);
  };

  useEffect(() => {
    const sync = () => setPlanBadge(readPlanBadge());
    window.addEventListener('superdub:plan-badge-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('superdub:plan-badge-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const closeMore = () => setMoreOpen(false);

  const goTo = (path: string) => {
    closeMore();
    navigate(path);
  };

  return (
    <>
      {moreOpen && (
        <div className="bottom-nav-overlay" onClick={() => { closeMore(); }} />
      )}

      {moreOpen && (
        <div className="diet-sub-menu more-sub-menu">
          <div className="diet-sub-title">More</div>
          <button className="diet-sub-item" onClick={() => goTo('/plan')}>
            <span className="diet-sub-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span>
            <div className="diet-sub-text">
              <span className="diet-sub-label">
                Weight Goal
                {planBadge?.active && (
                  <span
                    className={`plan-nav-badge ${
                      planBadge.onTrack === true  ? 'badge-on'
                    : planBadge.onTrack === false ? 'badge-off'
                    :                              'badge-neutral'
                    }`}
                    style={{ marginLeft: 6 }}
                  >
                    {planBadge.onTrack === true ? 'on pace' : planBadge.onTrack === false ? 'off pace' : '●'}
                  </span>
                )}
              </span>
              <span className="diet-sub-desc">
                {planBadge?.active
                  ? planBadge.calories != null
                    ? `${planBadge.calories} kcal/day prescribed`
                    : 'Goal active'
                  : 'Set a target & let the engine adapt'}
              </span>
            </div>
          </button>
          <button className="diet-sub-item" onClick={() => goTo('/profile')}>
            <span className="diet-sub-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
            <div className="diet-sub-text">
              <span className="diet-sub-label">Profile &amp; Settings</span>
              <span className="diet-sub-desc">Bio, units, goals &amp; account</span>
            </div>
          </button>
          <button className="diet-sub-item" onClick={() => goTo('/level')}>
            <span className="diet-sub-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>
            <div className="diet-sub-text">
              <span className="diet-sub-label">Level &amp; XP</span>
              <span className="diet-sub-desc">Progress, badges &amp; achievements</span>
            </div>
          </button>
          <button className="diet-sub-item" onClick={() => goTo('/about')}>
            <span className="diet-sub-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span>
            <div className="diet-sub-text">
              <span className="diet-sub-label">About Superdub</span>
              <span className="diet-sub-desc">App info &amp; version</span>
            </div>
          </button>
          <button className="diet-sub-item" onClick={() => goTo('/privacy')}>
            <span className="diet-sub-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
            <div className="diet-sub-text">
              <span className="diet-sub-label">Privacy Policy</span>
              <span className="diet-sub-desc">How we handle your data</span>
            </div>
          </button>
          <button
            className="diet-sub-item"
            onClick={() => {
              const next = !checkinEnabled;
              setCheckinEnabled(next);
              localStorage.setItem('superdub.checkin.enabled', next ? 'true' : 'false');
            }}
          >
            <span className="diet-sub-icon">
              {checkinEnabled
                ? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              }
            </span>
            <div className="diet-sub-text">
              <span className="diet-sub-label">Daily Check-in</span>
              <span className="diet-sub-desc">{checkinEnabled ? 'On — energy & adherence prompt' : 'Off — no daily prompt'}</span>
            </div>
            <span className={`checkin-toggle-pill ${checkinEnabled ? 'on' : 'off'}`}>
              {checkinEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          {pushSupported() && (
            <button className="diet-sub-item" onClick={togglePush}>
              <span className="diet-sub-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </span>
              <div className="diet-sub-text">
                <span className="diet-sub-label">Notifications</span>
                <span className="diet-sub-desc">{pushBusy ? 'Working…' : pushOn ? 'On — daily weigh-in reminder' : 'Off — get a daily nudge'}</span>
              </div>
              <span className={`checkin-toggle-pill ${pushOn ? 'on' : 'off'}`}>
                {pushOn ? 'ON' : 'OFF'}
              </span>
            </button>
          )}

          {pushSupported() && pushOn && (
            <div className="diet-sub-item reminder-time-row">
              <span className="diet-sub-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
              </span>
              <div className="diet-sub-text">
                <span className="diet-sub-label">Reminder time</span>
                <span className="diet-sub-desc">When to nudge your daily weigh-in</span>
              </div>
              <select
                className="reminder-time-select"
                value={reminderHour}
                onChange={e => changeReminderHour(parseInt(e.target.value, 10))}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                  </option>
                ))}
              </select>
            </div>
          )}

        </div>
      )}

      <nav className="bottom-nav">
        {/* Progress */}
        <button
          className={`bottom-nav-item${isActive('/dashboard') ? ' active' : ''}`}
          onClick={() => goTo('/dashboard')}
          aria-label="Progress"
        >
          <span className="bottom-nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </span>
          <span className="bottom-nav-label">Progress</span>
        </button>

        {/* Plan — navigates straight to the Plan page */}
        <button
          className={`bottom-nav-item${isActive('/diet') ? ' active' : ''}`}
          onClick={() => goTo('/diet')}
          aria-label="Plan"
        >
          <span className="bottom-nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </span>
          <span className="bottom-nav-label">Plan</span>
        </button>

        {/* Habits — centre circle */}
        <button
          className={`bottom-nav-item bottom-nav-center${isActive('/') ? ' active' : ''}`}
          onClick={() => goTo('/')}
          aria-label="Habits"
        >
          <span className="bottom-nav-center-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </span>
          <span className="bottom-nav-label">Habits</span>
        </button>

        {/* To Dos */}
        <button
          className={`bottom-nav-item${isActive('/tasks') ? ' active' : ''}`}
          onClick={() => goTo('/tasks')}
          aria-label="Lists"
        >
          <span className="bottom-nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </span>
          <span className="bottom-nav-label">Lists</span>
        </button>

        {/* More */}
        <button
          className={`bottom-nav-item${isActive('/profile') || isActive('/about') || isActive('/privacy') || isActive('/level') || isActive('/plan') || moreOpen ? ' active' : ''}`}
          onClick={() => setMoreOpen(o => !o)}
          aria-label="More"
        >
          <span className="bottom-nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="19" cy="12" r="1.6" />
            </svg>
          </span>
          <span className="bottom-nav-label">More</span>
        </button>
      </nav>
    </>
  );
};

export default BottomNav;
