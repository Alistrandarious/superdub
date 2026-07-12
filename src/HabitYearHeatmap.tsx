import React from 'react';
import type { Cadence } from './Habits';

// A whole-year heatmap for one habit, its granularity set by cadence:
//   daily / quit = a GitHub-style day grid (7 rows, ~53 week columns = 365 days)
//   weekly       = 52 cells (one per week)
//   monthly      = 12 cells (one per month)
//   yearly       = 1 cell (the whole year)
// `tracker` is App's shape: DD/MM -> { habits: { name: true | 'failed' | 'na' | false } }.
type Tracker = Record<string, { habits: Record<string, unknown> }>;

const pad = (n: number) => String(n).padStart(2, '0');
const ddmm = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

// Colour class from a stored state (true = done, 'failed', 'na', else nothing yet).
function cls(state: unknown, future: boolean): string {
  if (future) return 'hy-future';
  if (state === true) return 'hy-done';
  if (state === 'failed') return 'hy-failed';
  if (state === 'na') return 'hy-na';
  return 'hy-off';
}

// A period cell is done if ANY day inside it is done, else failed, else na, else off.
function periodState(tracker: Tracker, habit: string, days: string[]): unknown {
  if (days.some(k => tracker[k]?.habits[habit] === true)) return true;
  if (days.some(k => tracker[k]?.habits[habit] === 'failed')) return 'failed';
  if (days.some(k => tracker[k]?.habits[habit] === 'na')) return 'na';
  return null;
}

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

const HabitYearHeatmap: React.FC<{ habit: string; cadence: Cadence; year: number; tracker: Tracker }> = ({ habit, cadence, year, tracker }) => {
  const nowMs = Date.now();

  // ── Daily / quit: 7×53 day grid ──
  if (cadence === 'daily' || cadence === 'quit') {
    const start = new Date(year, 0, 1);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // back to Monday on/before Jan 1
    const cells: { cls: string }[] = [];
    const cursor = new Date(start);
    for (let i = 0; i < 371; i++) {
      const inYear = cursor.getFullYear() === year;
      const future = cursor.getTime() > nowMs;
      const st = inYear ? tracker[ddmm(cursor)]?.habits[habit] : undefined;
      cells.push({ cls: inYear ? cls(st, future) : 'hy-pad' });
      cursor.setDate(cursor.getDate() + 1);
    }
    return (
      <div className="hy-grid hy-grid--daily">
        {cells.map((c, i) => <span key={i} className={`hy-cell ${c.cls}`} />)}
      </div>
    );
  }

  // ── Yearly: a single cell for the whole year ──
  if (cadence === 'yearly') {
    const days: string[] = [];
    for (let m = 0; m < 12; m++) {
      const dim = new Date(year, m + 1, 0).getDate();
      for (let d = 1; d <= dim; d++) days.push(`${pad(d)}/${pad(m + 1)}`);
    }
    const st = periodState(tracker, habit, days);
    return <div className="hy-grid hy-grid--year"><span className={`hy-cell hy-cell--wide ${cls(st, false)}`}>{year}</span></div>;
  }

  // ── Monthly: 12 cells ──
  if (cadence === 'monthly') {
    const cells = Array.from({ length: 12 }, (_, m) => {
      const dim = new Date(year, m + 1, 0).getDate();
      const days = Array.from({ length: dim }, (_, i) => `${pad(i + 1)}/${pad(m + 1)}`);
      const future = new Date(year, m, 1).getTime() > nowMs;
      return cls(periodState(tracker, habit, days), future);
    });
    return (
      <div className="hy-grid hy-grid--monthly">
        {cells.map((c, m) => <span key={m} className={`hy-cell hy-cell--labelled ${c}`}>{MONTHS[m]}</span>)}
      </div>
    );
  }

  // ── Weekly: 52 cells (Mon-anchored weeks from the first Monday of the year) ──
  const wStart = new Date(year, 0, 1);
  wStart.setDate(wStart.getDate() - ((wStart.getDay() + 6) % 7));
  const weeks = Array.from({ length: 52 }, (_, w) => {
    const days: string[] = [];
    const d = new Date(wStart); d.setDate(wStart.getDate() + w * 7);
    let anyInYear = false;
    for (let k = 0; k < 7; k++) {
      if (d.getFullYear() === year) { days.push(ddmm(d)); anyInYear = true; }
      d.setDate(d.getDate() + 1);
    }
    const weekStart = new Date(wStart); weekStart.setDate(wStart.getDate() + w * 7);
    const future = weekStart.getTime() > nowMs;
    return anyInYear ? cls(periodState(tracker, habit, days), future) : 'hy-pad';
  });
  return (
    <div className="hy-grid hy-grid--weekly">
      {weeks.map((c, w) => <span key={w} className={`hy-cell ${c}`} />)}
    </div>
  );
};

export default HabitYearHeatmap;
