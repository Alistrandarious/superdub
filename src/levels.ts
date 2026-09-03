// =====================================================================
// SUPERDUB — Player level system (single source of truth)
// The global player level is driven by total XP. Each level grants a
// concrete, named REWARD — that payoff is what makes levelling meaningful.
// Rewards are mostly cosmetic unlocks (level-ring themes) that the user can
// actually equip, plus journey milestones.
// =====================================================================

// ── Per-habit progression (separate from the global player level) ────────────
// A habit's level is driven by TOTAL days logged (persistent — never resets on a
// miss). Each level pays a higher XP-per-completion rate. These helpers are the
// single source used by the habit cards, the Level-page breakdown AND the global
// XP sum, so all three always agree.
export const HABIT_LEVEL_TIERS = [0, 7, 14, 30, 60, 100, 200, 365]; // total days for each level
export const HABIT_LEVEL_RATES = [10, 15, 20, 25, 30, 35, 40, 50];  // XP per completion at each level
export const MAX_HABIT_LEVEL = HABIT_LEVEL_TIERS.length;

// Non-daily habits are harder to keep, so each completion is worth more XP.
export const CADENCE_XP_MULT: Record<string, number> = { daily: 1, quit: 1, weekly: 2, monthly: 4, yearly: 8 };
export const cadenceXpMultiplier = (cadence?: string): number => CADENCE_XP_MULT[cadence ?? 'daily'] ?? 1;

export const habitLevelFromDays = (days: number) =>
  HABIT_LEVEL_TIERS.filter(t => days >= t).length; // 1..8

// Total XP a habit has earned given how many days it's been completed. XP only
// depends on the COUNT of completions (each paid at the rate of the level you'd
// reached), so it's order-independent. `mult` scales it by cadence.
export function habitXPForDoneDays(totalDoneDays: number, mult = 1): number {
  let xp = 0;
  for (let n = 1; n <= totalDoneDays; n++) {
    const lvl = habitLevelFromDays(n);
    xp += HABIT_LEVEL_RATES[Math.min(lvl - 1, HABIT_LEVEL_RATES.length - 1)];
  }
  return Math.round(xp * mult);
}

export type RewardKind = 'theme' | 'milestone' | 'flair';

export interface LevelReward {
  icon: string;
  label: string;
  kind: RewardKind;
  themeId?: string;   // for kind 'theme', the ring theme this level unlocks
  flairId?: string;   // for kind 'flair', a cosmetic flag (e.g. gold wordmark)
  blurb: string;      // one-line description of the reward
}

export interface PlayerLevelDef {
  xp: number;
  title: string;
  reward: LevelReward;
}

// ── Unlock conditions — one model for every cosmetic ────────────────────────
// A cosmetic unlocks by reaching a level, hitting a day-streak, or being an
// early adopter (joined before launch). No condition = always available.
export interface Unlock { level?: number; streak?: number; special?: 'earlyAdopter' | 'globalWhite'; }
export interface UnlockCtx { level: number; streak: number; earlyAdopter: boolean; globalWhite: boolean; }
export const EARLY_ADOPTER_BEFORE = '2026-08-01';

export function isUnlocked(u: Unlock | undefined, ctx: UnlockCtx): boolean {
  if (!u) return true;
  if (u.special === 'earlyAdopter') return ctx.earlyAdopter;
  if (u.special === 'globalWhite') return ctx.globalWhite;
  if (u.streak != null && ctx.streak < u.streak) return false;
  if (u.level != null && ctx.level < u.level) return false;
  return true;
}
export function unlockLabel(u: Unlock | undefined): string {
  if (!u) return '';
  if (u.special === 'earlyAdopter') return 'Early adopter';
  if (u.special === 'globalWhite') return 'Community 10k';
  if (u.streak != null) return `${u.streak}-day streak`;
  if (u.level != null) return `LV${u.level}`;
  return '';
}

// ── The Global habit reward: the Aurora White ring ──────────────────────────
// Earned when the shared monthly total hits 10k AND this user has personally
// added ≥100 XP (participants only). A localStorage flag latches it so it stays
// earned; the ring shelf then shows it as pickable (never auto-equipped).
// The reward used to be a Dub colour, but the Dub colour picker went away when
// Dub was retired from the main app (v2.447), leaving nowhere to equip it.
export const DUB_WHITE_KEY = 'superdub.dub.white';
export const whiteUnlocked = (total: number, mine: number) => total >= 10000 && mine >= 100;
export const globalWhiteEarned = () =>
  typeof localStorage !== 'undefined' && localStorage.getItem(DUB_WHITE_KEY) === '1';

