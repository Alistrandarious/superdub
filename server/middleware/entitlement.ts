import { Response, NextFunction } from 'express';
import { pool } from '../db';
import { AuthRequest } from './auth';
import {
  resolveEntitlement, habitLimitFor, trialEndsAt, FREE_HABIT_LIMIT, type Entitlement,
} from '../entitlement';

export interface EntitledRequest extends AuthRequest {
  entitlement?: Entitlement;
}

export interface EntitlementState {
  entitlement: Entitlement;
  /** When this account's app-managed trial runs out (ISO). */
  trialEndsAt: string;
  /** How many of their own habits they may keep. null = no ceiling. */
  habitLimit: number | null;
}

/** Read the three plan columns and decide what this account is allowed to do. */
export async function loadEntitlement(userId: number): Promise<EntitlementState> {
  const { rows } = await pool.query(
    'SELECT created_at, plan, pro_until FROM users WHERE id = $1',
    [userId]
  );
  const r = rows[0];
  // A valid token with no user row means the account was deleted mid-session.
  // Nothing to be entitled to, and guessing generously would be the wrong way
  // to be wrong.
  if (!r) return { entitlement: 'free', trialEndsAt: new Date(0).toISOString(), habitLimit: FREE_HABIT_LIMIT };

  const entitlement = resolveEntitlement({ createdAt: r.created_at, plan: r.plan, proUntil: r.pro_until });
  return {
    entitlement,
    trialEndsAt: trialEndsAt(r.created_at).toISOString(),
    habitLimit: habitLimitFor(entitlement),
  };
}

/**
 * Attaches `req.entitlement`. Sits after requireAuth on the routes that gate
 * something, rather than inside it, so the hot sync routes don't pay for a plan
 * lookup they never read. A DB failure is a 500, not a silent downgrade —
 * refusing a paying user's habit because the database blinked would be worse
 * than failing loudly.
 */
export async function withEntitlement(req: EntitledRequest, _res: Response, next: NextFunction) {
  try {
    req.entitlement = (await loadEntitlement(req.userId!)).entitlement;
    next();
  } catch (err) {
    next(err);
  }
}
