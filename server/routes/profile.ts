import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT name, height_cm, weight_kg, age, sex, activity, steps, vest_kg FROM profile WHERE user_id = $1',
      [req.userId]
    );
    if (!rows[0]) return res.json({});
    const r = rows[0];
    res.json({
      name: r.name ?? '',
      heightCm: r.height_cm ?? '',
      weightKg: r.weight_kg ?? '',
      age: r.age ?? '',
      sex: r.sex ?? 'male',
      activity: r.activity ?? '1.55',
      steps: r.steps ?? '',
      vestKg: r.vest_kg ?? '',
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { name, heightCm, weightKg, age, sex, activity, steps, vestKg } = req.body;
    await pool.query(
      `UPDATE profile SET name=$2, height_cm=$3, weight_kg=$4, age=$5, sex=$6, activity=$7, steps=$8, vest_kg=$9
       WHERE user_id=$1`,
      [req.userId, name ?? '', heightCm ?? '', weightKg ?? '', age ?? '', sex ?? 'male', activity ?? '1.55', steps ?? '', vestKg ?? '']
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
