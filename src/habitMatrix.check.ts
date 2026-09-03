// Self-check for the habit matrix bucketing: what cell goes where, at each cadence.
// The rolling daily window crossing 1 January is the case this whole file exists for.
// Run: npx tsx src/habitMatrix.check.ts
import assert from 'assert';
import { matrixLayout, isoOf, IsoHistory } from './HabitMatrix';

const H = 'Morning Walk';
/** Build history from 'ISO date' -> state, for one habit. */
const hist = (days: Record<string, 'done' | 'failed' | 'na'>): IsoHistory =>
  Object.fromEntries(Object.entries(days).map(([k, v]) => [k, { [H]: v }]));

const at = (cells: { key: string; state: string }[], key: string) => cells.find(c => c.key === key);

// ── local ISO, never UTC ─────────────────────────────────────────────────────
// toISOString() would shift this to the previous day anywhere west of Greenwich.
assert(isoOf(new Date(2026, 6, 31, 0, 30)) === '2026-07-31', 'isoOf reads local date parts');

// ── daily: shape ─────────────────────────────────────────────────────────────
const today = new Date(2026, 6, 31); // Fri 31 Jul 2026
const daily = matrixLayout({ habit: H, cadence: 'daily', history: {}, today });
assert(daily.cells.length === 182, 'six months is 26 columns of 7');
assert(daily.cols === 26 && daily.rows === 7, '26 x 7');
assert(matrixLayout({ habit: H, cadence: 'daily', history: {}, today, span: 'year' }).cells.length === 371,
  'the full-year span is 53 columns of 7');
assert(matrixLayout({ habit: H, cadence: 'daily', history: {}, today, span: '3m' }).cells.length === 91,
  'the quarter span is 13 columns of 7');
assert(matrixLayout({ habit: H, cadence: 'quit', history: {}, today }).cells.length === 182,
  'quit uses the daily grid');

// Days run consecutively, no gaps and no repeats, starting on a Monday.
assert(new Date(daily.cells[0].key + 'T00:00').getDay() === 1, 'the grid starts on a Monday');
assert(new Set(daily.cells.map(c => c.key)).size === 182, 'every cell is a distinct day');
for (let i = 1; i < daily.cells.length; i++) {
  assert(daily.cells[i].key > daily.cells[i - 1].key, 'days ascend with no gaps');
}

// Today sits in the final column, so the newest data is at the right edge.
const todayIdx = daily.cells.findIndex(c => c.key === '2026-07-31');
assert(todayIdx >= 175, 'today lands in the last of the 26 columns');
assert(daily.cells[todayIdx].state !== 'future', 'today is not in the future');
assert(daily.cells[todayIdx + 1].state === 'future', 'tomorrow is');

// ── daily: the 1 January crossing, the reason history is ISO-keyed ───────────
const newYear = new Date(2027, 0, 15); // Fri 15 Jan 2027
const crossing = matrixLayout({
  habit: H,
  cadence: 'daily',
  today: newYear,
  // Same DD/MM, different years. Under the old DD/MM keying these were one cell.
  history: hist({ '2026-08-03': 'done', '2026-12-31': 'failed', '2027-01-01': 'done' }),
});
assert(crossing.cells.some(c => c.key.startsWith('2026-')), 'the window reaches back into last year');
assert(crossing.cells.some(c => c.key.startsWith('2027-')), 'and forward into this one');
assert(at(crossing.cells, '2026-08-03')!.state === 'done', 'last August is done');
assert(at(crossing.cells, '2026-12-31')!.state === 'failed', 'new year eve is a miss');
assert(at(crossing.cells, '2027-01-01')!.state === 'done', 'new year day is done');
assert(at(crossing.cells, '2027-08-03') === undefined, 'this August is not in the window at all');

