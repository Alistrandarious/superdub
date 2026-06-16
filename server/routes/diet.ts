import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Target
router.get('/target', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT calories, protein, carbs, fats FROM diet_target WHERE user_id = $1',
      [req.userId]
    );
    res.json(rows[0] ?? { calories: 2003, protein: 150, carbs: 200, fats: 67 });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/target', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { calories, protein, carbs, fats } = req.body;
    await pool.query(
      `INSERT INTO diet_target (user_id, calories, protein, carbs, fats)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         calories = EXCLUDED.calories, protein = EXCLUDED.protein,
         carbs = EXCLUDED.carbs, fats = EXCLUDED.fats`,
      [req.userId, calories ?? 2003, protein ?? 150, carbs ?? 200, fats ?? 67]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Settings (macro locks)
router.get('/settings', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT lock_protein, lock_carbs, lock_fats, calorie_lock, goal FROM diet_settings WHERE user_id = $1',
      [req.userId]
    );
    if (!rows[0]) return res.json({ lockProtein: false, lockCarbs: false, lockFats: false, calorieLock: false, goal: 'cut' });
    const r = rows[0];
    res.json({ lockProtein: r.lock_protein, lockCarbs: r.lock_carbs, lockFats: r.lock_fats, calorieLock: r.calorie_lock, goal: r.goal ?? 'cut' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/settings', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { lockProtein, lockCarbs, lockFats, calorieLock, goal } = req.body;
    await pool.query(
      `INSERT INTO diet_settings (user_id, lock_protein, lock_carbs, lock_fats, calorie_lock, goal)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         lock_protein = EXCLUDED.lock_protein, lock_carbs = EXCLUDED.lock_carbs,
         lock_fats = EXCLUDED.lock_fats, calorie_lock = EXCLUDED.calorie_lock,
         goal = EXCLUDED.goal`,
      [req.userId, !!lockProtein, !!lockCarbs, !!lockFats, !!calorieLock, goal ?? 'cut']
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Plans
router.get('/plans', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, label, meals, totals FROM diet_plans WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/plans', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { id, label, meals, totals } = req.body;
    await pool.query(
      'INSERT INTO diet_plans (id, user_id, label, meals, totals) VALUES ($1, $2, $3, $4, $5)',
      [id, req.userId, label, JSON.stringify(meals), JSON.stringify(totals)]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/plans/:id', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { label } = req.body as { label: string };
    if (!label || typeof label !== 'string') return res.status(400).json({ error: 'label required' });
    await pool.query(
      'UPDATE diet_plans SET label = $1 WHERE id = $2 AND user_id = $3',
      [label.trim().slice(0, 80), req.params.id, req.userId]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/plans/:id', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM diet_plans WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
