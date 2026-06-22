import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/graveyard', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT name, start_date FROM habits WHERE user_id = $1 AND archived = TRUE ORDER BY name',
      [req.userId]
    );
    res.json(rows.map((r: any) => ({ name: r.name, startDate: r.start_date })));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT name, start_date FROM habits WHERE user_id = $1 AND (archived = FALSE OR archived IS NULL) ORDER BY position',
      [req.userId]
    );
    res.json(rows.map((r: any) => ({ name: r.name, startDate: r.start_date })));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { habits } = req.body as { habits: string[] };
    const today = new Date().toISOString().slice(0, 10);

    const currentRes = await pool.query(
      'SELECT name, start_date FROM habits WHERE user_id = $1 AND (archived = FALSE OR archived IS NULL)',
      [req.userId]
    );
    const existingMap = new Map<string, string | null>(currentRes.rows.map((r: any) => [r.name as string, r.start_date as string | null]));

    const habitSet = new Set<string>(habits);
    const removed = Array.from(existingMap.keys()).filter((n: string) => !habitSet.has(n));
    // Removed habits are ARCHIVED (soft delete → graveyard), never hard-deleted.
    // Their tracker_habits history is preserved so nothing is ever lost.
    if (removed.length > 0) {
      await pool.query(
        'UPDATE habits SET archived = TRUE WHERE user_id = $1 AND name = ANY($2::text[])',
        [req.userId, removed]
      );
    }

    // Upsert each habit in the desired order. Update the existing row (un-archiving
    // it if it was in the graveyard) or insert a new one — without deleting anything.
    for (let i = 0; i < habits.length; i++) {
      const startDate = existingMap.has(habits[i]) ? existingMap.get(habits[i]) : today;
      const upd = await pool.query(
        'UPDATE habits SET position = $3, archived = FALSE, start_date = COALESCE(start_date, $4) WHERE user_id = $1 AND name = $2',
        [req.userId, habits[i], i, startDate]
      );
      if (upd.rowCount === 0) {
        await pool.query(
          'INSERT INTO habits (user_id, name, position, start_date, archived) VALUES ($1, $2, $3, $4, FALSE)',
          [req.userId, habits[i], i, startDate]
        );
      }
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:name', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.params;
    await pool.query(
      'UPDATE habits SET archived = TRUE WHERE user_id = $1 AND name = $2',
      [req.userId, name]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:name/restore', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.params;
    const today = new Date().toISOString().slice(0, 10);
    const posRes = await pool.query(
      'SELECT COALESCE(MAX(position), -1) as maxpos FROM habits WHERE user_id = $1 AND (archived = FALSE OR archived IS NULL)',
      [req.userId]
    );
    const nextPos = (posRes.rows[0].maxpos ?? -1) + 1;
    await pool.query(
      'UPDATE habits SET archived = FALSE, start_date = $3, position = $4 WHERE user_id = $1 AND name = $2',
      [req.userId, name, today, nextPos]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
