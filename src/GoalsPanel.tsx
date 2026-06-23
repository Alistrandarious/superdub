import React, { useState, useEffect } from 'react';
import { api } from './api';

interface Goal {
  id: string;
  title: string;
  specific: string;
  measurable: string;
  achievable: string;
  relevant: string;
  timeBound: string;
  done: boolean;
}

const BLANK = { title: '', specific: '', measurable: '', achievable: '', relevant: '', timeBound: '' };

// The five SMART dimensions, each with a coloured letter badge.
const SMART: { key: keyof typeof BLANK; letter: string; label: string; hint: string; color: string }[] = [
  { key: 'specific',   letter: 'S', label: 'Specific',    hint: 'What exactly will you achieve?',        color: '#2FD27E' },
  { key: 'measurable', letter: 'M', label: 'Measurable',  hint: 'How will you measure progress?',         color: '#2E8BFF' },
  { key: 'achievable', letter: 'A', label: 'Achievable',  hint: 'Is it realistic? What makes it doable?', color: '#FFB928' },
  { key: 'relevant',   letter: 'R', label: 'Relevant',    hint: 'Why does this matter to you?',           color: '#A855F7' },
];

function daysLeft(date: string): number | null {
  if (!date) return null;
  const d = new Date(date + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

const GoalsPanel: React.FC<{ accent: string }> = ({ accent }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ ...BLANK });

  useEffect(() => {
    api.getGoals().then((g: any[]) => { setGoals(g); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  const set = (k: keyof typeof BLANK, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    if (!form.title.trim()) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const goal: Goal = { id, ...form, title: form.title.trim(), done: false };
    setGoals(prev => [goal, ...prev]);
    api.createGoal(goal).catch(() => {});
    setForm({ ...BLANK });
    setFormOpen(false);
  };

  const toggleDone = (g: Goal) => {
    setGoals(prev => prev.map(x => x.id === g.id ? { ...x, done: !x.done } : x));
    api.updateGoal(g.id, { done: !g.done }).catch(() => {});
  };

  const remove = (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
    api.deleteGoal(id).catch(() => {});
  };

  if (!loaded) {
    return <div className="sd-loader-wrap"><div className="sd-loader"><img className="sd-loader-logo" src="/superdub-logo.png" alt="" /></div></div>;
  }

  return (
    <div className="goals-wrap" style={{ ['--goal-accent' as any]: accent }}>
      {!formOpen && (
        <button className="goals-new-btn" onClick={() => setFormOpen(true)}>
          <span className="goals-new-plus">+</span> New SMART goal
        </button>
      )}

      {formOpen && (
        <div className="goals-form">
          <input
            className="goals-title-input"
            value={form.title}
            autoFocus
            onChange={e => set('title', e.target.value)}
            placeholder="Your goal — e.g. Run a 10k"
          />
          {SMART.map(s => (
            <div className="goals-field" key={s.key}>
              <span className="goals-badge" style={{ background: s.color }}>{s.letter}</span>
              <div className="goals-field-body">
                <label className="goals-field-label">{s.label}</label>
                <textarea
                  className="goals-field-input"
                  rows={2}
                  value={form[s.key]}
                  onChange={e => set(s.key, e.target.value)}
                  placeholder={s.hint}
                />
              </div>
            </div>
          ))}
          <div className="goals-field">
            <span className="goals-badge" style={{ background: '#FF6B6B' }}>T</span>
            <div className="goals-field-body">
              <label className="goals-field-label">Time-bound</label>
              <input
                type="date"
                className="goals-date-input"
                value={form.timeBound}
                onChange={e => set('timeBound', e.target.value)}
              />
            </div>
          </div>
          <div className="goals-form-actions">
            <button className="goals-cancel" onClick={() => { setFormOpen(false); setForm({ ...BLANK }); }}>Cancel</button>
            <button className="goals-save" onClick={save} disabled={!form.title.trim()} style={{ background: accent }}>Save goal</button>
          </div>
        </div>
      )}

      {goals.length === 0 && !formOpen ? (
        <div className="lists-empty">
          <div className="lists-empty-icon">🎯</div>
          <div className="lists-empty-title">No goals yet</div>
          <div className="lists-empty-sub">Set a SMART goal — Specific, Measurable, Achievable, Relevant, Time-bound.</div>
        </div>
      ) : (
        <div className="goals-list">
          {goals.map(g => {
            const dl = daysLeft(g.timeBound);
            return (
              <div key={g.id} className={`goal-card${g.done ? ' goal-card--done' : ''}`}>
                <div className="goal-card-head">
                  <button className="goal-check" onClick={() => toggleDone(g)} style={{ borderColor: g.done ? accent : undefined, background: g.done ? accent : undefined }}>
                    {g.done && <span className="goal-check-tick">✓</span>}
                  </button>
                  <span className="goal-title">{g.title}</span>
                  <button className="goal-remove" onClick={() => remove(g.id)} aria-label="Delete goal">✕</button>
                </div>

                {dl !== null && (
                  <div className={`goal-deadline${dl < 0 ? ' overdue' : ''}`}>
                    {dl < 0 ? `${Math.abs(dl)}d overdue` : dl === 0 ? 'Due today' : `${dl} days left`}
                    <span className="goal-deadline-date">· {new Date(g.timeBound + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                )}

                <div className="goal-smart">
                  {SMART.map(s => g[s.key] ? (
                    <div className="goal-smart-row" key={s.key}>
                      <span className="goals-badge sm" style={{ background: s.color }}>{s.letter}</span>
                      <span className="goal-smart-text">{g[s.key]}</span>
                    </div>
                  ) : null)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GoalsPanel;
