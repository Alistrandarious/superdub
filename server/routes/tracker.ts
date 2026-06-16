import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const [daysRes, habitsRes] = await Promise.all([
      pool.query('SELECT day, weight, calories, protein, carbs, fats, steps FROM tracker WHERE user_id = $1', [req.userId]),
      pool.query('SELECT day, habit_name, done FROM tracker_habits WHERE user_id = $1', [req.userId]),
    ]);
    res.json({ days: daysRes.rows, habits: habitsRes.rows });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { day, weight, calories, protein, carbs, fats, steps } = req.body;
    if (!day) return res.status(400).json({ error: 'day required' });
    // Upsert row, then only SET the fields that were actually sent
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
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/habit', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { day, habitName, done } = req.body;
    if (!day || !habitName) return res.status(400).json({ error: 'day and habitName required' });
    await pool.query(
      `INSERT INTO tracker_habits (user_id, day, habit_name, done)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, day, habit_name) DO UPDATE SET done = EXCLUDED.done`,
      [req.userId, day, habitName, !!done]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
