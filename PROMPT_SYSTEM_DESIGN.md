# Superdub — Prompt-Based Check-in System Design

## 1. Morning Check-In Flow (First Login)

- **Weight Prompt (Dub):** "Did you weigh yourself this morning? (Before breakfast, after toilet)"
  - `[ Yes ]` -> Show sleek single-input. Ticks the weight pill on the Home Page.
  - `[ No ]` -> "No worries, we'll try again tomorrow." Hides prompt to prevent fatigue.
- **Vitals Prompt:**
  - **Sleep:** Horizontal range slider ($x$ hours, bounded 4–12).
  - **Mood & Energy:** Minimalist 1–10 slider/taps that slide into place sequentially.

## 2. Contextual Exercise Prompt

- **One-Time Setup:** "When do you usually hit your workouts? (e.g., 6:00 PM)"
- **Trigger:** Backend schedules a native Capacitor push notification 30 mins after that window closes.
- **Action:** "Did you close your exercise loop today?" `[ Yes ]` / `[ No ]`. One tap sync.

## 3. Evening Nutrition Prompt

- **Trigger:** Notification at 8:00 PM.
- **UI:** "Eating Today vs Target" progress circle. Simple `[ Log Quick Calories ]` overlay.

## 4. Profile "Core Habits" Matrix Widget

- Sits underneath the level ring and XP bar.
- 4 distinct token slots (Violet & Gold) that illuminate when a core tracking loop is completed for the day:
  1. Weight Pill
  2. Sleep/Energy Pill
  3. Steps Sync Pill (Fix: Widget must query `GET /api/steps/today` on render)
  4. Calorie Target Pill

## 5. Design & Interaction Constraints

- **Color Accent Rules:** Strict adherence to your Gold (`XP`) and Violet (`Rank`) token system. Prompts and activated slots use these exact hexes from `DESIGN_SYSTEM.md`.
- **Touch Targets:** Minimal 44px interactive surfaces for the sliders, checkboxes, and buttons to guarantee easy native tap tracking on mobile via Capacitor.
- **Micro-Transitions:** Use `framer-motion` (or standard CSS transitions) to ensure step 1 transitions seamlessly into step 2 without structural page shifts. Keep cognitive load low.
