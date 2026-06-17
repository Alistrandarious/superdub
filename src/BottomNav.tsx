import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [dietOpen, setDietOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const closeDiet = () => setDietOpen(false);

  const goTo = (path: string) => {
    closeDiet();
    navigate(path);
  };

  return (
    <>
      {dietOpen && (
        <div className="bottom-nav-overlay" onClick={closeDiet} />
      )}

      {dietOpen && (
        <div className="diet-sub-menu">
          <div className="diet-sub-title">Diet</div>
          <button className="diet-sub-item" onClick={() => goTo('/diet')}>
            <span className="diet-sub-icon">🥗</span>
            <div className="diet-sub-text">
              <span className="diet-sub-label">Macro Split &amp; Performance</span>
              <span className="diet-sub-desc">Build targets &amp; macro split</span>
            </div>
          </button>
          <button className="diet-sub-item" onClick={() => goTo('/diet?tab=meals')}>
            <span className="diet-sub-icon">📋</span>
            <div className="diet-sub-text">
              <span className="diet-sub-label">Meal Plans</span>
              <span className="diet-sub-desc">Your saved meal plans</span>
            </div>
          </button>
          <button className="diet-sub-item" onClick={() => goTo('/food-log')}>
            <span className="diet-sub-icon">📊</span>
            <div className="diet-sub-text">
              <span className="diet-sub-label">Food Logging</span>
              <span className="diet-sub-desc">Log today's meals by voice</span>
            </div>
          </button>
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

        {/* Diet — opens sub-menu */}
        <button
          className={`bottom-nav-item${isActive('/diet') ? ' active' : ''}${dietOpen ? ' active' : ''}`}
          onClick={() => setDietOpen(o => !o)}
          aria-label="Diet"
        >
          <span className="bottom-nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </span>
          <span className="bottom-nav-label">Plans</span>
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
          aria-label="To Dos"
        >
          <span className="bottom-nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </span>
          <span className="bottom-nav-label">To Dos</span>
        </button>

        {/* Profile */}
        <button
          className={`bottom-nav-item${isActive('/profile') ? ' active' : ''}`}
          onClick={() => goTo('/profile')}
          aria-label="Profile"
        >
          <span className="bottom-nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
          <span className="bottom-nav-label">Profile</span>
        </button>
      </nav>
    </>
  );
};

export default BottomNav;
