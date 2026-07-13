import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { computeChurnRisk } from '../services/churnRisk';
import { getCoachingMessage, getTrendStatus, getEnergyBand } from '../services/coachingEngine';
import type { CoachingInput } from '../services/coachingEngine';

const router = Router();

// ── POST /api/checkin ─────────────────────────────────────────────────────────
// Upsert today's energy + adherence check-in.
// Returns 5 XP (stub — habit XP is derived from tracker_habits, not awarded here;
// a future checkin_xp column can accumulate this when the XP system is extended).
// MET values per intensity for calorie-burn estimation
const WORKOUT_MET: Record<string, number> = {
  light: 3.5,
  moderate: 5.5,
  intense: 8.0,
  very_intense: 10.0,
};

router.post('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { energy, adherence, mood, workoutDone, workoutIntensity, workoutDurationMin, sleepHours, sleepBedtime, sleepWaketime, adherenceLevel } = req.body as {
      energy: number;
      adherence: 'below' | 'about' | 'above';
      mood?: number;
      workoutDone?: boolean;
      workoutIntensity?: 'light' | 'moderate' | 'intense' | 'very_intense';
      workoutDurationMin?: number;
      sleepHours?: number;
      sleepBedtime?: string;   // 'HH:MM'
      sleepWaketime?: string;  // 'HH:MM'
      adherenceLevel?: number; // -2..2, granular version of adherence
    };

    // Every field is optional now — each time-based prompt (vitals / exercise /
    // nutrition) writes only its own slice, and the upsert COALESCEs the rest.
    if (energy !== undefined && energy !== null && (energy < 1 || energy > 5)) {
      return res.status(400).json({ error: 'energy must be 1–5' });
    }
    if (adherence !== undefined && adherence !== null && !['below', 'about', 'above'].includes(adherence)) {
      return res.status(400).json({ error: 'adherence must be below, about, or above' });
    }
    if (mood !== undefined && mood !== null && (mood < 1 || mood > 10)) {
      return res.status(400).json({ error: 'mood must be 1–10' });
    }
    if (sleepHours !== undefined && sleepHours !== null && (sleepHours < 0 || sleepHours > 24)) {
      return res.status(400).json({ error: 'sleepHours must be 0–24' });
    }

    // Estimate calories burned from workout (MET × kg × hours)
    let workoutCalories: number | null = null;
    if (workoutDone && workoutIntensity && workoutDurationMin) {
      const { rows: wRows } = await pool.query(
        `SELECT weight_kg::NUMERIC AS w FROM profile WHERE user_id = $1`, [req.userId]
      );
      const userKg = wRows[0]?.w ? Number(wRows[0].w) : 75;
      const met = WORKOUT_MET[workoutIntensity] ?? 5.5;
      workoutCalories = Math.round(met * userKg * (workoutDurationMin / 60));
    }

    const lvl = adherenceLevel != null ? Math.max(-2, Math.min(2, Math.round(adherenceLevel))) : null;
    // COALESCE every column so a prompt that only sends its slice (e.g. vitals =
    // energy/mood/sleep) never wipes what another prompt wrote (e.g. workout).
    // workoutDone is a real boolean, so only overwrite it when explicitly sent.
    await pool.query(
      `INSERT INTO daily_checkins (user_id, date, energy, adherence, mood, workout_done, workout_intensity, workout_duration_min, sleep_hours, sleep_bedtime, sleep_waketime, adherence_level)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (user_id, date) DO UPDATE
         SET energy = COALESCE($2, daily_checkins.energy),
             adherence = COALESCE($3, daily_checkins.adherence),
             mood = COALESCE($4, daily_checkins.mood),
             workout_done = COALESCE($5, daily_checkins.workout_done),
             workout_intensity = COALESCE($6, daily_checkins.workout_intensity),
             workout_duration_min = COALESCE($7, daily_checkins.workout_duration_min),
             sleep_hours = COALESCE($8, daily_checkins.sleep_hours),
             sleep_bedtime = COALESCE($9, daily_checkins.sleep_bedtime),
             sleep_waketime = COALESCE($10, daily_checkins.sleep_waketime),
             adherence_level = COALESCE($11, daily_checkins.adherence_level)`,
      [req.userId,
       energy != null ? Math.round(energy) : null,
       adherence ?? null,
       mood != null ? Math.round(mood) : null,
       workoutDone ?? null,
       workoutDone && workoutIntensity ? workoutIntensity : null,
       workoutDone && workoutDurationMin ? workoutDurationMin : null,
       sleepHours != null ? sleepHours : null,
       sleepBedtime || null,
       sleepWaketime || null,
       lvl]
    );

    res.json({ ok: true, xpAwarded: 5, workoutCalories });
  } catch (err: any) {
    console.error('[checkin POST]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/checkin/recent ───────────────────────────────────────────────────
// Last 14 days of check-ins + churn risk + today's entry if present.
router.get('/recent', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT date::text, energy, adherence, mood
       FROM daily_checkins
       WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '14 days'
       ORDER BY date DESC`,
      [req.userId]
    );

    const { rows: priorRows } = await pool.query(
      `SELECT 1 FROM daily_checkins
       WHERE user_id = $1 AND date < CURRENT_DATE - INTERVAL '7 days'
       LIMIT 1`,
      [req.userId]
    );

    const { rows: actRows } = await pool.query(
      `SELECT occurred_at FROM activity_events
       WHERE user_id = $1 ORDER BY occurred_at DESC LIMIT 1`,
      [req.userId]
    );

    const checkins = rows.map((r: any) => ({
      date: new Date(r.date),
      energy: Number(r.energy),
      mood: r.mood != null ? Number(r.mood) : undefined,
    }));

    const churnRisk = computeChurnRisk(
      checkins,
      actRows[0]?.occurred_at ? new Date(actRows[0].occurred_at) : null,
      priorRows.length > 0,
    );

    const todayISO = new Date().toISOString().slice(0, 10);
    const todayRow = rows.find((r: any) => r.date === todayISO) ?? null;

    res.json({
      checkins: rows,
      churnRisk,
      today: todayRow ? { energy: Number(todayRow.energy), adherence: todayRow.adherence } : null,
    });
  } catch (err: any) {
    console.error('[checkin/recent]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/checkin/history ──────────────────────────────────────────────────
// Longer mood/energy history (default 90 days) for day-of-week pattern analysis.
router.get('/history', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const days = Math.min(365, Math.max(7, parseInt(String(req.query.days ?? '90')) || 90));
    const { rows } = await pool.query(
      `SELECT date::text AS date, energy, mood, adherence, adherence_level,
              workout_done, workout_intensity, workout_duration_min,
              sleep_hours, sleep_bedtime, sleep_waketime
       FROM daily_checkins
       WHERE user_id = $1 AND date >= CURRENT_DATE - ($2 || ' days')::interval
       ORDER BY date ASC`,
      [req.userId, days]
    );
    res.json({
      entries: rows.map((r: any) => ({
        date: r.date,
        energy: r.energy != null ? Number(r.energy) : null,
        mood: r.mood != null ? Number(r.mood) : null,
        adherence: r.adherence ?? null,
        adherenceLevel: r.adherence_level != null ? Number(r.adherence_level) : null, // −2..+2
        workoutIntensity: r.workout_done ? (r.workout_intensity ?? null) : null,
        workoutDurationMin: r.workout_done && r.workout_duration_min != null ? Number(r.workout_duration_min) : null,
        sleep: r.sleep_hours != null ? Number(r.sleep_hours) : null,
        bedtime: r.sleep_bedtime ?? null,   // 'HH:MM' or null
        waketime: r.sleep_waketime ?? null, // 'HH:MM' or null
      })),
    });
  } catch (err: any) {
    console.error('[checkin/history]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/checkin/coaching ─────────────────────────────────────────────────
// Return today's coaching message + churn risk.
// Derives trend from stored plan target reason text (no re-running the full cycle).
router.get('/coaching', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const [ciRes, priorRes, actRes, goalRes] = await Promise.all([
      pool.query(
        `SELECT energy, adherence, workout_done, workout_intensity, workout_duration_min
         FROM daily_checkins WHERE user_id = $1 AND date = CURRENT_DATE`,
        [req.userId]
      ),
      pool.query(
        `SELECT 1 FROM daily_checkins WHERE user_id = $1 AND date < CURRENT_DATE - INTERVAL '7 days' LIMIT 1`,
        [req.userId]
      ),
      pool.query(
        `SELECT occurred_at FROM activity_events WHERE user_id = $1 ORDER BY occurred_at DESC LIMIT 1`,
        [req.userId]
      ),
      pool.query(
        `SELECT wg.id, wg.goal_type, wg.target_weight::NUMERIC AS tw,
                wpt.prescribed_calories, wpt.reason
         FROM weight_goals wg
         LEFT JOIN weight_plan_targets wpt ON wpt.user_id = wg.user_id AND wpt.goal_id = wg.id
         WHERE wg.user_id = $1 AND wg.status = 'active'
         ORDER BY wpt.effective_from DESC
         LIMIT 1`,
        [req.userId]
      ),
    ]);

    const todayCI = ciRes.rows[0] ?? null;

    // Churn risk from last 7 days
    const { rows: recentRows } = await pool.query(
      `SELECT date, energy FROM daily_checkins
       WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY date DESC`,
      [req.userId]
    );
    const recentCheckins = recentRows.map((r: any) => ({ date: new Date(r.date), energy: Number(r.energy) }));
    const churnRisk = computeChurnRisk(
      recentCheckins,
      actRes.rows[0]?.occurred_at ? new Date(actRes.rows[0].occurred_at) : null,
      priorRes.rows.length > 0,
    );

    // Trend from stored reason string (avoids re-running EMA cycle)
    const goalRow = goalRes.rows[0] ?? null;
    let trend: 'ahead' | 'on-track' | 'behind' | 'none' = 'none';
    let newTarget: number | null = null;
    let kgToGoal: number | null = null;

    if (goalRow) {
      newTarget = goalRow.prescribed_calories ? Number(goalRow.prescribed_calories) : null;
      const reason: string = goalRow.reason ?? '';
      if (reason.includes('behind')) trend = 'behind';
      else if (reason.includes('ahead')) trend = 'ahead';
      else if (/on pace/i.test(reason)) trend = 'on-track';

      // Latest weight from tracker for kgToGoal
      const { rows: wtRows } = await pool.query(
        `SELECT weight::NUMERIC AS w FROM tracker
         WHERE user_id = $1 AND year = EXTRACT(YEAR FROM CURRENT_DATE)::int
           AND weight IS NOT NULL AND weight != '' AND weight::NUMERIC > 0
         ORDER BY TO_DATE(year::text || '-' || lpad(split_part(day,'/',2),2,'0') || '-' || lpad(split_part(day,'/',1),2,'0'), 'YYYY-MM-DD') DESC
         LIMIT 1`,
        [req.userId]
      );
      if (wtRows[0] && goalRow.tw) {
        kgToGoal = Number(wtRows[0].w) - Number(goalRow.tw);
      }
    }

    const streakDays = recentCheckins.length;

    const input: CoachingInput = {
      trend,
      adherence: todayCI?.adherence ?? null,
      energyBand: todayCI ? getEnergyBand(Number(todayCI.energy)) : null,
      churnRisk,
      streakDays,
      kgToGoal,
      newTarget,
    };

    // Include today's energy score so frontend can compute dynamic step targets
    const todayEnergy = todayCI ? Number(todayCI.energy) : null;

    // Workout calorie burn for today (if logged)
    let workoutCalories: number | null = null;
    if (todayCI?.workout_done && todayCI?.workout_intensity && todayCI?.workout_duration_min) {
      const { rows: profRows } = await pool.query(
        `SELECT weight_kg::NUMERIC AS w, step_target FROM profile WHERE user_id = $1`, [req.userId]
      );
      const userKg = profRows[0]?.w ? Number(profRows[0].w) : 75;
      const met = WORKOUT_MET[todayCI.workout_intensity as string] ?? 5.5;
      workoutCalories = Math.round(met * userKg * (Number(todayCI.workout_duration_min) / 60));

      // Advisable steps: reduce on workout days (body already stressed), increase on rest days
      const baseSteps = profRows[0]?.step_target ? Number(profRows[0].step_target) : 10000;
      const energyScore = todayEnergy ?? 3;
      const workoutPenalty = todayCI.workout_intensity === 'very_intense' ? -3000
        : todayCI.workout_intensity === 'intense' ? -2000
        : todayCI.workout_intensity === 'moderate' ? -1000
        : -500;
      const energyBonus = energyScore >= 4 ? 500 : energyScore <= 2 ? -1000 : 0;
      const trendBonus = trend === 'behind' && goalRow?.goal_type === 'lose' ? 1000 : 0;
      const advisableSteps = Math.max(3000, Math.min(20000, baseSteps + workoutPenalty + energyBonus + trendBonus));
      res.json({ message: getCoachingMessage(input), churnRisk, trend, todayEnergy, workoutCalories, advisableSteps });
      return;
    }

    // No workout today — advisable steps based purely on energy + trend
    const { rows: profRows2 } = await pool.query(
      `SELECT step_target FROM profile WHERE user_id = $1`, [req.userId]
    );
    const baseSteps2 = profRows2[0]?.step_target ? Number(profRows2[0].step_target) : 10000;
    const energyScore2 = todayEnergy ?? 3;
    const energyBonus2 = energyScore2 >= 5 ? 2000 : energyScore2 === 4 ? 1000 : energyScore2 <= 1 ? -2000 : energyScore2 === 2 ? -1000 : 0;
    const trendBonus2 = trend === 'behind' && goalRow?.goal_type === 'lose' ? 1500 : 0;
    const advisableSteps = Math.max(3000, Math.min(20000, baseSteps2 + energyBonus2 + trendBonus2));

    res.json({ message: getCoachingMessage(input), churnRisk, trend, todayEnergy, workoutCalories, advisableSteps });
  } catch (err: any) {
    console.error('[checkin/coaching]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/checkin/weekly-intention ────────────────────────────────────────
router.get('/weekly-intention', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { weekStart } = req.query as { weekStart?: string };
    if (!weekStart) return res.status(400).json({ error: 'weekStart required' });

    const { rows } = await pool.query(
      `SELECT intention FROM weekly_intentions WHERE user_id = $1 AND week_start = $2`,
      [req.userId, weekStart]
    );
    res.json({ intention: rows[0]?.intention ?? null });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/checkin/weekly-intention ───────────────────────────────────────
router.post('/weekly-intention', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { weekStart, intention } = req.body as { weekStart: string; intention: string };
    if (!weekStart || !intention?.trim()) {
      return res.status(400).json({ error: 'weekStart and intention required' });
    }

    await pool.query(
      `INSERT INTO weekly_intentions (user_id, week_start, intention)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, week_start) DO UPDATE SET intention = $3`,
      [req.userId, weekStart, intention.trim()]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
