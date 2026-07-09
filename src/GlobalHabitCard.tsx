import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api';

// This month's GLOBAL habit: one shared XP goal every Superdubber climbs together.
// Read-only here (contribution happens on the Habits page as you complete habits);
// this card just shows the collective progress, refreshing on check-ins and logs.
interface GlobalData {
  month: string;
  title: string;
  goal: number;
  total: number;
  contributors: number;
  mine: number;
}

const GlobalHabitCard: React.FC = () => {
  const [data, setData] = useState<GlobalData | null>(null);
  const load = useCallback(() => { api.getGlobalHabit().then(setData).catch(() => {}); }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener('superdub:checkin-done', h);
    window.addEventListener('superdub:tracker-updated', h);
    return () => {
      window.removeEventListener('superdub:checkin-done', h);
      window.removeEventListener('superdub:tracker-updated', h);
    };
  }, [load]);

  if (!data) return null;
  const pct = Math.max(0, Math.min(100, Math.round((data.total / Math.max(1, data.goal)) * 100)));

  return (
    <section className="global-habit">
      <div className="global-habit-head">
        <span className="global-habit-eyebrow">THIS MONTH · TOGETHER</span>
        <span className="global-habit-contributors">{data.contributors.toLocaleString()} climbing</span>
      </div>
      <h3 className="global-habit-title">{data.title}</h3>
      <div className="global-habit-bar">
        <div className="global-habit-fill" style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <div className="global-habit-stats">
        <span className="global-habit-total">{data.total.toLocaleString()}<span> / {data.goal.toLocaleString()} XP</span></span>
        <span className="global-habit-pct">{pct}%</span>
      </div>
      {data.mine > 0 && (
        <p className="global-habit-mine">You've added {data.mine.toLocaleString()} XP this month.</p>
      )}
    </section>
  );
};

export default GlobalHabitCard;
