import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../email';

const router = Router();

const SALT_ROUNDS = 10;
const DEFAULT_HABITS = ['Walking', 'Praying', 'Duolingo'];

function makeToken(userId: number) {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '90d' });
}

function ageFromDob(dob: string): string {
  if (!dob) return '';
  const born = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const m = today.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < born.getDate())) age--;
  return String(Math.max(0, age));
}

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  const {
    email, password,
    name = '', dob = '', sex = 'male', heightCm = '', weightKg = '',
    goalWeight = '', lossPerWeek = '', activityLevel = '1.55',
    habits = DEFAULT_HABITS,
  } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const age = ageFromDob(dob);

  let client: any;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'An account with that email already exists' });
      return;
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows: [user] } = await client.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
      [email.toLowerCase(), hash]
    );
    const userId = user.id;

    await client.query(
      `INSERT INTO profile (user_id, name, dob, age, sex, height_cm, weight_kg, activity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, name, dob || null, age, sex, heightCm, weightKg, activityLevel]
    );

    await client.query(
      `INSERT INTO weight_settings (user_id, current_weight, goal_weight, loss_per_week, height, age, activity_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, weightKg, goalWeight, lossPerWeek, heightCm, age, activityLevel]
    );

    await client.query('INSERT INTO diet_target (user_id) VALUES ($1)', [userId]);
    await client.query('INSERT INTO diet_settings (user_id) VALUES ($1)', [userId]);

    const habitList: string[] = Array.isArray(habits) && habits.length > 0 ? habits : DEFAULT_HABITS;
    for (let i = 0; i < habitList.length; i++) {
      await client.query(
        'INSERT INTO habits (user_id, name, position) VALUES ($1, $2, $3)',
        [userId, habitList[i], i]
      );
    }

    await client.query('COMMIT');

    // Fire-and-forget welcome email — don't block the signup response
    sendWelcomeEmail(email.toLowerCase(), name).catch(err =>
      console.error('[email] Failed to send welcome email:', err)
    );

    res.json({ token: makeToken(userId), userId });
  } catch (err: any) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: err?.message ?? 'Server error' });
  } finally {
    if (client) client.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const match = await bcrypt.compare(password, rows[0].password_hash);
    if (!match) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    res.json({ token: makeToken(rows[0].id), userId: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: 'Email is required' }); return; }

  const { rows } = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  // Always return 200 so we don't leak whether an account exists
  if (rows.length === 0) { res.json({ ok: true }); return; }

  const userId = rows[0].id;
  const code = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6-char hex e.g. A3F9B2
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await pool.query(
    'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, code, expiresAt]
  );

  sendPasswordResetEmail(email.toLowerCase(), code).catch(err =>
    console.error('[email] Failed to send reset email:', err)
  );

  res.json({ ok: true });
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    res.status(400).json({ error: 'Email, code, and new password are required' });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const { rows: userRows } = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  if (userRows.length === 0) { res.status(400).json({ error: 'Invalid or expired code' }); return; }
  const userId = userRows[0].id;

  const { rows: resetRows } = await pool.query(
    `SELECT id FROM password_resets
     WHERE user_id = $1 AND token = $2 AND used = FALSE AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [userId, code.toUpperCase()]
  );
  if (resetRows.length === 0) { res.status(400).json({ error: 'Invalid or expired code' }); return; }

  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await Promise.all([
    pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]),
    pool.query('UPDATE password_resets SET used = TRUE WHERE id = $1', [resetRows[0].id]),
  ]);

  res.json({ token: makeToken(userId) });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const [profileRes, habitsRes, wsRes] = await Promise.all([
    pool.query('SELECT * FROM profile WHERE user_id = $1', [userId]),
    pool.query('SELECT name FROM habits WHERE user_id = $1 ORDER BY position', [userId]),
    pool.query('SELECT * FROM weight_settings WHERE user_id = $1', [userId]),
  ]);

  res.json({
    profile: profileRes.rows[0] ?? null,
    habits: habitsRes.rows.map(r => r.name),
    weightSettings: wsRes.rows[0] ?? null,
  });
});

export default router;
