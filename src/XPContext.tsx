import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, isLoggedIn } from './api';
import { computePlayerLevel, type PlayerLevel } from './levels';

export type { PlayerLevel } from './levels';

const INSTALL_XP = 100;
const INSTALL_XP_KEY = 'superdub.installXP';
const XP_CACHE_KEY = 'superdub.xp.cache';

const XP_GATES: [number, number][] = [
  [0, 10], [7, 15], [14, 20], [30, 25], [60, 30], [100, 35], [200, 40], [365, 50],
];

function computeXPFromRaw(
  habits: { name: string }[],
  trackerHabits: { day: string; habit_name: string; state: string }[],
  installBonus: boolean,
): number {
  const habitNames = habits.map(h => h.name);
  // Build day→habit→state map
  const byDay: Record<string, Record<string, boolean | 'failed'>> = {};
  for (const row of trackerHabits) {
    if (!byDay[row.day]) byDay[row.day] = {};
    byDay[row.day][row.habit_name] = row.state === 'done' ? true : row.state === 'failed' ? 'failed' : false;
  }
  const sortedDays = Object.keys(byDay).sort((a, b) => {
    const [ad, am] = a.split('/').map(Number);
    const [bd, bm] = b.split('/').map(Number);
    return am !== bm ? am - bm : ad - bd;
  });

  let xp = 0;
  const streakMap: Record<string, number> = {};
  for (const day of sortedDays) {
    const d = byDay[day];
    for (const h of habitNames) {
      if (d[h] === true) {
        streakMap[h] = (streakMap[h] ?? 0) + 1;
        const streak = streakMap[h];
        const gateIdx = XP_GATES.filter(([t]) => t > 0 && streak >= t).length;
        xp += XP_GATES[Math.min(gateIdx, XP_GATES.length - 1)][1];
      } else if (d[h] === 'failed') {
        streakMap[h] = 0;
      }
    }
  }
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
