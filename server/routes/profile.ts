import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

function ageFromDob(dob: string | null): string {
  if (!dob) return '';
  const born = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const m = today.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < born.getDate())) age--;
  return String(Math.max(0, age));
}

router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT name, dob, height_cm, weight_kg, age, sex, activity, steps, vest_kg FROM profile WHERE user_id = $1',
      [req.userId]
    );
    if (!rows[0]) return res.json({});
    const r = rows[0];
    const dobStr = r.dob ? new Date(r.dob).toISOString().split('T')[0] : '';
    res.json({
      name: r.name ?? '',
      dob: dobStr,
      heightCm: r.height_cm ?? '',
      weightKg: r.weight_kg ?? '',
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
    const { name, dob, heightCm, weightKg, sex, activity, steps, vestKg } = req.body;
    const age = ageFromDob(dob || null);
    await pool.query(
      `UPDATE profile SET name=$2, dob=$3, height_cm=$4, weight_kg=$5, age=$6, sex=$7, activity=$8, steps=$9, vest_kg=$10
       WHERE user_id=$1`,
      [req.userId, name ?? '', dob || null, heightCm ?? '', weightKg ?? '', age, sex ?? 'male', activity ?? '1.55', steps ?? '', vestKg ?? '']
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
