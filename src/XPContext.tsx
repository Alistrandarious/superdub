import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, isLoggedIn } from './api';
import { computePlayerLevel, habitXPForDoneDays, type PlayerLevel } from './levels';

export type { PlayerLevel } from './levels';

const INSTALL_XP = 100;
const INSTALL_XP_KEY = 'superdub.installXP';
const XP_CACHE_KEY = 'superdub.xp.cache';

function computeXPFromRaw(
  trackerHabits: { day: string; habit_name: string; state: string }[],
  installBonus: boolean,
  xpCarry: Record<string, number> = {},
): number {
  // Lifetime XP is per-habit and level-based: each habit's XP depends only on its
  // TOTAL completed-day count (paid at the level rate). We sum EVERY habit that has
  // history — active, archived, or since deleted (its tracker history is kept) — so
  // archiving or deleting a habit never drops XP. xpCarry seeds prior-year done
  // counts (lifetime XP survives Jan 1); trackerHabits adds this year's dones.
  const doneCount: Record<string, number> = { ...xpCarry };
  for (const row of trackerHabits) {
    if (row.state === 'done') {
      doneCount[row.habit_name] = (doneCount[row.habit_name] ?? 0) + 1;
    }
  }
  return Object.keys(doneCount).reduce((sum, name) => sum + habitXPForDoneDays(doneCount[name] ?? 0), 0)
    + (installBonus ? INSTALL_XP : 0);
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
      // XP is lifetime, computed from all tracker history — no need to know which
      // habits are currently active/archived.
      const trackerData = await api.getTracker();
      const xp = computeXPFromRaw(trackerData.habits ?? [], installBonus, trackerData.xpCarry ?? {});
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
