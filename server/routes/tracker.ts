import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

function dayToDDMM(day: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(day)) {
    const parts = day.slice(0, 10).split('-');
    return `${parts[2]}/${parts[1]}`;
  }
  return day.slice(0, 5);
}

// Day keys are DD/MM — ambiguous across years — so every row carries a year
// tag and all reads/writes are scoped to the current calendar year.
const trackerYear = () => new Date().getFullYear();

router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const year = trackerYear();
    // How many calendar years of habit rows to return, newest first. Default 1
    // keeps every existing caller byte-identical; the Habits page asks for 2 so
    // its rolling six-month matrix can span a 1 January boundary. Capped at 3.
    // ponytail: a year floor, not a date range, because `day` is DD/MM text —
    // comparing integers beats to_date() parsing, and 2 years is all the matrix
    // can show. Widen the cap if a matrix ever needs a longer window.
    const span = Math.min(3, Math.max(1, Math.trunc(Number(req.query.years)) || 1));
    const [daysRes, habitsRes, carryRes] = await Promise.all([
      pool.query('SELECT day, weight, calories, protein, carbs, fats, steps FROM tracker WHERE user_id = $1 AND year = $2', [req.userId, year]),
      pool.query('SELECT day, year, habit_name, done, state FROM tracker_habits WHERE user_id = $1 AND year <= $2 AND year > $2 - $3', [req.userId, year, span]),
      // Done-days per habit per year, all years. Two things read it: xpCarry
      // (prior years only, so lifetime XP survives the year rollover) and the
      // yearly matrix, whose decade cells only need "did anything happen".
      pool.query(
        `SELECT habit_name, year, COUNT(*)::int AS n FROM tracker_habits
         WHERE user_id = $1 AND (state = 'done' OR done = TRUE)
         GROUP BY habit_name, year`,
        [req.userId]
      ),
    ]);
    const days = daysRes.rows.map((r: any) => ({ ...r, day: dayToDDMM(String(r.day)) }));
    const habits = habitsRes.rows.map((r: any) => ({
      day: dayToDDMM(String(r.day)),
      year: Number(r.year),
      habit_name: r.habit_name,
      state: (r.state as string | null) ?? (r.done ? 'done' : null),
    }));
    const xpCarry: Record<string, number> = {};
    const carryByYear: Record<string, Record<number, number>> = {};
    for (const r of carryRes.rows) {
      const y = Number(r.year);
      const n = Number(r.n);
      (carryByYear[r.habit_name] ??= {})[y] = n;
      if (y < year) xpCarry[r.habit_name] = (xpCarry[r.habit_name] ?? 0) + n;
    }
    res.json({ days, habits, xpCarry, carryByYear, year });
  } catch (err: any) {
    console.error('[tracker GET]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { day: rawDay, weight, calories, protein, carbs, fats, steps } = req.body;
    if (!rawDay) return res.status(400).json({ error: 'day required' });
    const day = dayToDDMM(rawDay);
    const w  = weight    != null ? String(weight)    : null;
    const c  = calories  != null ? String(calories)  : null;
    const p  = protein   != null ? String(protein)   : null;
    const ca = carbs     != null ? String(carbs)     : null;
    const f  = fats      != null ? String(fats)      : null;
    const s  = steps     != null ? String(steps)     : null;

    // UPDATE-then-INSERT: avoids ON CONFLICT which requires a unique constraint.
    // Single user writes are sequential so the race window is irrelevant.
    const year = trackerYear();
    const upd = await pool.query(
      `UPDATE tracker SET
         weight   = CASE WHEN $3::text IS NOT NULL THEN $3  ELSE weight   END,
         calories = CASE WHEN $4::text IS NOT NULL THEN $4  ELSE calories END,
         protein  = CASE WHEN $5::text IS NOT NULL THEN $5  ELSE protein  END,
         carbs    = CASE WHEN $6::text IS NOT NULL THEN $6  ELSE carbs    END,
         fats     = CASE WHEN $7::text IS NOT NULL THEN $7  ELSE fats     END,
         steps    = CASE WHEN $8::text IS NOT NULL THEN $8  ELSE steps    END
       WHERE user_id = $1 AND day = $2 AND year = $9`,
      [req.userId, day, w, c, p, ca, f, s, year]
    );
    if ((upd.rowCount ?? 0) === 0) {
      await pool.query(
        `INSERT INTO tracker (user_id, day, year, weight, calories, protein, carbs, fats, steps)
         VALUES ($1, $2, $9, COALESCE($3,''), COALESCE($4,''), COALESCE($5,''), COALESCE($6,''), COALESCE($7,''), COALESCE($8,''))`,
        [req.userId, day, w, c, p, ca, f, s, year]
      );
    }
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[tracker PATCH]', err?.message);
    res.status(500).json({ error: err?.message ?? 'Server error' });
  }
});

router.patch('/habit', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { day: rawDay, habitName, state } = req.body;
    if (!rawDay || !habitName) return res.status(400).json({ error: 'day and habitName required' });
    const day = dayToDDMM(rawDay);
    const validState = state === 'done' || state === 'failed' || state === 'na' ? state : null;
    const done = validState === 'done';

    const year = trackerYear();
    const upd = await pool.query(
      `UPDATE tracker_habits SET done = $4, state = $5
       WHERE user_id = $1 AND day = $2 AND habit_name = $3 AND year = $6`,
      [req.userId, day, habitName, done, validState, year]
    );
    if ((upd.rowCount ?? 0) === 0) {
      await pool.query(
        `INSERT INTO tracker_habits (user_id, day, year, habit_name, done, state)
         VALUES ($1, $2, $6, $3, $4, $5)`,
        [req.userId, day, habitName, done, validState, year]
      );
    }
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[tracker/habit PATCH]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
