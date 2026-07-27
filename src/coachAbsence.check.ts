// Self-check: the coach must not manufacture failure out of silence.
// A gap in the record means the person wasn't there. It is not a run of misses,
// and it must not drag adherence down, trigger the rescue line, or nag for a walk.
// The second half is the guard that matters most: someone who WAS here and simply
// skipped must still get the honest struggle line.
// Run: npx tsx src/coachAbsence.check.ts
import assert from 'assert';
import { buildCoachReport, HabitMeta, TrackerHabitRow } from './coach';

// 30 days of January, today is the 30th.
const allDays = Array.from({ length: 30 }, (_, i) => `${String(i + 1).padStart(2, '0')}/01`);
const TODAY = '30/01';
const habits: HabitMeta[] = [
  { name: 'Walking', startDate: '2026-01-01', cadence: 'daily' },
  { name: 'Reading', startDate: '2026-01-01', cadence: 'daily' },
];
const done = (day: string, habit_name: string): TrackerHabitRow => ({ day, habit_name, state: 'done' });
const report = (rows: TrackerHabitRow[]) => {
  const r = buildCoachReport([], habits, rows, allDays, TODAY, null);
  assert(r, 'report should build');
  return r!;
};

// ── Someone back after a three-week gap ──────────────────────────────────────
// Walking done on the 1st to the 9th, then nothing at all until today. They have
// just opened the app and marked nothing yet.
const away = report(allDays.slice(0, 9).flatMap(d => [done(d, 'Walking'), done(d, 'Reading')]));

assert(!away.lines.some(l => l.title.startsWith("Let's rescue")),
  'a gap must not produce the rescue line');
assert(!away.lines.some(l => /days missed in a row/.test(l.body)),
  'a gap must not be reported as consecutive misses');
assert(!away.wantsWalk,
  'do not nag someone for a walk on their first morning back');
assert(!away.lines.some(l => l.tone === 'warn'),
  'nothing about being away is a warning');

// ── Someone who was here every day and skipped anyway ────────────────────────
// Reading marks their presence on all 30 days; Walking goes unmarked throughout.
// Same "Walking has no rows lately" shape as above, opposite verdict, because
// this time the silence sits inside days they actually showed up for.
const present = report(allDays.map(d => done(d, 'Reading')));

assert(present.lines.some(l => l.title === "Let's rescue Walking"),
  'a habit skipped on days they were present still gets called out');
assert(present.lines.some(l => /7 days missed in a row/.test(l.body)),
  'those misses are still counted honestly');

console.log('coachAbsence.check.ts OK');
