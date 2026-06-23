import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Personal SMART goals (distinct from the weight-plan goal in /plan).
// Each goal carries the five SMART fields plus a target date.

router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, specific, measurable, achievable, relevant,
              time_bound::text AS time_bound, done, created_at
       FROM smart_goals WHERE user_id = $1 ORDER BY done ASC, created_at DESC`,
      [req.userId]
    );
    res.json(rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      specific: r.specific ?? '',
      measurable: r.measurable ?? '',
      achievable: r.achievable ?? '',
      relevant: r.relevant ?? '',
      timeBound: r.time_bound ?? '',
      done: r.done,
    })));
  } catch (err: any) {
    console.error('[goals/get]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { id, title, specific, measurable, achievable, relevant, timeBound } = req.body as Record<string, string>;
    if (!id || !title?.trim()) return res.status(400).json({ error: 'id and title required' });
    await pool.query(
      `INSERT INTO smart_goals (id, user_id, title, specific, measurable, achievable, relevant, time_bound)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, req.userId, title.trim(), specific ?? '', measurable ?? '', achievable ?? '', relevant ?? '', timeBound || null]
    );
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[goals/post]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, specific, measurable, achievable, relevant, timeBound, done } = req.body as any;
    await pool.query(
      `UPDATE smart_goals SET
         title       = COALESCE($3, title),
         specific    = COALESCE($4, specific),
         measurable  = COALESCE($5, measurable),
         achievable  = COALESCE($6, achievable),
         relevant    = COALESCE($7, relevant),
         time_bound  = CASE WHEN $8::text IS NOT NULL THEN NULLIF($8,'')::date ELSE time_bound END,
         done        = COALESCE($9, done)
       WHERE id = $1 AND user_id = $2`,
      [id, req.userId,
       title ?? null, specific ?? null, measurable ?? null, achievable ?? null, relevant ?? null,
       timeBound !== undefined ? timeBound : null,
       typeof done === 'boolean' ? done : null]
    );
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[goals/put]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM smart_goals WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[goals/delete]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
