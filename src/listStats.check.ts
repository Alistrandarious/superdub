// Runnable self-check for the Lists hero maths. Run: npx tsx src/listStats.check.ts
import assert from 'assert';
import { listStats, nextDue, daysUntil, type Countable } from './listStats';

const TODAY = '2026-07-20';

// ── Empty list: no divide-by-zero, no phantom progress ──────────────────────
const empty = listStats([], TODAY);
assert(empty.total === 0 && empty.done === 0, 'empty list counts nothing');
assert(empty.pct === 0, 'empty list is 0%, not NaN');
assert(empty.overdue === 0, 'empty list has no overdue items');
assert(nextDue([]) === null, 'empty list has no next deadline');

// ── Counting done vs total ──────────────────────────────────────────────────
const mixed: Countable[] = [
  { done: true },
  { done: true },
  { done: false },
  { done: false },
];
const m = listStats(mixed, TODAY);
assert(m.total === 4 && m.done === 2, 'counts done against total');
assert(m.pct === 50, 'half done reads 50%');

// Rounding: 1 of 3 is 33%, not 33.33.
assert(listStats([{ done: true }, { done: false }, { done: false }], TODAY).pct === 33, 'pct is a whole number');
assert(Number.isInteger(listStats([{ done: true }, { done: false }, { done: false }], TODAY).pct), 'pct never carries a fraction');

// ── The overdue boundary: yesterday is late, today is not ───────────────────
const dated: Countable[] = [
  { done: false, dueDate: '2026-07-19' }, // yesterday → overdue
  { done: false, dueDate: '2026-07-20' }, // today → NOT overdue
  { done: false, dueDate: '2026-07-21' }, // tomorrow → not overdue
  { done: true,  dueDate: '2026-01-01' }, // long past but done → not overdue
  { done: false },                        // no due date → never overdue
];
const d = listStats(dated, TODAY);
assert(d.overdue === 1, 'only the genuinely late, unfinished item is overdue');
assert(d.total === 5 && d.done === 1, 'overdue counting does not disturb done/total');

// ── Next deadline picks the soonest OPEN one ────────────────────────────────
assert(nextDue(dated) === '2026-07-19', 'nextDue returns the soonest open due date');
assert(
  nextDue([{ done: true, dueDate: '2026-07-01' }, { done: false, dueDate: '2026-08-01' }]) === '2026-08-01',
  'nextDue skips completed items even when they are earlier',
);
assert(nextDue([{ done: false }, { done: true }]) === null, 'nextDue is null when nothing carries a date');

// ── daysUntil signs the gap the way the copy reads it ───────────────────────
assert(daysUntil('2026-07-20', TODAY) === 0, 'today is 0 days out');
assert(daysUntil('2026-07-21', TODAY) === 1, 'tomorrow is 1 day out');
assert(daysUntil('2026-07-19', TODAY) === -1, 'yesterday is -1, so overdue copy can use the sign');
// Across a month boundary, where naive date maths goes wrong.
assert(daysUntil('2026-08-01', TODAY) === 12, 'spans a month end correctly');
// Across a DST change (clocks go back in most of Europe on 2026-10-25), where an
// hours-based diff would land on 30.96 days and floor to the wrong answer.
assert(daysUntil('2026-11-01', '2026-10-01') === 31, 'a DST shift does not eat a day');

console.log('listsHero.check.ts: all assertions passed');
