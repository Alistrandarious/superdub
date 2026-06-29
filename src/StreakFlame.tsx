import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Duolingo-style day-streak flame. Reads the cached check-in streak (written by
// the Habits page) so it can appear in every page header. Hidden at 0.
const StreakFlame: React.FC = () => {
  const navigate = useNavigate();
  const [streak, setStreak] = useState(() => parseInt(localStorage.getItem('superdub.dayStreak') || '0', 10));

  useEffect(() => {
    const sync = () => setStreak(parseInt(localStorage.getItem('superdub.dayStreak') || '0', 10));
    window.addEventListener('superdub:streak-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('superdub:streak-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (streak < 1) return null;

  return (
    <button
      className={`streak-flame${streak >= 7 ? ' hot' : ''}`}
      onClick={() => navigate('/')}
      aria-label={`${streak}-day streak`}
      title={`${streak}-day check-in streak`}
    >
      <span className="streak-flame-ico">🔥</span>
      <span className="streak-flame-num">{streak}</span>
    </button>
  );
};

export default StreakFlame;