// ── Ring themes — the equippable cosmetic reward ────────────────────────────
export interface RingTheme {
  id: string;
  name: string;
  from: string;       // gradient start
  to: string;         // gradient end
  glow: string;       // glow colour
  unlock?: Unlock;    // how it's earned (undefined = default, always on)
  animated?: boolean; // animated shimmer on the arc
  fill?: 'liquid';    // liquid themes render a water fill inside the ring
                      // (rises with XP, reacts to tilt); default is the arc
}

export const RING_THEMES: RingTheme[] = [
  { id: 'slate',   name: 'Slate',       from: '#9AA0AE', to: '#5B606E', glow: 'rgba(150,158,176,0.28)' },
  { id: 'gold',    name: 'Gold',        from: '#FFE15A', to: '#FFC42E', glow: 'rgba(255,196,46,0.35)',  unlock: { streak: 7 } },
  { id: 'freer',   name: 'Freer',       from: '#2FE0C4', to: '#FF6FB5', glow: 'rgba(120,220,210,0.45)', unlock: { special: 'earlyAdopter' }, animated: true, fill: 'liquid' },
  { id: 'ocean',   name: 'Ocean',       from: '#5AD1FF', to: '#2E8BFF', glow: 'rgba(46,139,255,0.35)',  unlock: { level: 2 } },
  { id: 'coral',   name: 'Coral',       from: '#FF9A6C', to: '#FF5470', glow: 'rgba(255,84,112,0.35)',  unlock: { level: 3 } },
  { id: 'sunset',  name: 'Sunset',      from: '#FFB347', to: '#FF5E8A', glow: 'rgba(255,94,138,0.35)',  unlock: { level: 4 } },
  { id: 'liquid',  name: 'Liquid',      from: '#5AD1FF', to: '#1565D8', glow: 'rgba(90,169,255,0.42)',  unlock: { level: 5 },  animated: true, fill: 'liquid' },
  { id: 'forest',  name: 'Forest',      from: '#52EFA0', to: '#1FA971', glow: 'rgba(47,210,126,0.35)',  unlock: { level: 6 } },
  { id: 'lava',    name: 'Lava Lamp',   from: '#FF9A3D', to: '#D81E5B', glow: 'rgba(255,110,60,0.42)',  unlock: { level: 7 },  animated: true, fill: 'liquid' },
  { id: 'aurora',  name: 'Aurora',      from: '#7CF8C0', to: '#A855F7', glow: 'rgba(168,85,247,0.35)',  unlock: { level: 8 } },
  { id: 'mono',    name: 'Platinum',    from: '#F4F4FA', to: '#A9A9C2', glow: 'rgba(220,220,235,0.35)', unlock: { level: 9 } },
  { id: 'galaxy',  name: 'Galaxy',      from: '#6C8BFF', to: '#A855F7', glow: 'rgba(124,108,255,0.4)',  unlock: { level: 10 }, animated: true, fill: 'liquid' },
  { id: 'inferno', name: 'Inferno',     from: '#FFD23F', to: '#FF3D3D', glow: 'rgba(255,61,61,0.4)',    unlock: { level: 12 }, animated: true, fill: 'liquid' },
  { id: 'eclipse', name: 'Eclipse',     from: '#B79CFF', to: '#3A2E6E', glow: 'rgba(183,156,255,0.35)', unlock: { level: 14 } },
  { id: 'prism',   name: 'Prism',       from: '#FF5E8A', to: '#2E8BFF', glow: 'rgba(255,255,255,0.4)',  unlock: { level: 15 }, animated: true, fill: 'liquid' },
  // The community reward — earned as a world, not by levelling. Gold glow so it
  // reads as the Global tab's own colour rather than another level prize.
  { id: 'aurorawhite', name: 'Aurora White', from: '#FFFFFF', to: '#E6ECF5', glow: 'rgba(255,185,40,0.40)', unlock: { special: 'globalWhite' } },
];

export const DEFAULT_THEME_ID = 'slate';
export const SELECTED_THEME_KEY = 'superdub.ringTheme';

