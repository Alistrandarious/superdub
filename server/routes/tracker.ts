import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

function dayToDDMM(day: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(day)) {
    const parts = day.slice(0, 10).split('-');
    return `${parts[2]}/${parts[1]}`;
  }
  return day.slice(0, 5);
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
      state: (r.state as string | null) ?? (r.done ? 'done' : null),
    }));
    res.json({ days, habits });
  } catch (err: any) {
    console.error('[tracker GET]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { day: rawDay, weight, calories, protein, carbs, fats, steps } = req.body;
    if (!rawDay) return res.status(400).json({ error: 'day required' });
    const day = dayToDDMM(rawDay);
    const w  = weight    != null ? String(weight)    : null;
    const c  = calories  != null ? String(calories)  : null;
    const p  = protein   != null ? String(protein)   : null;
    const ca = carbs     != null ? String(carbs)     : null;
    const f  = fats      != null ? String(fats)      : null;
    const s  = steps     != null ? String(steps)     : null;

    // UPDATE-then-INSERT: avoids ON CONFLICT which requires a unique constraint.
    // Single user writes are sequential so the race window is irrelevant.
    const upd = await pool.query(
      `UPDATE tracker SET
         weight   = CASE WHEN $3::text IS NOT NULL THEN $3  ELSE weight   END,
         calories = CASE WHEN $4::text IS NOT NULL THEN $4  ELSE calories END,
         protein  = CASE WHEN $5::text IS NOT NULL THEN $5  ELSE protein  END,
         carbs    = CASE WHEN $6::text IS NOT NULL THEN $6  ELSE carbs    END,
         fats     = CASE WHEN $7::text IS NOT NULL THEN $7  ELSE fats     END,
         steps    = CASE WHEN $8::text IS NOT NULL THEN $8  ELSE steps    END
       WHERE user_id = $1 AND day = $2`,
      [req.userId, day, w, c, p, ca, f, s]
    );
    if ((upd.rowCount ?? 0) === 0) {
      await pool.query(
        `INSERT INTO tracker (user_id, day, weight, calories, protein, carbs, fats, steps)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [req.userId, day, w, c, p, ca, f, s]
      );
    }
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
    const validState = state === 'done' || state === 'failed' ? state : null;
    const done = validState === 'done';

    const upd = await pool.query(
      `UPDATE tracker_habits SET done = $4, state = $5
       WHERE user_id = $1 AND day = $2 AND habit_name = $3`,
      [req.userId, day, habitName, done, validState]
    );
    if ((upd.rowCount ?? 0) === 0) {
      await pool.query(
        `INSERT INTO tracker_habits (user_id, day, habit_name, done, state)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.userId, day, habitName, done, validState]
      );
    }
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[tracker/habit PATCH]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
