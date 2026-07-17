// =====================================================================
// SUPERDUB — user stage (new · regular · super)
// One place that folds the three signals we already track — tenure, mastery,
// engagement — into a single stage, so surfaces can adapt (teach the newcomer,
// stay out of the veteran's way). Pure math; the React hook lives at the bottom.
// Thresholds are centralized here on purpose: tuning them is a one-line change.
// =====================================================================
import { useEffect, useState } from 'react';
import { hasGoldWordmark, computePlayerLevel } from './levels';
import { useXP } from './XPContext';

export type UserStage = 'new' | 'regular' | 'super';

export interface StageSignals {
  daysSinceJoin: number;   // whole days since accountCreatedAt (>=0)
  playerLevel: number;     // useXP().playerLevel.level (1-based)
  dayStreak: number;       // the login-streak flame (superdub.dayStreak)
}

// Blend rule — see plan. "super" needs proven mastery AND a still-live streak,
// so a dormant veteran (high level, cold streak) is regular, not super.
export function computeStage({ daysSinceJoin, playerLevel, dayStreak }: StageSignals): UserStage {
  if (daysSinceJoin < 7 || playerLevel <= 2) return 'new';
  if (hasGoldWordmark(playerLevel) && dayStreak >= 21) return 'super';
  return 'regular';
}

// ── Signal readers (localStorage-backed, so any surface can read without a fetch)
const CREATED_KEY = 'superdub.accountCreatedAt'; // cached by App.tsx on profile load
const STREAK_KEY = 'superdub.dayStreak';         // written by Habits.tsx
const XP_CACHE_KEY = 'superdub.xp.cache';        // kept fresh by XPProvider

// Missing/created-in-the-future → 0 days (treated as brand new).
export function daysSinceJoinFromStorage(now: number = Date.now()): number {
  const iso = localStorage.getItem(CREATED_KEY);
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / 86400000));
}

function readStreak(): number {
  return parseInt(localStorage.getItem(STREAK_KEY) || '0', 10) || 0;
}

// Synchronous stage read from localStorage — for non-component callers (e.g. the
// brief composers, built inside async effects where the hook can't run). Level
// comes from the XP cache, which XPProvider keeps fresh.
export function readStage(now: number = Date.now()): UserStage {
  const totalXP = parseInt(localStorage.getItem(XP_CACHE_KEY) || '0', 10) || 0;
  return computeStage({
    daysSinceJoin: daysSinceJoinFromStorage(now),
    playerLevel: computePlayerLevel(totalXP).level,
    dayStreak: readStreak(),
  });
}

// Thin hook: level from the XP context, streak + tenure from localStorage.
// Re-derives when the streak updates (same events StreakFlame listens to).
export function useUserStage(): UserStage {
  const { playerLevel } = useXP();
  const [dayStreak, setDayStreak] = useState(readStreak);

  useEffect(() => {
    const sync = () => setDayStreak(readStreak());
    window.addEventListener('superdub:streak-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('superdub:streak-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return computeStage({
    daysSinceJoin: daysSinceJoinFromStorage(),
    playerLevel: playerLevel.level,
    dayStreak,
  });
}
