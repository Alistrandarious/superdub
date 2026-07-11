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
      "SELECT name, start_date, COALESCE(cadence, 'daily') AS cadence, quit_started_at, COALESCE(starred, FALSE) AS starred FROM habits WHERE user_id = $1 AND (archived = FALSE OR archived IS NULL) ORDER BY position",
      [req.userId]
    );
    res.json(rows.map((r: any) => ({ name: r.name, startDate: r.start_date, cadence: r.cadence, quitStartedAt: r.quit_started_at, starred: r.starred })));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { habits: rawHabits } = req.body as { habits: (string | { name: string; cadence?: string })[] };
    // Accept both plain strings (legacy) and { name, cadence } objects.
    const CADENCES = new Set(['daily', 'weekly', 'monthly', 'yearly', 'quit']);
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

// Set / rewind a quit habit's clean-run start. Body: { name, startedAt } where
// startedAt is an ISO timestamp (Rewind sends "now"; add sends the chosen start).
router.patch('/quit-start', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { name, startedAt } = req.body as { name?: string; startedAt?: string };
    if (!name || !startedAt) return res.status(400).json({ error: 'name and startedAt required' });
    const when = new Date(startedAt);
    if (isNaN(when.getTime())) return res.status(400).json({ error: 'invalid startedAt' });
    await pool.query(
      'UPDATE habits SET quit_started_at = $3 WHERE user_id = $1 AND name = $2',
      [req.userId, name, when.toISOString()]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle a habit's starred flag. Body: { name, starred }.
router.patch('/star', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { name, starred } = req.body as { name?: string; starred?: boolean };
    if (!name || typeof starred !== 'boolean') return res.status(400).json({ error: 'name and starred required' });
    await pool.query(
      'UPDATE habits SET starred = $3 WHERE user_id = $1 AND name = $2',
      [req.userId, name, starred]
    );
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

// Permanently delete a habit (removes it from the list + graveyard). Its
// tracker_habits history is deliberately KEPT so lifetime XP is never lost — XP is
// computed from history, not the habit row. Works for active OR archived habits
// (the client guards this behind an explicit confirm). The only hard rule: the
// mandatory check-in habit can never be deleted.
const MANDATORY_HABIT = 'Logging into Superdub';
router.delete('/:name/permanent', requireAuth as any, async (req: AuthRequest, res: Response) => {
  const { name } = req.params;
  if (name === MANDATORY_HABIT) {
    return res.status(403).json({ error: 'This habit cannot be deleted' });
  }
  try {
    const del = await pool.query(
      'DELETE FROM habits WHERE user_id = $1 AND name = $2',
      [req.userId, name]
    );
    if (del.rowCount === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    // NOTE: tracker_habits rows are intentionally left in place so this habit's
    // earned XP keeps counting toward the lifetime total.
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
