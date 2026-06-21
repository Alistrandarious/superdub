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
import foodlogRoutes from './routes/foodlog';
import mealplansRoutes from './routes/mealplans';
import stepsRoutes from './routes/steps';
import planRoutes from './routes/plan';
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
app.use('/api/food-log', foodlogRoutes);
app.use('/api/meal-plans', mealplansRoutes);
app.use('/api/steps', stepsRoutes);
app.use('/api/plan', planRoutes);

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
  `ALTER TABLE habits ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE`,
  // Ensure unique constraints exist for ON CONFLICT to work
  `CREATE UNIQUE INDEX IF NOT EXISTS tracker_user_day_uniq ON tracker (user_id, day)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS tracker_habits_user_day_habit_uniq ON tracker_habits (user_id, day, habit_name)`,
  // 3-state habit support: done / failed / blank
  `ALTER TABLE tracker_habits ADD COLUMN IF NOT EXISTS state TEXT`,
  `CREATE TABLE IF NOT EXISTS food_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    items JSONB NOT NULL DEFAULT '[]',
    totals JSONB NOT NULL DEFAULT '{}',
    transcript TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  // Fix possible typo from old deployment (antophic_ instead of anthropic_)
  `DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profile' AND column_name='antophic_api_key')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profile' AND column_name='anthropic_api_key')
    THEN ALTER TABLE profile RENAME COLUMN antophic_api_key TO anthropic_api_key;
    END IF;
  END $$`,
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'todo'`,
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
];
(async () => {
  for (const sql of migrations) {
    await pool.query(sql).catch((err: any) => console.error('[migrate]', err?.message, sql.slice(0, 60)));
  }
  console.log('[migrate] done');
})();

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
