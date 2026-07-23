// Self-check for the lapse window derivation.
// Run: npx tsx server/lapseWindow.check.ts
import assert from 'assert';
import { deriveLapseWindow, gapDayKeys } from './lapseWindow';

const TODAY = '2026-07-23';

// ── nothing ever logged ──────────────────────────────────────────────────────
const none = deriveLapseWindow([], TODAY);
assert(none.daysSinceLog === Infinity && !none.hadPriorActivity, 'empty history has no prior activity');
assert(gapDayKeys([], TODAY).length === 0, 'nothing to restore with no history');

// ── logging daily ────────────────────────────────────────────────────────────
const daily = ['2026-07-19', '2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23'];
const a = deriveLapseWindow(daily, TODAY);
assert(a.daysSinceLog === 0 && a.hadPriorActivity, 'logged today');
assert(a.daysSinceReturn === null && a.lastGapDays === 0, 'an unbroken run has no gap');

// duplicates, disorder and future dates must not change the answer
assert(deriveLapseWindow([...daily, ...daily, '2026-12-01'].reverse(), TODAY).daysSinceLog === 0,
  'dupes, disorder and future dates are ignored');

// ── currently lapsed ─────────────────────────────────────────────────────────
const gone = deriveLapseWindow(['2026-07-10', '2026-07-11', '2026-07-12'], TODAY);
assert(gone.daysSinceLog === 11, '11 days since the last log');
assert(gone.daysSinceReturn === null, 'an open gap is not a return');
assert(gone.lastGapDays === 11, 'the open gap is the one a restore would cover');

// ── came back yesterday after a week away ────────────────────────────────────
const back = deriveLapseWindow(['2026-07-10', '2026-07-11', '2026-07-22'], TODAY);
assert(back.daysSinceLog === 1, 'logged yesterday');
assert(back.daysSinceReturn === 1, 'the 22nd ended the gap, one day ago');
assert(back.lastGapDays === 11, 'the closed gap spans the 11th to the 22nd');

// Skipping a single day is under the threshold and is not a gap at all. (A 3-day
// step between logs IS one: on that third morning, before logging, they read as
// lapsed — same rule daysSinceLog uses, so the two agree.)
const blip = deriveLapseWindow(['2026-07-19', '2026-07-21', '2026-07-23'], TODAY);
assert(blip.daysSinceReturn === null && blip.lastGapDays === 0, 'every-other-day is not a gap');

// ── the days a restore fills in ──────────────────────────────────────────────
const keys = gapDayKeys(['2026-07-10', '2026-07-11', '2026-07-22'], TODAY);
assert(keys.length === 10, 'the 12th through the 21st, both endpoints excluded');
assert(keys[0].day === '12/07' && keys[9].day === '21/07', 'DD/MM, endpoints excluded');
assert(keys.every(k => k.year === 2026), 'year travels with the day');

// An open gap fills from the last log up to today (today itself is theirs to mark).
const openKeys = gapDayKeys(['2026-07-20'], TODAY);
assert(openKeys.length === 2 && openKeys[0].day === '21/07' && openKeys[1].day === '22/07',
  'an open gap fills the quiet days but not today');

// A dormant account cannot ask us to write a year of rows.
assert(gapDayKeys(['2025-01-01', '2026-07-22'], TODAY).length === 60, 'restore is capped at 60 days');

console.log('lapseWindow.check.ts OK');
