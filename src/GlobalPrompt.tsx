import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { api } from './api';
import GlobalPlanet from './GlobalPlanet';
import PromptShell from './PromptShell';
import { GOLD } from './theme';
import { habitLevelFromDays, HABIT_LEVEL_RATES, whiteUnlocked, DUB_WHITE_KEY } from './levels';

// Community progress ring geometry (the gold arc around the globe).
const RING_R = 80;
const RING_C = 2 * Math.PI * RING_R;

// The Global habit overlay — opened by tapping the spinning planet by the level
// ring (dispatches `superdub:show-global`). One shared, ascension-gold habit that
// each user levels personally (day-count → level → XP-per-deed, the same ladder as
// every other habit) while all that XP feeds ONE monthly community total. Hitting
// 10k as a community, with ≥100 XP of your own, latches the Aurora White ring.

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

  // Tap the deed circle to log it, tap again to un-log — same fill/unfill toggle as
  // every other habit's completion circle.
  const toggleDeed = async () => {
    if (!data || saving) return;
    setSaving(true); setError(null);
    try {
      if (data.doneToday) {
        await api.uncontributeGlobal();
      } else {
        // Same completion haptic as every other habit (Habits handleToggleDay).
        if ('vibrate' in navigator) navigator.vibrate([0, 45, 40, 55]);
        // Today's deed is the (myDays+1)th completion — pay that level's rate, matching
        // habitXPForDoneDays. Idempotent per day, so this can't double-count.
        await api.contributeGlobal(rateFor(data.myDays + 1));
      }
      const fresh = await api.getGlobalHabit();
      setData(fresh);
      if (whiteUnlocked(fresh.total, fresh.mine) && localStorage.getItem(DUB_WHITE_KEY) !== '1') {
        localStorage.setItem(DUB_WHITE_KEY, '1');
        setJustEarned(true);
      }
      window.dispatchEvent(new CustomEvent('superdub:tracker-updated'));
    } catch (e: any) {
      setError(e?.message ?? 'Could not save. Tap to retry.');
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  const d = data;
  const pct = d ? Math.max(0, Math.min(100, Math.round((d.total / Math.max(1, d.goal)) * 100))) : 0;
  const level = d ? habitLevelFromDays(d.myDays) : 1;
  const ringOffset = RING_C * (1 - pct / 100);
  const close = () => setShow(false);

  return (
    <PromptShell
      accent={GOLD}
      eyebrow="Global · Today"
      title="Do a good deed today."
      subtitle="One good deed counts for everyone."
      closeOnBackdrop
      onDismiss={close}
    >
      {d && (
        <>
          {/* The gold ring fills as we all climb toward the monthly goal, with the
              spinning planet centred inside it (one hero graphic). */}
          <div className="gp-hero" style={{ position: 'relative' }}>
            <svg className="gp-ring" viewBox="0 0 180 180" width="180" height="180" aria-hidden="true">
              <defs>
                <linearGradient id="gp-ring-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FFB928" />
                  <stop offset="100%" stopColor="#FFE08A" />
                </linearGradient>
              </defs>
              <circle cx="90" cy="90" r={RING_R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <circle
                className="gp-ring-arc"
                cx="90" cy="90" r={RING_R} fill="none"
                stroke="url(#gp-ring-grad)" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={RING_C} strokeDashoffset={ringOffset}
                transform="rotate(-90 90 90)"
              />
            </svg>
            <div
              className="gp-hero-planet"
              style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}
              aria-hidden="true"
            >
              <GlobalPlanet size={116} />
            </div>
          </div>

          {/* The shared climb, front and centre. */}
          <div className="gp-climb">
            <span className="gp-climb-total">{d.total.toLocaleString()}<em> / {d.goal.toLocaleString()} XP</em></span>
            <span className="gp-climb-sub">{d.contributors.toLocaleString()} climbing · {pct}% there</span>
          </div>

          {/* Your quiet, personal line under the collective one. */}
          <div className="gp-you">
            <span className="gp-you-chip">LV {level}</span>
            <span className="gp-you-text">
              {d.mine > 0 ? `You've added ${d.mine.toLocaleString()} XP this month` : 'Log your first deed to join the climb'}
            </span>
          </div>

          {justEarned && (
            <p className="gp-earned">Aurora White unlocked. Equip the ring on your Profile.</p>
          )}

          {error && <p className="checkin-error">{error}</p>}
          {/* Habit-style toggle circle: tap fills (deed done), tap again clears it. */}
          <button
            type="button"
            className={`checkin-habit gp-deed ${d.doneToday ? 'done' : ''}`}
            onClick={toggleDeed}
            disabled={saving}
            aria-pressed={d.doneToday}
          >
            <span className="checkin-tick">{d.doneToday ? '✓' : '+'}</span>
            <span className="checkin-habit-name">
              {saving ? 'Saving…' : d.doneToday ? 'Good deed done today' : 'I did a good deed'}
            </span>
          </button>
        </>
      )}
    </PromptShell>
  );
};

export default GlobalPrompt;
