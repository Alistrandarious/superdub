import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
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

app.get('/api/health', (_req, res) => res.json({ ok: true }));

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
  // Login history: one row per successful login, so we can see how many times
  // and at what time each user logged in (users.last_login_at only keeps the latest).
  `CREATE TABLE IF NOT EXISTS login_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    logged_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS login_events_user_idx ON login_events (user_id, logged_in_at DESC)`,
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
];
(async () => {
  for (const sql of migrations) {
    await pool.query(sql).catch(err => console.error('[migrate]', err?.message, sql.slice(0, 60)));
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
