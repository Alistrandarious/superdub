import React, { useState, useEffect } from 'react';
import './App.css';
import { api } from './api';
import GoalsPanel from './GoalsPanel';
import JournalPanel from './JournalPanel';
import SuperdubHeader from './SuperdubHeader';
import { HEALTH, GROWTH, VIOLET, TEAL } from './theme';

const GOAL_ACCENT = VIOLET; // rare rank accent per the swatches guide
const JOURNAL_ACCENT = TEAL; // mood / reflection surface per the swatches guide

const TargetIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
  </svg>
);

interface Task {
  id: string;
  text: string;
  done: boolean;
  type: 'todo' | 'shopping';
  dueDate?: string; // ISO 8601, e.g. 2026-07-06; undefined = no due date
}

// Brand-family accents — green = To-Do (health/done), blue = Shopping (growth).
const TODO_ACCENT = HEALTH;
const SHOP_ACCENT = GROWTH;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Local YYYY-MM-DD. Native <input type="date"> emits this format, so lexical string
// compare (dueDate < today) is a correct date compare without timezone parsing.
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const formatDue = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return y && m && d ? `Due ${d} ${MONTHS[m - 1]}` : iso;
};
// Short label for the add-row chip, e.g. "6 Jul".
const shortDue = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return y && m && d ? `${d} ${MONTHS[m - 1]}` : iso;
};
// today + N days as local YYYY-MM-DD, for the quick-pick chips.
const isoPlus = (days: number) => {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const CalendarIcon: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

const CheckIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const JournalIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><path d="M9 7h6" />
  </svg>
);

const CartIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

