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
        `SELECT name, dob, height_cm, weight_kg, age, sex, activity, steps, vest_kg,
                job_type, gym_freq, walk_freq, step_target,
                gym_sessions_per_week, gym_intensity, gym_minutes, weekly_activities, avatar_seed,
                occupation, ethnicity, gender_identity, country, relationship_status, religion
         FROM profile WHERE user_id = $1`,
        [req.userId]
      ),
      pool.query('SELECT created_at, last_login_at, last_active_at FROM users WHERE id = $1', [req.userId]),
    ]);
    const accountCreatedAt = userRes.rows[0]?.created_at ?? null;
    const lastLoginAt = userRes.rows[0]?.last_login_at ?? null;
    const lastActiveAt = userRes.rows[0]?.last_active_at ?? null;
    if (!profileRes.rows[0]) return res.json({ accountCreatedAt, lastLoginAt, lastActiveAt });
    const r = profileRes.rows[0];
    const dobStr = r.dob ? new Date(r.dob).toISOString().split('T')[0] : '';
    let weeklyActivities: any[] = [];
    try { weeklyActivities = JSON.parse(r.weekly_activities ?? '[]'); } catch {}
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
      gymSessionsPerWeek: r.gym_sessions_per_week ?? 3,
      gymIntensity: r.gym_intensity ?? 'moderate',
      gymMinutes: r.gym_minutes ?? 60,
      weeklyActivities,
      avatarSeed: r.avatar_seed ?? null,
      occupation: r.occupation ?? '',
      ethnicity: r.ethnicity ?? '',
      genderIdentity: r.gender_identity ?? '',
      country: r.country ?? '',
      relationshipStatus: r.relationship_status ?? '',
      religion: r.religion ?? '',
      accountCreatedAt,
      lastLoginAt,
      lastActiveAt,
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const {
      name, dob, heightCm, weightKg, sex, activity, steps, vestKg,
      jobType, gymFreq, walkFreq, stepTarget,
      gymSessionsPerWeek, gymIntensity, gymMinutes, weeklyActivities, avatarSeed,
      occupation, ethnicity, genderIdentity, country, relationshipStatus, religion,
    } = req.body;
    const age = dob != null ? ageFromDob(dob || null) : undefined;
    const activitiesStr = weeklyActivities != null
      ? (typeof weeklyActivities === 'string' ? weeklyActivities : JSON.stringify(weeklyActivities))
      : null;
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
         step_target = CASE WHEN $14::int IS NOT NULL THEN $14 ELSE step_target END,
         gym_sessions_per_week = CASE WHEN $15::int IS NOT NULL THEN $15 ELSE gym_sessions_per_week END,
         gym_intensity = CASE WHEN $16::text IS NOT NULL THEN $16 ELSE gym_intensity END,
         gym_minutes = CASE WHEN $17::int IS NOT NULL THEN $17 ELSE gym_minutes END,
         weekly_activities = CASE WHEN $18::text IS NOT NULL THEN $18 ELSE weekly_activities END,
         avatar_seed = CASE WHEN $19::text IS NOT NULL THEN $19 ELSE avatar_seed END,
         occupation = CASE WHEN $20::text IS NOT NULL THEN $20 ELSE occupation END,
         ethnicity = CASE WHEN $21::text IS NOT NULL THEN $21 ELSE ethnicity END,
         gender_identity = CASE WHEN $22::text IS NOT NULL THEN $22 ELSE gender_identity END,
         country = CASE WHEN $23::text IS NOT NULL THEN $23 ELSE country END,
         relationship_status = CASE WHEN $24::text IS NOT NULL THEN $24 ELSE relationship_status END,
         religion = CASE WHEN $25::text IS NOT NULL THEN $25 ELSE religion END
       WHERE user_id=$1`,
      [req.userId,
       name          != null ? String(name)          : null,
       dob           != null ? (dob || null)          : null,
       heightCm      != null ? String(heightCm)       : null,
       weightKg      != null ? String(weightKg)       : null,
       age           != null ? String(age)            : null,
       sex           != null ? String(sex)            : null,
       activity      != null ? String(activity)       : null,
       steps         != null ? String(steps)          : null,
       vestKg        != null ? String(vestKg)         : null,
       jobType       != null ? String(jobType)        : null,
       gymFreq       != null ? String(gymFreq)        : null,
       walkFreq      != null ? String(walkFreq)       : null,
       stepTarget    != null ? Number(stepTarget)     : null,
       gymSessionsPerWeek != null ? Number(gymSessionsPerWeek) : null,
       gymIntensity  != null ? String(gymIntensity)   : null,
       gymMinutes    != null ? Number(gymMinutes)     : null,
       activitiesStr,
       avatarSeed    != null ? String(avatarSeed)     : null,
       occupation         != null ? String(occupation)         : null,
       ethnicity          != null ? String(ethnicity)          : null,
       genderIdentity     != null ? String(genderIdentity)     : null,
       country            != null ? String(country)            : null,
       relationshipStatus != null ? String(relationshipStatus) : null,
       religion           != null ? String(religion)           : null]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /heartbeat — client pings this when the user is interacting with the app
// (on open, tab focus, and every 5 min). requireAuth updates last_active_at; here we
// also record an activity event, throttled to at most one per minute per user.
router.post('/heartbeat', requireAuth as any, (req: AuthRequest, res: Response) => {
  pool.query(
    `INSERT INTO activity_events (user_id)
     SELECT $1 WHERE NOT EXISTS (
       SELECT 1 FROM activity_events
       WHERE user_id = $1 AND occurred_at > NOW() - INTERVAL '1 minute'
     )`,
    [req.userId]
  ).catch(() => {});
  res.json({ ok: true });
});

router.delete('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.userId]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/ai-key', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT anthropic_api_key FROM profile WHERE user_id = $1', [req.userId]);
    const key: string | null = rows[0]?.anthropic_api_key ?? null;
    res.json({ hasKey: !!key, masked: key ? `sk-ant-…${key.slice(-4)}` : null });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

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
