import React, { useEffect, useState } from 'react';
import { capture } from './analytics';
import AnimatedFlame from './AnimatedFlame';
import { milestoneProgress, STREAK_MILESTONES } from './dayStreak';

const CELEBRATED_KEY = 'superdub.streakMilestone';
const STREAK_KEY = 'superdub.dayStreak';

// One line per landmark. Short, second person, no dashes (SUPERDUB_VOICE.md).
const LINES: Record<number, string> = {
  3: 'Three days running. This is how it starts.',
  7: 'A whole week. Gold ring and gold accents are yours.',
  14: 'Two weeks straight. The habit is taking.',
  21: 'Three weeks. Most people never get here.',
  30: 'A month. Nothing about this is luck any more.',
  50: 'Fifty days. You do this now.',
  75: 'Seventy five days. Relentless.',
  100: 'One hundred days. Say it out loud.',
  150: 'A hundred and fifty. Half a year of showing up.',
  200: 'Two hundred days. Rare company.',
  365: 'A full year. Every single day.',
};

// Watches the cached day streak (Habits writes superdub.dayStreak and fires
// superdub:streak-updated) and throws a full-screen moment the first time the
// run crosses each landmark in STREAK_MILESTONES. Reuses the level-up overlay's
// chrome (lvlup-*) so the two feel like one reward system.
//
// The stored value is the last landmark celebrated. It follows the streak DOWN
// too: break the run and the landmarks re-arm, so earning a week back after a
// slip is celebrated like the first time. It should be.
const StreakMilestone: React.FC = () => {
  const [show, setShow] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const sync = () => {
      const streak = parseInt(localStorage.getItem(STREAK_KEY) || '0', 10) || 0;
      const reached = milestoneProgress(streak).prev;
      const stored = localStorage.getItem(CELEBRATED_KEY);
      // First ever run: record silently, never celebrate retroactively.
      if (stored === null) { localStorage.setItem(CELEBRATED_KEY, String(reached)); return; }
      const last = parseInt(stored, 10) || 0;
      if (reached === last) return;
      localStorage.setItem(CELEBRATED_KEY, String(reached));
      if (reached > last) {
        setShow(reached);
        capture('streak_milestone', { days: reached });
        if ('vibrate' in navigator) navigator.vibrate([0, 60, 50, 60, 50, 120]);
      }
    };
    sync();
    window.addEventListener('superdub:streak-updated', sync);
    return () => window.removeEventListener('superdub:streak-updated', sync);
  }, []);

  if (show === null) return null;

  const close = () => {
    setClosing(true);
    setTimeout(() => { setShow(null); setClosing(false); }, 320);
  };
  const next = STREAK_MILESTONES.find(m => m > show) ?? null;

  return (
    <div className={`lvlup-overlay smile-overlay${closing ? ' closing' : ''}`}>
      <div className="lvlup-card">
        <div className="lvlup-rays" style={{ ['--ray' as any]: 'rgba(255,138,0,0.45)' }} />
        <div className="lvlup-burst">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="lvlup-spark smile-spark" style={{ ['--i' as any]: i } as React.CSSProperties} />
          ))}
        </div>

        <p className="lvlup-eyebrow smile-eyebrow">STREAK MILESTONE</p>
        <div className="smile-flame lvlup-bump"><AnimatedFlame size={96} /></div>
        <div className="smile-num">{show}</div>
        <h2 className="lvlup-title">days in a row</h2>
        <p className="smile-line">{LINES[show] ?? 'Still going.'}</p>
        {next && <p className="smile-next">Next stop: {next} days.</p>}

        <button className="lvlup-down" onClick={close} aria-label="Down to the app">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
          <span>keep going</span>
        </button>
      </div>
    </div>
  );
};

export default StreakMilestone;
