import React, { useState, useEffect } from 'react';
import { api } from './api';
import { getLoggingISO } from './day';
import { listStats, nextDue, daysUntil } from './listStats';
import { type HeroData } from './ListsHero';

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
  { key: 'relevant',   letter: 'R', label: 'Relevant',    hint: 'Why does this matter to you?',           color: '#8B5CF6' },
];

const TickIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CloseIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);

const fmtDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const GoalsPanel: React.FC<{ onHero: (h: HeroData) => void }> = ({ onHero }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ ...BLANK });

  useEffect(() => {
    api.getGoals().then((g: any[]) => { setGoals(g); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  // Feed the page hero. A goal's deadline is its due date, so the shared list
  // maths counts closed against total and spots the ones that have slipped.
  useEffect(() => {
    if (!loaded) return;
    const countable = goals.map(g => ({ done: g.done, dueDate: g.timeBound || undefined }));
    const s = listStats(countable, getLoggingISO());
    const soonest = nextDue(countable);
    onHero({
      eyebrow: 'GOALS',
      count: <>{s.done}<em>/{s.total}</em></>,
      label: s.total === 1 ? 'goal closed' : 'goals closed',
      pct: s.pct,
      sub: s.overdue > 0
        ? <span className="late">{s.overdue} past its date</span>
        : soonest ? `Next up ${fmtDate(soonest)}` : null,
    });
  }, [goals, loaded, onHero]);

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
    return <div className="sd-loader-wrap"><div className="sd-loader" /></div>;
  }

  const today = getLoggingISO();

  return (
    <div className="goals-wrap">
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
            placeholder="Your goal, e.g. Run a 10k"
            aria-label="Goal title"
          />
          {SMART.map(s => (
            <div className="goals-field" key={s.key}>
              <span className="goals-badge" style={{ background: s.color }} aria-hidden="true">{s.letter}</span>
              <div className="goals-field-body">
                <label className="goals-field-label" htmlFor={`goal-${s.key}`}>{s.label}</label>
                <textarea
                  id={`goal-${s.key}`}
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
            <span className="goals-badge" style={{ background: '#FF6B6B' }} aria-hidden="true">T</span>
            <div className="goals-field-body">
              <label className="goals-field-label" htmlFor="goal-timebound">Time-bound</label>
              <input
                id="goal-timebound"
                type="date"
                className="goals-date-input"
                value={form.timeBound}
                onChange={e => set('timeBound', e.target.value)}
              />
            </div>
          </div>
          <div className="goals-form-actions">
            <button className="goals-cancel" onClick={() => { setFormOpen(false); setForm({ ...BLANK }); }}>Cancel</button>
            <button className="goals-save" onClick={save} disabled={!form.title.trim()}>Save goal</button>
          </div>
        </div>
      )}

      {goals.length === 0 && !formOpen ? (
        <div className="lists-empty">
          <div className="lists-empty-icon">
            <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" />
            </svg>
          </div>
          <div className="lists-empty-title">No goals yet</div>
          <div className="lists-empty-sub">Set a SMART goal: Specific, Measurable, Achievable, Relevant, Time-bound.</div>
        </div>
      ) : (
        <div className="goals-list">
          {goals.map(g => {
            const dl = g.timeBound ? daysUntil(g.timeBound, today) : null;
            return (
              <div key={g.id} className={`goal-card${g.done ? ' goal-card--done' : ''}`}>
                <div className="goal-card-head">
                  <button
                    className="goal-check"
                    onClick={() => toggleDone(g)}
                    aria-label={g.done ? `Reopen ${g.title}` : `Close ${g.title}`}
                    aria-pressed={g.done}
                  >
                    <TickIcon />
                  </button>
                  <span className="goal-title">{g.title}</span>
                  <button className="goal-remove" onClick={() => remove(g.id)} aria-label={`Delete goal ${g.title}`}>
                    <CloseIcon />
                  </button>
                </div>

                {dl !== null && (
                  <div className={`goal-deadline${!g.done && dl < 0 ? ' overdue' : ''}`}>
                    {dl < 0 ? `${Math.abs(dl)}d overdue` : dl === 0 ? 'Due today' : `${dl} days left`}
                    <span className="goal-deadline-date"> · {fmtDate(g.timeBound)}</span>
                  </div>
                )}

                <div className="goal-smart">
                  {SMART.map(s => g[s.key] ? (
                    <div className="goal-smart-row" key={s.key}>
                      <span className="goals-badge sm" style={{ background: s.color }} aria-hidden="true">{s.letter}</span>
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
