import { useEffect, useState, useCallback } from 'react';
import { inGracePeriod } from './day';

// Superdub night: during the after-midnight grace window (00:00-01:59, before
// "move to today" or 2 AM) the app turns to a starlit purple night as the ambient
// "you're still logging yesterday" cue. This just toggles a root class; the purple
// gradient + starfield live in CSS (html.superdub-night .app), so the stars sit in
// the background behind all content. Mirrors DayBanner's refresh cadence.
const NightSky: React.FC = () => {
  const [night, setNight] = useState(() => inGracePeriod());
  const refresh = useCallback(() => setNight(inGracePeriod()), []);

  useEffect(() => {
    refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('superdub:day-advanced', refresh);
    const id = window.setInterval(refresh, 60 * 1000); // lapses on its own at 2 AM
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('superdub:day-advanced', refresh);
      window.clearInterval(id);
    };
  }, [refresh]);

  useEffect(() => {
    document.documentElement.classList.toggle('superdub-night', night);
    return () => document.documentElement.classList.remove('superdub-night');
  }, [night]);

  return null;
};

export default NightSky;
