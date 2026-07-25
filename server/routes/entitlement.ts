import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { loadEntitlement } from '../middleware/entitlement';
import { countableHabits } from '../entitlement';

const router = Router();

// GET /api/entitlement — what this account is allowed to do, so the client can
// show a ceiling before the user walks into it. Purely informational: every gate
// is enforced again on the route that does the work.
router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const [state, habits] = await Promise.all([
      loadEntitlement(req.userId!),
      pool.query(
        'SELECT name FROM habits WHERE user_id = $1 AND (archived = FALSE OR archived IS NULL)',
        [req.userId]
      ),
    ]);
    res.json({ ...state, habitCount: countableHabits(habits.rows.map((r: any) => r.name)) });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
