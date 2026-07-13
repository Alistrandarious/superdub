import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import habitsRoutes from './routes/habits';
import trackerRoutes from './routes/tracker';
import tasksRoutes from './routes/tasks';
import dietRoutes from './routes/diet';
import weightSettingsRoutes from './routes/weightSettings';
import stepsRoutes from './routes/steps';
import planRoutes from './routes/plan';
import checkinRoutes from './routes/checkin';
import pushRoutes from './routes/push';
import goalsRoutes from './routes/goals';
import globalRoutes from './routes/global';
import journalRoutes from './routes/journal';
import friendsRoutes from './routes/friends';
import { sendPush, pushEnabled } from './services/push';
import { reminderDue, scheduleMatchesToday } from './reminderSchedule';
import { pool } from './db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/habits', habitsRoutes);
app.use('/api/tracker', trackerRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/diet', dietRoutes);
app.use('/api/weight-settings', weightSettingsRoutes);
app.use('/api/steps', stepsRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/global', globalRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/friends', friendsRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Android companion APK — served as a forced download (not rendered as binary).
// Drop the real signed build at server/public/downloads/superdub.apk to swap it.
app.get('/downloads/superdub.apk', (_req, res) => {
  const apkPath = path.join(__dirname, 'public', 'downloads', 'superdub.apk');
  if (!fs.existsSync(apkPath)) {
    res.status(404).send('APK not available yet.');
    return;
  }
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="superdub.apk"');
  fs.createReadStream(apkPath).pipe(res);
});

// DB migrations — each statement runs independently so a failure in one doesn't block others
const migrations = [
  `ALTER TABLE profile ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT`,
  `ALTER TABLE profile ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'desk'`,
  `ALTER TABLE profile ADD COLUMN IF NOT EXISTS gym_freq TEXT DEFAULT '3-4'`,
  `ALTER TABLE profile ADD COLUMN IF NOT EXISTS walk_freq TEXT DEFAULT 'moderate'`,
  `ALTER TABLE profile ADD COLUMN IF NOT EXISTS step_target INTEGER DEFAULT 10000`,
  `ALTER TABLE diet_settings ADD COLUMN IF NOT EXISTS goal TEXT DEFAULT 'cut'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`,
  // Google / social sign-in
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'password'`,
  `ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`,
  `ALTER TABLE habits ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE`,
  // Ensure unique constraints exist for ON CONFLICT to work
  `CREATE UNIQUE INDEX IF NOT EXISTS tracker_user_day_uniq ON tracker (user_id, day)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS tracker_habits_user_day_habit_uniq ON tracker_habits (user_id, day, habit_name)`,
  // 3-state habit support: done / failed / blank
  `ALTER TABLE tracker_habits ADD COLUMN IF NOT EXISTS state TEXT`,
  // Fix possible typo from old deployment (antophic_ instead of anthropic_)
  `DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profile' AND column_name='antophic_api_key')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profile' AND column_name='anthropic_api_key')
    THEN ALTER TABLE profile RENAME COLUMN antophic_api_key TO anthropic_api_key;
    END IF;
  END $$`,
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'todo'`,
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE`,
  // Per-source step provenance: keep every value per (day, source), flag the active one.
  // tracker.steps stays as a denormalized cache of the active value so charts/KPIs are untouched.
  `CREATE TABLE IF NOT EXISTS step_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('health_connect','healthkit','manual')),
    steps INTEGER NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, day, source)
  )`,
  // Activity history: one row each time a user actively interacts with the app
  // (login + heartbeat pings), so we can see how often and when they're active.
  // Evolved from the earlier login_events table — rename in place only if the new
  // table doesn't exist yet (preserves the old rows), then drop any leftover.
  `DO $$
   BEGIN
     IF to_regclass('public.activity_events') IS NULL
        AND to_regclass('public.login_events') IS NOT NULL THEN
       ALTER TABLE login_events RENAME TO activity_events;
       ALTER TABLE activity_events RENAME COLUMN logged_in_at TO occurred_at;
       ALTER INDEX IF EXISTS login_events_user_idx RENAME TO activity_events_user_idx;
     END IF;
   END $$`,
  `DROP TABLE IF EXISTS login_events`,
  `CREATE TABLE IF NOT EXISTS activity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS activity_events_user_idx ON activity_events (user_id, occurred_at DESC)`,
  `ALTER TABLE recipes ADD COLUMN IF NOT EXISTS ingredients JSONB DEFAULT '[]'`,
  `CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    image TEXT,
    calories INTEGER DEFAULT 0,
    protein REAL DEFAULT 0,
    carbs REAL DEFAULT 0,
    fat REAL DEFAULT 0,
    servings INTEGER DEFAULT 1,
    ready_in_minutes INTEGER,
    dish_types TEXT[] DEFAULT '{}',
    diets TEXT[] DEFAULT '{}',
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  // Backdate habit start_date to earliest logged activity when start_date was
  // clobbered forward (updateHabits bug that overrode NULL with today).
  // day is stored as DD/MM text — reconstruct as 2026-MM-DD date.
  `UPDATE habits h
   SET start_date = sub.min_date
   FROM (
     SELECT th.user_id, th.habit_name,
       MIN(TO_DATE(
         '2026-' ||
         LPAD(SPLIT_PART(th.day, '/', 2), 2, '0') || '-' ||
         LPAD(SPLIT_PART(th.day, '/', 1), 2, '0'),
         'YYYY-MM-DD'
       )) AS min_date
     FROM tracker_habits th
     WHERE th.done = TRUE OR th.state = 'done'
     GROUP BY th.user_id, th.habit_name
   ) sub
   WHERE h.user_id = sub.user_id
     AND h.name = sub.habit_name
     AND (h.start_date IS NULL OR h.start_date > sub.min_date)`,
  // For habits with no logged activity but whose start_date was clobbered to
  // 1-2 days after account creation (the updateHabits race on first Habits page
  // open), reset to account creation date. Skips habits added genuinely later.
  `UPDATE habits h
   SET start_date = u.created_at::DATE
   FROM users u
   WHERE h.user_id = u.id
     AND h.start_date IS NOT NULL
     AND h.start_date > u.created_at::DATE
     AND h.start_date <= u.created_at::DATE + INTERVAL '3 days'`,
  `ALTER TABLE profile ADD COLUMN IF NOT EXISTS avatar_seed TEXT`,
  // ── Year columns: day is DD/MM text, ambiguous across calendar years. Every
  // row is tagged with its year (existing data is all 2026) and all reads and
  // writes are year-scoped, so Jan 1 rollover can't collide with old rows.
  `ALTER TABLE tracker ADD COLUMN IF NOT EXISTS year INTEGER NOT NULL DEFAULT 2026`,
  `ALTER TABLE tracker_habits ADD COLUMN IF NOT EXISTS year INTEGER NOT NULL DEFAULT 2026`,
  // ── Plan engine tables ──────────────────────────────────────────────────────
  // One active weight goal per user; history kept with status != 'active'.
  `CREATE TABLE IF NOT EXISTS weight_goals (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_type   TEXT NOT NULL CHECK (goal_type IN ('lose','gain','maintain')),
    start_weight NUMERIC(6,2) NOT NULL,
    start_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    target_weight NUMERIC(6,2) NOT NULL,
    target_date DATE NOT NULL,
    rate_pct_bw NUMERIC(8,6) NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS weight_goals_one_active
    ON weight_goals (user_id) WHERE status = 'active'`,
  // Full history of calorie prescriptions; latest row = current target.
  `CREATE TABLE IF NOT EXISTS weight_plan_targets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id             UUID NOT NULL REFERENCES weight_goals(id) ON DELETE CASCADE,
    prescribed_calories INTEGER NOT NULL,
    previous_calories   INTEGER,
    reason              TEXT NOT NULL,
    effective_from      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS weight_plan_targets_user_idx
    ON weight_plan_targets (user_id, effective_from DESC)`,
  // ── Daily check-in (energy + adherence self-report) ─────────────────────────
  `CREATE TABLE IF NOT EXISTS daily_checkins (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    energy      INTEGER NOT NULL CHECK (energy BETWEEN 1 AND 5),
    adherence   TEXT NOT NULL CHECK (adherence IN ('below','about','above')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, date)
  )`,
  `CREATE INDEX IF NOT EXISTS daily_checkins_user_idx ON daily_checkins (user_id, date DESC)`,
  `ALTER TABLE daily_checkins ADD COLUMN IF NOT EXISTS mood INTEGER CHECK (mood BETWEEN 1 AND 10)`,
  // Mood moved from a compressed 1–5 to the true 1–10 the slider shows. Re-point the
  // CHECK on existing DBs (the ADD COLUMN above is a no-op once the column exists).
  // Old rows stay 1–5 — still valid under 1–10, just read low.
  `ALTER TABLE daily_checkins DROP CONSTRAINT IF EXISTS daily_checkins_mood_check`,
  `ALTER TABLE daily_checkins ADD CONSTRAINT daily_checkins_mood_check CHECK (mood IS NULL OR mood BETWEEN 1 AND 10)`,
  // One-time flags so data migrations run exactly once (a bare UPDATE in this array
  // would re-run every boot).
  `CREATE TABLE IF NOT EXISTS meta_flags (key TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())`,
  // Rescale mood rows written BEFORE the 1–10 switch (v2.369, committed 2026-07-12
  // 19:26 UTC). Those were stored compressed as round(v/2); double them back (cap 10).
  // Guarded + cut off by created_at so rows already on the 1–10 scale are untouched.
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM meta_flags WHERE key = 'mood_rescale_1to10_v1') THEN
       UPDATE daily_checkins SET mood = LEAST(mood * 2, 10)
         WHERE mood IS NOT NULL AND created_at < TIMESTAMPTZ '2026-07-12 19:26:48+00';
       INSERT INTO meta_flags (key) VALUES ('mood_rescale_1to10_v1');
     END IF;
   END $$`,
  `ALTER TABLE daily_checkins ADD COLUMN IF NOT EXISTS workout_done BOOLEAN`,
  `ALTER TABLE daily_checkins ADD COLUMN IF NOT EXISTS workout_intensity TEXT CHECK (workout_intensity IN ('light','moderate','intense','very_intense'))`,
  `ALTER TABLE daily_checkins ADD COLUMN IF NOT EXISTS workout_duration_min INTEGER CHECK (workout_duration_min > 0)`,
  `ALTER TABLE daily_checkins ADD COLUMN IF NOT EXISTS sleep_hours NUMERIC(4,1) CHECK (sleep_hours >= 0 AND sleep_hours <= 24)`,
  `ALTER TABLE daily_checkins ADD COLUMN IF NOT EXISTS sleep_bedtime TEXT`,   // 'HH:MM'
  `ALTER TABLE daily_checkins ADD COLUMN IF NOT EXISTS sleep_waketime TEXT`,  // 'HH:MM'
  `ALTER TABLE daily_checkins ADD COLUMN IF NOT EXISTS adherence_level INTEGER CHECK (adherence_level BETWEEN -2 AND 2)`,
  // The check-in split into separate time-based prompts (vitals / exercise /
  // nutrition), each writing only its own slice — so energy & adherence can no
  // longer be required at insert time.
  `ALTER TABLE daily_checkins ALTER COLUMN energy DROP NOT NULL`,
  `ALTER TABLE daily_checkins ALTER COLUMN adherence DROP NOT NULL`,
  // ── Weekly intentions (Sunday Review free-text) ──────────────────────────────
  `CREATE TABLE IF NOT EXISTS weekly_intentions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start  DATE NOT NULL,
    intention   TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, week_start)
  )`,
  // ── Web Push subscriptions ───────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint      TEXT NOT NULL UNIQUE,
    subscription  JSONB NOT NULL,
    tz_offset     INTEGER DEFAULT 0,
    last_reminded DATE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
  )`,
  // Per-user reminder hour (local 24h); defaults to 8 AM. Added post-hoc for
  // existing rows via ADD COLUMN IF NOT EXISTS.
  `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS reminder_hour INTEGER DEFAULT 8`,
  // Evening nutrition nudge (local 24h; default 8 PM) + optional exercise
  // check-in (NULL = off; user sets it to ~30 min after they finish training).
  // Each fires once/day, tracked by its own last_* date so they're independent.
  `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS nutrition_hour INTEGER DEFAULT 20`,
  `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS workout_hour INTEGER`,
  `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS last_nutrition DATE`,
  `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS last_workout DATE`,
  // Demographic / job / religion fields (optional, captured at signup + Profile).
  `ALTER TABLE profile ADD COLUMN IF NOT EXISTS occupation TEXT`,
  `ALTER TABLE profile ADD COLUMN IF NOT EXISTS ethnicity TEXT`,
  `ALTER TABLE profile ADD COLUMN IF NOT EXISTS gender_identity TEXT`,
  `ALTER TABLE profile ADD COLUMN IF NOT EXISTS country TEXT`,
  `ALTER TABLE profile ADD COLUMN IF NOT EXISTS relationship_status TEXT`,
  `ALTER TABLE profile ADD COLUMN IF NOT EXISTS religion TEXT`,
  // Suppress the "goal reached" celebration once the user has chosen "keep going".
  `ALTER TABLE weight_goals ADD COLUMN IF NOT EXISTS reached_dismissed BOOLEAN DEFAULT FALSE`,
  // Habit cadence: daily (default) | weekly | monthly | yearly | quit.
  `ALTER TABLE habits ADD COLUMN IF NOT EXISTS cadence TEXT DEFAULT 'daily'`,
  // Quit habits (abstinence timers): the moment the current clean run began.
  // Rewind resets it to now; the 30-day bar fills from here.
  `ALTER TABLE habits ADD COLUMN IF NOT EXISTS quit_started_at TIMESTAMPTZ`,
  // Starred habits surface on the Progress Today/Yesterday panels.
  `ALTER TABLE habits ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT FALSE`,
  // Optional one-off due date for a habit (any cadence).
  `ALTER TABLE habits ADD COLUMN IF NOT EXISTS due_date DATE`,
  // Optional scheduling anchor for non-daily habits — the day it runs on. Small
  // string read by cadence: weekly "<dow 0-6>", monthly "<dom 1-31>", yearly "<m>-<d>".
  `ALTER TABLE habits ADD COLUMN IF NOT EXISTS schedule TEXT`,
  // Optional per-habit push reminder: the local hour (0–23) to nudge, and the last
  // local date it fired (so it fires at most once a day per habit).
  `ALTER TABLE habits ADD COLUMN IF NOT EXISTS reminder_hour INTEGER`,
  `ALTER TABLE habits ADD COLUMN IF NOT EXISTS reminder_last_fired DATE`,
  // Personal SMART goals (Lists → Goals tab).
  `CREATE TABLE IF NOT EXISTS smart_goals (
    id          TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    specific    TEXT DEFAULT '',
    measurable  TEXT DEFAULT '',
    achievable  TEXT DEFAULT '',
    relevant    TEXT DEFAULT '',
    time_bound  DATE,
    done        BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )`,
  // Journal entries (Lists → Journal tab). Free text + an optional mood 1..5,
  // which feeds Dub's insight engine alongside check-in moods.
  `CREATE TABLE IF NOT EXISTS journal_entries (
    id          TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    mood        INTEGER CHECK (mood BETWEEN 1 AND 5),
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )`,
  // This month's community habit: one shared XP goal all users climb together.
  `CREATE TABLE IF NOT EXISTS global_months (
    month TEXT PRIMARY KEY,          -- 'YYYY-MM'
    title TEXT NOT NULL,
    goal  BIGINT NOT NULL
  )`,
  // The GLOBAL habit is now one named habit per month; correct the seeded July row
  // (was the old 500k "Community Climb") to the 10k good-deed milestone.
  `ALTER TABLE global_months ADD COLUMN IF NOT EXISTS habit TEXT`,
  `INSERT INTO global_months (month, title, goal, habit)
     VALUES ('2026-07', 'Do a good deed', 10000, 'Do a good deed today')
   ON CONFLICT (month) DO UPDATE SET title = EXCLUDED.title, goal = EXCLUDED.goal, habit = EXCLUDED.habit`,
  // Per-user, per-day XP contribution (idempotent: re-logging a day replaces it).
  `CREATE TABLE IF NOT EXISTS global_contributions (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day     DATE NOT NULL DEFAULT CURRENT_DATE,
    xp      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  )`,
  // ── Friends / social ───────────────────────────────────────────────────────
  // Phone captured for a later phone-connect flow (SMS verification not built yet).
  `ALTER TABLE profile ADD COLUMN IF NOT EXISTS phone TEXT`,
  // Global opt-out: friends may see your streaks + login activity when TRUE.
  `ALTER TABLE profile ADD COLUMN IF NOT EXISTS share_activity BOOLEAN DEFAULT TRUE`,
  // Per-habit opt-in: a habit is only visible to friends when this is TRUE.
  `ALTER TABLE habits ADD COLUMN IF NOT EXISTS shared_with_friends BOOLEAN DEFAULT FALSE`,
  `CREATE TABLE IF NOT EXISTS friendships (
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (requester_id, addressee_id),
    CHECK (requester_id <> addressee_id)
  )`,
  `CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON friendships (addressee_id, status)`,
  // Friend nudges — one row per push, drives the per-friend rate limit (4h).
  `CREATE TABLE IF NOT EXISTS friend_nudges (
    from_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sent_at  TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS friend_nudges_pair_idx ON friend_nudges (from_id, to_id, sent_at)`,
];
(async () => {
  for (const sql of migrations) {
    await pool.query(sql).catch((err: any) => console.error('[migrate]', err?.message, sql.slice(0, 60)));
  }
  console.log('[migrate] done');
})();

