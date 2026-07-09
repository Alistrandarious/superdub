# PROMPTS.md — Superdub's daily prompts and notifications

The single source of truth for every prompt Superdub shows and every push it sends.
Keep this in sync whenever a prompt's timing, trigger, or delivery changes.

Two things are separate and must not be conflated:

- **Delivery** is *how the prompt appears*. Either a **push notification** (only if the
  user turned notifications on) that deep-links via `?prompt=…`, or an **in-app
  time-lock** that opens the prompt when the app is already open at the right hour.
- **Notifications are opt-in and cover only a subset of prompts.** Not every prompt has
  a push. A prompt with no push only appears when the app is open.

Every prompt is **once per day**, keyed by a `localStorage` stamp, and self-suppresses if
its data is already logged for the day. All hours are the user's local time.

## The daily order

| # | Prompt | Captures | Trigger event | Push? | In-app time-lock | Once/day key |
|---|---|---|---|---|---|---|
| 1 | **Weigh-in** | weight | `superdub:show-checkin` | ✅ `?prompt=weight`, "Morning" hour (default 8 AM) | opens from the push / cog | tracker weight for the day |
| 2 | **Vitals** | sleep (bed→wake) + energy | `superdub:show-vitals` | ❌ | mornings (`<12h`); chains in right after the weigh-in saves, or on app open if weight is already logged | `superdub.vitals.checkin` |
| 3 | **Workout** | workout done + intensity | `superdub:show-exercise` | ✅ `?prompt=exercise`, "Workout" hour (opt-in, **off** by default) | fires at the Workout hour if set | `superdub.exercise.checkin` |
| 4 | **Evening reflection** | mood + eating adherence | `superdub:show-evening` | ✅ `?prompt=evening`, "Evening" hour (default 8 PM) | evenings (`>=18h`), if Daily Check-in is on | `superdub.evening.checkin` |

**Reading the day:** morning weigh-in → Vitals (sleep + energy) → (optional Workout at the
user's hour) → Evening reflection (mood + how eating landed).

## Per-prompt detail

### 1. Weigh-in — `DailyCheckIn.tsx`
- The only mandatory morning input. Push at the **Morning** reminder hour (`reminder_hour`,
  default 8 AM), suppressed if the day's tracker weight is already set.
- Saving fires `superdub:checkin-done`, which chains straight into Vitals.

### 2. Vitals — `VitalsPrompt.tsx`
- Sleep via the two-thumb bed→wake slider (30-min steps) plus an energy slider.
- **Mood is NOT here** — it moved to the Evening reflection so mood is a single end-of-day
  read. No push of its own; it rides in behind the weigh-in.

### 3. Workout — `ExercisePrompt.tsx`
- Opt-in only. `workout_hour` is NULL (off) unless the user sets a Workout hour in the cog.
- Push `?prompt=exercise`; suppressed if `daily_checkins.workout_done` is already true today.

### 4. Evening reflection — `EveningPrompt.tsx`
- Mood (1–10, mapped to the engine's 1–5) + the eating-adherence scale (`−−/−/✓/+/++`).
- The eating signal is **load-bearing**: it feeds `churnRisk.ts`, `coachingEngine.ts`,
  `plateauPredictor.ts`, `tdeeEstimator.ts`, and the Adaptive Weight Plan card. It stays even
  though calorie *logging* was retired — this is a qualitative self-report, not food logging.
- Push `?prompt=evening` at the **Evening** hour. Server-side this reuses the `nutrition_hour`
  column (freed when food logging went) and the `last_nutrition` stamp; suppressed if today's
  check-in already has a mood.
- In-app auto-opens after 6 PM once per day, gated by the "Daily Check-in" toggle
  (`superdub.checkin.enabled`).

## Tap-to-open (no time-lock, no push)

- **The Global habit** → `superdub:show-global` (`GlobalPrompt.tsx`): the spinning planet
  top-left of the level ring opens it. One shared monthly habit ("Do a good deed today" for
  July 2026); logging it contributes to the community total and levels the habit up per user.
  It is **not** once-per-day-suppressed by a `localStorage` stamp — the server row (one per
  user per day) is the source of truth, so the button just reads `doneToday` from the API.

## Manual-only (cog → Quick log, no time-lock, no push)

- **Log Weight** → `superdub:show-checkin` (same prompt as #1).
- **Log Steps** → `superdub:show-step-entry` (`StepEntry.tsx`; also fed by native step sync).
- **Log Check-in** → `superdub:show-energy-checkin` (`EnergyCheckIn.tsx`): the fuller combined
  ritual (energy + mood + eating + workout + weight + sleep). Kept as a power option; it does
  **not** auto-fire and has no push.

## Notification settings (cog, when notifications are on)

- **Morning** hour → `reminder_hour` (default 8 AM).
- **Evening** hour → `nutrition_hour` column (default 8 PM).
- **Workout** hour → `workout_hour` (opt-in; "Off" = NULL).

Server scheduling lives in `server/index.ts` `runReminders()` (every 30 min); the hours are
persisted via `server/routes/push.ts`.
