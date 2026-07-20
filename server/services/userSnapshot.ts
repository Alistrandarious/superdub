// One user's week, assembled server-side for outbound email (weekly highlight +
// re-engagement). This lifts the per-user insight assembly that lived inline in the
// /api/checkin/coaching route (churn risk, weight trend, coaching line) and adds the
// cheap weekly tracker aggregates an email recap needs. The checkin route now calls
// buildCoachingInput() from here so the two never drift.

import { pool } from '../db';
import { computeChurnRisk, type ChurnRisk, type CheckInRow } from './churnRisk';
import { getCoachingMessage, getEnergyBand, type CoachingInput, type TrendStatus } from './coachingEngine';

// ── Pure helpers (unit-tested in userSnapshot.check.ts) ──────────────────────────

// tracker day keys are stored either as 'YYYY-MM-DD…' or already as 'DD/MM'.
export function normalizeDDMM(day: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(day)) {
    const [, m, d] = day.slice(0, 10).split('-');
    return `${d}/${m}`;
  }
  return day.slice(0, 5);
}

function ddmm(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// The last n calendar days (including today) as DD/MM keys.
export function recentDayKeys(now: Date, n: number): string[] {
  const keys: string[] = [];
  const d = new Date(now);
  for (let i = 0; i < n; i++) {
    keys.push(ddmm(d));
    d.setDate(d.getDate() - 1);
  }
  return keys;
}

// Consecutive done-days ending today (or yesterday, so a run that's just "not ticked
// yet today" still counts). ponytail: DD/MM keys carry no year, so a streak spanning
// the Dec→Jan boundary can't be measured here — it resets at year end, matching the
// app's own YEAR-scoped tracker. Upgrade path: key by full ISO date if that matters.
export function currentStreak(doneKeys: Set<string>, now: Date): number {
  const d = new Date(now);
  if (!doneKeys.has(ddmm(d))) {
    d.setDate(d.getDate() - 1);
    if (!doneKeys.has(ddmm(d))) return 0;
  }
  let streak = 0;
  while (doneKeys.has(ddmm(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// ── Types ────────────────────────────────────────────────────────────────────────

export interface UserSnapshot {
  userId: number;
  email: string;
  name: string;             // nickname → profile name → '' (fall back to 'there' at render)
  optedOut: boolean;
  daysSinceActive: number | null;
  churnRisk: ChurnRisk;
  trend: TrendStatus;
  coachingLine: string;
  weekTicks: number;        // habit completions in the last 7 days
  weekPossible: number;     // active daily habits × 7 (approx denominator)
  weighIns: number;         // days with a logged weight in the last 7 days
  weightDeltaKg: number | null; // signed, negative = lost weight this week
  streakDays: number;
}

// ── Assembly ──────────────────────────────────────────────────────────────────────

// Derive weight trend from the stored plan target reason string, exactly as the
// checkin/coaching route does (avoids re-running the EMA cycle).
function trendFromReason(reason: string): TrendStatus {
  if (reason.includes('behind')) return 'behind';
  if (reason.includes('ahead')) return 'ahead';
  if (/on pace/i.test(reason)) return 'on-track';
  return 'none';
}

export async function buildUserSnapshot(userId: number, now: Date = new Date()): Promise<UserSnapshot | null> {
  const year = now.getFullYear();

  const uRes = await pool.query(
    `SELECT u.email, u.email_optout, u.last_active_at,
            COALESCE(NULLIF(p.nickname, ''), NULLIF(p.name, ''), '') AS name
     FROM users u LEFT JOIN profile p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  if (!uRes.rows[0]) return null;
  const u = uRes.rows[0];

  const [ciRes, priorRes, actRes, goalRes, thRes, habitRes, wtRes] = await Promise.all([
    pool.query(
      `SELECT date, energy, mood, adherence FROM daily_checkins
       WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days' ORDER BY date DESC`,
      [userId]
    ),
    pool.query(
      `SELECT 1 FROM daily_checkins WHERE user_id = $1 AND date < CURRENT_DATE - INTERVAL '7 days' LIMIT 1`,
      [userId]
    ),
    pool.query(
      `SELECT occurred_at FROM activity_events WHERE user_id = $1 ORDER BY occurred_at DESC LIMIT 1`,
      [userId]
    ),
    pool.query(
      `SELECT wg.goal_type, wg.target_weight::NUMERIC AS tw, wpt.prescribed_calories, wpt.reason
       FROM weight_goals wg
       LEFT JOIN weight_plan_targets wpt ON wpt.user_id = wg.user_id AND wpt.goal_id = wg.id
       WHERE wg.user_id = $1 AND wg.status = 'active'
       ORDER BY wpt.effective_from DESC LIMIT 1`,
      [userId]
    ),
    pool.query(
      `SELECT day FROM tracker_habits
       WHERE user_id = $1 AND year = $2 AND (state = 'done' OR done = TRUE)`,
      [userId, year]
    ),
    pool.query(
      `SELECT cadence FROM habits
       WHERE user_id = $1 AND (archived = FALSE OR archived IS NULL)`,
      [userId]
    ),
    pool.query(
      `SELECT day, weight FROM tracker
       WHERE user_id = $1 AND year = $2 AND weight IS NOT NULL AND weight != '' AND weight::NUMERIC > 0`,
      [userId, year]
    ),
  ]);

  // Churn risk (same inputs as the checkin route).
  const recentCheckins: CheckInRow[] = ciRes.rows.map((r: any) => ({
    date: new Date(r.date),
    energy: Number(r.energy),
    mood: r.mood != null ? Number(r.mood) : undefined,
  }));
  const lastActivity = actRes.rows[0]?.occurred_at ? new Date(actRes.rows[0].occurred_at) : null;
  const churnRisk = computeChurnRisk(recentCheckins, lastActivity, priorRes.rows.length > 0);
  const daysSinceActive = lastActivity ? Math.floor((now.getTime() - lastActivity.getTime()) / 86400000) : null;

  // Trend + coaching line.
  const goal = goalRes.rows[0] ?? null;
  const trend = goal ? trendFromReason(goal.reason ?? '') : 'none';
  const todayCI = ciRes.rows[0] ?? null; // newest first
  const coachingLine = getCoachingMessage({
    trend,
    adherence: todayCI?.adherence ?? null,
    energyBand: todayCI?.energy != null ? getEnergyBand(Number(todayCI.energy)) : null,
    churnRisk,
    streakDays: recentCheckins.length,
    kgToGoal: null,
    newTarget: goal?.prescribed_calories ? Number(goal.prescribed_calories) : null,
  } satisfies CoachingInput);

  // Weekly habit ticks + streak.
  const week = new Set(recentDayKeys(now, 7));
  const doneKeys: string[] = thRes.rows.map((r: any) => normalizeDDMM(String(r.day)));
  const weekTicks = doneKeys.filter((k: string) => week.has(k)).length;
  const dailyHabits = habitRes.rows.filter((r: any) => !r.cadence || r.cadence === 'daily' || r.cadence === 'quit').length;
  const weekPossible = dailyHabits * 7; // ponytail: non-daily habits excluded from the denominator
  const streakDays = currentStreak(new Set(doneKeys), now);

  // Weight moved this week (latest minus earliest logged weight in the window).
  interface WeekWeight { key: string; kg: number; }
  const weekWeights: WeekWeight[] = wtRes.rows
    .map((r: any) => ({ key: normalizeDDMM(String(r.day)), kg: Number(r.weight) }))
    .filter((w: WeekWeight) => week.has(w.key));
  // Order by the calendar position of the key within the last-7 window.
  const order = recentDayKeys(now, 7);
  weekWeights.sort((a: WeekWeight, b: WeekWeight) => order.indexOf(b.key) - order.indexOf(a.key)); // oldest → newest
  const weighIns = weekWeights.length;
  const weightDeltaKg = weekWeights.length >= 2
    ? Math.round((weekWeights[weekWeights.length - 1].kg - weekWeights[0].kg) * 10) / 10
    : null;

  return {
    userId,
    email: u.email,
    name: u.name || '',
    optedOut: u.email_optout === true,
    daysSinceActive,
    churnRisk,
    trend,
    coachingLine,
    weekTicks,
    weekPossible,
    weighIns,
    weightDeltaKg,
    streakDays,
  };
}
