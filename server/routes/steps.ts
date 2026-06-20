import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const DEVICE_SOURCES = ['health_connect', 'healthkit'];
const VALID_SOURCES = [...DEVICE_SOURCES, 'manual'];

// tracker.day is stored as year-less DD/MM text — map any ISO/date input down to it.
function dayToDDMM(day: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(day)) {
    const parts = day.slice(0, 10).split('-');
    return `${parts[2]}/${parts[1]}`;
  }
  return day.slice(0, 5);
}

function normalizeSteps(raw: any): number | null {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Recompute which source "wins" for a (user, day) and mirror it into tracker.steps.
 *
 * Precedence: a device source (health_connect / healthkit) beats manual by default,
 * UNLESS the user recorded a manual entry *after* the latest device entry — then the
 * manual override wins. All source rows are retained; only the `active` flag moves.
 */
async function recomputeActive(userId: number, day: string) {
  const { rows } = await pool.query(
    `SELECT source, steps, recorded_at FROM step_entries
     WHERE user_id = $1 AND day = $2`,
    [userId, day]
  );
  if (rows.length === 0) return;

  const device = rows
    .filter((r: any) => DEVICE_SOURCES.includes(r.source))
    .sort((a: any, b: any) => +new Date(b.recorded_at) - +new Date(a.recorded_at))[0];
  const manual = rows.find((r: any) => r.source === 'manual');

  let winner: any;
  if (device && manual) {
    // Manual overrides only if recorded strictly after the latest device sync.
    winner = +new Date(manual.recorded_at) > +new Date(device.recorded_at) ? manual : device;
  } else {
    winner = device ?? manual;
  }

  await pool.query(
    `UPDATE step_entries SET active = (source = $3) WHERE user_id = $1 AND day = $2`,
    [userId, day, winner.source]
  );

  // Mirror the winning value into tracker.steps (UPDATE-then-INSERT, no ON CONFLICT).
  const s = String(winner.steps);
  const upd = await pool.query(
    `UPDATE tracker SET steps = $3 WHERE user_id = $1 AND day = $2`,
    [userId, day, s]
  );
  if ((upd.rowCount ?? 0) === 0) {
    await pool.query(
      `INSERT INTO tracker (user_id, day, steps) VALUES ($1, $2, $3)`,
      [userId, day, s]
    );
  }
}

async function upsertEntry(userId: number, rawDay: string, source: string, steps: number) {
  const day = dayToDDMM(rawDay);
  const upd = await pool.query(
    `UPDATE step_entries SET steps = $4, recorded_at = NOW()
     WHERE user_id = $1 AND day = $2 AND source = $3`,
    [userId, day, source, steps]
  );
  if ((upd.rowCount ?? 0) === 0) {
    await pool.query(
      `INSERT INTO step_entries (user_id, day, source, steps) VALUES ($1, $2, $3, $4)`,
      [userId, day, source, steps]
    );
  }
  await recomputeActive(userId, day);
  return day;
}

// POST / — record one step value for a source, then re-merge.
router.post('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { day, source, steps } = req.body as { day: string; source: string; steps: any };
    if (!day) return res.status(400).json({ error: 'day required' });
    if (!VALID_SOURCES.includes(source)) return res.status(400).json({ error: 'invalid source' });
    const n = normalizeSteps(steps);
    if (n == null) return res.status(400).json({ error: 'invalid steps' });

    const ddmm = await upsertEntry(req.userId!, day, source, n);
    res.json({ ok: true, day: ddmm });
  } catch (err: any) {
    console.error('[steps POST]', err?.message);
    res.status(500).json({ error: err?.message ?? 'Server error' });
  }
});

// POST /bulk — array of { day, source, steps } for launch sync.
router.post('/bulk', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const entries = req.body?.entries as { day: string; source: string; steps: any }[] | undefined;
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries array required' });

    let written = 0;
    for (const e of entries) {
      if (!e?.day || !VALID_SOURCES.includes(e.source)) continue;
      const n = normalizeSteps(e.steps);
      if (n == null) continue;
      await upsertEntry(req.userId!, e.day, e.source, n);
      written++;
    }
    res.json({ ok: true, written });
  } catch (err: any) {
    console.error('[steps bulk POST]', err?.message);
    res.status(500).json({ error: err?.message ?? 'Server error' });
  }
});

// GET /?day=DD/MM — all source rows for a day + which is active (for the manual UI).
router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const day = req.query.day ? dayToDDMM(String(req.query.day)) : null;
    const { rows } = day
      ? await pool.query(
          `SELECT day, source, steps, active, recorded_at FROM step_entries
           WHERE user_id = $1 AND day = $2 ORDER BY recorded_at DESC`,
          [req.userId, day]
        )
      : await pool.query(
          `SELECT day, source, steps, active, recorded_at FROM step_entries
           WHERE user_id = $1 ORDER BY recorded_at DESC`,
          [req.userId]
        );
    res.json({ entries: rows });
  } catch (err: any) {
    console.error('[steps GET]', err?.message);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
