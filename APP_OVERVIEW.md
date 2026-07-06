# Superdub — App Overview

> Lightweight reference for future prompts. Superdub is a PWA (CRA + React 18 +
> TypeScript, wrapped in Capacitor for Android/iOS) with an Express + Postgres
> backend on Render. It helps one person build habits and reach a weight/health
> goal, and coaches them with behavioural insights derived from their own data.

## What it does

Superdub is a **habit + weight + nutrition tracker** built around a single loop:
**log → see the trend → get a plain-English read → do one small thing today.**

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
- **Progress** (`/dashboard`) — weight trend (EMA + regression), safe-zone
  corridor, sleep chart, a swipeable chart carousel, and a "Yesterday's Verdict"
  hero (estimated intake vs target). Calories-first — macros were removed.
- **Plan / Diet** (`/diet`, `/plan`) — calorie target, step goal, training burn,
  Smart Adjust. **Food Log** (`/food-log`) and **Meal Plans** (`/meal-plans`).
- All formulas are documented in [CALCULATIONS.md](CALCULATIONS.md) and mirrored
  live in the in-app **The Maths** page (`/maths`).

### 3. Gamification
- **XP & Levels** (`/level`) — XP is recomputed live from habit streaks (not
  stored). 15 named levels ("First Day" → "Transcendent"), a reward per level, and
  unlockable cosmetics (level-ring themes, Dub the mascot). Gold = XP, violet = rank.

### 4. Dub — the coach
- A small robotic Yorkie (switchable to a cat at L2) that reads your data and
  gives an honest read after each weigh-in: a win to protect, what's slipping, and
  one tiny next step. Sits by the level ring and atop Progress; asks for a "walk"
  when momentum stalls.

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
