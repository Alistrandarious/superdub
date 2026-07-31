# Superdub — Pages & Routes

> Lightweight map of every route, its component, its role, and its theme accent.
> Router is defined in `src/index.tsx` (`AppRouter`). Unauthed users see `Auth`;
> `/privacy` renders with no nav. `BottomNav` + overlays mount outside `<Routes>`.

## Routed pages

| Route | Component | Role | Nav | Accent |
|---|---|---|---|---|
| `/` | `Habits.tsx` | **Habits** (home) — habit cards (star toggle + drag-to-reorder via `ReorderableList`/`reorder.ts`), week strip, Daily Log, streaks; cadence carousel **Quit** · Daily · Weekly · Monthly · Yearly (Quit leftmost — grey abstinence timers, `QuitCard` + `quit.ts`; carousel opens on Daily each day) | Habits | HEALTH green |
| `/dashboard` | `App.tsx` | **Progress** — Today = your Plan (`PlanGauge` semicircle + `WeightSparkline` weekly chart + step tile, folded in from `/diet`), Yesterday's Verdict, weight trend, safe-zone, sleep, chart carousel | Progress | GROWTH blue |
| `/community` | `CommunityPage.tsx` | **Global & Friends** — shared Global habit (deed toggle) + Friends (coming soon) | Global | GOLD |
| `/diet` | `Diet.tsx` | Plan cards — weight-journey gauge (`PlanGauge`), Weight This Week (`WeightSparkline`), adaptive plan, activity targets, Smart Adjust. Gauge + weekly chart now shared with Progress→Today; **off the nav**, reachable via cog | — | GROWTH blue |
| `/plan` | `PlanPage.tsx` | Weight-plan setup / adaptive plan detail | — | GROWTH blue |
| `/food-log` | `FoodLog.tsx` | Daily food / calorie logging | — | HEALTH green |
| `/meal-plans` | `MealPlans.tsx` | Meal plan browsing / assignment | — | HEALTH green |
| `/tasks` | `Tasks.tsx` | **Lists** — To-Do · Shopping · Goals (`GoalsPanel`) · **Journal** (`JournalPanel`: free text + mood 1–5, feeds `dubInsights`) | Lists | — |
| `/dub` | `DubPage.tsx` | **Dub** — coach home: check-in button (fires the Coach report), live read, and on-device data insights (`dubInsights`) | Dub | GROWTH blue |
| `/level` | `LevelPage.tsx` | **The Ascension** — level ladder, badges, habit record (cosmetics moved to Profile) | — | GOLD / VIOLET |
| `/profile` | `Profile.tsx` | **Profile** — level ring + XP, all cosmetics + Dub customization (`LevelCustomizer`), identity, targets, settings (`onLogout`); off the nav, reachable via cog | — | GROWTH blue |
| `/maths` | `MathsPage.tsx` | **The Maths** — live formulas w/ worked examples | — | GROWTH tint |
| `/about` | `About.tsx` | About the app | — | — |
| `/archived` | `ArchivedHabits.tsx` | Archived habits (restore / permanent delete) | — | HEALTH green |
| `/privacy` | `PrivacyPolicy.tsx` | Privacy policy (no nav chrome) | none | — |

## Onboarding (unauthed)
`Auth.tsx` signup is a **soft walkthrough**, not a form: an ordered screen list
(`onboarding.ts` — account · name · body · goal · habits · **day** · **dub** · more ·
finish; Google drops `account`). Screen 6 (`OnboardingDaily.tsx`) previews the daily
window from the chosen habits; screen 7 (`OnboardingCustomize.tsx`) is "meet Dub +
make it yours" — it reuses the `levels.ts` cosmetic shelves + `DubMascot` with a fixed
level-1 unlock context (locks shown as teasers) and writes the **same** localStorage
keys + CustomEvents as `LevelCustomizer`, so picks apply the moment the app boots.
Progress + screen order are pure and covered by `onboarding.check.ts`.

## Global overlays (mount above the router)

| Component | Role |
|---|---|
| `DailyCheckIn.tsx` | Morning weigh-in prompt (Yes/No gate) |
| `VitalsPrompt.tsx` | Morning vitals — sleep slider (4–12h) + mood/energy 1–10 sliders |
| `ExercisePrompt.tsx` | Post-workout one-tap "closed your loop?" (time-locked to workout hour) |
| `NutritionPrompt.tsx` | Evening "eating vs target" ring (time-locked to nutrition hour) |
| `EnergyCheckIn.tsx` | Legacy combined check-in — on-demand only (cog menu → Log Check-in) |
| `StepEntry.tsx` | Manual step entry (fallback to native step sync) |
| `DubChat.tsx` | Dub's chat (was CoachReport): his weigh-in read as opening bubbles, then tappable questions answered from the user's data (`dubQuestions.ts`) |
| `LevelUpCelebration.tsx` | Full-screen level-up moment |
| `UpdateBanner.tsx` | New-version / What's-New prompt (see `BUILD_TAG` in `version.ts`) |

## Notable shared components
- `BottomNav.tsx` — 6-item uniform fixed nav (Habits · Progress · Dub · Global · Lists · Kit); no raised centre button. Profile left the nav (now cog-only); Dub took its slot. Habits icon tints with the habits-colour cosmetic; active tint follows the nav-glow cosmetic.
- `LevelCustomizer.tsx` — the level hero + all cosmetic/companion shelves (ring themes, Dub species/colour, **Dub pronouns** via `dubPronouns.ts`, accents, background); rendered on Profile.
- `CogMenu.tsx` — unified per-page cog menu (settings, navigation, quick-log).
- `LevelRing.tsx` / ring themes — XP ring, incl. the Liquid ring cosmetic.
- `DubMascot.tsx` — the coach avatar (dog/cat).
- `ChartCarousel.tsx` / `CadenceCarousel.tsx` — swipeable Progress charts. Chips
  sit **under** the viz; pagination dots removed. First slide is the Today matrix.
- `YesterdayMatrix.tsx` — Progress "Yesterday" panel: 2×2 KPI grid that fills the
  locked height (Calories eaten · Steps · Sleep/Mood · Habits closed). Fed by
  `App.tsx`. The "Today" panel beside it now shows today's live targets (calorie
  target · step goal · habit count).
- `CommunityPage.tsx` / `GlobalHabitCard.tsx` — the Global & Friends tab; the
  Global habit card moved here off `/level`.
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
