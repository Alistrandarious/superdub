import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { vapidPublicKey, sendPush } from '../services/push';

const router = Router();

// Admin-only broadcast: fire one push to EVERY subscribed device.
// Guarded by the ADMIN_SECRET env var (sent via the x-admin-secret header) so it
// can be triggered operationally without exposing a "send" button in the app UI.
// Returns 403 if the secret isn't configured or doesn't match.
router.post('/broadcast', async (req, res: Response) => {
  try {
    const secret = process.env.ADMIN_SECRET;
    if (!secret || req.header('x-admin-secret') !== secret) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const { title, body, url } = (req.body ?? {}) as { title?: string; body?: string; url?: string };
    const payload = {
      title: title || 'superdub 🎉',
      body: body || "You're on track to your target. You can do this.",
      url: url || '/',
      tag: 'broadcast',
    };
    const { rows } = await pool.query('SELECT id, subscription FROM push_subscriptions');
    let sent = 0;
    for (const r of rows) {
      const ok = await sendPush(r.subscription, payload);
      if (ok) sent++;
      else await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [r.id]).catch(() => {});
    }
    res.json({ ok: true, sent, devices: rows.length });
  } catch (err: any) {
    console.error('[push/broadcast]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Client fetches the public key before subscribing
router.get('/vapid-public-key', (_req, res) => {
  res.json({ key: vapidPublicKey() });
});

// Save / refresh a subscription for this user
router.post('/subscribe', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { subscription, tzOffsetMinutes, reminderHour } = req.body as { subscription: any; tzOffsetMinutes?: number; reminderHour?: number };
    if (!subscription?.endpoint) return res.status(400).json({ error: 'invalid subscription' });
    const hour = Number.isInteger(reminderHour) ? Math.max(0, Math.min(23, reminderHour as number)) : 8;
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, subscription, tz_offset, reminder_hour)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id, subscription = EXCLUDED.subscription,
             tz_offset = EXCLUDED.tz_offset, reminder_hour = EXCLUDED.reminder_hour`,
      [req.userId, subscription.endpoint, JSON.stringify(subscription), tzOffsetMinutes ?? 0, hour]
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

// Update the daily reminder hour (local 24h) for all of this user's devices.
router.post('/reminder-time', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { hour } = req.body as { hour?: number };
    if (!Number.isInteger(hour) || (hour as number) < 0 || (hour as number) > 23) {
      return res.status(400).json({ error: 'hour must be 0–23' });
    }
    await pool.query('UPDATE push_subscriptions SET reminder_hour = $2 WHERE user_id = $1', [req.userId, hour]);
    res.json({ ok: true, hour });
  } catch (err: any) {
    console.error('[push/reminder-time]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
