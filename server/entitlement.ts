// =====================================================================
// SUPERDUB — Entitlement (the server is the source of truth)
// Everything the client shows about plans is decoration. What an account is
// actually allowed to do is decided here, from columns only the server writes.
// Pure on purpose (no db, no express) so it stays runnable-checkable —
// see entitlement.check.ts. The DB read + middleware live in
// server/middleware/entitlement.ts.
// Strategy this implements: LAUNCH_STRATEGY.md §1 (early adopters), §2 (the
// 25-day no-card trial), §3 (Free keeps 5 habits), §7 (server enforcement).
// =====================================================================

export type Entitlement = 'free' | 'trial' | 'pro';

// Everyone who joined before launch keeps Pro free, forever. Resolved from
// users.created_at at read time rather than stamped onto rows, so a signup at
// 23:59 the night before launch is grandfathered without a backfill job.
// ponytail: this date is duplicated from EARLY_ADOPTER_BEFORE in src/levels.ts —
// nothing in server/ imports from src/ (same reason MIN_AGE_YEARS is duplicated
// in routes/auth.ts, ROADMAP E2.3).
export const EARLY_ADOPTER_BEFORE = '2026-08-01';

// The trial is ours, not the store's: full Pro from signup, no card. Derived
// from created_at, so it needs no column and can never drift out of sync.
export const TRIAL_DAYS = 25;

// What Superdub Free keeps: five of the user's own habits at a time.
export const FREE_HABIT_LIMIT = 5;

// Auto-managed habit rows the user never chose. They live in the same table, so
// they'd otherwise eat into the cap.
export const SYSTEM_HABITS: ReadonlySet<string> = new Set(['Logging into Superdub']);

/** The three `users` columns entitlement is decided from. */
export interface PlanRow {
  createdAt: string | Date;
  /** users.plan — what billing granted: 'free' | 'pro'. */
  plan?: string | null;
  /** users.pro_until — paid-through date. null on a 'pro' plan means forever. */
  proUntil?: string | Date | null;
}

const ms = (d: string | Date): number => (d instanceof Date ? d.getTime() : Date.parse(d));

export const trialEndsAt = (createdAt: string | Date): Date =>
  new Date(ms(createdAt) + TRIAL_DAYS * 86_400_000);

/**
 * What this account is entitled to right now. Trial and Pro are the same access
 * (§2: the trial is full Pro); they stay distinct so copy can tell the truth
 * about which one you're on.
 */
export function resolveEntitlement(u: PlanRow, now: Date = new Date()): Entitlement {
  const t = now.getTime();
  const created = ms(u.createdAt);
  if (created < Date.parse(EARLY_ADOPTER_BEFORE)) return 'pro';
  // Cancelling never revokes access mid-cycle (§6) — pro_until is the
  // paid-through date the store gives us, so a cancelled-but-paid month is Pro.
  if (u.plan === 'pro' && (u.proUntil == null || ms(u.proUntil) > t)) return 'pro';
  if (t < created + TRIAL_DAYS * 86_400_000) return 'trial';
  return 'free';
}

/** How many of their own habits this entitlement may keep. null = no ceiling. */
export const habitLimitFor = (e: Entitlement): number | null =>
  e === 'free' ? FREE_HABIT_LIMIT : null;

/** The habits that count against the cap (system rows don't). */
export const countableHabits = (names: string[]): number =>
  names.filter(n => !SYSTEM_HABITS.has(n)).length;

/**
 * Whether a proposed habit list is allowed, given what the account has today.
 * Being over the cap already never locks you out of your own list: a lapsed
 * subscriber keeps, reorders and archives the habits they built, they just
 * can't grow the list until they're back under the ceiling. Quitting is free
 * and we never hold data hostage (§3).
 */
export function habitListAllowed(next: string[], current: string[], e: Entitlement): boolean {
  const limit = habitLimitFor(e);
  if (limit == null) return true;
  const n = countableHabits(next);
  return n <= limit || n <= countableHabits(current);
}
