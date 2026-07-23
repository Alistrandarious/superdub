import { trendSeries, STRIP_W } from './weightMath';

// The one runnable check for the trend-strip geometry: ordering, toning and the
// flat-series guard (a divide-by-zero there would put every dot on NaN).

const day = (d: string, weight: string | number) => ({ day: d, weight });

// Out of order + junk rows: sorted by date, non-weights dropped.
const mixed = trendSeries([day('03/07', 80), day('bad', 79), day('01/07', 82), day('02/07', 0)]);
if (mixed.pts.map(p => p.ddmm).join() !== '01/07,03/07') throw new Error('sort/filter wrong');
if (mixed.deltaKg !== -2) throw new Error('delta wrong');

// Cutting (no goal): a drop is progress, a rise holds.
const cut = trendSeries([day('01/07', 82), day('02/07', 81), day('03/07', 82)]);
if (cut.pts.map(p => p.tone).join() !== 'hold,toward,hold') throw new Error('cut toning wrong');

// Bulking (goal above the first reading): the rise is the progress.
const bulk = trendSeries([day('01/07', 70), day('02/07', 71)], 80);
if (bulk.pts[1].tone !== 'toward') throw new Error('bulk toning wrong');

// A perfectly flat run must still land on finite, level coordinates.
const flat = trendSeries([day('01/07', 80), day('02/07', 80)]);
if (!flat.pts.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) throw new Error('flat series produced NaN');
if (flat.pts[0].y !== flat.pts[1].y) throw new Error('flat series should be level');

// A single point sits centred, and an empty history draws nothing.
if (trendSeries([day('01/07', 80)]).pts[0].x !== STRIP_W / 2) throw new Error('lone point should centre');
if (trendSeries([]).pts.length !== 0) throw new Error('empty should be empty');

console.log('WeightTrendStrip check passed');
export {};
