# Superdub — Documentation Map

Start here. This is the index for every doc in the repo, plus a **feature → file**
map because several UI concepts live in files that aren't named after them (e.g.
the "Progress" page is `App.tsx`).

## The docs, in reading order

| Doc | What it covers | Read it when… |
|---|---|---|
| [APP_OVERVIEW.md](APP_OVERVIEW.md) | What Superdub does + the insight services | You're new to the app or need the big picture |
| [PAGES.md](PAGES.md) | Every route → component → nav → accent | You need to find which component backs a screen |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Colours, type, surfaces, constraints (binding guide: `Superdub Swatches.pdf`) | You're touching UI / styling |
| [CALCULATIONS.md](CALCULATIONS.md) | Every formula (mirrored live at `/maths`) | You're changing anything numeric |
| [UPDATE_ARTICLES.md](UPDATE_ARTICLES.md) | Each major update ships a Success Kit article | You shipped a feature and need its write-up |
| [SUPERDUB_SPEC.md](SUPERDUB_SPEC.md) | Full product spec | You need the authoritative feature definition |
| [AGENTS.md](AGENTS.md) | The "lazy senior dev" (Ponytail) coding rules | Before writing any code |
| [ROADMAP.md](ROADMAP.md) | Prioritized backlog + live status | You're deciding what to build next |
| [ORCHESTRATION.md](ORCHESTRATION.md) | Lead/worker agent workflow (specs, review, shipping) | You're running agents on this repo |
| [CLAUDE.md](CLAUDE.md) | Repo entry point — points at all of the above | First contact |

## Feature → where it actually lives

The component name often doesn't match the screen name. Use this before assuming
a file exists:

| You're looking for… | It's actually in… |
|---|---|
| **Progress** page (weight trend, charts, "Today"/"Stats") | `src/App.tsx` (route `/dashboard`). "Today" and "Stats" are panels inside the `ChartCarousel`, **not** separate files |
| **Sleep** & **Mood** charts | `src/App.tsx` (`sleepChartData` / `moodChartData`) — no `SleepChart.tsx` |
| **Water / liquid fill** animation | `src/LevelRing.tsx` (the liquid ring theme, `liquidTopY`) — no `WaterTracker.tsx` |
| **Habits** (cards, streaks, mini-circles, per-habit calendar) | `src/Habits.tsx` |
| **Archived / graveyard** habits | `src/ArchivedHabits.tsx` (route `/archived`) |
| **Steps** logging + calendar | `src/StepEntry.tsx` (opened via `superdub:show-step-entry`) |
| **Daily Log** vitals strip | `src/DailyLog.tsx` |
| **XP / levels** (global state) | `src/XPContext.tsx` + `src/levels.ts` |
| **Plan / diet target / macros** | `src/Diet.tsx`, `src/PlanPage.tsx`, and the Plan section of `src/Profile.tsx` |
| **The Maths** (live formula mirror) | `src/MathsPage.tsx` (route `/maths`) |
| **Chart / cadence carousels** | `src/ChartCarousel.tsx`, `src/CadenceCarousel.tsx` |
| **API surface** (all endpoints) | `src/api.ts` |
| **Theme tokens** (colours, `pageTheme`) | `src/theme.ts` + `src/App.css` (one big stylesheet) |

## Conventions worth knowing

- **One stylesheet:** almost all CSS is in `src/App.css`, imported everywhere.
- **Cross-tab state** flows through `window` `CustomEvent`s prefixed `superdub:`
  (e.g. `superdub:tracker-updated`, `superdub:show-step-entry`). Grep for them.
- **Tracker day keys** come in two shapes: `DD/MM` (habit tracker) and
  `YYYY-MM-DD` (steps, check-ins, plan dates). Check which one a store uses.
