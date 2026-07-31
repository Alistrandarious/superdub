# Superdub — App Overview

> Lightweight reference for future prompts. Superdub is a PWA (CRA + React 18 +
> TypeScript, wrapped in Capacitor for Android/iOS) with an Express + Postgres
> backend on Render. It helps one person build habits and reach a weight/health
> goal, and coaches them with behavioural insights derived from their own data.

## What it does

Superdub is a **habit + weight + nutrition tracker** built around a single loop:
**log → see the trend → get a plain-English read → do one small thing today.**

> **Core principle — Superdub destroys food logging.** Calorie intake is
> reverse-engineered from **steps + weight-loss trend + activity**, never from a
> food diary. Food logging exists only as a *confidence heuristic* that corroborates
> the estimate; it is optional and is never scored "over/under" against a target.
> There is **one** calorie target and **one** verdict (the estimate) shown across the
> app. See [CALCULATIONS.md](CALCULATIONS.md) §9.

### 1. Habit & process tracking
- **Habits** (`/`, home) — collapsible cards you tick daily. Each habit carries a
  persistent level (grows with total days, never resets on a miss), streaks with
  gates at 7/14/30/60/100/200/365 days, and history. Missed due days auto-mark as
  failed so the week tells the truth. Archive/restore/delete via a dedicated screen.
- **Daily Log strip** — weigh-in, steps and check-in chips that tick green as you
  log, plus a logging streak to keep the data flowing.
- **Lists** (`/tasks`) — lightweight to-do / task lists.
- **Rituals** — a morning check-in (mood, energy, sleep slider, optional weigh-in)
  and an energy check-in that nudges the day's step target.

### 2. Weight & nutrition
- **Progress** (`/dashboard`) — leads with a **Today** panel of live targets
  (calorie target · step goal · habit count), then a "Yesterday's Verdict" hero
  (estimated intake vs target), weight trend (EMA + regression), safe-zone corridor,
  sleep chart, and a swipeable chart carousel. Calories-first — macros were removed.
- **Plan / Diet** (`/diet`, `/plan`) — calorie target, training burn, activity
  targets, Smart Adjust. Being folded into Progress; **off the bottom nav** (reached
  via the cog → Adaptive Weight Plan). **Food Log** (`/food-log`) and **Meal Plans**.
- All formulas are documented in [CALCULATIONS.md](CALCULATIONS.md) and mirrored
  live in the in-app **The Maths** page (`/maths`).

### 3. Gamification
- **XP & Levels** — XP is recomputed live from habit streaks (not stored, and never
  lost on archive/delete). 15 named levels ("First
  Day" → "Transcendent"), a reward per level. The level ring, XP, and all unlockable
  cosmetics (ring themes, Dub species/colour, accent colours, backgrounds) live on
  **Profile** (`LevelCustomizer`); `/level` keeps the ladder, badges, and habit record.
  Gold = XP, violet = rank.
- **The Global habit** — its own **Global & Friends** tab (`/community`,
  `CommunityPage.tsx`): one shared monthly habit (July 2026: "do a good deed today").
  Each user levels it up personally, but the XP feeds one community total
  (`global_months` / `global_contributions`, `GlobalPrompt.tsx`). Reaching 10k together,
  with ≥100 XP of your own, unlocks the white "Aurora" Dub colour. The **Friends
  layer is built** (`FriendsPanel.tsx` + `server/routes/friends.ts`, rendered inside
  `CommunityPage`): add friends, see their streaks, nudge them, share habits.

### 4. Dub — the coach
- A small robotic Yorkie (cat at L2, wizard at 3 referred friends) and the app's
  USP carrier. **Talking to Dub opens a chat** (`DubChat.tsx`, fires after each
  weigh-in and from every "Talk to Dub" button): his coach read arrives as bubbles,
  then tappable questions answered deterministically from the user's own data
  (`src/dubQuestions.ts` — pace + ETA, why-is-weight-up with the water/real-tissue
  cap, goal-by-date, calorie target, body burn, sleep, steps, level-up, plus
  questions generated from spotted patterns). **Daily briefs** (`src/dubBrief.ts`):
  a morning brief / evening debrief / midday read composed sentence-by-sentence
  from available data, shown as a speech-bubble card on `/dub` and as a chat chip.
  **His room is live** (`DubRoom.tsx` + `dubDayState`): mood, floor glow, a
  tappable thought bubble, and sparkles on a clean sweep. Per-habit **data
  insights** (`src/dubInsights.ts`) — which weekday a habit slips, step/mood/weight
  links — feed both the page and the chat. All of it is on-device and rule-based
  (`coach.ts` `weekPace` is the single pace source); voice rules are enforced by
  assert in `dubQuestions.check.ts` / `dubBrief.check.ts`.

## Behavioural insights ("ML"-flavoured, mostly deterministic)

All insight logic lives in `server/services/`. It is **transparent and rule-based**
(no LLM calls in these files) — closer to a proportional-feedback loop and additive
risk scores than trained models, which keeps every number auditable.

| Service | What it derives |
|---|---|
| `tdeeEstimator.ts` | **Learned personal maintenance** — blends the formula TDEE with observed TDEE back-calculated from actual weight change + logged intake, weighted by data confidence. |
| `plateauPredictor.ts` | **Stall/plateau risk (0–1)** from weight-trend deceleration, step drop, low energy/mood, and logging rate. Names the top factor so it's actionable. |
| `planEngine.ts` | **Proportional-feedback calorie adjustment** — compares actual weekly rate (EMA) to the goal rate and nudges the target to close the gap. |
| `churnRisk.ts` | **Disengagement risk** (LOW→CRITICAL) from rolling check-in windows + last-activity recency. |
| `cohortEngine.ts` | **Cohort-first cold start** — maps a new user to a community cohort (age/sex/activity/goal) for day-1 baseline step & calorie targets, no 14-day calibration. |
| `coachingEngine.ts` | **Template coaching** — picks Dub's message by (trend × adherence × energyBand × churn), with graceful fallbacks. |

## Stack (quick facts)
- **Frontend:** CRA (`react-scripts` 5), React 18 + TS, `react-router-dom` v7,
  `recharts` v3. Capacitor (android/ios) for native step sync via `capacitor-health`.
- **Backend:** Express 5 + `pg` (Neon Postgres), JWT auth (Bearer in localStorage
  `superdub.token`). Migrations run at boot in `server/index.ts`.
- **Data model:** `users.id` is INTEGER. `tracker` is daily metrics keyed by
  `(user_id, day)` where `day` is year-less `DD/MM` text. Step provenance in
  `step_entries`. All localStorage keys prefixed `superdub.*`.
- **Hosting:** superdub.onrender.com; native API base switches to the absolute
  Render URL when running under Capacitor.

See also: [PAGES.md](PAGES.md) · [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) ·
[UPDATE_ARTICLES.md](UPDATE_ARTICLES.md)
