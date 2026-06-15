import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT name FROM habits WHERE user_id = $1 ORDER BY position',
      [req.userId]
    );
    res.json(rows.map((r: any) => r.name));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { habits } = req.body as { habits: string[] };

    // Clean up tracker_habits for removed habits
    const currentRes = await pool.query('SELECT name FROM habits WHERE user_id = $1', [req.userId]);
    const currentNames = new Set(currentRes.rows.map((r: any) => r.name));
    const removed = [...currentNames].filter(n => !new Set(habits).has(n));
    if (removed.length > 0) {
      await pool.query(
        'DELETE FROM tracker_habits WHERE user_id = $1 AND habit_name = ANY($2::text[])',
        [req.userId, removed]
      );
    }

    await pool.query('DELETE FROM habits WHERE user_id = $1', [req.userId]);
    for (let i = 0; i < habits.length; i++) {
      await pool.query(
        'INSERT INTO habits (user_id, name, position) VALUES ($1, $2, $3)',
        [req.userId, habits[i], i]
      );
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
