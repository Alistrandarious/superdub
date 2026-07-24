# Superdub — How the maths works

> **Superseded:** the live, always-current version of this document is the
> in-app **"The Maths"** page (cog menu → The Maths, route `/maths`,
> `src/MathsPage.tsx`). This file is kept for history and may be stale —
> notably, macro targets have since been removed from the app.

A plain reference for every number the app shows, so you can check it.
Worked examples use a sample profile: **88.5 kg, on Fat Loss, 1 kg/wk target,
maintenance ≈ 2,378 kcal, calorie target ≈ 1,347 kcal**.

Universal constant used everywhere: **1 kg of body weight ≈ 7,700 kcal**.

---

## 1. Body energy (BMR & maintenance)

**BMR** (Mifflin–St Jeor), in `App.tsx`:
```
BMR = 10·weightKg + 6.25·heightCm − 5·age + 5
```

**Maintenance / TDEE** = BMR × activity multiplier (`activityLevel`, e.g. 1.2–1.7):
```
TDEE = BMR × activityLevel
```
This is the calories you burn in a day doing nothing extra.

---

## 2. Calorie target & deficit

```
dailyDeficit  = lossPerWeek × 7700 / 7        # kcal/day you must be under
calorieTarget = max(TDEE − dailyDeficit, 1200)
```
Worked: 1 kg/wk → `1 × 7700 / 7 = 1,100 kcal/day` deficit.
`2,378 − 1,100 = 1,278` (shown as ~1,347 once macros round).

The floor is 1,200 kcal so it never prescribes something unsafe.

---

## 3. Macros (`App.tsx`)
```
protein_g = weightKg × 2.0          # 4 kcal/g
fats_g    = weightKg × 0.8          # 9 kcal/g
carbs_g   = (calorieTarget − protein·4 − fats·9) / 4   # remainder, min 50 g
```

---

## 4. Steps  ← the one you asked about

**kcal per step** (scaled by body weight; ~0.04 at 70 kg):
```
kcalPerStep = 0.04 × (weightKg / 70)
```
Worked at 88.5 kg: `0.04 × 88.5/70 = 0.0506 kcal/step`.

### a) Daily step *target*
A fixed goal from your profile (e.g. **6,900**), nudged by your daily
energy check-in: `target = base + {energy 1:−2k … 5:+2k}`.

### b) "Steps to close the X kcal gap"  (the **1,364** number)
This is **not** your step goal — it's the *extra* steps to burn off the
part of today's deficit your **diet hasn't already covered**:
```
goalDeficit  = lossPerWeek × 7700 / 7              # 1,100 for 1 kg/wk
foodDeficit  = maintenance − calorieTarget          # deficit from eating less
trainingBurn = gym + activities, per day
gapKcal      = goalDeficit − foodDeficit − trainingBurn
stepsNeeded  = gapKcal / kcalPerStep   (if gapKcal > 0)
```
Worked: `foodDeficit = 2,378 − 1,347 = 1,031`. `gap = 1,100 − 1,031 − 0 = 69 kcal`.
`stepsNeeded = 69 / 0.0506 ≈ 1,364 steps`.

**So 1,364 is correct and consistent** — it's low *because your eating
already creates 1,031 of the 1,100 kcal deficit*, leaving only 69 kcal (≈1.4k
steps) to walk off. Your actual movement goal is still the **6,900 target**;
1,364 is just "the minimum walk to perfectly hit your loss rate today."

> If you'd rather this card show steps relative to your real activity
> (e.g. vs your 7,211 yesterday) instead of the marginal gap, that's a
> design change — say the word.

---

## 5. Training burn (MET formula)
```
burnPerSession = MET × weightKg × minutes / 60
burnPerDay     = sessionsPerWeek × burnPerSession / 7
```
MET by intensity: light ≈ 3.5, moderate ≈ 6, hard ≈ 8.

---

## 6. Weight trend

- **EMA (smoothed line)** — exponential moving average, α = 0.25:
  `ema = 0.25·todayWeight + 0.75·previousEma`
- **Trend line** — least-squares linear regression over the last 28 logged days.
- **Weekly rate** = regression slope × 7. + = gaining, − = losing.

### Gaps in the record
Smoothing exists to shrug off day-to-day water. It has no business shrugging off
a fortnight. So α is **compounded over the days actually elapsed** between two
weigh-ins:
```
alpha = 1 − (1 − 0.25)^daysSinceLastWeighIn
```
A weekly weigh-in pulls seven days' worth; the first weigh-in back after two
quiet months effectively *becomes* the trend. The outlier guard scales the same
way — a 2.5% jump overnight is water, a 2.5% jump across two months is your
body, and the engine used to call the second one an outlier and keep prescribing
for a person who wasn't there any more.

A break of **14 days or more** (`GAP_DAYS`) restarts the trend line: the
regression only runs over the weigh-ins **since the last gap**, because a rate of
change measured across a silence describes nobody. On the charts the line breaks
over the quiet stretch rather than drawing straight through it; shorter holes
between weigh-ins are bridged so a normal week still reads as one line.

Implemented once in `emaStep`/`sinceLastGap` (`src/weightMath.ts`) and mirrored
in `computeEMA`/`weeklySlope` (`server/services/planEngine.ts`).

## 7. Safe-zone corridor
A ±1.5 kg band around the ideal straight line from start weight → goal weight
over your goal timeframe. On the weekly chart the band is ±0.75 kg.

## 8. Smart Adjust
```
deviation  = actualWeeklyKg − targetWeeklyKg
calorieAdj = −deviation × 7700 / 7     (capped ±500 kcal/day)
newTarget  = clamp(calorieTarget + calorieAdj, 1200, 5000)
```
If you're gaining when you mean to lose, deviation is positive → it cuts calories.

