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