export function getRingTheme(id: string | null | undefined): RingTheme {
  return RING_THEMES.find(t => t.id === id) ?? RING_THEMES[0];
}
// The equipped theme is whatever the user picked (the picker only lets them pick
// unlocked ones), falling back to the default.
export function getSelectedThemeId(): string {
  return (typeof localStorage !== 'undefined' && localStorage.getItem(SELECTED_THEME_KEY)) || DEFAULT_THEME_ID;
}

// Migration: v2.299 briefly made liquid a global fill toggle
// (superdub.ringFill). Fill is a per-theme property again — if the toggle was
// on, equip the Liquid theme so the look carries over, then drop the key.
try {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('superdub.ringFill') === 'liquid') {
    localStorage.setItem(SELECTED_THEME_KEY, 'liquid');
    localStorage.removeItem('superdub.ringFill');
  }
} catch { /* storage unavailable */ }

// ── Dub colours — recolour the mascot ───────────────────────────────────────
// A free personalisation picked during onboarding, NOT a reward: the unlock
// gates came off when the Dub colour picker was retired with Dub (v2.447), so
// nothing was left to equip a locked colour with. The community prize moved to
// the Aurora White ring theme above.
export interface DubColor { id: string; name: string; bodyFrom: string; bodyTo: string; accent: string; }
export const DUB_COLORS: DubColor[] = [
  { id: 'steel',  name: 'Steel',   bodyFrom: '#9AA3BA', bodyTo: '#5A6276', accent: '#2FD27E' },
  { id: 'mint',   name: 'Mint',    bodyFrom: '#7EE6B8', bodyTo: '#2FB07E', accent: '#2FD27E' },
  { id: 'sky',    name: 'Sky',     bodyFrom: '#86C8FF', bodyTo: '#3E84D6', accent: '#5AD1FF' },
  { id: 'rose',   name: 'Rose',    bodyFrom: '#FFA6C4', bodyTo: '#E0668F', accent: '#FF7E9B' },
  { id: 'gold',   name: 'Golden',  bodyFrom: '#FFE08A', bodyTo: '#E0A22E', accent: '#FFC42E' },
  { id: 'violet', name: 'Violet',  bodyFrom: '#C3A6FF', bodyTo: '#7E54C8', accent: '#B79CFF' },
  { id: 'shadow', name: 'Shadow',  bodyFrom: '#454B5E', bodyTo: '#22262F', accent: '#6C8BFF' },
];
export const DUB_COLOR_KEY = 'superdub.dubColor';
export function getDubColor(): DubColor {
  const id = (typeof localStorage !== 'undefined' && localStorage.getItem(DUB_COLOR_KEY)) || 'steel';
  return DUB_COLORS.find(c => c.id === id) ?? DUB_COLORS[0];
}

// ── Habit-button + menu-glow colours (unlock-gated swatches) ─────────────────
export interface AccentColor { id: string; name: string; color: string; unlock?: Unlock; }
export const HABIT_COLORS: AccentColor[] = [
  { id: 'amber',  name: 'Amber',  color: '#FFB300' },
  { id: 'green',  name: 'Green',  color: '#2FD27E', unlock: { level: 2 } },
  { id: 'blue',   name: 'Blue',   color: '#2E8BFF', unlock: { level: 3 } },
  { id: 'pink',   name: 'Pink',   color: '#FF5E8A', unlock: { level: 5 } },
  { id: 'violet', name: 'Violet', color: '#A855F7', unlock: { level: 7 } },
  { id: 'gold',   name: 'Gold',   color: '#FFC42E', unlock: { streak: 7 } },
  { id: 'freer',  name: 'Freer',  color: '#2FE0C4', unlock: { special: 'earlyAdopter' } },
];
export const GLOW_COLORS: AccentColor[] = [
  { id: 'green',  name: 'Green',  color: '#2FD27E' },
  { id: 'blue',   name: 'Blue',   color: '#2E8BFF', unlock: { level: 2 } },
  { id: 'amber',  name: 'Amber',  color: '#FFB300', unlock: { level: 4 } },
  { id: 'pink',   name: 'Pink',   color: '#FF5E8A', unlock: { level: 6 } },
  { id: 'violet', name: 'Violet', color: '#A855F7', unlock: { level: 9 } },
  { id: 'gold',   name: 'Gold',   color: '#FFC42E', unlock: { streak: 7 } },
  { id: 'freer',  name: 'Freer',  color: '#FF6FB5', unlock: { special: 'earlyAdopter' } },
];
export const HABITS_COLOR_KEY = 'superdub.habitsColor';
export const NAV_GLOW_KEY = 'superdub.navGlow';

