import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT current_weight, goal_weight, loss_per_week, time_days, height, age, activity_level FROM weight_settings WHERE user_id = $1',
      [req.userId]
    );
    if (!rows[0]) return res.json({});
    const r = rows[0];
    res.json({
      currentWeight: r.current_weight ?? '',
      goalWeight: r.goal_weight ?? '',
      lossPerWeek: r.loss_per_week ?? '',
      timeDays: r.time_days ?? '',
      height: r.height ?? '',
      age: r.age ?? '',
      activityLevel: r.activity_level ?? '1.4',
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { currentWeight, goalWeight, lossPerWeek, timeDays, height, age, activityLevel } = req.body;
    await pool.query(
      `INSERT INTO weight_settings (user_id, current_weight, goal_weight, loss_per_week, time_days, height, age, activity_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET
         current_weight = EXCLUDED.current_weight, goal_weight = EXCLUDED.goal_weight,
         loss_per_week = EXCLUDED.loss_per_week, time_days = EXCLUDED.time_days,
         height = EXCLUDED.height, age = EXCLUDED.age, activity_level = EXCLUDED.activity_level`,
      [req.userId, currentWeight ?? '', goalWeight ?? '', lossPerWeek ?? '', timeDays ?? '', height ?? '', age ?? '', activityLevel ?? '1.4']
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