## 8b. Re-plan   `server/services/replan.ts`
Smart Adjust moves your calories. It cannot move your **date** — so a plan you've
drifted off keeps solving for the old deadline, and the pace it demands climbs
every cycle until it's asking for something no body does and no calorie target
can buy. Nothing errors, so nothing tells you.

Every `/plan/status` asks whether the plan is still a true statement:
```
safeRate = min(currentWeight × 1%,  (TDEE − BMR) × 7 / 7700)   # ≥ 0.05 kg/wk
requiredRate = |currentEMA − targetWeight| / weeksLeft
```
`safeRate` is capped by body size **and** by the BMR floor, because a pace you
could only hit by eating below your resting need isn't a pace, it's a promise the
engine will refuse to keep. It sits under the 1.5% velocity that trips Metabolic
Protection (§8) — the plan should never *prescribe* a rate the engine would flag.

If `requiredRate > safeRate` (or the target date has already passed with weight
still to go), Superdub proposes: **same goal weight, new date**, at
`weeksNeeded = ceil(kgToGo / safeRate)`. It is **offered, never applied** — one
tap accepts, and accepting goes through the ordinary goal endpoint, which keeps
the original start anchor so the journey so far stays on the chart.

A missed target date no longer marks the goal `completed`. Filing a missed goal
as complete is a comfortable lie the app then has nothing to say after; it stays
active so the re-plan can be offered instead.

## 9. Estimated intake (Progress chart)
> **This is the single source of truth for calories.** Superdub reverse-engineers
> your intake from **steps + weight-loss trend + activity** — you never have to log
> food. Food logging (the nutrition tracker) is only a *confidence heuristic*: it
> corroborates the estimate, it does not override it, and it is never scored
> "over/under" against a target. Superdub is deliberately an app that **destroys
> food logging**. The one calorie target is `targetCalories` (see §1); the estimate
> is the one verdict shown everywhere.

Back-calculated from energy balance:
```
intake ≈ TDEE + stepDeviation×kcalPerStep + (7-day EMA slope)×7700
```
The EMA slope is clamped to **±0.3 kg/day** and the whole figure to **≤ 2.5×
maintenance** before display, so a single outlier weigh-in or garbage step count
cannot inflate a day to tens of thousands of kcal. Values under 600 are hidden.
Implemented once in `estimateIntakeKcal()` (`src/energy.ts`).

## 10. XP & levels
XP is **recomputed live** from your habits' streaks (not stored):
each habit earns XP per day based on streak length (streak gates at
7/14/30/60/100/200/365 days). Levels are XP thresholds
(Rookie 0 → Beginner 100 → Novice 300 → …).

### The day streak   `src/dayStreak.ts`
Separate from per-habit streaks, and **not** a login count. A day continues the
run when at least **75%** of that day's *due* habits are done:
```
kept(day)  ⟺  done / due ≥ 0.75          due = daily habits live that day, minus 'na'
```
- Only **daily**-cadence habits count (a weekly habit isn't due every day), and
  the 'Logging into Superdub' habit is excluded — attendance is not the metric.
- `'na'` leaves the **denominator**, so a deliberate skip never counts against
  you. A day where everything due is `'na'` (or nothing was due yet) scores
  `neutral`: the walk steps over it without counting or breaking.
- **No grace day.** One day under 75% and the streak is 0. A grace day is just a
  6/7 rule in disguise.
- Today only counts once it already qualifies, so a half-finished morning never
  reads as a break.

A streak restore (the lapse protocol) works by writing `'na'` across every daily
habit on the quiet days, which turns them `neutral` — no special-casing anywhere.

---

## 11. Learned personal maintenance (TDEE)   `server/services/tdeeEstimator.ts`
The formula TDEE (BMR × activity) is a population guess. This derives your *real*
maintenance from what actually happened to your weight:
```
intake − TDEE = (Δweight_kg/day) × 7700
⇒ observedTDEE = avgDailyIntake − (weeklyEmaSlope / 7) × 7700
```
- `avgDailyIntake` = your logged calories (last 14 days) if available, else your
  prescribed target (assume adherence, at half confidence).
- The result is **blended** with the formula TDEE, trusting the observed value
  more as (a) weigh-in history grows toward 4 weeks and (b) you log real intake:
  `confidence = clamp(days/28, 0,1) × (loggedIntake ? 1 : 0.5)`.
- Clamped to ±35% of the formula so noisy early data can't run wild.

Worked: ate ~1,800/day, EMA losing 0.5 kg/wk over 3 weeks →
`observed = 1800 − (−0.5/7)×7700 = 2,350`. confidence ≈ `(21/28)×1 = 0.75` →
blended ≈ `0.75×2350 + 0.25×formula`.

## 12. Plateau / stall prediction   `server/services/plateauPredictor.ts`
A transparent additive risk score (0–1) from signals the app already collects:
- **Weight-trend deceleration** (primary): recent-10-day slope vs the prior 10
  days. Keeping <65% of your earlier pace, or going flat, adds the most weight.
- **Steps** down >15% (last 7 vs prior 7) — activity drop.
- **Energy** avg ≤ 2.6 — possible metabolic adaptation / fatigue.
- **Mood** avg ≤ 2.4 — adherence risk.
- **Logging rate** < 50% of recent days — trend getting unreliable.

Score → risk: ≥0.6 high · ≥0.35 medium · ≥0.18 low. The message names the
top contributing factor(s), so it's always actionable.

---

*Every formula above maps to code in `src/App.tsx`, `src/Diet.tsx`,
`src/XPContext.tsx`, and `server/services/`. If any number on screen doesn't
match this doc, that's a bug — flag it.*
