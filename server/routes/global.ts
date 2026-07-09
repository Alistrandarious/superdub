import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// This month's community habit: every Superdubber's daily XP feeds one shared
// total. Contributions are stored per user per day and are idempotent — logging
// again the same day replaces that day's number, so nobody double-counts.

const currentMonth = (): string => new Date().toISOString().slice(0, 7); // YYYY-MM

// Default theme + goal for a month that has not been seeded yet.
function defaultFor(_month: string): { title: string; goal: number } {
  return { title: 'The Community Climb', goal: 500000 };
}

async function ensureMonth(month: string): Promise<{ title: string; goal: number }> {
  const { rows } = await pool.query('SELECT title, goal FROM global_months WHERE month = $1', [month]);
  if (rows.length > 0) return { title: rows[0].title, goal: Number(rows[0].goal) };
  const d = defaultFor(month);
  await pool.query(
    'INSERT INTO global_months (month, title, goal) VALUES ($1, $2, $3) ON CONFLICT (month) DO NOTHING',
    [month, d.title, d.goal]
  );
  return d;
}

// GET / — this month's community habit + collective progress.
router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const month = currentMonth();
    const { title, goal } = await ensureMonth(month);
    const agg = await pool.query(
      `SELECT COALESCE(SUM(xp), 0) AS total, COUNT(DISTINCT user_id) AS contributors
         FROM global_contributions WHERE to_char(day, 'YYYY-MM') = $1`,
      [month]
    );
    const mine = await pool.query(
      `SELECT COALESCE(SUM(xp), 0) AS mine
         FROM global_contributions WHERE user_id = $1 AND to_char(day, 'YYYY-MM') = $2`,
      [req.userId, month]
    );
    res.json({
      month, title, goal,
      total: Number(agg.rows[0].total),
      contributors: Number(agg.rows[0].contributors),
      mine: Number(mine.rows[0].mine),
    });
  } catch (err: any) {
    console.error('[global GET]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /contribute { xp } — record TODAY's XP for this user (idempotent per day).
router.post('/contribute', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const raw = Math.round(Number((req.body as { xp?: number })?.xp));
    const xp = Number.isFinite(raw) ? Math.max(0, Math.min(100000, raw)) : 0;
    await pool.query(
      `INSERT INTO global_contributions (user_id, day, xp) VALUES ($1, CURRENT_DATE, $2)
       ON CONFLICT (user_id, day) DO UPDATE SET xp = EXCLUDED.xp`,
      [req.userId, xp]
    );
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[global contribute]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
