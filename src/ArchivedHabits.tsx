import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';
import { api } from './api';
import { BUILD_TAG } from './version';

const ArchivedHabits: React.FC = () => {
  const navigate = useNavigate();
  const [graveyard, setGraveyard] = useState<{ name: string; startDate: string | null }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => {
    setError(false);
    api.getGraveyard()
      .then(g => { setGraveyard(Array.isArray(g) ? g : []); setLoaded(true); })
      .catch(() => { setError(true); setLoaded(true); });
  };
  useEffect(() => { load(); }, []);

  const restore = async (name: string) => {
    setRestoring(name);
    try {
      await api.restoreHabit(name);
      window.dispatchEvent(new CustomEvent('superdub:tracker-updated'));
      setTimeout(() => {
        setGraveyard(prev => prev.filter(h => h.name !== name));
        setRestoring(null);
      }, 650);
    } catch {
      setRestoring(null);
    }
  };

  const permaDelete = async (name: string) => {
    setConfirmDelete(null);
    setDeleting(name);
    try {
      await api.deleteHabitPermanently(name);
      window.dispatchEvent(new CustomEvent('superdub:tracker-updated'));
      setGraveyard(prev => prev.filter(h => h.name !== name));
    } catch {
      // leave it in the list so the user can retry
    }
    setDeleting(null);
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

      {/* Permanent-delete confirmation */}
      {confirmDelete && (
        <div className="confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <p className="confirm-title">Delete "{confirmDelete}" forever?</p>
            <p className="confirm-desc">This permanently erases the habit and all of its history. This can't be undone.</p>
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="confirm-ok confirm-ok--danger" onClick={() => permaDelete(confirmDelete)}>Delete forever</button>
            </div>
          </div>
        </div>
      )}

      <div className="archived-scroll">
        <div className="archived-head">
          <h1 className="archived-title">📦 Archived Habits</h1>
          <p className="archived-sub">Restore one to start it fresh from today, or delete it forever.</p>
        </div>

        {!loaded ? (
          <div className="sd-loader-wrap"><div className="sd-loader"><img className="sd-loader-logo" src="/superdub-logo.png" alt="" /></div></div>
        ) : error ? (
          <div className="archived-empty">
            <div className="archived-empty-icon">⚠️</div>
            <p className="archived-empty-title">Couldn't load</p>
            <p className="archived-empty-sub">Check your connection and try again.</p>
            <button className="archived-back-btn" onClick={load}>Retry</button>
          </div>
        ) : graveyard.length === 0 ? (
          <div className="archived-empty">
            <div className="archived-empty-icon">🗂️</div>
            <p className="archived-empty-title">Nothing archived</p>
            <p className="archived-empty-sub">When you archive a habit it'll wait here for you.</p>
            <button className="archived-back-btn" onClick={() => navigate('/')}>Back to habits</button>
          </div>
        ) : (
          <div className="graveyard-list">
            {graveyard.map(h => {
              const busy = restoring === h.name || deleting === h.name;
              return (
                <div key={h.name} className={`graveyard-card ${restoring === h.name ? 'rising' : ''}`}>
                  <span className="graveyard-card-name">📁 {h.name}</span>
                  <div className="graveyard-card-actions">
                    <button
                      className="graveyard-restore-btn"
                      onClick={() => restore(h.name)}
                      disabled={busy}
                    >
                      {restoring === h.name ? '✨ Restoring…' : 'Restore'}
                    </button>
                    <button
                      className="graveyard-delete-btn"
                      onClick={() => setConfirmDelete(h.name)}
                      disabled={busy}
                      aria-label={`Delete ${h.name} permanently`}
                      title="Delete forever"
                    >
                      {deleting === h.name
                        ? '…'
                        : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ArchivedHabits;
