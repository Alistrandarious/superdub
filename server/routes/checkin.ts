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
router.post('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { energy, adherence, mood } = req.body as {
      energy: number;
      adherence: 'below' | 'about' | 'above';
      mood?: number;
    };

    if (!energy || energy < 1 || energy > 5) {
      return res.status(400).json({ error: 'energy must be 1–5' });
    }
    if (!['below', 'about', 'above'].includes(adherence)) {
      return res.status(400).json({ error: 'adherence must be below, about, or above' });
    }
    if (mood !== undefined && (mood < 1 || mood > 5)) {
      return res.status(400).json({ error: 'mood must be 1–5' });
    }

    await pool.query(
      `INSERT INTO daily_checkins (user_id, date, energy, adherence, mood)
       VALUES ($1, CURRENT_DATE, $2, $3, $4)
       ON CONFLICT (user_id, date) DO UPDATE SET energy = $2, adherence = $3, mood = $4`,
      [req.userId, Math.round(energy), adherence, mood != null ? Math.round(mood) : null]
    );

    res.json({ ok: true, xpAwarded: 5 });
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

// ── GET /api/checkin/coaching ─────────────────────────────────────────────────
// Return today's coaching message + churn risk.
// Derives trend from stored plan target reason text (no re-running the full cycle).
router.get('/coaching', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const [ciRes, priorRes, actRes, goalRes] = await Promise.all([
      pool.query(
        `SELECT energy, adherence FROM daily_checkins WHERE user_id = $1 AND date = CURRENT_DATE`,
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
         WHERE user_id = $1 AND weight IS NOT NULL AND weight != '' AND weight::NUMERIC > 0
         ORDER BY TO_DATE('2026-' || lpad(split_part(day,'/',2),2,'0') || '-' || lpad(split_part(day,'/',1),2,'0'), 'YYYY-MM-DD') DESC
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
    res.json({ message: getCoachingMessage(input), churnRisk, trend, todayEnergy });
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
