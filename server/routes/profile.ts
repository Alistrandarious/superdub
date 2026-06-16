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
      'SELECT name, dob, height_cm, weight_kg, age, sex, activity, steps, vest_kg, job_type, gym_freq, walk_freq FROM profile WHERE user_id = $1',
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
      jobType: r.job_type ?? 'desk',
      gymFreq: r.gym_freq ?? '3-4',
      walkFreq: r.walk_freq ?? 'moderate',
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { name, dob, heightCm, weightKg, sex, activity, steps, vestKg, jobType, gymFreq, walkFreq } = req.body;
    const age = ageFromDob(dob || null);
    await pool.query(
      `UPDATE profile SET name=$2, dob=$3, height_cm=$4, weight_kg=$5, age=$6, sex=$7, activity=$8, steps=$9, vest_kg=$10,
         job_type=$11, gym_freq=$12, walk_freq=$13
       WHERE user_id=$1`,
      [req.userId, name ?? '', dob || null, heightCm ?? '', weightKg ?? '', age, sex ?? 'male', activity ?? '1.55', steps ?? '', vestKg ?? '',
       jobType ?? 'desk', gymFreq ?? '3-4', walkFreq ?? 'moderate']
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/profile — permanently deletes the user and all their data (cascades via FK)
router.delete('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.userId]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /ai-key — returns whether key is set + masked value
router.get('/ai-key', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT anthropic_api_key FROM profile WHERE user_id = $1', [req.userId]);
    const key: string | null = rows[0]?.anthropic_api_key ?? null;
    res.json({ hasKey: !!key, masked: key ? `sk-ant-…${key.slice(-4)}` : null });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /ai-key — store or clear the user's Anthropic API key
router.put('/ai-key', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { key } = req.body as { key: string };
    await pool.query('UPDATE profile SET anthropic_api_key = $1 WHERE user_id = $2', [key?.trim() || null, req.userId]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
