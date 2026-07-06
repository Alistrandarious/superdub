# Superdub — Pages & Routes

> Lightweight map of every route, its component, its role, and its theme accent.
> Router is defined in `src/index.tsx` (`AppRouter`). Unauthed users see `Auth`;
> `/privacy` renders with no nav. `BottomNav` + overlays mount outside `<Routes>`.

## Routed pages

| Route | Component | Role | Nav | Accent |
|---|---|---|---|---|
| `/` | `Habits.tsx` | **Home** — habit cards, Daily Log strip, streaks, level ring, Dub | Habits (center) | HEALTH green |
| `/dashboard` | `App.tsx` | **Progress** — weight trend, safe-zone, sleep chart, chart carousel, Yesterday's Verdict | Progress | GROWTH blue |
| `/diet` | `Diet.tsx` | **Plan** — calorie target, steps, training burn, Smart Adjust | Plan | GROWTH blue |
| `/plan` | `PlanPage.tsx` | Weight-plan setup / adaptive plan detail | — | GROWTH blue |
| `/food-log` | `FoodLog.tsx` | Daily food / calorie logging | — | HEALTH green |
| `/meal-plans` | `MealPlans.tsx` | Meal plan browsing / assignment | — | HEALTH green |
| `/tasks` | `Tasks.tsx` | **Lists** — to-do / task lists | Lists | — |
| `/success-kit` | `SuccessKit.tsx` | **Success Kit** — articles, book recs, What's New timeline | Success Kit | GOLD |
| `/level` | `LevelPage.tsx` | **The Ascension** — level ladder, rewards, ring-theme cosmetics | — | GOLD / VIOLET |
| `/profile` | `Profile.tsx` | Profile, targets, settings (`onLogout`) | — | GROWTH blue |
| `/maths` | `MathsPage.tsx` | **The Maths** — live formulas w/ worked examples | — | GROWTH tint |
| `/about` | `About.tsx` | About the app | — | — |
| `/archived` | `ArchivedHabits.tsx` | Archived habits (restore / permanent delete) | — | HEALTH green |
| `/privacy` | `PrivacyPolicy.tsx` | Privacy policy (no nav chrome) | none | — |

## Global overlays (mount above the router)

| Component | Role |
|---|---|
| `DailyCheckIn.tsx` | Morning ritual — mood, energy, sleep slider, optional weigh-in |
| `EnergyCheckIn.tsx` | Energy check-in; nudges the day's step target |
| `StepEntry.tsx` | Manual step entry (fallback to native step sync) |
| `CoachReport.tsx` | Dub's post-weigh-in read (win / slipping / next step) |
| `LevelUpCelebration.tsx` | Full-screen level-up moment |
| `UpdateBanner.tsx` | New-version / What's-New prompt (see `BUILD_TAG` in `version.ts`) |

## Notable shared components
- `BottomNav.tsx` — 5-item fixed nav (Progress · Plan · Habits · Success Kit · Lists).
- `CogMenu.tsx` — unified per-page cog menu (settings, navigation, quick-log).
- `LevelRing.tsx` / ring themes — XP ring, incl. the Liquid ring cosmetic.
- `DubMascot.tsx` — the coach avatar (dog/cat).
- `ChartCarousel.tsx` / `CadenceCarousel.tsx` — swipeable Progress charts. Chips
  sit **under** the viz; pagination dots removed. First slide is the Today matrix.
- `YesterdayMatrix.tsx` — Progress "Yesterday" panel: 2×2 KPI grid that fills the
  locked height (Calories eaten · Steps · Sleep/Mood · Habits closed). Fed by
  `App.tsx`. The "Today" tab beside it is a "coming soon" placeholder for now.
- `WeeklyRecap.tsx`, `DubProgressSummary.tsx`, `PatternsCard.tsx` — insight cards.
- `CoreHabitsMatrix.tsx` — four daily-loop tokens (Weight · Sleep/Energy · Steps ·
  Calories) that light gold as each is closed; sits under the ring on `/level`.

## Push reminders
`CogMenu` exposes three per-user daily push times (morning weigh-in, evening
nutrition, optional post-workout). The server scheduler (`server/index.ts`
`runReminders`, gated by pure `server/reminderSchedule.ts`) fires each once/day,
skipping loops already closed. Taps deep-link via `?prompt=weight|exercise` (see
`AppRouter`) or straight to `/food-log`.

See also: [APP_OVERVIEW.md](APP_OVERVIEW.md) · [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)
