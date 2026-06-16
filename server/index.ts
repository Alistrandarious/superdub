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
