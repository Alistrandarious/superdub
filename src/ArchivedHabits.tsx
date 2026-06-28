import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';
import { api } from './api';
import { BUILD_TAG } from './version';

const ArchivedHabits: React.FC = () => {
  const navigate = useNavigate();
  const [graveyard, setGraveyard] = useState<{ name: string; startDate: string | null }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    api.getGraveyard().then(g => { setGraveyard(g); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  const restore = async (name: string) => {
    setRestoring(name);
    try {
      await api.restoreHabit(name);
      window.dispatchEvent(new CustomEvent('superdub:tracker-updated'));
      // brief "rising" animation, then remove from the list
      setTimeout(() => {
        setGraveyard(prev => prev.filter(h => h.name !== name));
        setRestoring(null);
      }, 650);
    } catch {
      setRestoring(null);
    }
  };

  return (
    <div className="app flush" style={{ '--theme': '#22C55E', '--theme-dim': '#22C55E66', '--theme-glow': '#22C55E14' } as React.CSSProperties}>
      <div className="hb-topbar">
        <button className="hb-cog" onClick={() => navigate('/')} aria-label="Back to habits">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div className="hb-brand">
          <img className="hb-brand-logo" src="/superdub-logo.png" alt="" />
          <span className="hb-brand-name">super<span className="hb-brand-dub">dub</span></span><span className="hb-build-tag">{BUILD_TAG}</span>
        </div>
        <div style={{ width: 38 }} />
      </div>

      <div className="page-content">
        <div className="archived-head">
          <h1 className="archived-title">📦 Archived Habits</h1>
          <p className="archived-sub">Habits you've archived. Restore one and it starts fresh from today.</p>
        </div>

        {!loaded ? (
          <div className="sd-loader-wrap"><div className="sd-loader"><img className="sd-loader-logo" src="/superdub-logo.png" alt="" /></div></div>
        ) : graveyard.length === 0 ? (
          <div className="archived-empty">
            <div className="archived-empty-icon">🗂️</div>
            <p className="archived-empty-title">Nothing archived</p>
            <p className="archived-empty-sub">When you archive a habit it'll wait here for you.</p>
            <button className="archived-back-btn" onClick={() => navigate('/')}>Back to habits</button>
          </div>
        ) : (
          <div className="graveyard-list" style={{ marginBottom: 100 }}>
            {graveyard.map(h => (
              <div key={h.name} className={`graveyard-card ${restoring === h.name ? 'rising' : ''}`}>
                <span className="graveyard-card-name">📁 {h.name}</span>
                <button
                  className="graveyard-restore-btn"
                  onClick={() => restore(h.name)}
                  disabled={restoring !== null}
                >
                  {restoring === h.name ? '✨ Restoring…' : 'Restore'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ArchivedHabits;
