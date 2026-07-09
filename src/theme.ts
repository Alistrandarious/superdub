// =====================================================================
// SUPERDUB — semantic accent palette (single source of truth)
// From "Superdub Swatches.pdf" (V2 — The Ascension). Colour carries
// meaning: green = health, blue = growth, gold = ascension/XP,
// violet = rare rank, flame = streak/energy, danger = over target.
// Every page root MUST take its --theme from here — no ad-hoc hexes.
// =====================================================================
import type React from 'react';

export const HEALTH = '#2FD27E';        // primary green, habits, food, the body
export const HEALTH_DEEP = '#1FB463';
export const HEALTH_BRIGHT = '#3CF08E';
export const TEAL = '#19C5B0';          // bridge, mood/check-in surfaces
export const GROWTH = '#2E8BFF';        // blue, trends, plans, progress, profile
export const GROWTH_BRIGHT = '#46C2FF'; // tint, reference/data pages
export const GOLD = '#FFB928';          // ascension, XP, levels, rewards ONLY
export const GOLD_TINT = '#FFD233';
export const VIOLET = '#8B5CF6';        // rare rank accent, goals, milestones
export const FLAME = '#FF8A00';         // streak / energy
export const DANGER = '#FF5470';        // over target / off pace

/** Standard page-root theme vars. glowAlpha is the hex alpha for --theme-glow. */
export function pageTheme(c: string, glowAlpha: string = '14'): React.CSSProperties {
  return { '--theme': c, '--theme-dim': c + '66', '--theme-glow': c + glowAlpha } as React.CSSProperties;
}
