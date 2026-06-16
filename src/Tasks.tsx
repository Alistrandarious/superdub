import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './App.css';
import { api } from './api';

interface Task {
  id: string;
  text: string;
  done: boolean;
}

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getTasks().then((data: Task[]) => {
      setTasks(data);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const addTask = async () => {
    const text = input.trim();
    if (!text) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newTask = { id, text, done: false };
    setTasks(prev => [...prev, newTask]);
    setInput('');
    api.createTask(id, text).catch(() => {});
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const newDone = !t.done;
      api.updateTask(id, newDone).catch(() => {});
      return { ...t, done: newDone };
    }));
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    api.deleteTask(id).catch(() => {});
  };

  return (
    <div className="app" style={{ '--theme': '#30d158', '--theme-dim': '#30d15866', '--theme-glow': '#30d15822' } as React.CSSProperties}>
      <header className="header">
        <div className="header-left">
          <Link to="/" className="back-link">← Back</Link>
        </div>
        <h1 className="title">To Dos</h1>
      </header>
      <div className="tasks-content page-content">
        <div className="diet-section">
          <h2 className="diet-heading">To Dos</h2>
          <div className="food-add">
            <input
              className="food-name"
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              placeholder="New task..."
            />
            <button className="food-add-btn" onClick={addTask}>+</button>
          </div>
          {!loaded ? (
            <p className="diet-empty">Loading…</p>
          ) : tasks.length === 0 ? (
            <p className="diet-empty">No tasks yet — add one above.</p>
          ) : (
            <ul className="task-list">
              {tasks.map(task => (
                <li key={task.id} className={`task-item ${task.done ? 'done' : ''}`}>
                  <label className="task-label">
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => toggleTask(task.id)}
                    />
                    <span>{task.text}</span>
                  </label>
                  <button className="food-remove" onClick={() => removeTask(task.id)}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Tasks;