const Tasks: React.FC = () => {
  const [tasks, setTasks]   = useState<Task[]>([]);
  const [tab, setTab]       = useState<'todo' | 'shopping' | 'goals' | 'journal'>('todo');
  const [input, setInput]   = useState('');
  const [due, setDue]       = useState('');
  const [showDate, setShowDate] = useState(false); // due-date dropdown open?
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getTasks().then((data: any[]) => {
      setTasks(data.map(t => ({ ...t, type: t.type ?? 'todo' })));
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const addItem = async () => {
    const text = input.trim();
    if (!text || tab === 'goals' || tab === 'journal') return;
    const listType: 'todo' | 'shopping' = tab;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newTask: Task = { id, text, done: false, type: listType, dueDate: due || undefined };
    setTasks(prev => [...prev, newTask]);
    setInput('');
    setDue('');
    setShowDate(false);
    if (tab === 'shopping') {
      api.createShoppingItem(id, text).catch(() => {});
    } else {
      api.createTask(id, text, due || undefined).catch(() => {});
    }
  };

  const toggleItem = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const newDone = !t.done;
      api.updateTask(id, newDone).catch(() => {});
      return { ...t, done: newDone };
    }));
  };

  const removeItem = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    api.deleteTask(id).catch(() => {});
  };

  const clearDone = () => {
    const done = tasks.filter(t => t.type === tab && t.done);
    done.forEach(t => api.deleteTask(t.id).catch(() => {}));
    setTasks(prev => prev.filter(t => !(t.type === tab && t.done)));
  };

  // Completed items sink to the bottom so the list stays clean as you tick things
  // off; insertion order is preserved within each group (Array.sort is stable).
  const visible = tasks.filter(t => t.type === tab).sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
  const doneCount = visible.filter(t => t.done).length;
  const today = todayISO();

  const isShopping = tab === 'shopping';
  const isGoals = tab === 'goals';
  const isJournal = tab === 'journal';
  const accent = isGoals ? GOAL_ACCENT : isJournal ? JOURNAL_ACCENT : isShopping ? SHOP_ACCENT : TODO_ACCENT;
  const themeVars = {
    '--theme': accent,
    '--theme-dim': accent + '66',
    '--theme-glow': accent + '22',
  } as React.CSSProperties;

  return (
    <div className="app flush" style={themeVars}>
      <SuperdubHeader />
      {/* Tab bar */}
      <div className="lists-tab-bar lists-tab-bar--top">
        <button
          className={`lists-tab${tab === 'todo' ? ' lists-tab--active' : ''}`}
          onClick={() => setTab('todo')}
        >
          <CheckIcon /> To-Do
        </button>
        <button
          className={`lists-tab${tab === 'shopping' ? ' lists-tab--active' : ''}`}
          onClick={() => setTab('shopping')}
        >
          <CartIcon /> Shopping
        </button>
        <button
          className={`lists-tab${tab === 'goals' ? ' lists-tab--active' : ''}`}
          onClick={() => setTab('goals')}
        >
          <TargetIcon /> Goals
        </button>
        <button
          className={`lists-tab${tab === 'journal' ? ' lists-tab--active' : ''}`}
          onClick={() => setTab('journal')}
        >
          <JournalIcon /> Journal
        </button>
      </div>

      <div className="tasks-content page-content">
        {isGoals ? (
          <GoalsPanel accent={GOAL_ACCENT} />
        ) : isJournal ? (
          <JournalPanel accent={JOURNAL_ACCENT} />
        ) : (
        <>
        {/* Add block: task text + add. A due date lives in a dropdown below the
            row, not as a raw date box inline, so it's part of the UI, not stuck
            on the side. Once picked it rides on the task itself (lists-due). */}
        <div className="lists-input-block">
          <div className="lists-input-row">
            <input
              className="lists-input"
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              placeholder={isShopping ? 'Add item to shop for…' : 'New task…'}
            />
            {!isShopping && (
              <button
                className={`lists-date-toggle${due ? ' has-date' : ''}${showDate ? ' open' : ''}`}
                onClick={() => setShowDate(s => !s)}
                aria-label={due ? `Due ${shortDue(due)}, change` : 'Add a due date'}
                title="Add a due date"
              >
                <CalendarIcon />
                {due && <span className="lists-date-toggle-val">{shortDue(due)}</span>}
              </button>
            )}
            <button className="lists-add-btn" onClick={addItem} style={{ background: accent }}>+</button>
          </div>

          {!isShopping && showDate && (
            <div className="lists-date-drop">
              {[{ label: 'Today', d: 0 }, { label: 'Tomorrow', d: 1 }, { label: 'Next week', d: 7 }].map(o => (
                <button
                  key={o.d}
                  className={`lists-date-chip${due === isoPlus(o.d) ? ' active' : ''}`}
                  onClick={() => { setDue(isoPlus(o.d)); setShowDate(false); }}
                >{o.label}</button>
              ))}
              <label className="lists-date-chip lists-date-pick">
                <CalendarIcon size={13} />
                {due && ![isoPlus(0), isoPlus(1), isoPlus(7)].includes(due) ? shortDue(due) : 'Pick…'}
                <input type="date" value={due} min={todayISO()} onChange={e => setDue(e.target.value)} />
              </label>
              {due && (
                <button className="lists-date-chip lists-date-clear" onClick={() => { setDue(''); setShowDate(false); }}>
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* List */}
        {!loaded ? (
          <div className="sd-loader-wrap"><div className="sd-loader"><img className="sd-loader-logo" src="/superdub-logo.png" alt="" /></div></div>
        ) : visible.length === 0 ? (
          <div className="lists-empty">
            <div className="lists-empty-icon">{isShopping ? <CartIcon size={40} /> : <CheckIcon size={40} />}</div>
            <div className="lists-empty-title">{isShopping ? 'Shopping list is empty' : 'No tasks yet'}</div>
            <div className="lists-empty-sub">
              {isShopping
                ? 'Add items above, or export a saved meal plan from Meal Plans.'
                : 'Add a task above to get started.'}
            </div>
          </div>
        ) : (
          <>
            <ul className="lists-list">
              {visible.map(task => (
                <li key={task.id} className={`lists-item${task.done ? ' lists-item--done' : ''}`}>
                  <button
                    className="lists-check"
                    onClick={() => toggleItem(task.id)}
                    style={{ borderColor: task.done ? accent : undefined, background: task.done ? accent : undefined }}
                  >
                    {task.done && (
                      <svg className="lists-check-tick" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                  <div className="lists-text-col">
                    <span className="lists-text">{task.text}</span>
                    {task.dueDate && (
                      <span className={`lists-due${!task.done && task.dueDate < today ? ' lists-due--overdue' : ''}`}>
                        {formatDue(task.dueDate)}
                      </span>
                    )}
                  </div>
                  <button className="lists-remove" onClick={() => removeItem(task.id)} aria-label="Remove">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
                  </button>
                </li>
              ))}
            </ul>
            {doneCount > 0 && (
              <button className="lists-clear-btn" onClick={clearDone}>
                Clear {doneCount} done
              </button>
            )}
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
};

export default Tasks;