// ── App backgrounds — unlockable, level-gated ───────────────────────────────
// Kept dark so text stays readable; `grad` is the base layer the .app paints
// under its per-page glow. `swatch` is what the picker shows.
export interface Background { id: string; name: string; grad: string; swatch: string; unlock?: Unlock; }
export const BACKGROUNDS: Background[] = [
  { id: 'midnight', name: 'Midnight', grad: 'linear-gradient(160deg, #07090C 0%, #0A0B10 100%)', swatch: '#07090C' },
  // Two colourful backgrounds free out of the gate, so there's colour beyond grey/black from day one.
  { id: 'plum',     name: 'Plum',     grad: 'linear-gradient(160deg, #1A0E1E 0%, #2A1330 100%)', swatch: '#2A1330' },
  { id: 'teal',     name: 'Teal',     grad: 'linear-gradient(160deg, #071518 0%, #0C2429 100%)', swatch: '#0C2429' },
  { id: 'dusk',     name: 'Dusk',     grad: 'linear-gradient(160deg, #0E0B16 0%, #16101F 100%)', swatch: '#16101F', unlock: { level: 3 } },
  { id: 'ocean',    name: 'Deep Ocean', grad: 'linear-gradient(160deg, #080F18 0%, #0C1826 100%)', swatch: '#0C1826', unlock: { level: 5 } },
  { id: 'forest',   name: 'Forest',   grad: 'linear-gradient(160deg, #08130D 0%, #0C1B13 100%)', swatch: '#0C1B13', unlock: { level: 7 } },
  { id: 'ember',    name: 'Ember',    grad: 'linear-gradient(160deg, #150B0B 0%, #1C0F0E 100%)', swatch: '#1C0F0E', unlock: { level: 10 } },
  { id: 'aurora',   name: 'Aurora',   grad: 'linear-gradient(160deg, #0A1018 0%, #140A1C 100%)', swatch: '#140A1C', unlock: { level: 13 } },
  // Richer colour gates — earned as you climb.
  { id: 'rose',     name: 'Rose',     grad: 'linear-gradient(160deg, #1C0A10 0%, #2E0F1C 100%)', swatch: '#2E0F1C', unlock: { level: 15 } },
  { id: 'sunrise',  name: 'Sunrise',  grad: 'linear-gradient(160deg, #1A0E08 0%, #2A1710 100%)', swatch: '#2A1710', unlock: { level: 18 } },
  { id: 'nebula',   name: 'Nebula',   grad: 'linear-gradient(160deg, #0B0A1E 0%, #1C1030 60%, #2A1330 100%)', swatch: '#1C1030', unlock: { level: 20 } },
  { id: 'freer',    name: 'Freer',    grad: 'linear-gradient(160deg, #07130F 0%, #160E18 100%)', swatch: '#0E1A1B', unlock: { special: 'earlyAdopter' } },
];
export const BACKGROUND_KEY = 'superdub.background';
export function getBackground(): Background {
  const id = (typeof localStorage !== 'undefined' && localStorage.getItem(BACKGROUND_KEY)) || 'midnight';
  return BACKGROUNDS.find(b => b.id === id) ?? BACKGROUNDS[0];
}

// ── Light / dark theme — a top-level axis, applied as [data-theme] on <html>. ──
export type ThemeMode = 'dark' | 'light';
export const THEME_KEY = 'superdub.theme';
export function getTheme(): ThemeMode {
  return (typeof localStorage !== 'undefined' && localStorage.getItem(THEME_KEY)) === 'light' ? 'light' : 'dark';
}

