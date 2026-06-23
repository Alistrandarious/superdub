import React, { useState, useEffect } from 'react';
import './App.css';
import { api } from './api';
import GoalsPanel from './GoalsPanel';

const GOAL_ACCENT = '#A855F7';

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
}

// Brand-family accents — green = To-Do (health/done), blue = Shopping (growth).
const TODO_ACCENT = '#2FD27E';
const SHOP_ACCENT = '#2E8BFF';

const CheckIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
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
  const [tab, setTab]       = useState<'todo' | 'shopping' | 'goals'>('todo');
  const [input, setInput]   = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getTasks().then((data: any[]) => {
      setTasks(data.map(t => ({ ...t, type: t.type ?? 'todo' })));
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const addItem = async () => {
    const text = input.trim();
    if (!text || tab === 'goals') return;
    const listType: 'todo' | 'shopping' = tab;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newTask: Task = { id, text, done: false, type: listType };
    setTasks(prev => [...prev, newTask]);
    setInput('');
    if (tab === 'shopping') {
      api.createShoppingItem(id, text).catch(() => {});
    } else {
      api.createTask(id, text).catch(() => {});
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

  const visible = tasks.filter(t => t.type === tab);
  const doneCount = visible.filter(t => t.done).length;

  const isShopping = tab === 'shopping';
  const isGoals = tab === 'goals';
  const accent = isGoals ? GOAL_ACCENT : isShopping ? SHOP_ACCENT : TODO_ACCENT;
  const themeVars = {
    '--theme': accent,
    '--theme-dim': accent + '66',
    '--theme-glow': accent + '22',
  } as React.CSSProperties;

  return (
    <div className="app flush" style={themeVars}>
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
      </div>

      <div className="tasks-content page-content">
        {isGoals ? (
          <GoalsPanel accent={GOAL_ACCENT} />
        ) : (
        <>
        {/* Input row */}
        <div className="lists-input-row">
          <input
            className="lists-input"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder={isShopping ? 'Add item to shop for…' : 'New task…'}
          />
          <button
            className="lists-add-btn"
            onClick={addItem}
            style={{ background: accent }}
          >+</button>
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
                    {task.done && <span className="lists-check-tick">✓</span>}
                  </button>
                  <span className="lists-text">{task.text}</span>
                  <button className="lists-remove" onClick={() => removeItem(task.id)}>✕</button>
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
