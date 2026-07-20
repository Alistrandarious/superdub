// Scheduled + triggered lifecycle email jobs, run off the same 30-min interval as
// runReminders(). Each job is idempotent per period via a users.last_* DATE stamp, so
// re-running within the window is a no-op. ponytail: every sweep is O(users) with a
// per-user snapshot query — fine at this scale; upgrade path is a batched/queued job
// if the user base grows past a few thousand.

import { pool } from './db';
import { buildUserSnapshot } from './services/userSnapshot';
import { sendHabitsClearedEmail, sendWeeklyHighlightEmail, sendReengagementEmail } from './email';

// ── Pure threshold (unit-tested in emailJobs.check.ts) ──────────────────────────
// Fire the safety net when a clear-out looks deliberate-at-scale, not a tidy-up of
// one or two. Trigger on an absolute batch (≥ hardCount) OR clearing ≥ half of the
// habits they had. minAbsolute keeps tiny lists (delete 1 of 2) from ever firing.
export function shouldNudgeClearout(
  archivedInWindow: number,
  activeRemaining: number,
  minAbsolute = 3,
  hardCount = 5,
): boolean {
  if (archivedInWindow < minAbsolute) return false;
  if (archivedInWindow >= hardCount) return true;
  const total = archivedInWindow + activeRemaining;
  return total > 0 && archivedInWindow >= total * 0.5;
}

// ── P2: habits-cleared safety net ───────────────────────────────────────────────
// Runs every cycle. A clear-out is many single archive calls, so we look at the
// habits archived in the last ~90 min rather than timing any one request. Not gated
// by email_optout: it's a reversible account-safety note, not marketing.
export async function runClearoutNudge(): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email,
              COALESCE(NULLIF(p.nickname,''), NULLIF(p.name,''), '') AS name,
              (SELECT COUNT(*)::int FROM habits h
                 WHERE h.user_id = u.id AND h.archived = TRUE
                   AND h.archived_at >= NOW() - INTERVAL '90 minutes') AS recent_archived,
              (SELECT COUNT(*)::int FROM habits h
                 WHERE h.user_id = u.id AND (h.archived = FALSE OR h.archived IS NULL)) AS active_remaining
       FROM users u LEFT JOIN profile p ON p.user_id = u.id
       WHERE (u.last_delete_nudge IS NULL OR u.last_delete_nudge < CURRENT_DATE)
         AND EXISTS (SELECT 1 FROM habits h WHERE h.user_id = u.id AND h.archived = TRUE
                       AND h.archived_at >= NOW() - INTERVAL '90 minutes')`
    );
    for (const r of rows) {
      if (!shouldNudgeClearout(r.recent_archived, r.active_remaining)) continue;
      await sendHabitsClearedEmail(r.email, r.name, r.recent_archived)
        .catch((e: any) => console.error('[clearout-nudge]', e?.message));
      await pool.query('UPDATE users SET last_delete_nudge = CURRENT_DATE WHERE id = $1', [r.id]).catch(() => {});
    }
  } catch (err: any) {
    console.error('[clearout-nudge]', err?.message);
  }
}

// ── P3: weekly highlight ────────────────────────────────────────────────────────
// Sunday evening (server time), once per user per week via last_weekly_email. Goes to
// everyone not opted out; quiet users get the lighter variant inside the email.
export async function runWeeklyEmails(now: Date = new Date()): Promise<void> {
  if (now.getDay() !== 0 || now.getHours() < 18) return; // Sunday, from 18:00
  try {
    const { rows } = await pool.query(
      `SELECT id FROM users
       WHERE email_optout = FALSE
         AND (last_weekly_email IS NULL OR last_weekly_email < CURRENT_DATE - INTERVAL '6 days')`
    );
    for (const r of rows) {
      const snap = await buildUserSnapshot(r.id, now);
      if (!snap || snap.optedOut) continue;
      await sendWeeklyHighlightEmail(snap).catch((e: any) => console.error('[weekly]', e?.message));
      await pool.query('UPDATE users SET last_weekly_email = CURRENT_DATE WHERE id = $1', [r.id]).catch(() => {});
    }
  } catch (err: any) {
    console.error('[weekly]', err?.message);
  }
}

// ── P4: re-engagement ───────────────────────────────────────────────────────────
// Daily around 17:00 server time. Wins back users the churn model flags HIGH/CRITICAL
// who've been quiet ~7+ days. Capped to once per ~2 weeks via last_reengage_email.
export async function runReengagementSweep(now: Date = new Date()): Promise<void> {
  if (now.getHours() !== 17) return;
  try {
    const { rows } = await pool.query(
      `SELECT id FROM users
       WHERE email_optout = FALSE
         AND (last_reengage_email IS NULL OR last_reengage_email < CURRENT_DATE - INTERVAL '14 days')`
    );
    for (const r of rows) {
      const snap = await buildUserSnapshot(r.id, now);
      if (!snap || snap.optedOut) continue;
      const atRisk = snap.churnRisk === 'HIGH' || snap.churnRisk === 'CRITICAL';
      if (!atRisk || snap.daysSinceActive == null || snap.daysSinceActive < 7) continue;
      await sendReengagementEmail(snap).catch((e: any) => console.error('[reengage]', e?.message));
      await pool.query('UPDATE users SET last_reengage_email = CURRENT_DATE WHERE id = $1', [r.id]).catch(() => {});
    }
  } catch (err: any) {
    console.error('[reengage]', err?.message);
  }
}
