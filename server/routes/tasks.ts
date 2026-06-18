import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, text, done, COALESCE(type, 'todo') AS type FROM tasks WHERE user_id = $1 ORDER BY created_at`,
      [req.userId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { id, text, type = 'todo' } = req.body;
    if (!id || !text) return res.status(400).json({ error: 'id and text required' });
    await pool.query(
      `INSERT INTO tasks (id, user_id, text, done, type) VALUES ($1, $2, $3, false, $4)`,
      [id, req.userId, text, type]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { done } = req.body;
    await pool.query(
      'UPDATE tasks SET done = $1 WHERE id = $2 AND user_id = $3',
      [!!done, req.params.id, req.userId]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
