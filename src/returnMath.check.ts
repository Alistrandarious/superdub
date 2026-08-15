// Self-check for the Return Review. Run: npx tsx src/returnMath.check.ts
import assert from 'assert';
import { buildReturnReview, quitAsk, type ReturnReviewInput } from './returnMath';
import type { TrackerHabitRow } from './coach';

const YEAR = 2026;
const ALL_DAYS = (() => {
  const d: string[] = [];
  for (let m = 0; m < 12; m++) {
    const n = new Date(YEAR, m + 1, 0).getDate();
    for (let day = 1; day <= n; day++) d.push(`${String(day).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}`);
  }
  return d;
})();

/** The Lapsed profile: 90 strong days, a 42-day hole, then 7 days back. */
const STRONG = 90, HOLE = 42, BACK = 7;
const TOTAL = STRONG + HOLE + BACK;
const todayIdx = 200;
const TODAY = ALL_DAYS[todayIdx];
const startIdx = todayIdx - (TOTAL - 1);

function lapsedRows(): TrackerHabitRow[] {
  const rows: TrackerHabitRow[] = [];
  for (let i = 0; i < TOTAL; i++) {
    const inHole = i >= STRONG && i < STRONG + HOLE;
    if (inHole) continue;                          // away: no rows at all, not 'failed' rows
    const day = ALL_DAYS[startIdx + i];
    // 9 of every 10 present days are done, so adherence sits at 90%.
    rows.push({ day, habit_name: 'Read', state: i % 10 === 3 ? 'failed' : 'done' });
  }
  return rows;
}

const base: ReturnReviewInput = {
  gapDays: HOLE,
  daysSinceReturn: BACK - 1,
  habits: [
    { name: 'Read', startDate: null, cadence: 'daily' },
    { name: 'Vaping', startDate: null, cadence: 'quit' },
  ],
  trackerHabits: lapsedRows(),
  allDays: ALL_DAYS,
  today: TODAY,
  weights: [],
  moods: [],
  quitStarts: { Vaping: Date.UTC(2026, 0, 1) },
  nowMs: Date.UTC(2026, 3, 2),
};

// ── The claim the whole first step rests on ──────────────────────────────────
// A gap must not cost you a level or a percentage point. If this ever fails, the
// screen is lying to someone who just came back, which is the worst possible
// moment to be caught doing it.
const withGap = buildReturnReview(base);
const noGap = buildReturnReview({
  ...base,
  gapDays: 0,
  daysSinceReturn: null,
  // Same present days, just with the hole closed up so they run contiguously.
  trackerHabits: lapsedRows().map((r, i) => ({ ...r, day: ALL_DAYS[startIdx + i] })),
});
const gapRead = withGap.held.find(h => h.name === 'Read')!;
const flatRead = noGap.held.find(h => h.name === 'Read')!;
assert(gapRead, 'the gap profile still reports the habit');
assert.strictEqual(gapRead.level, flatRead.level, 'a gap does not cost a habit level');
assert.strictEqual(gapRead.doneDays, flatRead.doneDays, 'days banked survive a gap untouched');
assert(Math.abs(gapRead.adherence - flatRead.adherence) < 1e-9, 'adherence counts presence, so a gap cannot dilute it');
assert(gapRead.adherence > 0.85, `90% of present days done reads as ~0.9, got ${gapRead.adherence}`);
assert(gapRead.held, 'holding 90% of the days you were here counts as held');

// ── Habits with nothing banked stay off the board ────────────────────────────
const withNever = buildReturnReview({
  ...base,
  habits: [...base.habits, { name: 'Cold shower', startDate: null, cadence: 'daily' }],
});
assert(!withNever.held.some(h => h.name === 'Cold shower'), 'a habit never once done has nothing to say about what held');

// ── Quit habits are asked about, never asserted, and never in `held` ─────────
assert(!withGap.held.some(h => h.name === 'Vaping'), 'quit habits are not adherence rows');
assert.strictEqual(withGap.quit.length, 1, 'the quit habit shows up in its own step');
assert(withGap.quit[0].days > 0, 'the clean clock reads a real number of days');
assert(/kept running/.test(quitAsk(91)), 'the quit line admits the clock ran on its own');
assert(/91 days/.test(quitAsk(91)) && /1 day\b/.test(quitAsk(1)), 'the quit line pluralises');

// ── Weight and mood across the gap ───────────────────────────────────────────
const beforeIdx = startIdx + STRONG - 1;         // last day before the hole
const afterIdx = startIdx + STRONG + HOLE;       // first day back
const withBoth = buildReturnReview({
  ...base,
  weights: [
    { day: ALL_DAYS[beforeIdx], weight: 84.1 },
    { day: ALL_DAYS[afterIdx], weight: 86.5 },
  ],
  moods: [
    { date: isoOf(beforeIdx), mood: 7 },
    { date: isoOf(afterIdx), mood: 5 },
  ],
});
assert(withBoth.weight, 'a weigh-in either side of the gap gives a reading');
assert(Math.abs(withBoth.weight!.delta - 2.4) < 1e-9, `weight delta is after minus before, got ${withBoth.weight!.delta}`);
assert(withBoth.mood, 'a check-in either side of the gap gives a reading');
assert.strictEqual(withBoth.mood!.before, 7, 'mood before the gap');
assert.strictEqual(withBoth.mood!.after, 5, 'mood since coming back');

// A weigh-in only on ONE side is not a comparison, so it reports nothing rather
// than comparing a real number against a guess.
const oneSided = buildReturnReview({ ...base, weights: [{ day: ALL_DAYS[afterIdx], weight: 86.5 }] });
assert.strictEqual(oneSided.weight, null, 'one weigh-in is not a before and after');

// ── The DD/MM ceiling is admitted, not papered over ──────────────────────────
// A gap reaching back past 1 January cannot be read from year-agnostic keys.
const yearCross = buildReturnReview({ ...base, today: ALL_DAYS[20], gapDays: 60, daysSinceReturn: 0 });
assert(yearCross.spansYearStart, 'a gap over the year boundary is flagged');
assert.strictEqual(yearCross.weight, null, 'no invented before-weight across the year boundary');
assert.strictEqual(yearCross.mood, null, 'no invented before-mood across the year boundary');

// ── A gap longer than the server's 120-day lookback still renders ────────────
const longGap = buildReturnReview({ ...base, gapDays: 150, daysSinceReturn: 0 });
assert(Array.isArray(longGap.held), 'a gap past the server lookback does not throw');

// ── Sparse: thin data must not crash the steps ───────────────────────────────
const sparse = buildReturnReview({
  ...base, gapDays: 4, daysSinceReturn: 0,
  trackerHabits: [{ day: ALL_DAYS[todayIdx], habit_name: 'Read', state: 'done' }],
  quitStarts: {},
});
assert.strictEqual(sparse.held.length, 1, 'one done day is still something that held');
assert.strictEqual(sparse.quit.length, 0, 'no quit habits, no quit step');

// ── An unknown "today" degrades to empty rather than throwing ────────────────
const bogus = buildReturnReview({ ...base, today: '99/99' });
assert.strictEqual(bogus.held.length, 0, 'an unrecognised today yields nothing, not a crash');

function isoOf(i: number): string {
  const [d, m] = ALL_DAYS[i].split('/');
  return `${YEAR}-${m}-${d}`;
}

console.log('returnMath.check.ts OK');
