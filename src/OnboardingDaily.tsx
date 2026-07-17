import React, { useState } from 'react';

// Screen 6 of onboarding — "This is your day." A soft, non-functional preview of
// the daily habit window built from the habits the user just picked, so they feel
// what tracking is before the app is even running. Tapping a ring ticks it (local
// state only — nothing persists); closing them all lights the card up.
// ponytail: illustration, not the live Habits card. It mirrors the daily loop's
// feel without its data/engine wiring — intentional, this screen is pre-account.

const OnboardingDaily: React.FC<{ habits: string[]; nickname: string }> = ({ habits, nickname }) => {
  const shown = habits.slice(0, 6); // keep the card calm even if they picked a lot
  const [done, setDone] = useState<Set<string>>(new Set());
  const toggle = (h: string) =>
    setDone(prev => {
      const next = new Set(prev);
      next.has(h) ? next.delete(h) : next.add(h);
      return next;
    });

  const closed = shown.filter(h => done.has(h)).length;
  const allDone = shown.length > 0 && closed === shown.length;
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long' });

  return (
    <div className={`onb-day-card${allDone ? ' is-complete' : ''}`}>
      <div className="onb-day-head">
        <div>
          <span className="onb-day-eyebrow">{today}</span>
          <h3 className="onb-day-title">{allDone ? `Clean sweep, ${nickname || 'you'}!` : 'Your day'}</h3>
        </div>
        <div className="onb-day-count" aria-label={`${closed} of ${shown.length} closed`}>
          <strong>{closed}</strong><span>/{shown.length}</span>
        </div>
      </div>

      <ul className="onb-day-list">
        {shown.map(h => {
          const isDone = done.has(h);
          return (
            <li key={h}>
              <button
                type="button"
                className={`onb-day-row${isDone ? ' done' : ''}`}
                onClick={() => toggle(h)}
                aria-pressed={isDone}
              >
                <span className="onb-day-ring" aria-hidden>
                  {isDone && (
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
                <span className="onb-day-name">{h}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="onb-day-hint">{allDone ? 'This is what a perfect day looks like.' : 'Tap a ring to close it — try it out.'}</p>
    </div>
  );
};

export default OnboardingDaily;
