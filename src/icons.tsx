import React from 'react';

// ── Shared icon set ─────────────────────────────────────────────────────────
// Style guide: no emoji in UI chrome. These are the SVG replacements, in one
// place so they stop being re-defined per file. Feather-style 24×24 stroke,
// currentColor, size-parametrised. Pictographs that were emoji live here;
// AnimatedFlame (streak fire) and CheckSVG keep their existing homes.

export interface IconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

// Base stroke wrapper — matches the CogMenu `Ic` convention.
const S: React.FC<IconProps & { children: React.ReactNode }> = ({ size = 16, strokeWidth = 2, className, children }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
       strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
       className={className} aria-hidden="true">
    {children}
  </svg>
);

// ── Stat / streak icons (habit cards) ───────────────────────────────────────
export const MoonIc: React.FC<IconProps> = (p) => (   // idle / days-off (was 💤)
  <S {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></S>
);
export const CalendarIc: React.FC<IconProps> = (p) => ( // days done (was 📅)
  <S {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></S>
);
export const MedalIc: React.FC<IconProps> = (p) => (  // recent miss (was 🏅)
  <S {...p}><circle cx="12" cy="14" r="6" /><path d="M8.5 8.5 6 2h5l1.5 4M15.5 8.5 18 2h-5" /></S>
);
export const TrophyIc: React.FC<IconProps> = (p) => ( // maxed (was 🏆)
  <S {...p}><path d="M6 4h12v4a6 6 0 0 1-12 0z" /><path d="M6 6H3v2a3 3 0 0 0 3 3M18 6h3v2a3 3 0 0 1-3 3M9 20h6M12 14v6" /></S>
);

// ── Progress screen ─────────────────────────────────────────────────────────
export const UsersIc: React.FC<IconProps> = (p) => (  // cohort (was 👥)
  <S {...p}><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" /></S>
);
export const AppleIc: React.FC<IconProps> = (p) => (  // nutrition (was 🍎)
  <S {...p}><path d="M12 7c-1.5-2-4.5-2.5-6 0-1.7 2.8-.5 8 2 10 1 .8 2 .8 3 0M12 7c1.5-2 4.5-2.5 6 0 1.7 2.8.5 8-2 10-1 .8-2 .8-3 0" /><path d="M12 7c0-2 1-3 3-3.5" /></S>
);
export const EditIc: React.FC<IconProps> = (p) => (   // edit (was ✎)
  <S {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></S>
);

// ── Weather chip ────────────────────────────────────────────────────────────
export const SunIc: React.FC<IconProps> = (p) => (
  <S {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></S>
);
// Sun disc + rays clearing the cloud's top right. The sun used to be a bare arc
// with two stray ticks, which at the header's 14px read as scratches, not a sun.
export const CloudSunIc: React.FC<IconProps> = (p) => (
  <S {...p}><circle cx="16.5" cy="5" r="2.5" /><path d="M12.3 5H11M20.7 5H21.7M13.5 2 12.8 1.3M19.5 2 20.2 1.3" /><path d="M17.5 19a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.7 1.3A3 3 0 0 0 8 19z" /></S>
);
export const CloudIc: React.FC<IconProps> = (p) => (  // fog / overcast
  <S {...p}><path d="M17.5 19a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.7 1.3A3 3 0 0 0 8 19z" /></S>
);
export const RainIc: React.FC<IconProps> = (p) => (
  <S {...p}><path d="M17.5 15a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.7 1.3A3 3 0 0 0 8 15" /><path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2" /></S>
);
export const SnowIc: React.FC<IconProps> = (p) => (
  <S {...p}><path d="M17.5 15a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.7 1.3A3 3 0 0 0 8 15" /><path d="M8 19h.01M12 19h.01M16 19h.01M10 21h.01M14 21h.01" /></S>
);
export const StormIc: React.FC<IconProps> = (p) => (
  <S {...p}><path d="M17.5 14a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.7 1.3A3 3 0 0 0 8 14" /><path d="M12 13l-2 4h3l-2 4" /></S>
);

// ── Featured-habit tiles ─────────────────────────────────────────────────────
export const WalkIc: React.FC<IconProps> = (p) => (   // steps / walking (was 🚶)
  // Same activity glyph the Steps chip uses (DailyLog StepIc) — clean + consistent.
  <S {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></S>
);
export const BookIc: React.FC<IconProps> = (p) => (   // reading (was 📖)
  <S {...p}><path d="M12 6C10 4 6 4 3 5v14c3-1 7-1 9 1 2-2 6-2 9-1V5c-3-1-7-1-9 1z" /><path d="M12 6v14" /></S>
);
export const NoSmokeIc: React.FC<IconProps> = (p) => ( // quit smoking (was 🚭)
  <S {...p}><rect x="2" y="13" width="16" height="4" rx="1" /><path d="M22 13v4M18 13v4" /><line x1="3" y1="21" x2="21" y2="3" /></S>
);
export const MealIc: React.FC<IconProps> = (p) => (   // meal prep (was 🥘)
  <S {...p}><path d="M3 11h18a9 9 0 0 1-18 0z" /><path d="M2 20h20M12 11V7a2 2 0 0 1 2-2" /></S>
);
export const MoneyIc: React.FC<IconProps> = (p) => (  // budget (was 💰)
  <S {...p}><rect x="2" y="6" width="20" height="13" rx="2" /><circle cx="12" cy="12.5" r="2.5" /><path d="M6 6V4h12v2" /></S>
);
export const HealthIc: React.FC<IconProps> = (p) => ( // check-up (was 🩺)
  <S {...p}><path d="M5 3v5a4 4 0 0 0 8 0V3" /><path d="M9 12v3a5 5 0 0 0 10 0v-1" /><circle cx="19" cy="12" r="2" /></S>
);
