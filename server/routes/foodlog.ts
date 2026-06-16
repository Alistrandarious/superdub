import { Router, Response } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /parse — transcript → user's Claude key → structured food items
router.post('/parse', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { transcript } = req.body as { transcript: string };
    if (!transcript?.trim()) return res.status(400).json({ error: 'No transcript provided' });

    const { rows } = await pool.query('SELECT anthropic_api_key FROM profile WHERE user_id = $1', [req.userId]);
    const apiKey = rows[0]?.anthropic_api_key;
    if (!apiKey) return res.status(403).json({ error: 'NO_KEY' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: `You are a nutrition parser. Extract every food item from the user's description and return ONLY a valid JSON array. Each element must be:
{"name": string, "qty": number, "unit": "g"|"ml"|"unit", "p": number, "c": number, "f": number, "kcal": number}
- p = protein grams, c = carb grams, f = fat grams, kcal = total calories
- Scale macros to the exact quantity described
- If no quantity is mentioned, use a typical single serving
- Return ONLY the JSON array — no explanation, no markdown`,
        messages: [{ role: 'user', content: transcript }],
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({})) as any;
      return res.status(502).json({ error: errData?.error?.message ?? 'Claude API error' });
    }

    const data = await response.json() as any;
    const text: string = data.content?.[0]?.text ?? '[]';

    let items: any[];
    try {
      items = JSON.parse(text);
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      items = match ? JSON.parse(match[0]) : [];
    }

    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

// GET /today — today's logged entries for this user
router.get('/today', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, items, totals, transcript, created_at
       FROM food_logs WHERE user_id = $1 AND date = CURRENT_DATE ORDER BY created_at ASC`,
      [req.userId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST / — save a confirmed log entry
router.post('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const { items, totals, transcript } = req.body as { items: any[]; totals: any; transcript?: string };
    const { rows } = await pool.query(
      `INSERT INTO food_logs (user_id, date, items, totals, transcript)
       VALUES ($1, CURRENT_DATE, $2, $3, $4) RETURNING id`,
      [req.userId, JSON.stringify(items), JSON.stringify(totals), transcript ?? '']
    );
    res.json({ id: rows[0].id });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /:id — remove a log entry
router.delete('/:id', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM food_logs WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
