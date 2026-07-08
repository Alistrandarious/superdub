# Superdub Voice & Copy Guide

How Superdub talks. This governs every **user-facing** string: the mascot's lines,
coach and progress summaries, the daily prompts, card labels, buttons, and empty
states. It does **not** govern code comments.

If a string on screen breaks a rule here, that's a bug. Fix it.

---

## Rule 1 — No dashes as punctuation. This is the big one.

Superdub never uses em-dashes (`—`) or en-dashes (`–`) as sentence punctuation. They
read as AI writing. Use a period, a comma, or split into two sentences.

- ✗ `Yesterday you ate about 2,100 kcal — 640 over your target.`
- ✓ `Yesterday you ate about 2,100 kcal, 640 over your target.`
- ✗ `You're on pace — keep it up.`
- ✓ `You're on pace. Keep it up.`

Hyphens in genuine compound words are fine (`check-in`, `weigh-in`, `back-calculated`).
A hyphen `-` as a stand-in for a dash is not fine. Rewrite it.

Number **ranges** use "to", not a dash: `2 Jul to 8 Jul`, not `2–8 Jul`.

## Rule 2 — Short, plain, second person.

Talk to the user as "you". Prefer the plain word over the technical one. Superdub is a
friendly coach, not a research paper. If a sentence needs a comma-spliced clause to sound
smart, cut it.

- ✗ `Your weight velocity has exceeded the prescribed threshold.`
- ✓ `You're losing weight faster than your plan needs.`

## Rule 3 — No jargon on screen.

These words never appear in user-facing copy. Say the plain version:

| Don't say | Say |
|---|---|
| EMA / exponential moving average | your smoothed trend |
| Maintenance / TDEE / prescribed | your daily target / what your body burns |
| Weight velocity / metabolic protection | losing weight (too) fast |
| Learned maintenance | what your body actually burns |
| Implied rate | that works out to |
| Needed pace | the pace you need |

## Rule 4 — One feature, one name.

The adaptive calorie feature is called **"Adaptive Weight Plan"** everywhere. Not "Smart
Adjust", not "Adaptive plan engine", not "Weight Goal" as the feature name. (A page can
still be titled for its job, e.g. setting a goal, but the feature is the Adaptive Weight
Plan.)

## Rule 5 — No emoji in UI chrome.

Per the design system, chrome uses SVG icons, not emoji. Emoji are allowed only where
they're already established (e.g. the mascot's own expressions, notification titles).

---

## Prompts

Superdub's in-app prompts (there is no separate catalog; they live in `src/`):

- **Vitals** (`VitalsPrompt.tsx`) — morning weigh-in + sleep/energy sliders.
- **Exercise** (`ExercisePrompt.tsx`) — optional post-workout check-in.
- **Daily check-in** (`DailyCheckIn.tsx`, `EnergyCheckIn.tsx`) — mood/energy/adherence.

Prompt copy follows every rule above: a short title, one plain sentence of context, two
clear buttons. No dashes, no jargon.

_(Food logging and its evening "Nutrition" prompt were retired; intake is back-calculated
from weight trend, not logged.)_
