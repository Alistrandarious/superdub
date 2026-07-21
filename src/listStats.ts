// Hero maths for the Lists page. Pure and separate from the components so the
// numbers under the progress bar have one runnable check (listsHero.check.ts).

export interface ListStats {
  done: number;
  total: number;
  overdue: number;
  pct: number; // 0..100, floored at 0 for an empty list
}

/** Anything the hero can count: a checkbox and an optional 'YYYY-MM-DD' due date. */
export interface Countable {
  done: boolean;
  dueDate?: string;
}

// Due dates are stored as local 'YYYY-MM-DD' (what <input type="date"> emits),
// so a lexical string compare is a correct date compare with no timezone parsing.
const isOverdue = (i: Countable, today: string) => !i.done && !!i.dueDate && i.dueDate < today;

/** Progress for one Lists tab. `today` is a 'YYYY-MM-DD' key (see day.ts). */
export function listStats(items: ReadonlyArray<Countable>, today: string): ListStats {
  const total = items.length;
  const done = items.reduce((n, i) => n + (i.done ? 1 : 0), 0);
  const overdue = items.reduce((n, i) => n + (isOverdue(i, today) ? 1 : 0), 0);
  return { done, total, overdue, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Soonest due date among the unfinished items, or null when none carry one. */
export function nextDue(items: ReadonlyArray<Countable>): string | null {
  return items.reduce<string | null>((best, i) => {
    if (i.done || !i.dueDate) return best;
    return best === null || i.dueDate < best ? i.dueDate : best;
  }, null);
}

/** Whole days from `today` to `iso`; negative when it has already passed. */
export function daysUntil(iso: string, today: string): number {
  const a = Date.parse(`${today}T00:00:00`);
  const b = Date.parse(`${iso}T00:00:00`);
  return Math.round((b - a) / 86400000);
}