// ── Daily reminder pushes — runs every 30 min. Three independent nudges, each
// fires once/day at the user's chosen local hour and self-suppresses if the
// matching loop is already closed: morning weigh-in, an evening reflection
// (mood + eating), and an optional post-workout check-in.
// ponytail: daily_checkins.date is stored as server-UTC
// CURRENT_DATE, so the "already logged today" skip is off by up to a tz-day at
// the extremes — acceptable for a nudge (worst case: one redundant reminder).
// Upgrade path: store the client's local date alongside those rows.
async function runReminders() {
  if (!pushEnabled) return;
  const localHelper = (r: any) => {
    const local = new Date(Date.now() - (Number(r.tz_offset) || 0) * 60000);
    return { local, localDate: local.toISOString().slice(0, 10), hour: local.getUTCHours() };
  };
  const stamp = (col: string, id: string, localDate: string) =>
    pool.query(`UPDATE push_subscriptions SET ${col} = $2 WHERE id = $1`, [id, localDate]).catch(() => {});
  const prune = (id: string) =>
    pool.query('DELETE FROM push_subscriptions WHERE id = $1', [id]).catch(() => {});

  try {
    const { rows } = await pool.query(
      `SELECT id, user_id, subscription, tz_offset, reminder_hour,
              nutrition_hour, workout_hour, last_reminded, last_nutrition, last_workout
         FROM push_subscriptions`
    );
    for (const r of rows) {
      const { local, localDate, hour } = localHelper(r);
      const dayDDMM = `${String(local.getUTCDate()).padStart(2, '0')}/${String(local.getUTCMonth() + 1).padStart(2, '0')}`;

      // 1. Morning weigh-in — skip if they've already weighed in today (local)
      const morningHour = Number.isInteger(r.reminder_hour) ? r.reminder_hour : 8;
      if (reminderDue(morningHour, hour, r.last_reminded, localDate)) {
        const ddmm = `${String(local.getUTCDate()).padStart(2, '0')}/${String(local.getUTCMonth() + 1).padStart(2, '0')}`;
        const w = await pool.query(
          `SELECT 1 FROM tracker WHERE user_id = $1 AND day = $2 AND year = $3
             AND weight IS NOT NULL AND weight != '' AND weight::NUMERIC > 0 LIMIT 1`,
          [r.user_id, ddmm, local.getUTCFullYear()]
        ).catch(() => ({ rows: [] as any[] }));
        if (w.rows.length === 0) {
          const ok = await sendPush(r.subscription, {
            title: 'Morning from superdub 🌅',
            body: 'Quick weigh-in + how are you feeling today?',
            url: '/?prompt=weight',
            tag: 'daily-reminder',
          });
          if (!ok) { await prune(r.id); continue; }
        }
        await stamp('last_reminded', r.id, localDate);
      }

      // 2. Evening reflection — mood + eating; skip if today's check-in is already in.
      // Reuses the nutrition_hour column (default 8 PM) freed when food logging went.
      const eveningHour = Number.isInteger(r.nutrition_hour) ? r.nutrition_hour : 20;
      if (reminderDue(eveningHour, hour, r.last_nutrition, localDate)) {
        const c = await pool.query(
          'SELECT 1 FROM daily_checkins WHERE user_id = $1 AND date = $2 AND mood IS NOT NULL LIMIT 1',
          [r.user_id, localDate]
        ).catch(() => ({ rows: [] as any[] }));
        if (c.rows.length === 0) {
          const ok = await sendPush(r.subscription, {
            title: 'superdub 🌙',
            body: 'How did today feel, and how did eating land?',
            url: '/?prompt=evening',
            tag: 'evening-reminder',
          });
          if (!ok) { await prune(r.id); continue; }
        }
        await stamp('last_nutrition', r.id, localDate);
      }

      // 3. Post-workout check-in — opt-in (NULL = off); skip if already logged today
      if (reminderDue(r.workout_hour, hour, r.last_workout, localDate)) {
        const wo = await pool.query(
          'SELECT 1 FROM daily_checkins WHERE user_id = $1 AND date = $2 AND workout_done = true LIMIT 1',
          [r.user_id, localDate]
        ).catch(() => ({ rows: [] as any[] }));
        if (wo.rows.length === 0) {
          const ok = await sendPush(r.subscription, {
            title: 'superdub 💪',
            body: 'Did you close your exercise loop today?',
            url: '/?prompt=exercise',
            tag: 'workout-reminder',
          });
          if (!ok) { await prune(r.id); continue; }
        }
        await stamp('last_workout', r.id, localDate);
      }

      // 4. Per-habit reminders — each opted-in habit nudges at its own hour, at most
      // once a local day, and is skipped if it's already marked done today.
      const habitRows = await pool.query(
        `SELECT name, reminder_hour, reminder_last_fired, COALESCE(cadence, 'daily') AS cadence, schedule FROM habits
           WHERE user_id = $1 AND reminder_hour IS NOT NULL AND (archived = FALSE OR archived IS NULL)`,
        [r.user_id]
      ).catch(() => ({ rows: [] as any[] }));
      for (const h of habitRows.rows) {
        if (!reminderDue(h.reminder_hour, hour, h.reminder_last_fired, localDate)) continue;
        // A scheduled non-daily habit only nudges on its day (the day it "runs on").
        if (h.schedule && !scheduleMatchesToday(h.cadence, h.schedule, local)) continue;
        const done = await pool.query(
          `SELECT 1 FROM tracker_habits WHERE user_id = $1 AND day = $2 AND habit_name = $3
             AND state = 'done' AND year = $4 LIMIT 1`,
          [r.user_id, dayDDMM, h.name, local.getUTCFullYear()]
        ).catch(() => ({ rows: [] as any[] }));
        if (done.rows.length === 0) {
          const ok = await sendPush(r.subscription, {
            title: 'superdub ⏰',
            body: `Time for: ${h.name}`,
            url: '/',
            tag: `habit-${h.name}`,
          });
          if (!ok) { await prune(r.id); break; }
        }
        await pool.query(
          'UPDATE habits SET reminder_last_fired = $3 WHERE user_id = $1 AND name = $2',
          [r.user_id, h.name, localDate]
        ).catch(() => {});
      }
    }
  } catch (err: any) {
    console.error('[reminders]', err?.message);
  }
}
setInterval(runReminders, 30 * 60 * 1000);
runReminders();

// Serve React build in production
const buildDir = path.join(__dirname, '..', 'build');
app.use(express.static(buildDir));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(buildDir, 'index.html'));
});

// Global JSON error handler — must be last
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err?.message ?? err);
  res.status(err?.status ?? 500).json({ error: err?.message ?? 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Superdub running on http://localhost:${PORT}`);
});