// ── daily: states, blanks and the nag window ─────────────────────────────────
const marked = matrixLayout({
  habit: H,
  cadence: 'daily',
  today,
  startISO: '2026-01-01',
  history: hist({ '2026-07-30': 'done', '2026-07-29': 'failed', '2026-07-28': 'na' }),
});
assert(at(marked.cells, '2026-07-30')!.state === 'done', 'done carries through');
assert(at(marked.cells, '2026-07-29')!.state === 'failed', 'failed carries through');
assert(at(marked.cells, '2026-07-28')!.state === 'na', 'skipped carries through');
assert(at(marked.cells, '2026-07-27')!.state === 'undeclared', 'a recent unlogged day still nags');
assert(at(marked.cells, '2026-05-01')!.state === 'off', 'an old unlogged day is just empty, not alarm yellow');

const noStart = matrixLayout({ habit: H, cadence: 'daily', history: {}, today });
assert(noStart.cells.every(c => c.state !== 'undeclared'),
  'with no start date nothing is undeclared, so a new habit is not a wall of yellow');

// ── daily: ONE shared axis, whatever the habit's own start date ──────────────
// This is the point of the whole grid: stack two habits and read down a column.
// A young habit used to open on its OWN first Monday, so column N was a different
// date on every card and the cards could not be compared by eye at all.
const young = matrixLayout({ habit: H, cadence: 'daily', history: {}, today, startISO: '2026-07-01' });
const old = matrixLayout({ habit: H, cadence: 'daily', history: {}, today, startISO: '2024-03-01' });
assert(young.cells[0].key === daily.cells[0].key, 'a young habit starts on the same day as every other');
assert(old.cells[0].key === daily.cells[0].key, 'and so does an old one');
assert(young.cells.every((c, i) => c.key === old.cells[i].key),
  'column for column, the two grids cover identical dates — the shared continuum');
assert(young.cells[young.cells.length - 1].key === daily.cells[daily.cells.length - 1].key,
  'and they end together, on the column holding today');

// Before it existed is blank, not a miss: absence is silence, never failure.
assert(at(young.cells, '2026-06-30')!.state === 'pad', 'the day before day one is blank');
assert(at(young.cells, '2026-07-01')!.state !== 'pad', 'day one is live');
assert(young.cells[0].state === 'pad', 'so a young habit opens with blanks, not with its own edge');
assert(old.cells.every(c => c.state !== 'pad'), 'an older habit predates the whole window, so nothing is blank');

// ── daily: month bands, the thing that makes six months readable ─────────────
assert(daily.months && daily.months.length > 0, 'the daily grid carries month bands');
const bands = daily.months!;
assert(bands.every(b => b.col >= 0 && b.col + b.span <= daily.cols), 'every band sits inside the grid');
assert(bands.reduce((n, b) => n + b.span, 0) === daily.cols, 'the bands tile the columns exactly, no overlap');
assert(bands.every((b, i) => i === 0 || b.col === bands[i - 1].col + bands[i - 1].span), 'and run in order');
assert(bands[bands.length - 1].label === 'Jul', 'the last band is the month today sits in');
assert(bands.length === 6, 'a 26-week window spans six months');

// A 53-column span is longer than a year, so the same month appears at both ends
// and the two must not merge into one band — hence keying on year+month, not label.
const yearSpan = matrixLayout({ habit: H, cadence: 'daily', history: {}, today, span: 'year' });
const yb = yearSpan.months!;
assert(yb.length === 13, 'a 53-week window holds 13 month runs, so the two Julys stayed apart');
assert(yb[0].span === 1 && yb[0].label === '', 'a run too narrow to letter is left unlabelled rather than crushed');
assert(yb[yb.length - 1].label === 'Jul' && yb[yb.length - 1].col > yb[0].col,
  'the far July is its own band at the right edge');
assert(yb.reduce((n, b) => n + b.span, 0) === yearSpan.cols, 'and they tile the full year exactly');


// ── weekly ───────────────────────────────────────────────────────────────────
const weekly = matrixLayout({
  habit: H, cadence: 'weekly', today,
  history: hist({ '2026-03-11': 'done' }), // a Wednesday
});
assert(weekly.cells.length === 52 && weekly.cols === 52 && weekly.rows === 1, '52 weeks in one row');
assert(weekly.cells[0].key === '2025-12-29', 'week 1 is the Monday on or before 1 January');
assert(at(weekly.cells, '2026-03-09')!.state === 'done', 'a done Wednesday lights its whole week');
assert(weekly.cells[51].state === 'future', 'the last week of the year has not happened yet');

