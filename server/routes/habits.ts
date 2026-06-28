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
      "SELECT name, start_date, COALESCE(cadence, 'daily') AS cadence FROM habits WHERE user_id = $1 AND (archived = FALSE OR archived IS NULL) ORDER BY position",
      [req.userId]
    );
    res.json(rows.map((r: any) => ({ name: r.name, startDate: r.start_date, cadence: r.cadence })));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { habits: rawHabits } = req.body as { habits: (string | { name: string; cadence?: string })[] };
    // Accept both plain strings (legacy) and { name, cadence } objects.
    const CADENCES = new Set(['daily', 'weekly', 'monthly', 'yearly']);
    const habits = (rawHabits ?? []).map(h => {
      const name = typeof h === 'string' ? h : h.name;
      const cadence = typeof h === 'string' ? 'daily' : (CADENCES.has(h.cadence ?? '') ? h.cadence! : 'daily');
      return { name, cadence };
    });
    const today = new Date().toISOString().slice(0, 10);

    const currentRes = await pool.query(
      'SELECT name, start_date FROM habits WHERE user_id = $1 AND (archived = FALSE OR archived IS NULL)',
      [req.userId]
    );
    const existingMap = new Map<string, string | null>(currentRes.rows.map((r: any) => [r.name as string, r.start_date as string | null]));

    const habitSet = new Set<string>(habits.map(h => h.name));
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
      const { name, cadence } = habits[i];
      const startDate = existingMap.has(name) ? existingMap.get(name) : today;
      const upd = await pool.query(
        'UPDATE habits SET position = $3, archived = FALSE, start_date = COALESCE(start_date, $4), cadence = $5 WHERE user_id = $1 AND name = $2',
        [req.userId, name, i, startDate, cadence]
      );
      if (upd.rowCount === 0) {
        await pool.query(
          'INSERT INTO habits (user_id, name, position, start_date, archived, cadence) VALUES ($1, $2, $3, $4, FALSE, $5)',
          [req.userId, name, i, startDate, cadence]
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

// Permanently delete a habit + its tracker history. Works for active OR archived
// habits (the client always guards this behind an explicit confirm). The only
// hard rule: the mandatory check-in habit can never be deleted.
const MANDATORY_HABIT = 'Logging into Superdub';
router.delete('/:name/permanent', requireAuth as any, async (req: AuthRequest, res: Response) => {
  const { name } = req.params;
  if (name === MANDATORY_HABIT) {
    return res.status(403).json({ error: 'This habit cannot be deleted' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const del = await client.query(
      'DELETE FROM habits WHERE user_id = $1 AND name = $2',
      [req.userId, name]
    );
    if (del.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    // Remove its tracker history too (tracker_habits links by name, no FK cascade).
    await client.query(
      'DELETE FROM tracker_habits WHERE user_id = $1 AND habit_name = $2',
      [req.userId, name]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
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
