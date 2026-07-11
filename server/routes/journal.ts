import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Journal entries: a bit of free text plus an optional mood (1..5). Newest first.
// The mood feeds Dub's insight engine alongside daily check-in moods.

// Validate a mood value: undefined/null is allowed (mood is optional), otherwise
// it must be an integer 1..5. Exported-in-spirit guard, mirrored by the client.
export function validJournalMood(mood: unknown): boolean {
  if (mood == null) return true;
  return Number.isInteger(mood) && (mood as number) >= 1 && (mood as number) <= 5;
}

router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, body, mood, created_at::text AS created_at
       FROM journal_entries WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json(rows.map((r: any) => ({ id: r.id, body: r.body, mood: r.mood, createdAt: r.created_at })));
  } catch (err: any) {
    console.error('[journal/get]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { id, body, mood } = req.body as { id?: string; body?: string; mood?: number | null };
    if (!id || !body?.trim()) return res.status(400).json({ error: 'id and body required' });
    if (!validJournalMood(mood)) return res.status(400).json({ error: 'mood must be 1..5' });
    await pool.query(
      `INSERT INTO journal_entries (id, user_id, body, mood) VALUES ($1, $2, $3, $4)`,
      [id, req.userId, body.trim(), mood ?? null]
    );
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[journal/post]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM journal_entries WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[journal/delete]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
