# Superdub — Pages & Routes

> Lightweight map of every route, its component, its role, and its theme accent.
> Router is defined in `src/index.tsx` (`AppRouter`). Unauthed users see `Auth`;
> `/privacy` renders with no nav. `BottomNav` + overlays mount outside `<Routes>`.

## Routed pages

| Route | Component | Role | Nav | Accent |
|---|---|---|---|---|
| `/` | `Habits.tsx` | **Habits** (home) — habit cards (level left · name centred · streak right, over a `HabitMatrix` of the habit's whole history; tap to complete, hold for the cog tray of Favourite · Remind · Archive · More; drag-to-reorder via `ReorderableList`/`reorder.ts`), week strip, streaks; cadence **tabs** **Quit** · Daily · Weekly · Monthly · Yearly, a visible segmented control with per-cadence counts (`CadenceTabs.tsx`, replaced the swipe carousel; Quit leftmost — grey abstinence timers, `QuitCard` + `quit.ts`; opens on Daily each day). The `HabitMatrix` runs on ONE shared time axis for every habit with a month-label strip, so cards stack and compare column for column | Habits | HEALTH green |
| `/dashboard` | `App.tsx` | **Progress** — Today = your Plan (`PlanGauge` semicircle + `WeightSparkline` weekly chart + step tile, folded in from the retired `/diet`), Yesterday's Verdict, weight trend, safe-zone, sleep, chart carousel | Progress | GROWTH blue |
| `/community` | `CommunityPage.tsx` | **Global & Friends** — shared Global habit (deed toggle) + Friends (coming soon) | Global | GOLD |
| `/plan` | `PlanPage.tsx` | Weight-plan setup / adaptive plan detail | — | GROWTH blue |
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
(`onboarding.ts` — account · name · body · goal · habits · finish; Google drops
`account`). Six screens as of v2.492, down from nine: the `day` preview and the
`more` demographics screen are gone (Profile already collects demographics), and
the Dub mascot no longer hosts the flow — each screen asks its own question in its
heading (`screenPrompt`).

`finish` carries three things: the "Make it yours" cosmetic shelves
(`OnboardingCustomize.tsx` — `levels.ts` shelves at a fixed level-1 unlock context,
writing the **same** localStorage keys + CustomEvents as `LevelCustomizer`, so picks
apply the moment the app boots), and two **primed permission asks** (reminders,
automatic steps) that replace the OS dialogs that used to fire unannounced on the
first home render.

On submit, signup logs the day-0 weigh-in and opens the Adaptive Weight Plan through
the real endpoints (`planBootstrap.ts` → `PATCH /tracker` → `POST /plan/goal`), so the
goal answers produce a live plan and the morning weigh-in prompt is on from day one.

Progress + screen order are pure and covered by `onboarding.check.ts`; the plan
bootstrap by `planBootstrap.check.ts`.

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
- `BottomNav.tsx` — 5 items on web (Progress · Coach · **Habits** · Global · Lists), with Habits as a raised centre circle. **4 in the native app**: Lists is hidden behind the `SHOW_LISTS` const, and the `/tasks` route stays registered. Profile left the nav (now cog-only). Habits icon tints with the habits-colour cosmetic; active tint follows the nav-glow cosmetic.
- `LevelCustomizer.tsx` — the level hero + all cosmetic/companion shelves (ring themes, Dub species/colour, **Dub pronouns** via `dubPronouns.ts`, accents, background); rendered on Profile. Onboarding's copy of these shelves is mascot-free (ring, accents, background only) — Dub was retired from the app in v2.447 and from onboarding in v2.492.
- `CogMenu.tsx` — unified per-page cog menu (settings, navigation, quick-log).
- `LevelRing.tsx` / ring themes — XP ring, incl. the Liquid ring cosmetic.
- `DubMascot.tsx` — the coach avatar (dog/cat).
- `ChartCarousel.tsx` — swipeable Progress charts. Chips sit **under** the viz;
  pagination dots removed. First slide is the Today matrix.
- `CadenceTabs.tsx` — the Habits cadence switcher: a visible tablist, one tab per
  cadence with its habit count. Replaced `CadenceCarousel.tsx` (deleted), whose
  swipe made the other cadences discoverable only by trying the gesture.
- `DailyLog.tsx` — the weigh-in / steps / check-in vitals strip. **No longer on
  Habits**; the cog's Quick log still opens all three editors.
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
`CogMenu` exposes three per-user daily reminder times (morning weigh-in, evening
reflection, optional post-workout). Two delivery paths behind one door (`push.ts`):
on **web** the server scheduler (`server/index.ts` `runReminders`, gated by pure
`server/reminderSchedule.ts`) fires each once/day, skipping loops already closed;
on **native** the same three hours are scheduled as local notifications on the
device, re-armed on boot. Web taps deep-link via `?prompt=weight|exercise` (see
`AppRouter`).

See also: [APP_OVERVIEW.md](APP_OVERVIEW.md) · [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)
