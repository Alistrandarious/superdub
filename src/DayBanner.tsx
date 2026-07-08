import React, { useEffect, useState, useCallback } from 'react';
import './App.css';
import { inGracePeriod, loggingNow, advanceToToday } from './day';

// Superdub time: after midnight the app keeps logging to the previous day until
// 2 AM. This top banner makes that explicit and lets the user jump ahead early.
// It clears itself at 2 AM (minute re-check) or when "Move to today" is tapped.
const DayBanner: React.FC = () => {
  const [show, setShow] = useState(() => inGracePeriod());

  const refresh = useCallback(() => setShow(inGracePeriod()), []);

  useEffect(() => {
    refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('superdub:day-advanced', refresh);
    const id = window.setInterval(refresh, 60 * 1000); // clears itself at 2 AM
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('superdub:day-advanced', refresh);
      window.clearInterval(id);
    };
  }, [refresh]);

  if (!show) return null;

  const label = loggingNow().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const advance = () => { advanceToToday(); setShow(false); };

  return (
    <div className="day-banner">
      <span className="day-banner-text">Still logging {label}. New entries land here until 2 AM.</span>
      <button className="day-banner-btn" onClick={advance}>Move to today</button>
    </div>
  );
};

export default DayBanner;
