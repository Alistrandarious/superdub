import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { vapidPublicKey } from '../services/push';

const router = Router();

// Client fetches the public key before subscribing
router.get('/vapid-public-key', (_req, res) => {
  res.json({ key: vapidPublicKey() });
});

// Save / refresh a subscription for this user
router.post('/subscribe', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { subscription, tzOffsetMinutes } = req.body as { subscription: any; tzOffsetMinutes?: number };
    if (!subscription?.endpoint) return res.status(400).json({ error: 'invalid subscription' });
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, subscription, tz_offset)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id, subscription = EXCLUDED.subscription, tz_offset = EXCLUDED.tz_offset`,
      [req.userId, subscription.endpoint, JSON.stringify(subscription), tzOffsetMinutes ?? 0]
    );
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[push/subscribe]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove this device's subscription (or all of the user's if no endpoint given)
router.post('/unsubscribe', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { endpoint } = req.body as { endpoint?: string };
    if (endpoint) {
      await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2', [endpoint, req.userId]);
    } else {
      await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [req.userId]);
    }
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[push/unsubscribe]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
