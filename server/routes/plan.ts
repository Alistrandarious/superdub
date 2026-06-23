import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import {
  computeEMA, computeBMR, computeTDEE, runCycle, weeklySlope,
} from '../services/planEngine';
import type { WeightPoint, Biometrics, Goal, EMAPoint } from '../services/planEngine';
import { estimatePersonalTDEE } from '../services/tdeeEstimator';
import { predictStall } from '../services/plateauPredictor';

// ── Gather recent behavioural metrics for the ML models ──────────────────────
async function getRecentMetrics(userId: number) {
  const num = (v: any) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
  // Avg logged calories over the last 14 days (null if nothing logged)
  const cal = await pool.query(
    `SELECT AVG(calories::NUMERIC) AS avg FROM tracker
     WHERE user_id = $1 AND calories IS NOT NULL AND calories != '' AND calories::NUMERIC > 0
       AND TO_DATE('2026-'||lpad(split_part(day,'/',2),2,'0')||'-'||lpad(split_part(day,'/',1),2,'0'),'YYYY-MM-DD') >= CURRENT_DATE - INTERVAL '14 days'`,
    [userId]
  ).catch(() => ({ rows: [{ avg: null }] }));

  // Steps: last 7 days vs the 7 before
  const stepsRow = await pool.query(
    `SELECT
       AVG(CASE WHEN d >= CURRENT_DATE - INTERVAL '7 days' THEN s END) AS s7,
       AVG(CASE WHEN d <  CURRENT_DATE - INTERVAL '7 days' AND d >= CURRENT_DATE - INTERVAL '14 days' THEN s END) AS sprev
     FROM (
       SELECT steps::NUMERIC AS s,
              TO_DATE('2026-'||lpad(split_part(day,'/',2),2,'0')||'-'||lpad(split_part(day,'/',1),2,'0'),'YYYY-MM-DD') AS d
       FROM tracker WHERE user_id = $1 AND steps IS NOT NULL AND steps != '' AND steps::NUMERIC > 0
     ) t`,
    [userId]
  ).catch(() => ({ rows: [{ s7: null, sprev: null }] }));

  // Energy + mood, last 7 days of check-ins
  const ci = await pool.query(
    `SELECT AVG(energy::NUMERIC) AS energy, AVG(mood::NUMERIC) AS mood
     FROM daily_checkins WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'`,
    [userId]
  ).catch(() => ({ rows: [{ energy: null, mood: null }] }));

  // Logging rate: distinct weigh-in days in the last 14 days / 14
  const lg = await pool.query(
    `SELECT COUNT(DISTINCT day) AS n FROM tracker
     WHERE user_id = $1 AND weight IS NOT NULL AND weight != '' AND weight::NUMERIC > 0
       AND TO_DATE('2026-'||lpad(split_part(day,'/',2),2,'0')||'-'||lpad(split_part(day,'/',1),2,'0'),'YYYY-MM-DD') >= CURRENT_DATE - INTERVAL '14 days'`,
    [userId]
  ).catch(() => ({ rows: [{ n: 0 }] }));

  return {
    avgDailyIntake: num(cal.rows[0]?.avg),
    steps7: num(stepsRow.rows[0]?.s7),
    stepsPrev7: num(stepsRow.rows[0]?.sprev),
    energyAvg: num(ci.rows[0]?.energy),
    moodAvg: num(ci.rows[0]?.mood),
    loggingRate: Math.min(1, (Number(lg.rows[0]?.n) || 0) / 14),
  };
}

function slopeOfLast(emaPoints: EMAPoint[], n: number): number | null {
  if (emaPoints.length < 2) return null;
  return weeklySlope(emaPoints.slice(Math.max(0, emaPoints.length - n)));
}

const router = Router();

const YEAR = 2026; // tracker days are stored as DD/MM within a single year

function ddmmToDate(ddmm: string): Date | null {
  const m = ddmm.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return null;
  const d = new Date(`${YEAR}-${m[2]}-${m[1]}`);
  return isNaN(d.getTime()) ? null : d;
}

async function getWeightPoints(userId: number): Promise<WeightPoint[]> {
  // weight column is text — cast to numeric after filtering blanks/zeros
  const { rows } = await pool.query(
    `SELECT day, weight::NUMERIC AS w
     FROM tracker
     WHERE user_id = $1
       AND weight IS NOT NULL AND weight != '' AND weight::NUMERIC > 0
     ORDER BY
       TO_DATE(
         $2 || '-' || lpad(split_part(day,'/',2),2,'0') || '-' || lpad(split_part(day,'/',1),2,'0'),
         'YYYY-MM-DD'
       ) ASC`,
    [userId, String(YEAR)]
  );
  const out: WeightPoint[] = [];
  for (const r of rows) {
    const date = ddmmToDate(String(r.day));
    if (date) out.push({ day: String(r.day), weight: Number(r.w), date });
  }
  return out;
}

