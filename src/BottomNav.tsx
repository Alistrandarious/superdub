import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Darken a hex colour for the gradient's lower stop.
function darken(hex: string, amt = 0.78): string {
  const m = hex.replace('#', '');
  if (m.length !== 6) return hex;
  const r = Math.round(parseInt(m.slice(0, 2), 16) * amt);
  const g = Math.round(parseInt(m.slice(2, 4), 16) * amt);
  const b = Math.round(parseInt(m.slice(4, 6), 16) * amt);
  return `rgb(${r},${g},${b})`;
}

const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [habitsColor, setHabitsColor] = useState(() => localStorage.getItem('superdub.habitsColor') || '#FFB300');

  useEffect(() => {
    const sync = () => setHabitsColor(localStorage.getItem('superdub.habitsColor') || '#FFB300');
    window.addEventListener('superdub:habits-color-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('superdub:habits-color-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };
  const goTo = (path: string) => navigate(path);

  return (
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

      {/* Plan */}
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
        <span
          className="bottom-nav-center-btn"
          style={{
            background: `linear-gradient(135deg, ${habitsColor}, ${darken(habitsColor)})`,
            boxShadow: `0 4px 16px ${habitsColor}73, 0 0 0 1px ${habitsColor}40`,
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </span>
        <span className="bottom-nav-label">Habits</span>
      </button>

      {/* Success Kit */}
      <button
        className={`bottom-nav-item${isActive('/success-kit') ? ' active' : ''}`}
        onClick={() => goTo('/success-kit')}
        aria-label="Success Kit"
      >
        <span className="bottom-nav-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </span>
        <span className="bottom-nav-label">Success Kit</span>
      </button>

      {/* Lists */}
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
    </nav>
  );
};

export default BottomNav;
