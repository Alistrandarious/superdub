import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, isLoggedIn } from './api';
import { computePlayerLevel, habitXPForDoneDays, type PlayerLevel } from './levels';

export type { PlayerLevel } from './levels';

const INSTALL_XP = 100;
const INSTALL_XP_KEY = 'superdub.installXP';
const XP_CACHE_KEY = 'superdub.xp.cache';

function computeXPFromRaw(
  habits: { name: string }[],
  trackerHabits: { day: string; habit_name: string; state: string }[],
  installBonus: boolean,
): number {
  const habitNames = habits.map(h => h.name);
  const known = new Set(habitNames);
  // XP is per-habit and level-based: it only depends on each habit's TOTAL
  // completed-day count (paid at the level rate). Count dones per habit, then
  // sum each habit's level-based XP — this matches the habit cards exactly.
  const doneCount: Record<string, number> = {};
  for (const row of trackerHabits) {
    if (row.state === 'done' && known.has(row.habit_name)) {
      doneCount[row.habit_name] = (doneCount[row.habit_name] ?? 0) + 1;
    }
  }
  const xp = habitNames.reduce((sum, name) => sum + habitXPForDoneDays(doneCount[name] ?? 0), 0);
  return xp + (installBonus ? INSTALL_XP : 0);
}

interface XPContextValue {
  totalXP: number;
  playerLevel: PlayerLevel;
  refresh: () => void;
}

const XPContext = createContext<XPContextValue>({
  totalXP: 0,
  playerLevel: computePlayerLevel(0),
  refresh: () => {},
});

export function XPProvider({ children }: { children: React.ReactNode }) {
  const installBonus = localStorage.getItem(INSTALL_XP_KEY) === 'granted';
  // Seed from cache so the level ring never flashes to 0 between navigations
  const [totalXP, setTotalXP] = useState<number>(() =>
    parseInt(localStorage.getItem(XP_CACHE_KEY) || '0', 10)
  );

  const load = useCallback(async () => {
    if (!isLoggedIn()) return;
    try {
      const [habitsData, trackerData] = await Promise.all([
        api.getHabits(),
        api.getTracker(),
      ]);
      const xp = computeXPFromRaw(habitsData, trackerData.habits ?? [], installBonus);
      setTotalXP(xp);
      localStorage.setItem(XP_CACHE_KEY, String(xp));
    } catch {
      // non-fatal — cached value stays displayed
    }
  }, [installBonus]);

  useEffect(() => { load(); }, [load]);

  // Re-load when tracker data changes (habit toggles, step syncs, etc.)
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('superdub:tracker-updated', handler);
    return () => window.removeEventListener('superdub:tracker-updated', handler);
  }, [load]);

  const playerLevel = computePlayerLevel(totalXP);

  return (
    <XPContext.Provider value={{ totalXP, playerLevel, refresh: load }}>
      {children}
    </XPContext.Provider>
  );
}

export function useXP(): XPContextValue {
  return useContext(XPContext);
}