// ── The level ladder — meaningful titles + a reward each ─────────────────────
// 15 levels, themed around the journey of building habits (not generic RPG ranks).
export const PLAYER_LEVELS: PlayerLevelDef[] = [
  { xp: 0,      title: 'First Day',     reward: { icon: '🌱', kind: 'milestone', label: 'The journey begins', blurb: 'You showed up. That’s the hardest part.' } },
  { xp: 100,    title: 'Getting Going', reward: { icon: '🌊', kind: 'theme', themeId: 'ocean', label: 'Ocean ring theme', blurb: 'Unlocks the Ocean level-ring theme.' } },
  { xp: 300,    title: 'Finding Rhythm',reward: { icon: '🪸', kind: 'theme', themeId: 'coral', label: 'Coral ring theme', blurb: 'Unlocks the Coral level-ring theme.' } },
  { xp: 700,    title: 'In the Groove', reward: { icon: '🌅', kind: 'theme', themeId: 'sunset', label: 'Sunset ring theme', blurb: 'Unlocks the Sunset level-ring theme.' } },
  { xp: 1500,   title: 'Consistent',    reward: { icon: '💧', kind: 'theme', themeId: 'liquid', label: 'Liquid ring (water fill)', blurb: 'Your first liquid ring, the water rises with your XP and sloshes when you tilt your phone.' } },
  { xp: 3000,   title: 'Committed',     reward: { icon: '🌲', kind: 'theme', themeId: 'forest', label: 'Forest ring theme', blurb: 'Unlocks the Forest level-ring theme.' } },
  { xp: 5000,   title: 'Disciplined',   reward: { icon: '✨', kind: 'flair', flairId: 'gold-wordmark', label: 'Gold wordmark', blurb: 'Your superdub logo turns gold, app-wide.' } },
  { xp: 8000,   title: 'Locked In',     reward: { icon: '🌌', kind: 'theme', themeId: 'aurora', label: 'Aurora ring theme', blurb: 'Unlocks the Aurora level-ring theme.' } },
  { xp: 12000,  title: 'Relentless',    reward: { icon: '⚪', kind: 'theme', themeId: 'mono', label: 'Platinum ring theme', blurb: 'Unlocks the Platinum level-ring theme.' } },
  { xp: 18000,  title: 'Unstoppable',   reward: { icon: '🌠', kind: 'theme', themeId: 'galaxy', label: 'Galaxy ring (animated)', blurb: 'Unlocks the animated Galaxy ring theme.' } },
  { xp: 28000,  title: 'Powerhouse',    reward: { icon: '🛡️', kind: 'milestone', label: 'Prestige status', blurb: 'You’re in rare company now.' } },
  { xp: 42000,  title: 'Habit Master',  reward: { icon: '🌋', kind: 'theme', themeId: 'inferno', label: 'Inferno ring (animated)', blurb: 'Unlocks the animated Inferno ring theme.' } },
  { xp: 60000,  title: 'Grandmaster',   reward: { icon: '💠', kind: 'milestone', label: 'Grandmaster crest', blurb: 'A title earned over many months.' } },
  { xp: 85000,  title: 'Legendary',     reward: { icon: '🌑', kind: 'theme', themeId: 'eclipse', label: 'Eclipse ring theme', blurb: 'Unlocks the Eclipse level-ring theme.' } },
  { xp: 120000, title: 'Transcendent',  reward: { icon: '🌈', kind: 'theme', themeId: 'prism', label: 'Prism ring (animated)', blurb: 'The ultimate ring. You’ve transcended.' } },
];

export interface PlayerLevel {
  level: number;
  title: string;
  progress: number;
  xpForLevel: number;
  xpForNext: number | null;
  nextTitle: string | null;
  reward: LevelReward;
  nextReward: LevelReward | null;
}

export function computePlayerLevel(totalXP: number): PlayerLevel {
  let idx = 0;
  for (let i = PLAYER_LEVELS.length - 1; i >= 0; i--) {
    if (totalXP >= PLAYER_LEVELS[i].xp) { idx = i; break; }
  }
  const cur = PLAYER_LEVELS[idx];
  const hasNext = idx < PLAYER_LEVELS.length - 1;
  const next = hasNext ? PLAYER_LEVELS[idx + 1] : null;
  const xpForNext = next ? next.xp : null;
  const progress = next ? (totalXP - cur.xp) / (next.xp - cur.xp) : 1;
  return {
    level: idx + 1,
    title: cur.title,
    progress,
    xpForLevel: cur.xp,
    xpForNext,
    nextTitle: next ? next.title : null,
    reward: cur.reward,
    nextReward: next ? next.reward : null,
  };
}

// True once the user has earned the gold-wordmark flair (level 7+).
export function hasGoldWordmark(level: number): boolean {
  return level >= (PLAYER_LEVELS.findIndex(l => l.reward.flairId === 'gold-wordmark') + 1);
}
