// Is tonight the night a streak dies? Feeds the evening streak push in index.ts.
//
// ponytail: imports the day-streak maths straight from src/ rather than mirroring
// it (the way lapseWindow.ts mirrors src/lapse.ts). The 75% rule is subtle enough
// that two copies would drift, and dayStreak.ts is pure TypeScript with no DOM or
// React in it, which is the one condition that makes the import safe. Keep it so.
import { pool } from './db';
import { computeDayStreak, todayProgress, type DayStreakInput } from '../src/dayStreak';

/** Mirrors MANDATORY_HABIT in src/Habits.tsx: attendance never counts as effort. */
const LOGIN_HABIT = 'Logging into Superdub';

function allDaysOf(year: number): string[] {
  const out: string[] = [];
  for (let m = 0; m < 12; m++) {
    const n = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    for (let d = 1; d <= n; d++) out.push(`${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}`);
  }
  return out;
}

/**
 * The run this user stands to lose tonight, and how many more habits save it.
 * `local` is a Date whose UTC fields hold the user's local time (as the reminder
 * loop builds it). Null when there is nothing at stake: no streak, or today is
 * already kept, or no daily habits at all.
 */
export async function streakAtRisk(userId: number, local: Date): Promise<{ streak: number; needed: number } | null> {
  const year = local.getUTCFullYear();
  const today = `${String(local.getUTCDate()).padStart(2, '0')}/${String(local.getUTCMonth() + 1).padStart(2, '0')}`;
  const [habitRows, markRows] = await Promise.all([
    pool.query(
      `SELECT name, start_date::text AS start_date FROM habits
        WHERE user_id = $1 AND (archived = FALSE OR archived IS NULL)
          AND COALESCE(cadence, 'daily') = 'daily' AND name <> $2`,
      [userId, LOGIN_HABIT],
    ),
    pool.query(
      `SELECT day, habit_name, state FROM tracker_habits WHERE user_id = $1 AND year = $2`,
      [userId, year],
    ),
  ]);
  if (habitRows.rows.length === 0) return null;

  const states: DayStreakInput['states'] = {};
  for (const r of markRows.rows) (states[r.day] ??= {})[r.habit_name] = r.state;
  const startDay: Record<string, string | undefined> = {};
  for (const h of habitRows.rows) {
    // 'YYYY-MM-DD' → 'DD/MM' when it started this year; earlier years are simply "always".
    const sd: string | null = h.start_date;
    if (sd && sd.startsWith(String(year))) startDay[h.name] = `${sd.slice(8, 10)}/${sd.slice(5, 7)}`;
  }
  const input: DayStreakInput = { allDays: allDaysOf(year), today, habits: habitRows.rows.map((h: any) => h.name), states, startDay };
  const streak = computeDayStreak(input);
  const { kept, needed } = todayProgress(input);
  if (streak < 1 || kept || needed < 1) return null;
  return { streak, needed };
}
