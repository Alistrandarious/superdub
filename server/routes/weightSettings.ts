import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { ageFromDob } from './profile';

const router = Router();

// profile is canonical for biometrics (weight/height/age/activity); the legacy
// weight_settings copies only fill gaps for pre-profile accounts. Goal fields
// (goalWeight/lossPerWeek/timeDays) live in weight_settings alone.
export function mergeWeightSettings(
  ws: Record<string, any> | null,
  profile: Record<string, any> | null
) {
  const w = ws ?? {};
  const p = profile ?? {};
  return {
    currentWeight: p.weight_kg || w.current_weight || '',
    goalWeight: w.goal_weight ?? '',
    lossPerWeek: w.loss_per_week ?? '',
    timeDays: w.time_days ?? '',
    height: p.height_cm || w.height || '',
    age: p.age || ageFromDob(p.dob ?? null) || w.age || '',
    activityLevel: p.activity || w.activity_level || '1.4',
  };
}

router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const [wsRes, pRes] = await Promise.all([
      pool.query(
        'SELECT current_weight, goal_weight, loss_per_week, time_days, height, age, activity_level FROM weight_settings WHERE user_id = $1',
        [req.userId]
      ),
      pool.query(
        'SELECT weight_kg, height_cm, age, dob, activity FROM profile WHERE user_id = $1',
        [req.userId]
      ),
    ]);
    if (!wsRes.rows[0] && !pRes.rows[0]) return res.json({});
    res.json(mergeWeightSettings(wsRes.rows[0] ?? null, pRes.rows[0] ?? null));
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
    // Write biometrics through to profile (the canonical store) so the two
    // tables can never diverge again. Empty strings don't clobber profile.
    await pool.query(
      `UPDATE profile SET
         weight_kg = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE weight_kg END,
         height_cm = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE height_cm END,
         age       = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE age END,
         activity  = CASE WHEN $5::text IS NOT NULL THEN $5 ELSE activity END
       WHERE user_id = $1`,
      [req.userId,
       currentWeight ? String(currentWeight) : null,
       height ? String(height) : null,
       age ? String(age) : null,
       activityLevel ? String(activityLevel) : null]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
