import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Normalise any day value to DD/MM — the format used as tracker state keys.
function dayToDDMM(day: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(day)) {
    const parts = day.slice(0, 10).split('-');
    return `${parts[2]}/${parts[1]}`;
  }
  return day.slice(0, 5); // already "DD/MM"
}

router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const [daysRes, habitsRes] = await Promise.all([
      pool.query('SELECT day, weight, calories, protein, carbs, fats, steps FROM tracker WHERE user_id = $1', [req.userId]),
      pool.query('SELECT day, habit_name, done, state FROM tracker_habits WHERE user_id = $1', [req.userId]),
    ]);
    const days = daysRes.rows.map((r: any) => ({ ...r, day: dayToDDMM(String(r.day)) }));
    const habits = habitsRes.rows.map((r: any) => ({
      day: dayToDDMM(String(r.day)),
      habit_name: r.habit_name,
      // Prefer explicit state column; fall back to done boolean for old rows
      state: (r.state as string | null) ?? (r.done ? 'done' : null),
    }));
    res.json({ days, habits });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { day: rawDay, weight, calories, protein, carbs, fats, steps } = req.body;
    if (!rawDay) return res.status(400).json({ error: 'day required' });
    const day = dayToDDMM(rawDay);
    await pool.query(
      `INSERT INTO tracker (user_id, day, weight, calories, protein, carbs, fats, steps)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, day) DO UPDATE SET
         weight    = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE tracker.weight END,
         calories  = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE tracker.calories END,
         protein   = CASE WHEN $5::text IS NOT NULL THEN $5 ELSE tracker.protein END,
         carbs     = CASE WHEN $6::text IS NOT NULL THEN $6 ELSE tracker.carbs END,
         fats      = CASE WHEN $7::text IS NOT NULL THEN $7 ELSE tracker.fats END,
         steps     = CASE WHEN $8::text IS NOT NULL THEN $8 ELSE tracker.steps END`,
      [req.userId, day,
       weight    != null ? String(weight)    : null,
       calories  != null ? String(calories)  : null,
       protein   != null ? String(protein)   : null,
       carbs     != null ? String(carbs)     : null,
       fats      != null ? String(fats)      : null,
       steps     != null ? String(steps)     : null]
    );
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[tracker PATCH]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/habit', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { day: rawDay, habitName, state } = req.body;
    if (!rawDay || !habitName) return res.status(400).json({ error: 'day and habitName required' });
    const day = dayToDDMM(rawDay);
    // state: 'done' | 'failed' | null (null = blank / remove)
    const validState = state === 'done' || state === 'failed' ? state : null;
    const done = validState === 'done';
    await pool.query(
      `INSERT INTO tracker_habits (user_id, day, habit_name, done, state)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, day, habit_name) DO UPDATE SET done = EXCLUDED.done, state = EXCLUDED.state`,
      [req.userId, day, habitName, done, validState]
    );
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[tracker/habit PATCH]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
