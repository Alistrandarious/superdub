import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { deriveLapseWindow, gapDayKeys } from '../lapseWindow';

const router = Router();

// The login-streak habit. Mirrors MANDATORY_HABIT in src/Habits.tsx — the streak
// restore writes neutral 'na' days against it.
const MANDATORY_HABIT = 'Logging into Superdub';
/** One restore a month. Rationed so a frozen streak still means something. */
const RESTORE_COOLDOWN_DAYS = 30;

// Every day the user logged ANYTHING, as 'YYYY-MM-DD'. Three sources, because
// "falling off" means going quiet in any of them, not just missing a check-in.
// tracker/tracker_habits store 'DD/MM' + year, so they're rebuilt into real dates.
const LOG_DAYS_SQL = `
  SELECT DISTINCT d FROM (
    SELECT date::text AS d FROM daily_checkins
      WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '120 days'
    UNION ALL
    SELECT to_char(to_date(day || '/' || year, 'DD/MM/YYYY'), 'YYYY-MM-DD') AS d
      FROM tracker_habits WHERE user_id = $1 AND state IS NOT NULL
    UNION ALL
    SELECT to_char(to_date(day || '/' || year, 'DD/MM/YYYY'), 'YYYY-MM-DD') AS d
      FROM tracker WHERE user_id = $1 AND weight IS NOT NULL AND weight != ''
  ) s WHERE d IS NOT NULL`;

/** The user's local date, from the tz offset the client sends (minutes, as
 *  Date.getTimezoneOffset()). Falls back to server UTC. */
function localDate(req: AuthRequest): string {
  const off = Number(req.query.tzOffset);
  const ms = Date.now() - (Number.isFinite(off) ? off : 0) * 60000;
  return new Date(ms).toISOString().slice(0, 10);
}

async function logDays(userId: number): Promise<string[]> {
  const { rows } = await pool.query(LOG_DAYS_SQL, [userId]).catch(() => ({ rows: [] as any[] }));
  return rows.map((r: any) => r.d);
}

/** Days of silence for a user, for the comeback push in index.ts. Infinity when
 *  they have never logged (those get onboarding, not a comeback nudge). */
export async function daysSinceLastLog(userId: number, todayISO: string): Promise<number> {
  return deriveLapseWindow(await logDays(userId), todayISO).daysSinceLog;
}

// ── GET /api/lapse ────────────────────────────────────────────────────────────
// Raw signals only. The state machine (src/lapse.ts) runs client-side so the
// thresholds live in exactly one place.
router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const today = localDate(req);
    const days = await logDays(req.userId!);
    const window = deriveLapseWindow(days, today);

    // The week's habit marks vs what was due. Catches the person who still opens
    // the app but has stopped marking anything — the cheapest save there is.
    // ponytail: "due" counts every live habit once a day, so a weekly habit is
    // over-counted. It only feeds a ratio against a 25% floor, so the error is
    // absorbed; upgrade path is to fold in habits.cadence/schedule.
    const monday = new Date(`${today}T00:00:00Z`);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const daysElapsed = Math.floor((Date.parse(`${today}T00:00:00Z`) - monday.getTime()) / 86400000) + 1;
    const mondayISO = monday.toISOString().slice(0, 10);

    const [{ rows: habitRows }, { rows: markRows }] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS n FROM habits
          WHERE user_id = $1 AND (archived = FALSE OR archived IS NULL) AND name <> $2`,
        [req.userId, MANDATORY_HABIT],
      ).catch(() => ({ rows: [{ n: 0 }] })),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM tracker_habits
          WHERE user_id = $1 AND state IS NOT NULL AND habit_name <> $2
            AND to_date(day || '/' || year, 'DD/MM/YYYY') >= $3::date`,
        [req.userId, MANDATORY_HABIT, mondayISO],
      ).catch(() => ({ rows: [{ n: 0 }] })),
    ]);

    const { rows: restoreRows } = await pool.query(
      `SELECT last_streak_restore::text FROM profile WHERE user_id = $1`, [req.userId],
    ).catch(() => ({ rows: [] as any[] }));
    const lastRestore = restoreRows[0]?.last_streak_restore ?? null;
    const restoreCooledDown = !lastRestore ||
      (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastRestore}T00:00:00Z`)) / 86400000 >= RESTORE_COOLDOWN_DAYS;

    res.json({
      // deriveLapseWindow returns Infinity for "never logged"; JSON can't carry it.
      daysSinceLog: Number.isFinite(window.daysSinceLog) ? window.daysSinceLog : null,
      hadPriorActivity: window.hadPriorActivity,
      daysSinceReturn: window.daysSinceReturn,
      lastGapDays: window.lastGapDays,
      weekMarks: markRows[0]?.n ?? 0,
      weekDue: (habitRows[0]?.n ?? 0) * daysElapsed,
      restoreAvailable: restoreCooledDown && window.lastGapDays > 0 && gapDayKeys(days, today).length > 0,
    });
  } catch (err: any) {
    console.error('[lapse]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/lapse/restore ───────────────────────────────────────────────────
// Fill the quiet days with neutral 'na' marks across every daily habit. 'na' is
// already out of the denominator in src/dayStreak.ts, so a fully-'na' day scores
// as 'neutral' and the walk steps over it — the streak survives with no new
// streak maths anywhere. One restore per RESTORE_COOLDOWN_DAYS.
//
// (This used to mark only the login habit, which was enough when the streak
// counted logins. The streak now counts 75% of the day's habits, so neutralising
// a day means neutralising all of them.)
router.post('/restore', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const today = localDate(req);
    const { rows: restoreRows } = await pool.query(
      `SELECT last_streak_restore::text FROM profile WHERE user_id = $1`, [req.userId],
    ).catch(() => ({ rows: [] as any[] }));
    const lastRestore = restoreRows[0]?.last_streak_restore ?? null;
    if (lastRestore &&
        (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastRestore}T00:00:00Z`)) / 86400000 < RESTORE_COOLDOWN_DAYS) {
      return res.status(429).json({ error: 'Already restored recently' });
    }

    const gap = gapDayKeys(await logDays(req.userId!), today);
    if (gap.length === 0) return res.status(400).json({ error: 'Nothing to restore' });

    const { rows: habitRows } = await pool.query(
      `SELECT name FROM habits
        WHERE user_id = $1 AND (archived = FALSE OR archived IS NULL)
          AND COALESCE(cadence, 'daily') = 'daily' AND name <> $2`,
      [req.userId, MANDATORY_HABIT],
    ).catch(() => ({ rows: [] as any[] }));
    const names = habitRows.map((h: any) => h.name);
    if (names.length === 0) return res.status(400).json({ error: 'No daily habits to restore' });

    for (const { day, year } of gap) {
      // Never overwrite a real mark — a day they explicitly failed stays failed.
      await pool.query(
        `INSERT INTO tracker_habits (user_id, day, habit_name, state, year)
         SELECT $1, $2, name, 'na', $4 FROM unnest($3::text[]) AS name
         ON CONFLICT (user_id, day, habit_name) DO NOTHING`,
        [req.userId, day, names, year],
      ).catch(() => {});
    }
    await pool.query(
      `UPDATE profile SET last_streak_restore = $2::date WHERE user_id = $1`, [req.userId, today],
    ).catch(() => {});

    res.json({ ok: true, daysRestored: gap.length });
  } catch (err: any) {
    console.error('[lapse/restore]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
