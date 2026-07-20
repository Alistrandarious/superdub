import React, { useEffect, useState, useCallback } from 'react';
import './App.css';
import SuperdubHeader from './SuperdubHeader';
import GlobalPlanet from './GlobalPlanet';
import FriendsPanel from './FriendsPanel';
import { pageTheme, GOLD } from './theme';
import { api } from './api';
import { habitLevelFromDays, HABIT_LEVEL_RATES, whiteUnlocked, DUB_WHITE_KEY } from './levels';

// Global & Friends — the community tab. One shared Global habit that every
// Superdubber climbs together: the gold community-progress ring wraps the shared
// planet (one hero graphic, "one planet, one habit" made literal), a milestone
// track surfaces the Aurora White reward + your personal 100-XP gate, and your
// own contribution reads as a stat row. Logging a deed opens the existing
// GlobalPrompt overlay (mounted app-wide) via superdub:show-global.

// Progress-ring geometry (the gold arc around the planet).
const RING_R = 92;
const RING_C = 2 * Math.PI * RING_R;
// Today's deed is the (myDays+1)th completion — same ladder as every habit.
const rateFor = (days: number) =>
  HABIT_LEVEL_RATES[Math.min(habitLevelFromDays(days) - 1, HABIT_LEVEL_RATES.length - 1)];

interface GlobalData {
  month: string; title: string; habit: string; goal: number;
  total: number; contributors: number; mine: number; myDays: number; doneToday: boolean;
}

const CommunityPage: React.FC = () => {
  const [d, setD] = useState<GlobalData | null>(null);

  const load = useCallback(() => {
    api.getGlobalHabit().then(g => {
      setD(g);
      // Latch the white-dub reward the moment the milestone is met (same as the card did).
      if (whiteUnlocked(g.total, g.mine)) localStorage.setItem(DUB_WHITE_KEY, '1');
    }).catch(() => {});
  }, []);

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

  const pct = d ? Math.max(0, Math.min(100, Math.round((d.total / Math.max(1, d.goal)) * 100))) : 0;
  const level = d ? habitLevelFromDays(d.myDays) : 1;
  const perDeed = d ? rateFor(d.myDays + 1) : HABIT_LEVEL_RATES[0];
  const ringOffset = RING_C * (1 - pct / 100);
  const toGo = d ? Math.max(0, d.goal - d.total) : 0;
  const unlocked = d ? whiteUnlocked(d.total, d.mine) : false;
  const mm = /^(\d{4})-(\d{2})$/.exec(d?.month ?? '');
  const monthName = mm ? new Date(+mm[1], +mm[2] - 1, 1).toLocaleString('en-US', { month: 'long' }) : '';

  return (
    <div className="app flush" style={pageTheme(GOLD)}>
      <SuperdubHeader />

      <div className="page-content community-content">
        {/* Hero — the shared planet inside the gold community-progress ring */}
        <div className="community-hero">
          <span className="community-eyebrow">GLOBAL &amp; FRIENDS{monthName ? ` · ${monthName}` : ''}</span>
          <div className="community-hero-stage">
            <div className="community-hero-orb">
              {/* Gold arc fills as the world climbs toward the monthly goal */}
              <svg className="community-ring" viewBox="0 0 200 200" aria-hidden="true">
                <defs>
                  <linearGradient id="community-ring-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FFB928" />
                    <stop offset="100%" stopColor="#FFE08A" />
                  </linearGradient>
                </defs>
                <circle cx="100" cy="100" r={RING_R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
                <circle
                  className="community-ring-arc"
                  cx="100" cy="100" r={RING_R} fill="none"
                  stroke="url(#community-ring-grad)" strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={RING_C} strokeDashoffset={ringOffset}
                  transform="rotate(-90 100 100)"
                />
              </svg>
              <span className="community-hero-orbit community-hero-orbit--a" />
              <span className="community-hero-orbit community-hero-orbit--b" />
              {d && <span className="community-ring-pct">{pct}%</span>}
              <GlobalPlanet size={150} />
            </div>
          </div>

          <div className="community-hero-copy">
            {d ? (
              <>
                <span className="community-hero-total">
                  {d.total.toLocaleString()}<em> / {d.goal.toLocaleString()} XP</em>
                </span>
                <p className="community-sub">The world is climbing <b>{d.habit}</b> this month</p>
                <div className="community-climbers">
                  <span className="community-avatars" aria-hidden="true"><i /><i /><i /><i /></span>
                  <small>{d.contributors.toLocaleString()} climbing</small>
                </div>
              </>
            ) : (
              <h2 className="community-hero-title">One planet, one habit</h2>
            )}
          </div>
        </div>

        {d && (
          <>
            {/* Milestone track — the Aurora White reward + your personal 100-XP gate */}
            <section className="global-milestone">
              <div className="global-milestone-head">
                <span className="global-milestone-eyebrow">REWARD · AURORA WHITE RING</span>
                <span className="global-milestone-togo">{unlocked ? 'Unlocked' : `${toGo.toLocaleString()} XP to go`}</span>
              </div>
              <div className="global-milestone-track">
                <div className="global-milestone-fill" style={{ width: `${Math.max(2, pct)}%` }} />
                <span className="global-milestone-node start" />
                <span className={`global-milestone-node goal${unlocked ? ' hit' : ''}`} />
              </div>
              <div className="global-milestone-labels">
                <span>Started</span><span>{pct}% there</span><span>{d.goal.toLocaleString()}</span>
              </div>
              <p className="global-milestone-note">
                Reach {d.goal.toLocaleString()} together with <b>100+ XP of your own</b> and everyone latches{' '}
                <b>Aurora White</b>, a ring theme you can only earn as a world.
                {!unlocked && d.mine < 100 && (
                  <span className="global-milestone-you"> You: {d.mine.toLocaleString()} / 100 XP.</span>
                )}
              </p>
            </section>

            {/* Your quiet, personal line under the collective one */}
            <div className="global-you">
              <span className="global-you-badge"><small>LEVEL</small><strong>{level}</strong></span>
              <div className="global-you-text">
                <b>{d.mine > 0 ? `+${d.mine.toLocaleString()} XP this month` : 'Log your first deed to join the climb'}</b>
                <small>
                  {d.mine > 0
                    ? `Your deeds are worth ${perDeed} XP each at Level ${level}`
                    : 'One good deed counts for everyone'}
                </small>
              </div>
            </div>
          </>
        )}

        <button
          className="community-deed-btn"
          onClick={() => window.dispatchEvent(new CustomEvent('superdub:show-global'))}
        >
          {d?.doneToday ? 'Good deed done today ✓' : 'Log a good deed'}
        </button>

        <FriendsPanel />
      </div>
    </div>
  );
};

export default CommunityPage;
