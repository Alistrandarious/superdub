// Small shared weight-trend helpers, used by the Diet ("Plan") page, the extracted
// WeightSparkline, and the Progress Today panel. Pure, no deps.

export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function linearReg(pts: { x: number; y: number }[]): { slope: number; weeklyRate: number; intercept: number } | null {
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  const num = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const den = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (den === 0) return null;
  const slope = num / den;
  return { slope, weeklyRate: slope * 7, intercept: my - slope * mx };
}

// ── Gap-aware smoothing ──────────────────────────────────────────────────
// Smoothing exists to shrug off day-to-day water. It has no business shrugging
// off a fortnight. The daily pull is compounded over the days actually elapsed,
// so a weigh-in after a quiet spell moves the trend as hard as the days it
// stands for, and the first weigh-in back after a long gap simply *is* the
// trend. Mirrored server-side in planEngine.computeEMA.
export const EMA_ALPHA = 0.25;
/** Quiet days that count as a real break in the story, not a missed morning. */
export const GAP_DAYS = 14;

export function emaStep(prev: number | null, weight: number, gapDays = 1): number {
  if (prev === null) return weight;
  const alpha = 1 - (1 - EMA_ALPHA) ** Math.max(1, gapDays);
  return alpha * weight + (1 - alpha) * prev;
}

/** Only the run of points since the last real break — a trend line drawn across
 *  a gap describes a person who wasn't there. */
export function sinceLastGap<T extends { x: number }>(pts: T[], gap = GAP_DAYS): T[] {
  for (let i = pts.length - 1; i > 0; i--) if (pts[i].x - pts[i - 1].x >= gap) return pts.slice(i);
  return pts;
}

/**
 * Fill the days between consecutive weigh-ins so a normal week reads as one line,
 * while leaving a real break empty: the chart should show the quiet stretch, not
 * invent a body through it. `xs` are the indices that actually hold a value.
 * Mutates `byIdx` in place.
 */
export function bridgeGaps(byIdx: Record<number, number>, xs: number[], gap = GAP_DAYS): void {
  for (let p = 1; p < xs.length; p++) {
    const a = xs[p - 1], b = xs[p];
    if (b - a < 2 || b - a >= gap) continue;
    for (let i = a + 1; i < b; i++) {
      byIdx[i] = +(byIdx[a] + ((byIdx[b] - byIdx[a]) * (i - a)) / (b - a)).toFixed(2);
    }
  }
}

export function localYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isoToDDMM(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// ── Trend strip (WeightTrendStrip) ───────────────────────────────────────
// Your last few weigh-ins placed in a W×H box and toned by whether each point
// moved toward your goal. Mint = toward, slate = held or drifted; never red,
// a single heavy morning is water (see the lapse protocol).

export const STRIP_W = 300, STRIP_H = 76;
const PAD_X = 14, PAD_Y = 12;
const MIN_SPAN = 0.6;   // kg — keeps a flat week from looking like a rollercoaster
const MOVE_EPS = 0.05;  // kg — smaller than this is scale noise, not movement

export type StripTone = 'toward' | 'hold';
export interface StripPoint { ddmm: string; kg: number; x: number; y: number; tone: StripTone }

const ddmmNum = (s: string) => { const [d, m] = s.split('/').map(Number); return (m || 0) * 100 + (d || 0); };

/** Days since 1 Jan, so the strip can space points by when they happened rather
 *  than by how many of them there are. A fixed non-leap year keeps it pure.
 *  ponytail: within-year only, the same Dec to Jan wrap ALL_DAYS carries everywhere. */
const ddmmDay = (s: string) => {
  const [d, m] = s.split('/').map(Number);
  return Math.round((Date.UTC(2001, (m || 1) - 1, d || 1) - Date.UTC(2001, 0, 1)) / 86400000);
};

export function trendSeries(days: any[], goalKg?: number, max = 14): { pts: StripPoint[]; deltaKg: number } {
  const logged = (days ?? [])
    .map((d: any) => ({ ddmm: String(d?.day ?? ''), kg: parseFloat(d?.weight) }))
    .filter(d => d.kg > 0 && /^\d\d\/\d\d$/.test(d.ddmm))
    .sort((a, b) => ddmmNum(a.ddmm) - ddmmNum(b.ddmm))
    .slice(-max);
  if (logged.length === 0) return { pts: [], deltaKg: 0 };

  const lo = Math.min(...logged.map(d => d.kg));
  const hi = Math.max(...logged.map(d => d.kg));
  const mid = (lo + hi) / 2;
  const span = Math.max(hi - lo, MIN_SPAN);
  // Bulking (goal above where you started) flips which direction counts as progress.
  const dir = goalKg && goalKg > logged[0].kg ? 1 : -1;

  // Spaced by date, not by position in the list. Index spacing drew 14 weigh-ins
  // identically whether they spanned a fortnight or half a year, which hid the
  // gap on the one screen built to show you the map you're adding a point to.
  const t0 = ddmmDay(logged[0].ddmm);
  const dateSpan = Math.max(1, ddmmDay(logged[logged.length - 1].ddmm) - t0);

  const pts: StripPoint[] = logged.map((d, i) => ({
    ddmm: d.ddmm,
    kg: d.kg,
    x: logged.length === 1 ? STRIP_W / 2 : PAD_X + ((ddmmDay(d.ddmm) - t0) / dateSpan) * (STRIP_W - PAD_X * 2),
    y: PAD_Y + (1 - (d.kg - (mid - span / 2)) / span) * (STRIP_H - PAD_Y * 2),
    tone: i > 0 && (d.kg - logged[i - 1].kg) * dir > MOVE_EPS ? 'toward' : 'hold',
  }));
  return { pts, deltaKg: logged[logged.length - 1].kg - logged[0].kg };
}