async function getBiometrics(userId: number, weightKg?: number): Promise<Biometrics | null> {
  const { rows } = await pool.query(
    `SELECT height_cm, age, sex, COALESCE(activity,'1.55') AS activity
     FROM profile WHERE user_id = $1`,
    [userId]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  const heightCm = parseFloat(r.height_cm);
  const age = parseInt(r.age, 10);
  if (!heightCm || !age) return null;

  let wkg = weightKg;
  if (!wkg) {
    const pts = await getWeightPoints(userId);
    wkg = pts.length > 0 ? pts[pts.length - 1].weight : 0;
  }
  if (!wkg) return null;

  return {
    weightKg: wkg,
    heightCm,
    age,
    sex: r.sex === 'female' ? 'female' : 'male',
    activityMultiplier: parseFloat(r.activity) || 1.55,
  };
}

async function getActiveGoal(userId: number) {
  const { rows } = await pool.query(
    `SELECT id, goal_type, start_weight::NUMERIC, start_date,
            target_weight::NUMERIC, target_date, rate_pct_bw::NUMERIC, status
     FROM weight_goals WHERE user_id = $1 AND status = 'active' LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

async function getCurrentTarget(userId: number, goalId: string) {
  const { rows } = await pool.query(
    `SELECT prescribed_calories, previous_calories, reason, effective_from
     FROM weight_plan_targets WHERE user_id = $1 AND goal_id = $2
     ORDER BY effective_from DESC LIMIT 1`,
    [userId, goalId]
  );
  return rows[0] ?? null;
}

function rowToGoal(r: any): Goal {
  return {
    id: r.id,
    goalType: r.goal_type as 'lose' | 'gain' | 'maintain',
    startWeight: Number(r.start_weight),
    startDate: new Date(r.start_date),
    targetWeight: Number(r.target_weight),
    targetDate: new Date(r.target_date),
    ratePctBw: Number(r.rate_pct_bw),
  };
}

// ── GET /api/plan/status ─────────────────────────────────────────────────────
// Active goal + current target + last 15 adjustment events.
router.get('/status', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const goal = await getActiveGoal(req.userId!);
    if (!goal) return res.json({ active: false });

    const target = await getCurrentTarget(req.userId!, goal.id);
    const { rows: history } = await pool.query(
      `SELECT id, prescribed_calories, previous_calories, reason, effective_from
       FROM weight_plan_targets WHERE user_id = $1 AND goal_id = $2
       ORDER BY effective_from DESC LIMIT 15`,
      [req.userId, goal.id]
    );

    // ── ML: personalized TDEE + plateau/stall prediction ────────────────────
    let tdee: any = null;
    let stall: any = null;
    try {
      const pts = await getWeightPoints(req.userId!);
      const emaPoints = computeEMA(pts);
      const latestWeight = pts.length > 0 ? pts[pts.length - 1].weight : Number(goal.start_weight);
      const bio = await getBiometrics(req.userId!, latestWeight);
      if (bio && emaPoints.length >= 2) {
        const metrics = await getRecentMetrics(req.userId!);
        const formulaTDEE = computeTDEE(bio);
        const dataDays = (emaPoints[emaPoints.length - 1].date.getTime() - emaPoints[0].date.getTime()) / 86400000 + 1;

        tdee = estimatePersonalTDEE({
          emaSlopePerWeek: weeklySlope(emaPoints),
          avgDailyIntake: metrics.avgDailyIntake,
          prescribedCalories: target?.prescribed_calories ?? formulaTDEE,
          formulaTDEE,
          dataDays,
        });

        stall = predictStall({
          goalType: goal.goal_type as 'lose' | 'gain' | 'maintain',
          recentSlope: slopeOfLast(emaPoints, 10),
          priorSlope: emaPoints.length >= 12 ? weeklySlope(emaPoints.slice(Math.max(0, emaPoints.length - 20), emaPoints.length - 10)) : null,
          steps7: metrics.steps7,
          stepsPrev7: metrics.stepsPrev7,
          energyAvg: metrics.energyAvg,
          moodAvg: metrics.moodAvg,
          loggingRate: metrics.loggingRate,
        });
      }
    } catch (e: any) {
      console.error('[plan/status ml]', e?.message);
    }

    res.json({
      active: true,
      tdee,
      stall,
      goal: {
        id: goal.id,
        goalType: goal.goal_type,
        startWeight: Number(goal.start_weight),
        startDate: goal.start_date,
        targetWeight: Number(goal.target_weight),
        targetDate: goal.target_date,
        ratePctBw: Number(goal.rate_pct_bw),
      },
      currentTarget: target ? {
        calories: target.prescribed_calories,
        reason: target.reason,
        effectiveFrom: target.effective_from,
      } : null,
      history: history.map((h: any) => ({
        id: h.id,
        calories: h.prescribed_calories,
        previousCalories: h.previous_calories,
        reason: h.reason,
        effectiveFrom: h.effective_from,
      })),
    });
  } catch (err: any) {
    console.error('[plan/status]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/plan/goal ──────────────────────────────────────────────────────
// Create or replace an active goal. Abandons any existing active goal first.
router.post('/goal', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { targetWeight, targetDate } = req.body as {
      targetWeight: number;
      targetDate: string; // YYYY-MM-DD
    };

    if (!targetWeight || !targetDate) {
      return res.status(400).json({ error: 'targetWeight and targetDate are required' });
    }

    const targetDt = new Date(targetDate);
    if (isNaN(targetDt.getTime()) || targetDt <= new Date()) {
      return res.status(400).json({ error: 'targetDate must be a future date' });
    }

    const pts = await getWeightPoints(req.userId!);
    if (pts.length === 0) {
      return res.status(400).json({ error: 'Log at least one weigh-in before setting a goal' });
    }
    const latestPt = pts[pts.length - 1];
    const startWeight = latestPt.weight;

    const bio = await getBiometrics(req.userId!, startWeight);
    if (!bio) {
      return res.status(400).json({
        error: 'Complete your profile (height, age, sex) before setting a goal',
      });
    }

    const weeksToGoal = (targetDt.getTime() - Date.now()) / (7 * 86400000);
    if (weeksToGoal <= 0) return res.status(400).json({ error: 'Target date must be in the future' });

    const ratePctBw = Math.abs(targetWeight - startWeight) / startWeight / weeksToGoal;
    const goalType: 'lose' | 'gain' | 'maintain' =
      targetWeight < startWeight ? 'lose' : targetWeight > startWeight ? 'gain' : 'maintain';

    // Abandon any existing active goal
    await pool.query(
      `UPDATE weight_goals SET status = 'abandoned' WHERE user_id = $1 AND status = 'active'`,
      [req.userId]
    );

    // Create goal
    const goalRes = await pool.query(
      `INSERT INTO weight_goals
         (user_id, goal_type, start_weight, start_date, target_weight, target_date, rate_pct_bw)
       VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6)
       RETURNING id`,
      [req.userId, goalType, startWeight, targetWeight, targetDate, ratePctBw]
    );
    const goalId: string = goalRes.rows[0].id;

    // Initial calorie prescription: TDEE ± daily equivalent of chosen rate.
    // Use the LEARNED TDEE when we have enough history, else the formula estimate.
    const bmr = computeBMR(bio);
    const formulaTDEE = computeTDEE(bio);
    let tdee = formulaTDEE;
    let tdeeSource = 'formula';
    try {
      const emaPoints = computeEMA(pts);
      if (emaPoints.length >= 2) {
        const metrics = await getRecentMetrics(req.userId!);
        const dataDays = (emaPoints[emaPoints.length - 1].date.getTime() - emaPoints[0].date.getTime()) / 86400000 + 1;
        const est = estimatePersonalTDEE({
          emaSlopePerWeek: weeklySlope(emaPoints),
          avgDailyIntake: metrics.avgDailyIntake,
          prescribedCalories: formulaTDEE,
          formulaTDEE,
          dataDays,
        });
        if (est.confidence >= 0.4 && est.observedTDEE != null) {
          tdee = est.blendedTDEE;
          tdeeSource = 'learned';
        }
      }
    } catch { /* fall back to formula */ }
    const dailyEquiv = Math.round(ratePctBw * startWeight * 7700 / 7);
    const direction = goalType === 'gain' ? 1 : -1;
    const initialCalories = Math.max(tdee + direction * dailyEquiv, bmr);

    const rateKgPerWk = +(ratePctBw * startWeight).toFixed(2);
    const reason = `Goal created — ${goalType} ${Math.abs(startWeight - targetWeight).toFixed(1)} kg`
      + ` by ${targetDate} (${rateKgPerWk} kg/wk, ${tdeeSource} TDEE ${tdee} kcal)`;

    await pool.query(
      `INSERT INTO weight_plan_targets (user_id, goal_id, prescribed_calories, reason)
       VALUES ($1, $2, $3, $4)`,
      [req.userId, goalId, initialCalories, reason]
    );

    res.json({
      ok: true,
      goalId,
      goalType,
      startWeight,
      initialCalories,
      bmrFloor: bmr,
      tdee,
      ratePctBw,
      rateKgPerWk,
    });
  } catch (err: any) {
    console.error('[plan/goal POST]', err?.message);
    res.status(500).json({ error: err?.message ?? 'Server error' });
  }
});

// ── DELETE /api/plan/goal ────────────────────────────────────────────────────
router.delete('/goal', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      `UPDATE weight_goals SET status = 'abandoned' WHERE user_id = $1 AND status = 'active'`,
      [req.userId]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/plan/cycle ─────────────────────────────────────────────────────
// Run one adjustment cycle. Idempotent: skips if < 7 days since last adjustment.
// Called by the frontend on Progress page load.
router.post('/cycle', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const goal = await getActiveGoal(req.userId!);
    if (!goal) return res.json({ ran: false, reason: 'No active goal' });

    const target = await getCurrentTarget(req.userId!, goal.id);
    const currentCalories = target?.prescribed_calories ?? 2000;
    const lastAt = target?.effective_from ? new Date(target.effective_from) : null;
    const daysSinceLast = lastAt ? (Date.now() - lastAt.getTime()) / 86400000 : 999;

    if (daysSinceLast < 7) {
      return res.json({
        ran: false,
        reason: `Next cycle in ${Math.ceil(7 - daysSinceLast)} day(s)`,
        currentCalories,
        daysUntilNext: Math.ceil(7 - daysSinceLast),
      });
    }

    const pts = await getWeightPoints(req.userId!);
    const emaPoints = computeEMA(pts);
    const latestWeight = pts.length > 0 ? pts[pts.length - 1].weight : Number(goal.start_weight);

    const bio = await getBiometrics(req.userId!, latestWeight);
    if (!bio) return res.json({ ran: false, reason: 'Profile incomplete' });

    // Auto-complete goal if target date has passed
    if (new Date(goal.target_date) < new Date()) {
      await pool.query(
        `UPDATE weight_goals SET status = 'completed' WHERE id = $1`,
        [goal.id]
      );
      return res.json({ ran: false, reason: 'Goal target date has passed — marked complete' });
    }

    const result = runCycle(rowToGoal(goal), currentCalories, emaPoints, bio);

    // ── Weekly adherence confidence modifier (Step 5) ───────────────────────
    // Fetch this week's check-ins. If ≥3 logged, modulate the correction size:
    //   high "about right" fraction → stronger correction (TDEE likely miscalibrated)
    //   high "above/below" fraction → conservative correction (adherence pattern, not calibration)
    // Falls back to plain cycle result when data is sparse (< 3 check-ins).
    let finalNewCalories = result.newCalories;
    let adherenceNote = '';
    if (result.shouldAdjust) {
      const { rows: ciRows } = await pool.query(
        `SELECT adherence FROM daily_checkins
         WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'`,
        [req.userId]
      );
      if (ciRows.length >= 3) {
        const total = ciRows.length;
        const aboutCount = ciRows.filter((r: any) => r.adherence === 'about').length;
        const aboutFraction = aboutCount / total;
        const baseDelta = result.newCalories - result.prevCalories;

        if (aboutFraction >= 0.6) {
          // Consistent self-report "about right" but trend is off → TDEE is the culprit
          // Apply 120% of the raw correction (stronger signal)
          finalNewCalories = Math.max(
            Math.round(result.prevCalories + baseDelta * 1.2),
            result.bmrFloor
          );
          adherenceNote = '; adherence signal: TDEE recalibration (×1.2)';
        } else {
          const divergentFraction = 1 - aboutFraction;
          if (divergentFraction >= 0.6) {
            // Mixed above/below → adherence is driving the divergence, not calibration
            // Apply 50% of the raw correction (conservative)
            finalNewCalories = Math.max(
              Math.round(result.prevCalories + baseDelta * 0.5),
              result.bmrFloor
            );
            adherenceNote = '; adherence signal: behaviour pattern (×0.5)';
          }
        }
      }
    }

    if (result.shouldAdjust) {
      await pool.query(
        `INSERT INTO weight_plan_targets
           (user_id, goal_id, prescribed_calories, previous_calories, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.userId, goal.id, finalNewCalories, result.prevCalories, result.reason + adherenceNote]
      );
    }

    res.json({
      ran: true,
      adjusted: result.shouldAdjust,
      newCalories: finalNewCalories,
      prevCalories: result.prevCalories,
      reason: result.reason + adherenceNote,
      onTrack: result.onTrack,
      actualSlope: result.actualSlope,
      targetSlope: result.targetSlope,
      bmrFloor: result.bmrFloor,
      flaggedDays: result.flaggedDays,
      metabolicProtection: result.metabolicProtection ?? false,
    });
  } catch (err: any) {
    console.error('[plan/cycle]', err?.message);
    res.status(500).json({ error: err?.message ?? 'Server error' });
  }
});

export default router;
