import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { api } from './api';
import GlobalPlanet from './GlobalPlanet';
import {
  habitLevelFromDays, HABIT_LEVEL_RATES, HABIT_LEVEL_TIERS, MAX_HABIT_LEVEL,
  whiteUnlocked, DUB_WHITE_KEY,
} from './levels';

// The Global habit overlay — opened by tapping the spinning planet by the level
// ring (dispatches `superdub:show-global`). One shared, ascension-gold habit that
// each user levels personally (day-count → level → XP-per-deed, the same ladder as
// every other habit) while all that XP feeds ONE monthly community total. Hitting
// 10k as a community, with ≥100 XP of your own, latches the white dub colour.

interface GlobalData {
  month: string; title: string; habit: string; goal: number;
  total: number; contributors: number; mine: number; myDays: number; doneToday: boolean;
}

const rateFor = (days: number) => HABIT_LEVEL_RATES[Math.min(habitLevelFromDays(days) - 1, HABIT_LEVEL_RATES.length - 1)];

const GlobalPrompt: React.FC = () => {
  const [show, setShow] = useState(false);
  const [data, setData] = useState<GlobalData | null>(null);
  const [saving, setSaving] = useState(false);
  const [justEarned, setJustEarned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => { api.getGlobalHabit().then(setData).catch(() => {}); }, []);

  useEffect(() => {
    const open = () => { setError(null); setJustEarned(false); setShow(true); load(); };
    window.addEventListener('superdub:show-global', open);
    return () => window.removeEventListener('superdub:show-global', open);
  }, [load]);

  const logDeed = async () => {
    if (!data || data.doneToday || saving) return;
    setSaving(true); setError(null);
    try {
      // Today's deed is the (myDays+1)th completion — pay that level's rate, matching
      // habitXPForDoneDays. Idempotent per day, so this can't double-count.
      const xp = rateFor(data.myDays + 1);
      await api.contributeGlobal(xp);
      const fresh = await api.getGlobalHabit();
      setData(fresh);
      if (whiteUnlocked(fresh.total, fresh.mine) && localStorage.getItem(DUB_WHITE_KEY) !== '1') {
        localStorage.setItem(DUB_WHITE_KEY, '1');
        setJustEarned(true);
      }
      window.dispatchEvent(new CustomEvent('superdub:tracker-updated'));
    } catch (e: any) {
      setError(e?.message ?? 'Could not log. Tap to retry.');
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  const d = data;
  const pct = d ? Math.max(0, Math.min(100, Math.round((d.total / Math.max(1, d.goal)) * 100))) : 0;
  const level = d ? habitLevelFromDays(d.myDays) : 1;
  const curTier = HABIT_LEVEL_TIERS[level - 1];
  const nextTier = level < MAX_HABIT_LEVEL ? HABIT_LEVEL_TIERS[level] : null;
  const lvlPct = d
    ? (nextTier ? Math.max(4, Math.min(100, Math.round(((d.myDays - curTier) / (nextTier - curTier)) * 100))) : 100)
    : 0;

  return (
    <div className="checkin-overlay" onClick={() => setShow(false)}>
      <div className="checkin-modal gp-modal" onClick={e => e.stopPropagation()}>
        <div className="gp-head">
          <span className="gp-planet-wrap"><GlobalPlanet size={40} /></span>
          <div>
            <span className="global-habit-eyebrow">THE GLOBAL HABIT · TOGETHER</span>
            <h2 className="gp-title">{d?.habit ?? 'Do a good deed today'}</h2>
          </div>
        </div>

        {d && (
          <>
            {/* Your personal progress on this habit */}
            <div className="gp-section">
              <div className="gp-row">
                <span className="gp-lvl">Level {level}</span>
                <span className="gp-rate">+{rateFor(d.myDays + 1)} XP · {d.myDays} {d.myDays === 1 ? 'day' : 'days'}</span>
              </div>
              <div className="global-habit-bar"><span className="global-habit-fill" style={{ width: `${lvlPct}%` }} /></div>
            </div>

            {/* The shared community climb */}
            <div className="gp-section">
              <div className="global-habit-head">
                <span className="global-habit-eyebrow">COMMUNITY · {d.goal.toLocaleString()} XP GOAL</span>
                <span className="global-habit-contributors">{d.contributors.toLocaleString()} climbing</span>
              </div>
              <div className="global-habit-bar"><span className="global-habit-fill" style={{ width: `${Math.max(2, pct)}%` }} /></div>
              <div className="global-habit-stats">
                <span className="global-habit-total">{d.total.toLocaleString()}<span> / {d.goal.toLocaleString()} XP</span></span>
                <span className="global-habit-pct">{pct}%</span>
              </div>
              {d.mine > 0 && <p className="global-habit-mine">You've added {d.mine.toLocaleString()} XP this month.</p>}
            </div>

            {justEarned && (
              <p className="gp-earned">New colour unlocked: Aurora White. Equip it on your Level page.</p>
            )}

            <div className="checkin-actions">
              {d.doneToday ? (
                <div className="checkin-done">✓ Good deed logged today</div>
              ) : (
                <>
                  {error && <p className="checkin-error">{error}</p>}
                  <button className="checkin-save-btn gp-save" onClick={logDeed} disabled={saving}>
                    {saving ? 'Logging…' : error ? 'Retry' : 'I did a good deed'}
                  </button>
                </>
              )}
              <button className="checkin-skip-btn" onClick={() => setShow(false)}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GlobalPrompt;
