import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './App.css';
import { api } from './api';

interface Task {
  id: string;
  text: string;
  done: boolean;
  type: 'todo' | 'shopping';
}

const Tasks: React.FC = () => {
  const [tasks, setTasks]   = useState<Task[]>([]);
  const [tab, setTab]       = useState<'todo' | 'shopping'>('todo');
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
    if (!text) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newTask: Task = { id, text, done: false, type: tab };
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
  const accent = isShopping ? '#ff9f0a' : '#30d158';
  const themeVars = isShopping
    ? { '--theme': '#ff9f0a', '--theme-dim': '#ff9f0a66', '--theme-glow': '#ff9f0a22' }
    : { '--theme': '#30d158', '--theme-dim': '#30d15866', '--theme-glow': '#30d15822' };

  return (
    <div className="app" style={themeVars as React.CSSProperties}>
      <header className="header">
        <div className="header-left">
          <Link to="/" className="back-link">← Back</Link>
        </div>
        <h1 className="title">Lists</h1>
      </header>

      {/* Tab bar */}
      <div className="lists-tab-bar">
        <button
          className={`lists-tab${tab === 'todo' ? ' lists-tab--active lists-tab--green' : ''}`}
          onClick={() => setTab('todo')}
        >
          ✓ To-Do
        </button>
        <button
          className={`lists-tab${tab === 'shopping' ? ' lists-tab--active lists-tab--orange' : ''}`}
          onClick={() => setTab('shopping')}
        >
          🛒 Shopping
        </button>
      </div>

      <div className="tasks-content page-content">
        {/* Input row */}
        <div className="lists-input-row">
          <input
            className="lists-input"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder={isShopping ? 'Add item to shop for…' : 'New task…'}
            style={{ '--accent': accent } as React.CSSProperties}
          />
          <button
            className="lists-add-btn"
            onClick={addItem}
            style={{ background: accent }}
          >+</button>
        </div>

        {/* List */}
        {!loaded ? (
          <p className="diet-empty">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="lists-empty">
            <div className="lists-empty-icon">{isShopping ? '🛒' : '✅'}</div>
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
      </div>
    </div>
  );
};

export default Tasks;
