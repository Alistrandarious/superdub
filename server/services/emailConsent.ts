// Email opt-out + one-click unsubscribe tokens.
// Lifecycle/marketing email (weekly highlight, re-engagement) needs an unsubscribe
// path; transactional email (welcome, password reset) is exempt. The token is a
// plain signed JWT over the user id so the unsubscribe link works with no login and
// can't be forged into opting out someone else. Signing reuses JWT_SECRET (same
// secret the auth middleware uses) so there's no new key to manage.

import jwt from 'jsonwebtoken';
import { pool } from '../db';

const PURPOSE = 'email-unsub';

// No expiry: an unsubscribe link must keep working however old the email is.
export function makeUnsubToken(userId: number): string {
  return jwt.sign({ uid: userId, p: PURPOSE }, process.env.JWT_SECRET!);
}

// Returns the user id, or null if the token is missing/tampered/wrong-purpose.
export function verifyUnsubToken(token: string): number | null {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { uid?: number; p?: string };
    if (payload.p !== PURPOSE || typeof payload.uid !== 'number') return null;
    return payload.uid;
  } catch {
    return null;
  }
}

export async function setEmailOptOut(userId: number, optedOut: boolean): Promise<void> {
  await pool.query('UPDATE users SET email_optout = $2 WHERE id = $1', [userId, optedOut]);
}

export async function isEmailOptedOut(userId: number): Promise<boolean> {
  const { rows } = await pool.query('SELECT email_optout FROM users WHERE id = $1', [userId]);
  return rows[0]?.email_optout === true;
}
