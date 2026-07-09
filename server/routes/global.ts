import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// The GLOBAL habit: one shared, single habit for the whole community each month.
// Every user levels it up personally (their day-count → level → XP-per-completion,
// mirroring the per-habit ladder in src/levels.ts) but all that XP feeds ONE shared
// monthly total. Contributions are stored per user per day and are idempotent —
// logging again the same day replaces that day's number, so nobody double-counts.

const currentMonth = (): string => new Date().toISOString().slice(0, 7); // YYYY-MM

interface MonthDef { title: string; goal: number; habit: string }

// The monthly habit table — edit this to schedule future months. First month's
// 10k goal is the milestone that unlocks the white "Aurora" dub colour.
const MONTHLY: Record<string, MonthDef> = {
  '2026-07': { title: 'Do a good deed', goal: 10000, habit: 'Do a good deed today' },
};
const FALLBACK: MonthDef = { title: 'The Community Climb', goal: 10000, habit: 'Do a good deed today' };

const defaultFor = (month: string): MonthDef => MONTHLY[month] ?? FALLBACK;

async function ensureMonth(month: string): Promise<MonthDef> {
  const { rows } = await pool.query('SELECT title, goal, habit FROM global_months WHERE month = $1', [month]);
  if (rows.length > 0 && rows[0].habit) return { title: rows[0].title, goal: Number(rows[0].goal), habit: rows[0].habit };
  const d = defaultFor(month);
  await pool.query(
    `INSERT INTO global_months (month, title, goal, habit) VALUES ($1, $2, $3, $4)
     ON CONFLICT (month) DO UPDATE SET title = EXCLUDED.title, goal = EXCLUDED.goal, habit = EXCLUDED.habit`,
    [month, d.title, d.goal, d.habit]
  );
  return d;
}

// GET / — this month's community habit + collective progress.
router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const month = currentMonth();
    const { title, goal, habit } = await ensureMonth(month);
    const agg = await pool.query(
      `SELECT COALESCE(SUM(xp), 0) AS total, COUNT(DISTINCT user_id) AS contributors
         FROM global_contributions WHERE to_char(day, 'YYYY-MM') = $1`,
      [month]
    );
    // mine = this month's XP (goal bar + the ≥100 white-unlock gate).
    // myDays = all-time days this user has done the deed (drives their personal level
    // "over time"). doneToday = whether they've already logged today.
    const mine = await pool.query(
      `SELECT COALESCE(SUM(xp), 0) AS mine
         FROM global_contributions WHERE user_id = $1 AND to_char(day, 'YYYY-MM') = $2`,
      [req.userId, month]
    );
    const days = await pool.query(
      `SELECT COUNT(*) AS days,
              COUNT(*) FILTER (WHERE day = CURRENT_DATE) > 0 AS done_today
         FROM global_contributions WHERE user_id = $1`,
      [req.userId]
    );
    res.json({
      month, title, goal, habit,
      total: Number(agg.rows[0].total),
      contributors: Number(agg.rows[0].contributors),
      mine: Number(mine.rows[0].mine),
      myDays: Number(days.rows[0].days),
      doneToday: days.rows[0].done_today === true,
    });
  } catch (err: any) {
    console.error('[global GET]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /contribute { xp } — record TODAY's XP for this user (idempotent per day).
// ponytail: XP is computed client-side (rate for the user's level) and trusted here,
// matching the existing low-stakes model; the 0..100000 clamp is the only guard.
// Upgrade path if it ever matters: derive the rate server-side from the day-count.
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

// POST /uncontribute — undo TODAY's deed for this user (the toggle-off path).
// Removes today's row so the shared total, myDays and doneToday all reflect it.
router.post('/uncontribute', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      `DELETE FROM global_contributions WHERE user_id = $1 AND day = CURRENT_DATE`,
      [req.userId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[global uncontribute]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