// Any done day beats a failed one in the same week.
const mixed = matrixLayout({
  habit: H, cadence: 'weekly', today,
  history: hist({ '2026-03-09': 'failed', '2026-03-12': 'done' }),
});
assert(at(mixed.cells, '2026-03-09')!.state === 'done', 'one done day makes the week done');

// ── monthly ──────────────────────────────────────────────────────────────────
const monthly = matrixLayout({
  habit: H, cadence: 'monthly', today,
  history: hist({ '2026-02-14': 'done', '2026-04-02': 'na' }),
});
assert(monthly.cells.length === 12 && monthly.cols === 12, '12 months');
assert(monthly.cells.map(c => c.label).join('') === 'JFMAMJJASOND', 'month initials in order');
assert(at(monthly.cells, '2026-02')!.state === 'done', 'February is done');
assert(at(monthly.cells, '2026-04')!.state === 'na', 'April was skipped');
assert(at(monthly.cells, '2026-03')!.state === 'off', 'March saw nothing');
assert(at(monthly.cells, '2026-08')!.state === 'future', 'August has not started');
assert(at(monthly.cells, '2026-07')!.state !== 'future', 'the current month is live, not future');

// ── yearly: the decade, leaning forward ──────────────────────────────────────
const yearly = matrixLayout({
  habit: H, cadence: 'yearly', history: {}, today,
  yearCounts: { 2024: 5, 2026: 12 },
});
assert(yearly.cells.length === 10 && yearly.cols === 10, 'ten years');
assert(yearly.cells[0].key === '2020' && yearly.cells[9].key === '2029', '2026 sits in the 2020s');
assert(yearly.cells.map(c => c.label).join(' ') === '20 21 22 23 24 25 26 27 28 29', 'two-digit labels');
assert(at(yearly.cells, '2024')!.state === 'done', 'a year with anything logged is done');
assert(at(yearly.cells, '2025')!.state === 'off', 'a year with nothing is empty');
assert(at(yearly.cells, '2026')!.state === 'done', 'including the current year');
assert(['2027', '2028', '2029'].every(y => at(yearly.cells, y)!.state === 'future'),
  'the rest of the decade is still ahead, which is the forward-leaning part');

const startedMid = matrixLayout({
  habit: H, cadence: 'yearly', history: {}, today,
  startISO: '2024-03-01', yearCounts: { 2024: 5 },
});
assert(at(startedMid.cells, '2023')!.state === 'pad', 'years before the habit existed stay blank');
assert(at(startedMid.cells, '2024')!.state === 'done', 'the year it started counts');

// A decade boundary: 2030 must roll to its own decade, not stay in the 2020s.
const nextDecade = matrixLayout({ habit: H, cadence: 'yearly', history: {}, today: new Date(2030, 0, 5) });
assert(nextDecade.cells[0].key === '2030' && nextDecade.cells[9].key === '2039', '2030 opens a new decade');

// ── the period you are in is marked, exactly once, at every cadence ──────────
const currents = (cells: { key: string; current?: boolean }[]) => cells.filter(c => c.current);
assert(currents(daily.cells).length === 1 && currents(daily.cells)[0].key === '2026-07-31', 'today is marked');
assert(currents(young.cells).length === 1, 'marked once on a young habit too');
assert(currents(weekly.cells).length === 1 && currents(weekly.cells)[0].key === '2026-07-27', 'this week is marked');
assert(currents(monthly.cells).length === 1 && currents(monthly.cells)[0].key === '2026-07', 'this month is marked');
assert(currents(yearly.cells).length === 1 && currents(yearly.cells)[0].key === '2026', 'this year is marked');
// A future decade has no "now" cell at all, so the marker must not be assumed.
assert(currents(nextDecade.cells).length === 1, 'the decade you are in always has one');

console.log('habitMatrix: all checks passed.');
