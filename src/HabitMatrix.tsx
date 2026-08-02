import React from 'react';
import type { Cadence } from './Habits';
import type { HabitState } from './habitState';

// One habit's whole history as a condensed matrix, its granularity set by cadence:
//   daily / quit = a weekday grid, 7 rows. 26 week columns for the rolling six
//                  months on a habit card, 53 for the full year on Progress.
//   weekly       = 52 cells, one per Mon-anchored week of the calendar year
//   monthly      = 12 cells, one per month
//   yearly       = 10 cells, the decade the current year sits in. Years still to
//                  come are drawn as outlines, so the card leans forward.
//
// History is keyed by real ISO dates, NOT the DD/MM the rest of the app uses,
// because a rolling six-month window crosses 1 January for half the year and
// DD/MM alone would collide two years into one cell.

/** ISO day ('YYYY-MM-DD') -> habit name -> state. Mirrors HabitTracker, year-safe. */
export type IsoHistory = Record<string, Record<string, HabitState>>;

export type CellState = 'done' | 'failed' | 'na' | 'undeclared' | 'off' | 'future' | 'pad';

export interface MatrixCell {
  /** ISO day, ISO week-start, 'YYYY-MM' or 'YYYY' depending on cadence. */
  key: string;
  state: CellState;
  /** Rendered inside the cell where there is room for it (monthly, yearly). */
  label?: string;
  /** The period you are in right now: today, this week, this month, this year. */
  current?: boolean;
}

export interface MatrixLayout {
  cells: MatrixCell[];
  cols: number;
  rows: number;
}

export interface MatrixInput {
  habit: string;
  cadence: Cadence;
  history: IsoHistory;
  /** The day to anchor on. Injected rather than read from the clock so the check can pin it. */
  today: Date;
  /** Daily width: six rolling months (habit card) or a full year (Progress). */
  span?: '6m' | 'year';
  /** The habit's start date, 'YYYY-MM-DD'. Anything earlier renders blank. */
  startISO?: string | null;
  /** Done-days per calendar year, for the yearly decade. From the tracker's carryByYear. */
  yearCounts?: Record<number, number>;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local ISO date. Deliberately not toISOString(), which converts to UTC and
 *  shifts the day for every user west of Greenwich. */
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const addDays = (d: Date, n: number) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
};

/** Monday on or before `d`, so every grid row is one weekday. */
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

