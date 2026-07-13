import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { sendPushToUser } from '../services/push';

// ── Friends / social ──────────────────────────────────────────────────────────
// Connect by email (phone-connect is a later pass). Friends can see each other's
// streaks + login activity ONLY when the owner's profile.share_activity is on, and
// each habit only when its shared_with_friends flag is set. This is the first place
// the server returns another user's data, so every read is gated by an ACCEPTED
// friendship + the owner's privacy flags.
const router = Router();
const LOGIN_HABIT = 'Logging into Superdub';

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Consecutive-day check-in streak, from the mandatory login habit's done days.
async function checkInStreak(userId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT year, day FROM tracker_habits WHERE user_id = $1 AND habit_name = $2 AND state = 'done'`,
    [userId, LOGIN_HABIT],
  );
  const done = new Set<string>();
  for (const r of rows) {
    const [dd, mm] = String(r.day).split('/');
    if (dd && mm) done.add(`${r.year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`);
  }
  let streak = 0;
  const d = new Date();
  if (!done.has(isoOf(d))) d.setDate(d.getDate() - 1); // not logged today yet → start at yesterday
  while (done.has(isoOf(d))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

// TRUE only when an ACCEPTED friendship exists between the two users, either
// direction. Every read/action on another user's data goes through this gate.
async function isAcceptedFriend(me: number, other: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM friendships
      WHERE status = 'accepted'
        AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
    [me, other],
  );
  return rows.length > 0;
}

// The permitted summary for a friend (already checked: accepted + share_activity on).
async function friendSummary(userId: number): Promise<{ streak: number; doneDays: number; sharedHabits: string[] }> {
  const [streak, doneAgg, shared] = await Promise.all([
    checkInStreak(userId),
    pool.query(`SELECT COUNT(*)::int AS n FROM tracker_habits WHERE user_id = $1 AND state = 'done'`, [userId]),
    pool.query(`SELECT name FROM habits WHERE user_id = $1 AND shared_with_friends = TRUE AND (archived = FALSE OR archived IS NULL) ORDER BY name`, [userId]),
  ]);
  return { streak, doneDays: doneAgg.rows[0]?.n ?? 0, sharedHabits: shared.rows.map((r: any) => r.name) };
}

// GET / — accepted friends (with permitted summaries) + incoming/outgoing requests.
router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const me = req.userId!;
    const { rows: links } = await pool.query(
      `SELECT f.requester_id, f.addressee_id, f.status,
              u.id AS other_id, u.email AS other_email, u.last_active_at,
              p.name AS other_name, COALESCE(p.share_activity, TRUE) AS share_activity
         FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
         LEFT JOIN profile p ON p.user_id = u.id
        WHERE f.requester_id = $1 OR f.addressee_id = $1`,
      [me],
    );
    const friends: any[] = [];
    const incoming: any[] = [];
    const outgoing: any[] = [];
    for (const l of links) {
      const base = { id: l.other_id, name: l.other_name || l.other_email.split('@')[0], email: l.other_email };
      if (l.status === 'accepted') {
        const summary = l.share_activity
          ? { ...(await friendSummary(l.other_id)), lastActive: l.last_active_at, shares: true }
          : { streak: null, doneDays: null, sharedHabits: [], lastActive: null, shares: false };
        friends.push({ ...base, ...summary });
      } else if (l.status === 'pending') {
        if (l.requester_id === me) outgoing.push(base);
        else incoming.push(base);
      }
    }
    res.json({ friends, incoming, outgoing });
  } catch (err: any) {
    console.error('[friends GET]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /request { email } — send a friend request by email.
router.post('/request', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const me = req.userId!;
    const email = String((req.body?.email ?? '')).trim().toLowerCase();
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Enter a valid email.' });
    const { rows } = await pool.query('SELECT id FROM users WHERE lower(email) = $1', [email]);
    if (rows.length === 0) return res.status(404).json({ error: 'No Superdub account with that email.' });
    const other = rows[0].id as number;
    if (other === me) return res.status(400).json({ error: "That's you." });
    // If they already requested you, accept it. Otherwise create a pending request.
    const existing = await pool.query(
      `SELECT requester_id, addressee_id, status FROM friendships
        WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
      [me, other],
    );
    if (existing.rows.length > 0) {
      const e = existing.rows[0];
      if (e.status === 'accepted') return res.status(409).json({ error: 'Already friends.' });
      if (e.requester_id === other && e.status === 'pending') {
        await pool.query(`UPDATE friendships SET status = 'accepted' WHERE requester_id = $1 AND addressee_id = $2`, [other, me]);
        return res.json({ ok: true, status: 'accepted' });
      }
      return res.status(409).json({ error: 'Request already sent.' });
    }
    await pool.query(`INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, 'pending')`, [me, other]);
    res.json({ ok: true, status: 'pending' });
  } catch (err: any) {
    console.error('[friends request]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /respond { userId, action: 'accept' | 'decline' } — respond to an incoming request.
router.post('/respond', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const me = req.userId!;
    const other = Number(req.body?.userId);
    const action = req.body?.action;
    if (!other || !['accept', 'decline'].includes(action)) return res.status(400).json({ error: 'Bad request.' });
    if (action === 'accept') {
      const upd = await pool.query(
        `UPDATE friendships SET status = 'accepted' WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
        [other, me],
      );
      if (upd.rowCount === 0) return res.status(404).json({ error: 'No pending request from that person.' });
    } else {
      await pool.query(`DELETE FROM friendships WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`, [other, me]);
    }
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[friends respond]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /:userId — unfriend (or cancel a request), either direction.
router.delete('/:userId', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const me = req.userId!;
    const other = Number(req.params.userId);
    if (!other) return res.status(400).json({ error: 'Bad request.' });
    await pool.query(
      `DELETE FROM friendships WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
      [me, other],
    );
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[friends delete]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /settings — my sharing preference.
router.get('/settings', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT COALESCE(share_activity, TRUE) AS share_activity FROM profile WHERE user_id = $1', [req.userId]);
    res.json({ shareActivity: rows[0]?.share_activity ?? true });
  } catch (err: any) {
    console.error('[friends settings GET]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /settings { shareActivity } — global "share my streaks + activity" toggle.
router.post('/settings', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const share = !!req.body?.shareActivity;
    await pool.query('UPDATE profile SET share_activity = $2 WHERE user_id = $1', [req.userId, share]);
    res.json({ ok: true, shareActivity: share });
  } catch (err: any) {
    console.error('[friends settings POST]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /:userId/profile — the richer detail-sheet read for ONE accepted friend.
// Same privacy gates as the list: friendship must be accepted, and the activity
// fields only come through when the owner's share_activity is on.
router.get('/:userId/profile', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const me = req.userId!;
    const other = Number(req.params.userId);
    if (!other) return res.status(400).json({ error: 'Bad request.' });
    if (!(await isAcceptedFriend(me, other))) return res.status(403).json({ error: 'Not friends.' });
    const { rows } = await pool.query(
      `SELECT u.email, u.created_at, u.last_active_at, p.name, COALESCE(p.share_activity, TRUE) AS share_activity
         FROM users u LEFT JOIN profile p ON p.user_id = u.id WHERE u.id = $1`,
      [other],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found.' });
    const r = rows[0];
    const base = { id: other, name: r.name || r.email.split('@')[0], email: r.email, memberSince: r.created_at };
    if (!r.share_activity) return res.json({ ...base, shares: false, streak: null, doneDays: null, sharedHabits: [], lastActive: null });
    const summary = await friendSummary(other);
    res.json({ ...base, shares: true, ...summary, lastActive: r.last_active_at });
  } catch (err: any) {
    console.error('[friends profile]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /:userId/nudge — send a friend a push. Gated by accepted friendship and
// rate-limited to one nudge per friend per 4 hours (friend_nudges table).
const NUDGE_WINDOW_HOURS = 4;
router.post('/:userId/nudge', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const me = req.userId!;
    const other = Number(req.params.userId);
    if (!other) return res.status(400).json({ error: 'Bad request.' });
    if (!(await isAcceptedFriend(me, other))) return res.status(403).json({ error: 'Not friends.' });
    const recent = await pool.query(
      `SELECT 1 FROM friend_nudges WHERE from_id = $1 AND to_id = $2 AND sent_at > NOW() - INTERVAL '${NUDGE_WINDOW_HOURS} hours'`,
      [me, other],
    );
    if (recent.rows.length > 0) {
      return res.status(429).json({ error: 'You nudged them recently. Give it a few hours.' });
    }
    const { rows: meRows } = await pool.query(
      `SELECT u.email, p.name FROM users u LEFT JOIN profile p ON p.user_id = u.id WHERE u.id = $1`,
      [me],
    );
    const myName = meRows[0]?.name || meRows[0]?.email?.split('@')[0] || 'A friend';
    await pool.query('INSERT INTO friend_nudges (from_id, to_id) VALUES ($1, $2)', [me, other]);
    const delivered = await sendPushToUser(other, {
      title: 'Superdub',
      body: `${myName} gave you a nudge. Keep your streak alive.`,
      url: '/community',
      tag: 'friend-nudge',
    });
    res.json({ ok: true, delivered: delivered > 0 });
  } catch (err: any) {
    console.error('[friends nudge]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /habit-share { name, shared } — per-habit opt-in for what friends can see.
router.post('/habit-share', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const name = String(req.body?.name ?? '').trim();
    const shared = !!req.body?.shared;
    if (!name) return res.status(400).json({ error: 'Missing habit.' });
    await pool.query('UPDATE habits SET shared_with_friends = $3 WHERE user_id = $1 AND name = $2', [req.userId, name, shared]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[friends habit-share]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
