import React, { useState, useEffect } from 'react';
import './App.css';
import './Lists.css';
import { api } from './api';
import GoalsPanel from './GoalsPanel';
import JournalPanel from './JournalPanel';
import ListsHero, { type HeroData } from './ListsHero';
import SuperdubHeader from './SuperdubHeader';
import { getLoggingISO } from './day';
import { listStats, nextDue } from './listStats';
import { HEALTH, GROWTH, VIOLET, TEAL, pageTheme } from './theme';

const TargetIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
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

const CalendarIcon: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

const PlusIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

interface Task {
  id: string;
  text: string;
  done: boolean;
  type: 'todo' | 'shopping';
  dueDate?: string; // ISO 8601, e.g. 2026-07-06; undefined = no due date
}

type TabId = 'todo' | 'shopping' | 'goals' | 'journal';

// One row per tab: icon, label, and the accent that themes the page while it's
// open. Green = health/done, blue = growth, violet = rare rank (goals), teal =
// mood surfaces — straight off the swatches guide.
const TABS: { id: TabId; label: string; accent: string; Icon: React.FC<{ size?: number }> }[] = [
  { id: 'todo',     label: 'To-Do',    accent: HEALTH, Icon: CheckIcon },
  { id: 'shopping', label: 'Shopping', accent: GROWTH, Icon: CartIcon },
  { id: 'goals',    label: 'Goals',    accent: VIOLET, Icon: TargetIcon },
  { id: 'journal',  label: 'Journal',  accent: TEAL,   Icon: JournalIcon },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatDue = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return y && m && d ? `Due ${d} ${MONTHS[m - 1]}` : iso;
};
// Short label for the add-row chip and the hero, e.g. "6 Jul".
const shortDue = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return y && m && d ? `${d} ${MONTHS[m - 1]}` : iso;
};
// today + N days as local YYYY-MM-DD, for the quick-pick chips.
const isoPlus = (days: number) => {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const Tasks: React.FC = () => {
  const [tasks, setTasks]   = useState<Task[]>([]);
  const [tab, setTab]       = useState<TabId>('todo');
  const [input, setInput]   = useState('');
  const [due, setDue]       = useState('');
  const [showDate, setShowDate] = useState(false); // due-date dropdown open?
  const [loaded, setLoaded] = useState(false);
  // Goals and Journal own their data, so they hand their hero numbers up here.
  const [panelHero, setPanelHero] = useState<HeroData | null>(null);

  // Drop the panel's numbers when you leave it, so the next tab can't flash the
  // previous one's hero while it fetches. The composer resets with it: a due
  // date picked on To-Do would otherwise still be armed on Shopping, where the
  // date control is hidden and createShoppingItem has nowhere to put it — the
  // item showed a deadline until the next reload silently dropped it.
  useEffect(() => {
    setPanelHero(null);
    setInput('');
    setDue('');
    setShowDate(false);
  }, [tab]);

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
    // Only to-dos carry a deadline — the shopping endpoint has no due column,
    // so anything set here would render once and vanish on the next fetch.
    const dueDate = listType === 'todo' ? due || undefined : undefined;
    const newTask: Task = { id, text, done: false, type: listType, dueDate };
    setTasks(prev => [...prev, newTask]);
    setInput('');
    setDue('');
    setShowDate(false);
    if (tab === 'shopping') {
      api.createShoppingItem(id, text).catch(() => {});
    } else {
      api.createTask(id, text, dueDate).catch(() => {});
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

  // Items stay in place when marked done (insertion order preserved)
  const visible = tasks.filter(t => t.type === tab);
  const isShopping = tab === 'shopping';
  const isGoals = tab === 'goals';
  const isJournal = tab === 'journal';

  // The logging day, not the wall-clock day: a 1am tidy-up still counts as
  // "today" here, the same way it does for habits and the tracker (day.ts).
  const today = getLoggingISO();
  const stats = listStats(visible, today);
  const soonest = nextDue(visible);

  const accent = TABS.find(t => t.id === tab)!.accent;
  // Open-item counts on the chips, so you can see where the work is without
  // switching tabs. Goals and Journal own their own data, so they have none.
  const openCount = (type: 'todo' | 'shopping') =>
    tasks.filter(t => t.type === type && !t.done).length;

  const heroSub = stats.overdue > 0
    ? <span className="late">{stats.overdue} overdue</span>
    : soonest ? `Next due ${shortDue(soonest)}` : null;

  return (
    <div className="app flush" style={pageTheme(accent)}>
      <SuperdubHeader />

      <div className="lists-chips" role="tablist" aria-label="Lists">
        {TABS.map(t => {
          const n = t.id === 'todo' || t.id === 'shopping' ? openCount(t.id) : 0;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`lists-chip${tab === t.id ? ' active' : ''}`}
              style={{ ['--chip' as any]: t.accent }}
              onClick={() => setTab(t.id)}
            >
              <t.Icon size={14} /> {t.label}
              {n > 0 && <span className="lists-chip-n">{n}</span>}
            </button>
          );
        })}
      </div>

      {isGoals || isJournal ? (
        panelHero && <ListsHero {...panelHero} />
      ) : (
        <ListsHero
          eyebrow={isShopping ? 'SHOPPING' : 'TO-DO'}
          count={<>{stats.done}<em>/{stats.total}</em></>}
          label={isShopping ? 'picked up' : 'done'}
          pct={stats.pct}
          sub={heroSub}
        />
      )}

      {/* key={tab} remounts the panel on every switch, which is what replays the
          fade — without it React reuses the node and the swap is a hard cut. */}
      <div className="tasks-content page-content lists-panel" key={tab}>
        {isGoals ? (
          <GoalsPanel onHero={setPanelHero} />
        ) : isJournal ? (
          <JournalPanel onHero={setPanelHero} />
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
              aria-label={isShopping ? 'New shopping item' : 'New task'}
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
            <button
              className="lists-add-btn"
              onClick={addItem}
              disabled={!input.trim()}
              aria-label={isShopping ? 'Add item' : 'Add task'}
            >
              <PlusIcon />
            </button>
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
                <input type="date" value={due} min={isoPlus(0)} onChange={e => setDue(e.target.value)} aria-label="Pick a due date" />
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
          <div className="sd-loader-wrap"><div className="sd-loader" /></div>
        ) : visible.length === 0 ? (
          <div className="lists-empty">
            <div className="lists-empty-icon">{isShopping ? <CartIcon size={40} /> : <CheckIcon size={40} />}</div>
            <div className="lists-empty-title">{isShopping ? 'Nothing to shop for' : 'No tasks yet'}</div>
            <div className="lists-empty-sub">
              {isShopping
                ? 'Add what you need above, then tick it off in the aisle.'
                : 'Add a task above. Give it a due date and it will tell you when it runs late.'}
            </div>
          </div>
        ) : (
          <>
            <ul className="lists-list">
              {visible.map(task => {
                const late = !task.done && !!task.dueDate && task.dueDate < today;
                return (
                  <li key={task.id} className={`lists-item${task.done ? ' lists-item--done' : ''}${late ? ' lists-item--overdue' : ''}`}>
                    <button
                      className="lists-check"
                      onClick={() => toggleItem(task.id)}
                      aria-label={task.done ? `Mark ${task.text} as not done` : `Mark ${task.text} as done`}
                      aria-pressed={task.done}
                    >
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </button>
                    <div className="lists-text-col">
                      <span className="lists-text">{task.text}</span>
                      {task.dueDate && (
                        <span className={`lists-due${late ? ' lists-due--overdue' : ''}`}>
                          {formatDue(task.dueDate)}
                        </span>
                      )}
                    </div>
                    <button className="lists-remove" onClick={() => removeItem(task.id)} aria-label={`Remove ${task.text}`}>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
                    </button>
                  </li>
                );
              })}
            </ul>
            {stats.done > 0 && (
              <button className="lists-clear-btn" onClick={clearDone}>
                Clear {stats.done} done
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
