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

  const pts: StripPoint[] = logged.map((d, i) => ({
    ddmm: d.ddmm,
    kg: d.kg,
    x: logged.length === 1 ? STRIP_W / 2 : PAD_X + (i / (logged.length - 1)) * (STRIP_W - PAD_X * 2),
    y: PAD_Y + (1 - (d.kg - (mid - span / 2)) / span) * (STRIP_H - PAD_Y * 2),
    tone: i > 0 && (d.kg - logged[i - 1].kg) * dir > MOVE_EPS ? 'toward' : 'hold',
  }));
  return { pts, deltaKg: logged[logged.length - 1].kg - logged[0].kg };
}
