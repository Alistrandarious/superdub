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

export const habitLevelFromDays = (days: number) =>
  HABIT_LEVEL_TIERS.filter(t => days >= t).length; // 1..8

// Total XP a habit has earned given how many days it's been completed. XP only
// depends on the COUNT of completions (each paid at the rate of the level you'd
// reached), so it's order-independent.
export function habitXPForDoneDays(totalDoneDays: number): number {
  let xp = 0;
  for (let n = 1; n <= totalDoneDays; n++) {
    const lvl = habitLevelFromDays(n);
    xp += HABIT_LEVEL_RATES[Math.min(lvl - 1, HABIT_LEVEL_RATES.length - 1)];
  }
  return xp;
}

export type RewardKind = 'theme' | 'milestone' | 'flair';

export interface LevelReward {
  icon: string;
  label: string;
  kind: RewardKind;
  themeId?: string;   // for kind 'theme' — the ring theme this level unlocks
  flairId?: string;   // for kind 'flair' — a cosmetic flag (e.g. gold wordmark)
  blurb: string;      // one-line description of the reward
}

export interface PlayerLevelDef {
  xp: number;
  title: string;
  reward: LevelReward;
}

// ── Ring themes — the equippable cosmetic reward ────────────────────────────
export interface RingTheme {
  id: string;
  name: string;
  from: string;       // gradient start
  to: string;         // gradient end
  glow: string;       // glow colour
  unlockLevel: number; // 1-based player level at which it unlocks
  animated?: boolean;  // animated shimmer
}

export const RING_THEMES: RingTheme[] = [
  { id: 'slate',   name: 'Slate',       from: '#9AA0AE', to: '#5B606E', glow: 'rgba(150,158,176,0.28)', unlockLevel: 1 },
  { id: 'gold',    name: 'Gold',        from: '#FFE15A', to: '#FFC42E', glow: 'rgba(255,196,46,0.35)',  unlockLevel: 1 },
  { id: 'ocean',   name: 'Ocean',       from: '#5AD1FF', to: '#2E8BFF', glow: 'rgba(46,139,255,0.35)',  unlockLevel: 2 },
  { id: 'coral',   name: 'Coral',       from: '#FF9A6C', to: '#FF5470', glow: 'rgba(255,84,112,0.35)',  unlockLevel: 3 },
  { id: 'sunset',  name: 'Sunset',      from: '#FFB347', to: '#FF5E8A', glow: 'rgba(255,94,138,0.35)',  unlockLevel: 4 },
  { id: 'forest',  name: 'Forest',      from: '#52EFA0', to: '#1FA971', glow: 'rgba(47,210,126,0.35)',  unlockLevel: 6 },
  { id: 'gold-anim', name: 'Molten Gold', from: '#FFF0A0', to: '#FF9E2E', glow: 'rgba(255,158,46,0.4)', unlockLevel: 7, animated: true },
  { id: 'aurora',  name: 'Aurora',      from: '#7CF8C0', to: '#A855F7', glow: 'rgba(168,85,247,0.35)',  unlockLevel: 8 },
  { id: 'mono',    name: 'Platinum',    from: '#F4F4FA', to: '#A9A9C2', glow: 'rgba(220,220,235,0.35)', unlockLevel: 9 },
  { id: 'galaxy',  name: 'Galaxy',      from: '#6C8BFF', to: '#A855F7', glow: 'rgba(124,108,255,0.4)',  unlockLevel: 10, animated: true },
  { id: 'inferno', name: 'Inferno',     from: '#FFD23F', to: '#FF3D3D', glow: 'rgba(255,61,61,0.4)',    unlockLevel: 12, animated: true },
  { id: 'eclipse', name: 'Eclipse',     from: '#B79CFF', to: '#3A2E6E', glow: 'rgba(183,156,255,0.35)', unlockLevel: 14 },
  { id: 'prism',   name: 'Prism',       from: '#FF5E8A', to: '#2E8BFF', glow: 'rgba(255,255,255,0.4)',  unlockLevel: 15, animated: true },
];

export const DEFAULT_THEME_ID = 'slate';
export const SELECTED_THEME_KEY = 'superdub.ringTheme';

export function getRingTheme(id: string | null | undefined): RingTheme {
  return RING_THEMES.find(t => t.id === id) ?? RING_THEMES[0];
}
export function unlockedThemes(level: number): RingTheme[] {
  return RING_THEMES.filter(t => t.unlockLevel <= level);
}
export function isThemeUnlocked(id: string, level: number): boolean {
  return getRingTheme(id).unlockLevel <= level;
}
export function getSelectedThemeId(level: number): string {
  const stored = (typeof localStorage !== 'undefined' && localStorage.getItem(SELECTED_THEME_KEY)) || DEFAULT_THEME_ID;
  // Guard: if a stored theme is somehow above the current level, fall back.
  return isThemeUnlocked(stored, level) ? stored : DEFAULT_THEME_ID;
}

// ── The level ladder — meaningful titles + a reward each ─────────────────────
// 15 levels, themed around the journey of building habits (not generic RPG ranks).
export const PLAYER_LEVELS: PlayerLevelDef[] = [
  { xp: 0,      title: 'First Day',     reward: { icon: '🌱', kind: 'milestone', label: 'The journey begins', blurb: 'You showed up. That’s the hardest part.' } },
  { xp: 100,    title: 'Getting Going', reward: { icon: '🌊', kind: 'theme', themeId: 'ocean', label: 'Ocean ring theme', blurb: 'Unlocks the Ocean level-ring theme.' } },
  { xp: 300,    title: 'Finding Rhythm',reward: { icon: '🪸', kind: 'theme', themeId: 'coral', label: 'Coral ring theme', blurb: 'Unlocks the Coral level-ring theme.' } },
  { xp: 700,    title: 'In the Groove', reward: { icon: '🌅', kind: 'theme', themeId: 'sunset', label: 'Sunset ring theme', blurb: 'Unlocks the Sunset level-ring theme.' } },
  { xp: 1500,   title: 'Consistent',    reward: { icon: '🏅', kind: 'milestone', label: 'Consistency badge', blurb: 'A milestone most never reach. Keep stacking days.' } },
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
