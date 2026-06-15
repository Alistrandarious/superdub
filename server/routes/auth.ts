import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const SALT_ROUNDS = 10;
const DEFAULT_HABITS = ['Walking', 'Praying', 'Duolingo'];

function makeToken(userId: number) {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '90d' });
}

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  const {
    email, password,
    name = '', age = '', sex = 'male', heightCm = '', weightKg = '',
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check duplicate email
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

    // Profile
    await client.query(
      `INSERT INTO profile (user_id, name, age, sex, height_cm, weight_kg, activity)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, name, age, sex, heightCm, weightKg, activityLevel]
    );

    // Weight settings (goal)
    await client.query(
      `INSERT INTO weight_settings (user_id, current_weight, goal_weight, loss_per_week, height, age, activity_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, weightKg, goalWeight, lossPerWeek, heightCm, age, activityLevel]
    );

    // Diet target & settings (defaults)
    await client.query('INSERT INTO diet_target (user_id) VALUES ($1)', [userId]);
    await client.query('INSERT INTO diet_settings (user_id) VALUES ($1)', [userId]);

    // Habits
    const habitList: string[] = Array.isArray(habits) && habits.length > 0 ? habits : DEFAULT_HABITS;
    for (let i = 0; i < habitList.length; i++) {
      await client.query(
        'INSERT INTO habits (user_id, name, position) VALUES ($1, $2, $3)',
        [userId, habitList[i], i]
      );
    }

    await client.query('COMMIT');

    res.json({ token: makeToken(userId), userId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

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
});

// GET /api/auth/me  — returns profile + habits for the logged-in user
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