/** 'YYYY-MM-DD' to a local Date. Null for anything unparseable. */
function parseISO(s: string): Date | null {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

/** An unlogged past day only nags while you can still meaningfully act on it.
 *  Older blanks render as plain empty cells, otherwise a sporadically logged
 *  habit paints six months of alarm yellow and the matrix stops being readable.
 *  ponytail: a flat 7 days, not the habit's own cadence. Revisit if weekly
 *  habits ever want a longer nag window. */
const UNDECLARED_DAYS = 7;

/** A period is done if ANY day inside it is done, else failed, else skipped. */
function periodState(history: IsoHistory, habit: string, days: string[]): CellState {
  let sawFailed = false;
  let sawNa = false;
  for (const k of days) {
    const s = history[k]?.[habit];
    if (s === 'done') return 'done';
    if (s === 'failed') sawFailed = true;
    else if (s === 'na') sawNa = true;
  }
  return sawFailed ? 'failed' : sawNa ? 'na' : 'off';
}

/** Every ISO day in a calendar month, 0-indexed month. */
function daysInMonth(year: number, month: number): string[] {
  const n = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${year}-${pad2(month + 1)}-${pad2(i + 1)}`);
}

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** The pure core: what cell goes where. Exported for habitMatrix.check.ts. */
export function matrixLayout(input: MatrixInput): MatrixLayout {
  const { habit, cadence, history, today, span = '6m', startISO, yearCounts } = input;
  const todayISO = isoOf(today);
  const year = today.getFullYear();
  const before = (iso: string) => !!startISO && iso < startISO;

  // ── Daily / quit: a weekday grid ending on the column that holds today ──
  if (cadence === 'daily' || cadence === 'quit') {
    const cols = span === 'year' ? 53 : 26;
    const nagFrom = isoOf(addDays(today, -UNDECLARED_DAYS));
    const dayCell = (iso: string): CellState => {
      if (before(iso)) return 'pad';
      if (iso > todayISO) return 'future';
      const raw = history[iso]?.[habit];
      if (raw === 'done' || raw === 'failed' || raw === 'na') return raw;
      // A due day you never marked, recent enough to still be worth fixing.
      return startISO && iso >= nagFrom ? 'undeclared' : 'off';
    };
    // Read left to right from day one. A habit younger than the window opens on
    // its own first week, so the run of dots starts at the left edge and the days
    // still to come sit grey after it. Once a habit outgrows the window the grid
    // rolls instead, otherwise recent days would fall off the right.
    const rolling = addDays(mondayOf(today), -7 * (cols - 1));
    const begun = startISO ? parseISO(startISO) : null;
    const start = begun && mondayOf(begun) > rolling ? mondayOf(begun) : rolling;
    const cells = Array.from({ length: cols * 7 }, (_, i) => {
      const iso = isoOf(addDays(start, i));
      return { key: iso, state: dayCell(iso), current: iso === todayISO };
    });
    return { cells, cols, rows: 7 };
  }

  // ── Yearly: the decade the current year sits in ──
  if (cadence === 'yearly') {
    const decade = Math.floor(year / 10) * 10;
    const startYear = startISO ? Number(startISO.slice(0, 4)) : -Infinity;
    const cells = Array.from({ length: 10 }, (_, i) => {
      const y = decade + i;
      const state: CellState =
        y < startYear ? 'pad'
        : y > year ? 'future'
        : (yearCounts?.[y] ?? 0) > 0 ? 'done'
        : 'off';
      return { key: String(y), state, label: String(y).slice(2), current: y === year };
    });
    return { cells, cols: 10, rows: 1 };
  }

  // ── Monthly: 12 cells of the current calendar year ──
  if (cadence === 'monthly') {
    const cells = Array.from({ length: 12 }, (_, m) => {
      const days = daysInMonth(year, m);
      const first = days[0];
      const last = days[days.length - 1];
      const state: CellState =
        before(last) ? 'pad'
        : first > todayISO ? 'future'
        : periodState(history, habit, days);
      return { key: `${year}-${pad2(m + 1)}`, state, label: MONTH_INITIALS[m], current: m === today.getMonth() };
    });
    return { cells, cols: 12, rows: 1 };
  }

  // ── Weekly: 52 Mon-anchored weeks of the current calendar year ──
  const wStart = mondayOf(new Date(year, 0, 1));
  const cells = Array.from({ length: 52 }, (_, w) => {
    const start = addDays(wStart, w * 7);
    const days = Array.from({ length: 7 }, (_, k) => isoOf(addDays(start, k)));
    const state: CellState =
      before(days[6]) ? 'pad'
      : days[0] > todayISO ? 'future'
      : periodState(history, habit, days);
    return { key: days[0], state, current: days.includes(todayISO) };
  });
  return { cells, cols: 52, rows: 1 };
}

const HabitMatrix: React.FC<MatrixInput & { className?: string }> = ({ className, ...input }) => {
  const { cells, cols, rows } = matrixLayout(input);
  const kind = input.cadence === 'quit' ? 'daily' : input.cadence;
  const span = input.span === 'year' ? ' hmx--span-year' : '';
  return (
    <div
      className={`hmx hmx--${kind}${span}${className ? ` ${className}` : ''}`}
      style={{ '--hmx-cols': cols, '--hmx-rows': rows } as React.CSSProperties}
      aria-hidden="true"
    >
      {cells.map(c => (
        <span key={c.key} className={`hmx-cell hmx-${c.state}${c.current ? ' hmx-now' : ''}`}>{c.label}</span>
      ))}
    </div>
  );
};

export default HabitMatrix;
