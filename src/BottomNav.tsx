import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const DUB_FRESH_KEY = 'superdub.dub.fresh';

const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [habitsColor, setHabitsColor] = useState(() => localStorage.getItem('superdub.habitsColor') || '#FFB300');
  const [navGlow, setNavGlow] = useState(() => localStorage.getItem('superdub.navGlow') || '#2FD27E');
  const [dubFresh, setDubFresh] = useState(() => localStorage.getItem(DUB_FRESH_KEY) === '1');

  useEffect(() => {
    const sync = () => {
      setHabitsColor(localStorage.getItem('superdub.habitsColor') || '#FFB300');
      setNavGlow(localStorage.getItem('superdub.navGlow') || '#2FD27E');
    };
    window.addEventListener('superdub:habits-color-changed', sync);
    window.addEventListener('superdub:nav-glow-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('superdub:habits-color-changed', sync);
      window.removeEventListener('superdub:nav-glow-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Dub is tap-only now: a check-in lights a quiet "!" dot on his tab instead of
  // auto-opening the coach. It clears when the coach opens or you land on /dub.
  useEffect(() => {
    const mark = () => { localStorage.setItem(DUB_FRESH_KEY, '1'); setDubFresh(true); };
    const clear = () => { localStorage.removeItem(DUB_FRESH_KEY); setDubFresh(false); };
    window.addEventListener('superdub:checkin-done', mark);
    window.addEventListener('superdub:show-coach', clear);
    return () => {
      window.removeEventListener('superdub:checkin-done', mark);
      window.removeEventListener('superdub:show-coach', clear);
    };
  }, []);
  useEffect(() => {
    if (location.pathname.startsWith('/dub') && localStorage.getItem(DUB_FRESH_KEY) === '1') {
      localStorage.removeItem(DUB_FRESH_KEY); setDubFresh(false);
    }
  }, [location.pathname]);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };
  const goTo = (path: string) => navigate(path);

  return (
    <nav className="bottom-nav bottom-nav--five" style={{ ['--nav-glow' as any]: navGlow, ['--habits-c' as any]: habitsColor, ['--habits-c-glow' as any]: habitsColor + '73' }}>
      {/* Progress */}
      <button className={`bottom-nav-item${isActive('/dashboard') ? ' active' : ''}`} onClick={() => goTo('/dashboard')} aria-label="Progress">
        <span className="bottom-nav-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        </span>
        <span className="bottom-nav-label">Progress</span>
      </button>

      {/* Coach (route stays /dub, display-only rebrand) */}
      <button className={`bottom-nav-item${isActive('/dub') ? ' active' : ''}`} onClick={() => goTo('/dub')} aria-label={dubFresh ? 'Coach, your read — new read' : 'Coach, your read'}>
        <span className="bottom-nav-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* spark/pulse mark: a center dot with short radiating lines, non-mascot */}
            <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
            <line x1="12" y1="4" x2="12" y2="7" />
            <line x1="12" y1="17" x2="12" y2="20" />
            <line x1="4" y1="12" x2="7" y2="12" />
            <line x1="17" y1="12" x2="20" y2="12" />
            <line x1="6.5" y1="6.5" x2="8.6" y2="8.6" />
            <line x1="15.4" y1="15.4" x2="17.5" y2="17.5" />
          </svg>
          {dubFresh && <span className="bottom-nav-dot" aria-hidden="true">!</span>}
        </span>
        <span className="bottom-nav-label">Coach</span>
      </button>

      {/* Habits — raised center circle */}
      <button className={`bottom-nav-item bottom-nav-center${isActive('/') ? ' active' : ''}`} onClick={() => goTo('/')} aria-label="Habits">
        <span className="bottom-nav-center-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </span>
      </button>

      {/* Global & Friends */}
      <button className={`bottom-nav-item${isActive('/community') ? ' active' : ''}`} onClick={() => goTo('/community')} aria-label="Global and Friends">
        <span className="bottom-nav-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" />
          </svg>
        </span>
        <span className="bottom-nav-label">Global</span>
      </button>

      {/* Lists */}
      <button className={`bottom-nav-item${isActive('/tasks') ? ' active' : ''}`} onClick={() => goTo('/tasks')} aria-label="Lists">
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
