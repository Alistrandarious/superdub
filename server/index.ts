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

// DB migrations — safe to run on every startup
pool.query(`
  ALTER TABLE profile ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT;
  CREATE TABLE IF NOT EXISTS food_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    items JSONB NOT NULL DEFAULT '[]',
    totals JSONB NOT NULL DEFAULT '{}',
    transcript TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`).catch(err => console.error('[migrate]', err?.message));

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
