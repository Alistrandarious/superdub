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
    const [profileRes, userRes] = await Promise.all([
      pool.query(
        'SELECT name, dob, height_cm, weight_kg, age, sex, activity, steps, vest_kg, job_type, gym_freq, walk_freq, step_target FROM profile WHERE user_id = $1',
        [req.userId]
      ),
      pool.query('SELECT created_at FROM users WHERE id = $1', [req.userId]),
    ]);
    const accountCreatedAt = userRes.rows[0]?.created_at ?? null;
    if (!profileRes.rows[0]) return res.json({ accountCreatedAt });
    const r = profileRes.rows[0];
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
      stepTarget: r.step_target ?? 10000,
      accountCreatedAt,
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { name, dob, heightCm, weightKg, sex, activity, steps, vestKg, jobType, gymFreq, walkFreq, stepTarget } = req.body;
    const age = dob != null ? ageFromDob(dob || null) : undefined;
    // Only update fields that were explicitly provided — preserve everything else
    await pool.query(
      `UPDATE profile SET
         name       = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE name END,
         dob        = CASE WHEN $3::text IS NOT NULL THEN $3::date ELSE dob END,
         height_cm  = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE height_cm END,
         weight_kg  = CASE WHEN $5::text IS NOT NULL THEN $5 ELSE weight_kg END,
         age        = CASE WHEN $6::text IS NOT NULL THEN $6 ELSE age END,
         sex        = CASE WHEN $7::text IS NOT NULL THEN $7 ELSE sex END,
         activity   = CASE WHEN $8::text IS NOT NULL THEN $8 ELSE activity END,
         steps      = CASE WHEN $9::text IS NOT NULL THEN $9 ELSE steps END,
         vest_kg    = CASE WHEN $10::text IS NOT NULL THEN $10 ELSE vest_kg END,
         job_type   = CASE WHEN $11::text IS NOT NULL THEN $11 ELSE job_type END,
         gym_freq   = CASE WHEN $12::text IS NOT NULL THEN $12 ELSE gym_freq END,
         walk_freq  = CASE WHEN $13::text IS NOT NULL THEN $13 ELSE walk_freq END,
         step_target = CASE WHEN $14::int IS NOT NULL THEN $14 ELSE step_target END
       WHERE user_id=$1`,
      [req.userId,
       name     != null ? String(name)     : null,
       dob      != null ? (dob || null)    : null,
       heightCm != null ? String(heightCm) : null,
       weightKg != null ? String(weightKg) : null,
       age      != null ? String(age)      : null,
       sex      != null ? String(sex)      : null,
       activity != null ? String(activity) : null,
       steps    != null ? String(steps)    : null,
       vestKg   != null ? String(vestKg)   : null,
       jobType  != null ? String(jobType)  : null,
       gymFreq  != null ? String(gymFreq)  : null,
       walkFreq != null ? String(walkFreq) : null,
       stepTarget != null ? Number(stepTarget) : null]
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
