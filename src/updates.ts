// Superdub release notes — the major updates, newest first. Dated to when they
// actually shipped. Rendered as the "What's New" timeline in the Success Kit.
export interface UpdateEntry {
  date: string;        // ISO yyyy-mm-dd
  emoji: string;
  title: string;
  summary: string;
  points: string[];
}

export const UPDATE_LOG: UpdateEntry[] = [
  {
    date: '2026-06-29',
    emoji: '🐶',
    title: 'Meet Dub, your coach',
    summary: 'Superdub got a companion — a little robotic Yorkie who reads your data and coaches you in plain English.',
    points: [
      'Dub gives you an honest read after every weigh-in: a win to protect, what\'s slipping, and one tiny next step.',
      'He sits by your level ring and at the top of Progress, rating how you\'re trending over time.',
      'When momentum stalls, Dub asks to be taken for a walk — a nudge to just move today.',
      'Reach level 2 and you can switch Dub from a dog to a cat. More to unlock as you climb.',
    ],
  },
  {
    date: '2026-06-28',
    emoji: '🔐',
    title: 'Sign in with Google',
    summary: 'Create your account or log in with one tap using Google — no password to remember.',
    points: [
      'New Google users still get the full onboarding so your targets stay personalised.',
      'Your identity is always verified securely on our server.',
    ],
  },
  {
    date: '2026-06-28',
    emoji: '📚',
    title: 'The Success Kit',
    summary: 'A new home for guides, recommended books and original Superdub articles to help you build habits and reach your goals.',
    points: [
      'Original reads on habits, habit tracking, goal setting and daily weighing.',
      'Hand-picked book recommendations across focus, discipline, weight and health.',
      'Every page now has one unified menu (the cog) — settings, navigation and quick-logging in one place.',
    ],
  },
  {
    date: '2026-06-28',
    emoji: '⭐',
    title: 'Levels, rewards & ring themes',
    summary: 'Your XP now means something. A proper level system with meaningful titles, a reward at every level, and unlockable cosmetics.',
    points: [
      'Fifteen levels from "First Day" to "Transcendent", each granting a named reward.',
      'Unlockable level-ring themes — equip the one you\'ve earned.',
      'A full-screen celebration when you level up.',
      'A Duolingo-style day-streak flame in the header to keep your run alive.',
    ],
  },
  {
    date: '2026-06-28',
    emoji: '✅',
    title: 'Habit cards, reimagined',
    summary: 'The whole habit experience was rebuilt — cleaner, more informative, and more satisfying to tick.',
    points: [
      'Collapsible cards: a clean summary that expands into stats, streaks and history.',
      'A persistent habit level that grows with total days — it never resets on a miss.',
      'Missed due days now auto-mark as failed so your week tells the truth.',
      'A redesigned stat panel with your earned title, level, streak and XP.',
    ],
  },
  {
    date: '2026-06-28',
    emoji: '🗂️',
    title: 'Archived habits & easier weigh-ins',
    summary: 'Archive habits to a dedicated screen, restore them any time, or delete them for good — plus a faster way to log your weight.',
    points: [
      'A proper Archived Habits screen with restore and permanent-delete.',
      'Weigh-ins are now tap-to-type, pre-filled with your last weight.',
    ],
  },
  {
    date: '2026-06-25',
    emoji: '📈',
    title: 'Progress charts overhaul',
    summary: 'Weight and habits split into their own charts, with smoother panning and a clearer view of where you\'re heading.',
    points: [
      'Separate Weight Trend and Habits charts on Progress.',
      'Drag the chart directly to pan through time windows.',
      'A forward projection line shows where your current pace is taking you.',
    ],
  },
];
