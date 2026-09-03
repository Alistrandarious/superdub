import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, isLoggedIn } from './api';
import { computePlayerLevel, habitXPForDoneDays, cadenceXpMultiplier, type PlayerLevel } from './levels';

export type { PlayerLevel } from './levels';

const INSTALL_XP = 100;
const INSTALL_XP_KEY = 'superdub.installXP';
const XP_CACHE_KEY = 'superdub.xp.cache';

function computeXPFromRaw(
  trackerHabits: { day: string; habit_name: string; state: string }[],
  installBonus: boolean,
  xpCarry: Record<string, number> = {},
  cadenceOf: Record<string, string> = {},
): number {
  // Lifetime XP is per-habit and level-based: each habit's XP depends only on its
  // TOTAL completed-day count (paid at the level rate), scaled by its cadence
  // (weekly/monthly/yearly are worth more). We sum EVERY habit that has history —
  // active, archived, or since deleted (its tracker history is kept) — so archiving
  // or deleting never drops XP. xpCarry seeds prior-year done counts (lifetime XP
  // survives Jan 1); trackerHabits adds this year's dones.
  // ponytail: archived habits aren't in cadenceOf (from active getHabits), so they
  // fall back to the daily x1 multiplier — a small under-count on old non-daily habits.
  const doneCount: Record<string, number> = { ...xpCarry };
  for (const row of trackerHabits) {
    if (row.state === 'done') {
      doneCount[row.habit_name] = (doneCount[row.habit_name] ?? 0) + 1;
    }
  }
  return Object.keys(doneCount).reduce(
    (sum, name) => sum + habitXPForDoneDays(doneCount[name] ?? 0, cadenceXpMultiplier(cadenceOf[name])), 0,
  ) + (installBonus ? INSTALL_XP : 0);
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
      // XP is lifetime, from all tracker history. Also pull the habit list to map
      // each habit to its cadence (for the weekly/monthly/yearly XP multiplier).
      const [trackerData, habitList] = await Promise.all([api.getTracker(), api.getHabits().catch(() => [])]);
      const cadenceOf: Record<string, string> = {};
      for (const h of (habitList as any[])) cadenceOf[h.name] = h.cadence ?? 'daily';
      const xp = computeXPFromRaw(trackerData.habits ?? [], installBonus, trackerData.xpCarry ?? {}, cadenceOf);
      setTotalXP(xp);
      localStorage.setItem(XP_CACHE_KEY, String(xp));
    } catch {
      // non-fatal — cached value stays displayed
    }
  }, [installBonus]);

  useEffect(() => { load(); }, [load]);

  // Re-load when tracker data changes (habit toggles, step syncs, etc.), and when
  // held-back writes finally land — a tick that was queued offline earns its XP on
  // the flush, not on the tap. 'outbox-flushed' is separate from 'tracker-updated'
  // on purpose: the latter also re-opens the daily check-in overlay, which must not
  // pop out of a background sync.
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('superdub:tracker-updated', handler);
    window.addEventListener('superdub:outbox-flushed', handler);
    return () => {
      window.removeEventListener('superdub:tracker-updated', handler);
      window.removeEventListener('superdub:outbox-flushed', handler);
    };
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
