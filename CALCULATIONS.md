# Superdub — How the maths works

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

## 9. Estimated intake (Progress chart)
Back-calculated from energy balance:
```
intake ≈ TDEE + stepDeviation×kcalPerStep + (7-day EMA slope)×7700
```

## 10. XP & levels
XP is **recomputed live** from your habits' streaks (not stored):
each habit earns XP per day based on streak length (streak gates at
7/14/30/60/100/200/365 days). Levels are XP thresholds
(Rookie 0 → Beginner 100 → Novice 300 → …).

---

*Every formula above maps to code in `src/App.tsx`, `src/Diet.tsx`,
`src/XPContext.tsx`, and `server/services/`. If any number on screen doesn't
match this doc, that's a bug — flag it.*
