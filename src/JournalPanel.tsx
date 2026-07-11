import React, { useState, useEffect } from 'react';
import { api } from './api';

interface Entry {
  id: string;
  body: string;
  mood: number | null;
  createdAt: string;
}

// Mood 1..5, rough → great. Coloured dots (no emoji chrome, per the style guide).
const MOODS: { v: number; label: string; color: string }[] = [
  { v: 1, label: 'Rough', color: '#FF5470' },
  { v: 2, label: 'Low',   color: '#FF8A00' },
  { v: 3, label: 'Okay',  color: '#FFB928' },
  { v: 4, label: 'Good',  color: '#19C5B0' },
  { v: 5, label: 'Great', color: '#2FD27E' },
];
const moodOf = (v: number | null) => MOODS.find(m => m.v === v) ?? null;

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ', ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const JournalPanel: React.FC<{ accent: string }> = ({ accent }) => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<number | null>(null);

  useEffect(() => {
    api.getJournal().then(rows => { setEntries(rows); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  const save = () => {
    const text = body.trim();
    if (!text) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const entry: Entry = { id, body: text, mood, createdAt: new Date().toISOString() };
    setEntries(prev => [entry, ...prev]);
    api.createJournalEntry(id, text, mood).catch(() => {});
    // Let Dub know a fresh mood signal exists.
    window.dispatchEvent(new CustomEvent('superdub:journal-updated'));
    setBody('');
    setMood(null);
    setFormOpen(false);
  };

  const remove = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    api.deleteJournalEntry(id).catch(() => {});
  };

  if (!loaded) {
    return <div className="sd-loader-wrap"><div className="sd-loader"><img className="sd-loader-logo" src="/superdub-logo.png" alt="" /></div></div>;
  }

  return (
    <div className="journal-wrap" style={{ ['--journal-accent' as any]: accent }}>
      {!formOpen && (
        <button className="goals-new-btn" onClick={() => setFormOpen(true)}>
          <span className="goals-new-plus">+</span> New entry
        </button>
      )}

      {formOpen && (
        <div className="goals-form">
          <textarea
            className="journal-input"
            rows={4}
            value={body}
            autoFocus
            onChange={e => setBody(e.target.value)}
            placeholder="What's on your mind?"
          />
          <div className="journal-mood-row">
            <span className="journal-mood-label">Mood</span>
            <div className="journal-mood-dots">
              {MOODS.map(m => (
                <button
                  key={m.v}
                  className={`journal-mood-dot${mood === m.v ? ' active' : ''}`}
                  style={{ ['--m' as any]: m.color }}
                  onClick={() => setMood(mood === m.v ? null : m.v)}
                  aria-label={m.label}
                  title={m.label}
                >
                  <span className="journal-mood-fill" />
                </button>
              ))}
            </div>
            <span className="journal-mood-picked">{moodOf(mood)?.label ?? ''}</span>
          </div>
          <div className="goals-form-actions">
            <button className="goals-cancel" onClick={() => { setFormOpen(false); setBody(''); setMood(null); }}>Cancel</button>
            <button className="goals-save" onClick={save} disabled={!body.trim()} style={{ background: accent }}>Save entry</button>
          </div>
        </div>
      )}

      {entries.length === 0 && !formOpen ? (
        <div className="lists-empty">
          <div className="lists-empty-icon">📓</div>
          <div className="lists-empty-title">No entries yet</div>
          <div className="lists-empty-sub">Write a line about your day and tag how you felt. Dub reads the mood to help spot what lifts you.</div>
        </div>
      ) : (
        <div className="journal-list">
          {entries.map(e => {
            const m = moodOf(e.mood);
            return (
              <div key={e.id} className="journal-card">
                <div className="journal-card-head">
                  {m && <span className="journal-card-mood" style={{ background: m.color }} title={m.label} />}
                  <span className="journal-card-when">{fmtWhen(e.createdAt)}</span>
                  {m && <span className="journal-card-moodlbl">{m.label}</span>}
                  <button className="goal-remove" onClick={() => remove(e.id)} aria-label="Delete entry">✕</button>
                </div>
                <p className="journal-card-body">{e.body}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default JournalPanel;
