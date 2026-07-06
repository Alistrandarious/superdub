// Superdub release notes — the major updates, newest first. Dated to when they
// actually shipped. Rendered as the "What's New" timeline in the Success Kit.
export interface UpdateEntry {
  date: string;        // ISO yyyy-mm-dd
  emoji: string;
  title: string;
  summary: string;
  points: string[];
}

export const UPDATE_LOG: UpdateEntry[] = [
  {
    date: '2026-07-06',
    emoji: '🌗',
    title: 'A sleek new morning check-in: slide, slide, done',
    summary: 'The Check-in on Home is now a focused vitals prompt with sliders. Set last night\'s sleep, then mood, then energy, each sliding into place as you go.',
    points: [
      'Tap Check-in and you get a clean pop-up: a sleep slider from 4 to 12 hours, then mood and energy on 1 to 10 sliders that appear one after another so it never feels busy.',
      'It saves just those vitals without touching anything else you have logged that day.',
      'This is the first of the split, time-based prompts. Focused exercise and evening nutrition pop-ups are next.',
    ],
  },
  {
    date: '2026-07-06',
    emoji: '🗓️',
    title: 'Nicer due dates on Lists, and they finally stick',
    summary: 'The clunky date box on Lists is gone. Add a task, then tap the calendar to pick a due date from a tidy dropdown, and it now saves properly and rides under the task.',
    points: [
      'Add a task, then tap the calendar button to set a due date from a dropdown of quick picks (Today, Tomorrow, Next week) or a date of your choice, instead of the raw date box that sat awkwardly in the row.',
      'Due dates now actually save: before they vanished on refresh, now they stick and show under the task, turning red when overdue.',
      'Log Steps dropped its separate date field, since the calendar already picks the day. The Steps box now shows which day you are logging.',
    ],
  },
  {
    date: '2026-07-06',
    emoji: '📅',
    title: 'A Yesterday tab that grades your day, with Today on the way',
    summary: 'The first Progress tab is now Yesterday: your closing numbers for the day just gone, at a glance. A new Today tab is coming soon and will show live targets.',
    points: [
      'New Yesterday tab: calories eaten versus target, steps taken, sleep and mood, and how many habits you closed, all in one glance at how the day actually went.',
      'A Today tab now sits next to it, holding the spot for live daily targets. It says coming soon for now.',
      'Dub still gives you the plain-English verdict on yesterday at the top of the tab.',
    ],
  },
  {
    date: '2026-07-06',
    emoji: '🩹',
    title: 'Fixed the blank Progress charts, plus a tidier menu',
    summary: 'The Progress charts were rendering as empty boxes after the height-lock change. They fill their space properly again, and the settings menu got a cleanup with more quick-log options.',
    points: [
      'Fixed the Progress charts showing up blank: they now fill the locked height correctly instead of collapsing to nothing.',
      'Quick log in the menu now covers everything you can track by hand: weight, steps, check-in, and food and calories.',
      'Menu cleanup: removed the old Tracker shortcut, moved Personalise into Settings, and tucked The Maths under About Superdub.',
      'Dub is a touch bigger at the top of each Progress tab, because he was feeling left out.',
    ],
  },
  {
    date: '2026-07-06',
    emoji: '🔒',
    title: 'Progress pages are height-locked, with Dub talking up top',
    summary: 'Every Progress tab now fits one screen with no scrolling. Dub gives you a line at the top of each tab (tap him for the full read), and the chart fills all the space below it.',
    points: [
      'No more scrolling on the Progress tabs: each one is locked to a single screen, so the chart stretches as tall as it can instead of leaving gaps.',
      'Dub sits at the top of every tab with a short read on what you are looking at. Tap him and he opens the full coaching breakdown.',
      'Swiping left or right on the chart itself now flips to the next tab, so you can move through Today, Weight, Steps and the rest without reaching for the chips.',
      'Tap a point on a chart to see its details; the tooltip stays put so you can actually read it.',
    ],
  },
  {
    date: '2026-07-06',
    emoji: '📐',
    title: 'Progress tab: taller charts, forward targets, sleep and mood together',
    summary: 'Every Progress chart now fills a taller uniform canvas so tabs no longer jump, the Today gauges point at what to hit next, the verdict reads yesterday back to you, and Sleep and Mood share one panel.',
    points: [
      'All Progress charts share one taller height, so switching between Today, Weight, Steps and the rest no longer shifts the layout, and the graphs use the full screen instead of leaving dead space.',
      'The Today matrix is now forward-looking: Activity shows the steps you still need to hit today\'s target, and Vitals recommends how many hours to aim for tonight to steady tomorrow\'s energy.',
      'Dub\'s verdict up top is a clean retrospective read on yesterday: what you ate versus target, your safe-zone status, and the week\'s change.',
      'Sleep and Mood moved onto a single panel, stacked on a shared date axis so you can see how last night\'s rest and the next day\'s mood track together.',
    ],
  },
  {
    date: '2026-07-06',
    emoji: '🎯',
    title: 'The Today tab is now a Live Target Matrix',
    summary: 'The Progress "Today" view is rebuilt: a plain-text read from Dub up top, then a fixed four-gauge matrix of live pace and buffers, with the chart chips moved underneath and the pager dots gone.',
    points: [
      'New Live Target Matrix: four live gauges in a fixed 2x2 grid. Intake shows your calorie runway as a ring (and flashes a critical buffer if you go over), Activity tracks your steps against where you should be by now, Vitals reads last night\'s sleep and predicts your afternoon energy, and Focus surfaces the one habit still open today (tap it to tick it).',
      'Dub\'s verdict is now plain text at the top of Today, a live read on where you stand right now rather than a boxed number.',
      'The chart chips (Today, Weight, Habits and the rest) moved directly under the visualization, and the little pagination dots are gone. Tap a chip to switch instantly.',
      'The Today matrix is locked to the same width as the trend charts, so moving between them no longer shifts the layout.',
    ],
  },
  {
    date: '2026-07-06',
    emoji: '🔔',
    title: 'Reminders that fit your day, and a Core Habits matrix',
    summary: 'Notifications now cover the whole loop (morning, evening, and an optional post-workout nudge), and The Ascension shows your four daily loops as tokens that light up gold as you close them.',
    points: [
      'Notifications settings now let you pick three separate times: a morning weigh-in, an evening nutrition check, and (optional) a post-workout "did you close your exercise loop?" nudge. Each one stays quiet if you have already logged that thing.',
      'Tapping a reminder drops you straight into the right place: the weigh-in opens the morning check-in, the workout nudge opens your daily ritual, and the nutrition one opens Food Log.',
      'New Core Habits matrix on The Ascension, under your level ring: four tokens (Weight, Sleep and Energy, Steps, Calories) that light gold the moment you close each loop for the day.',
      'The morning check-in now opens with a simple "Did you weigh yourself?" Yes or No, so a quiet no just stops the nagging for the day instead of sitting in your way.',
    ],
  },
  {
    date: '2026-07-06',
    emoji: '😴',
    title: 'Sleep as candlesticks, plus fixes across the app',
    summary: 'Your nights now read as bed-to-wake candles coloured by your morning mood, and a batch of fixes lands across Habits, Progress, Steps and Profile.',
    points: [
      'New sleep chart: each night is a candle whose body runs from when you went to bed to when you woke, so its length is the time you actually slept. The colour is that morning\'s mood (green good, red rough), so you can see how sleep and mood move together.',
      'Habits: double-tap a day circle to mark it as a miss (a single tap still marks it done), and your XP and level ring now update the instant you tick a habit.',
      'Log Steps: a month calendar (green for logged days, red for missed) that stays open, so you can fill several days in one go.',
      'Progress: one swipe now moves exactly one chart, and the Today panel sits full-height without scrolling.',
      'Fixes: the water ring tilts the correct way now, The Maths no longer runs off the side of the screen, and the Plan section on Profile no longer spills over the edge.',
    ],
  },
  {
    date: '2026-07-06',
    emoji: '🎠',
    title: 'Daily Log, swipeable charts & a fuller ring',
    summary: 'A vitals strip that reinforces your daily logging, a swipe-through chart carousel with Dub\'s read on each, and a liquid ring that fills the whole disc.',
    points: [
      'New "Daily Log" strip at the top of Habits: weigh-in, steps and check-in chips that tick green as you log, plus a logging streak to keep the data flowing.',
      'Progress charts are now a swipeable carousel — one full-width chart at a time with Dub\'s interpretation underneath, instead of an endless scroll.',
      'Liquid ring themes now fill the entire disc (no separate ring) — the water level alone shows your progress.',
      'Fixed the daily check-in running off the top of the screen — it scrolls neatly within the sheet now.',
    ],
  },
  {
    date: '2026-07-05',
    emoji: '🌙',
    title: 'Your daily ritual, sleep, and a sharper look',
    summary: 'A morning ritual with a sleep slider, a new Progress hero that leads with the number that matters, and a top-to-bottom design pass.',
    points: [
      'New "Yesterday\'s Verdict" hero at the top of Progress: your estimated intake vs target at a glance, with an under/over chip, safe-zone status, and this week\'s weight change.',
      'The daily check-in is now a proper ritual — add a sleep slider and an optional morning weigh-in without leaving the screen.',
      'Sleep is saved and charted: a new graph on Progress with an 8-hour reference line, so you can see rest against everything else.',
      'One consistent colour language app-wide — green for the body, blue for growth, gold reserved for XP — no more mismatched accents.',
      'The Level page was rebuilt into "The Ascension": a gold identity, a level ladder, and a cleaner cosmetics shelf, with emoji removed from the app\'s chrome.',
      'Fixed the weight axis (now on the left), the personalise header, and smoothed the liquid ring fill.',
    ],
  },
  {
    date: '2026-07-03',
    emoji: '📐',
    title: 'Honest maths & the Liquid ring',
    summary: 'A full audit of every calculation in the app, a new page that shows you the formulas, and a liquid ring theme that moves when you do.',
    points: [
      'Dub now quotes your real weekly change — first and last weigh-in of the week, both numbers shown, so you can check him against the chart.',
      'New "The Maths" page in the cog menu: every formula written out with worked examples, straight from the code.',
      'One unified step-burn formula everywhere (three pages used to disagree), sex-aware calorie maths, and the safe-zone corridor no longer skips its first day.',
      'Editing your Weight Plan no longer resets your start date — your corridor progress is safe.',
      'New Liquid ring theme at level 5: a water fill that rises with your XP and sloshes when you tilt your phone.',
      'Macros are gone — Superdub is calories-first now. Simpler logging, same results.',
    ],
  },
  {
    date: '2026-06-29',
    emoji: '🐶',
    title: 'Meet Dub, your coach',
    summary: 'Superdub got a companion — a little robotic Yorkie who reads your data and coaches you in plain English.',
    points: [
      'Dub gives you an honest read after every weigh-in: a win to protect, what\'s slipping, and one tiny next step.',
      'He sits by your level ring and at the top of Progress, rating how you\'re trending over time.',
      'When momentum stalls, Dub asks to be taken for a walk — a nudge to just move today.',
      'Reach level 2 and you can switch Dub from a dog to a cat. More to unlock as you climb.',
    ],
  },
  {
    date: '2026-06-28',
    emoji: '🔐',
    title: 'Sign in with Google',
    summary: 'Create your account or log in with one tap using Google — no password to remember.',
    points: [
      'New Google users still get the full onboarding so your targets stay personalised.',
      'Your identity is always verified securely on our server.',
    ],
  },
  {
    date: '2026-06-28',
    emoji: '📚',
    title: 'The Success Kit',
    summary: 'A new home for guides, recommended books and original Superdub articles to help you build habits and reach your goals.',
    points: [
      'Original reads on habits, habit tracking, goal setting and daily weighing.',
      'Hand-picked book recommendations across focus, discipline, weight and health.',
      'Every page now has one unified menu (the cog) — settings, navigation and quick-logging in one place.',
    ],
  },
  {
    date: '2026-06-28',
    emoji: '⭐',
    title: 'Levels, rewards & ring themes',
    summary: 'Your XP now means something. A proper level system with meaningful titles, a reward at every level, and unlockable cosmetics.',
    points: [
      'Fifteen levels from "First Day" to "Transcendent", each granting a named reward.',
      'Unlockable level-ring themes — equip the one you\'ve earned.',
      'A full-screen celebration when you level up.',
      'A Duolingo-style day-streak flame in the header to keep your run alive.',
    ],
  },
  {
    date: '2026-06-28',
    emoji: '✅',
    title: 'Habit cards, reimagined',
    summary: 'The whole habit experience was rebuilt — cleaner, more informative, and more satisfying to tick.',
    points: [
      'Collapsible cards: a clean summary that expands into stats, streaks and history.',
      'A persistent habit level that grows with total days — it never resets on a miss.',
      'Missed due days now auto-mark as failed so your week tells the truth.',
      'A redesigned stat panel with your earned title, level, streak and XP.',
    ],
  },
  {
    date: '2026-06-28',
    emoji: '🗂️',
    title: 'Archived habits & easier weigh-ins',
    summary: 'Archive habits to a dedicated screen, restore them any time, or delete them for good — plus a faster way to log your weight.',
    points: [
      'A proper Archived Habits screen with restore and permanent-delete.',
      'Weigh-ins are now tap-to-type, pre-filled with your last weight.',
    ],
  },
  {
    date: '2026-06-25',
    emoji: '📈',
    title: 'Progress charts overhaul',
    summary: 'Weight and habits split into their own charts, with smoother panning and a clearer view of where you\'re heading.',
    points: [
      'Separate Weight Trend and Habits charts on Progress.',
      'Drag the chart directly to pan through time windows.',
      'A forward projection line shows where your current pace is taking you.',
    ],
  },
];
