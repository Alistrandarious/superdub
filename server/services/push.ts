// ─────────────────────────────────────────────────────────────────────────────
// Web Push — VAPID-authenticated notifications to subscribed PWA clients.
//
// Keys come from env (NEVER commit the private key):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   (generate with: npx web-push generate-vapid-keys)
// If they're absent, push is silently disabled so the rest of the app still runs.
// ─────────────────────────────────────────────────────────────────────────────
import webpush from 'web-push';

const PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
export const pushEnabled = !!(PUBLIC && PRIVATE);

if (pushEnabled) {
  webpush.setVapidDetails('mailto:superdub@app.local', PUBLIC, PRIVATE);
} else {
  console.warn('[push] VAPID keys not set — push notifications disabled');
}

export function vapidPublicKey(): string {
  return PUBLIC;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;   // where to go when tapped
  tag?: string;   // collapses repeat notifications
}

// Sends a push. Returns false (and the caller should prune) if the subscription
// is dead (410 Gone / 404).
export async function sendPush(subscription: any, payload: PushPayload): Promise<boolean> {
  if (!pushEnabled) return true;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err: any) {
    const code = err?.statusCode;
    if (code === 404 || code === 410) return false; // expired — prune it
    console.error('[push] send failed', code, err?.message);
    return true; // transient — keep the subscription
  }
}
