import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      // to_char keeps due_date a clean 'YYYY-MM-DD' string (node-pg would
      // otherwise hand back a Date that serialises to a UTC timestamp and breaks
      // the client's lexical date compare).
      `SELECT id, text, done, COALESCE(type, 'todo') AS type,
              to_char(due_date, 'YYYY-MM-DD') AS "dueDate"
         FROM tasks WHERE user_id = $1 ORDER BY created_at`,
      [req.userId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { id, text, type = 'todo', dueDate } = req.body as { id: string; text: string; type?: string; dueDate?: string };
    if (!id || !text) return res.status(400).json({ error: 'id and text required' });
    // Accept only a plain YYYY-MM-DD; anything else stores NULL (no due date).
    const due = typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null;
    await pool.query(
      `INSERT INTO tasks (id, user_id, text, done, type, due_date) VALUES ($1, $2, $3, false, $4, $5)`,
      [id, req.userId, text, type, due]
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
