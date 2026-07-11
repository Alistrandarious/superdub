// Quit habits (abstinence timers): a continual clock counts up from the moment
// the current clean run began; the bar fills over 30 days. Rewind resets the
// start to now. No "done" — just staying clean over time. Pure helpers (no React,
// no CSS) so they're unit-testable on their own.

export const QUIT_GOAL_MS = 30 * 24 * 60 * 60 * 1000;

// 0 at the start, 1 once 30 days are reached, capped there. Never negative.
export function quitProgress(startedAtMs: number, nowMs: number): number {
  if (!startedAtMs || nowMs <= startedAtMs) return 0;
  return Math.min(1, (nowMs - startedAtMs) / QUIT_GOAL_MS);
}

// Break the elapsed clean time into days / hours / minutes / seconds.
export function quitElapsed(startedAtMs: number, nowMs: number) {
  let s = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  const days = Math.floor(s / 86400); s -= days * 86400;
  const hours = Math.floor(s / 3600); s -= hours * 3600;
  const mins = Math.floor(s / 60); s -= mins * 60;
  return { days, hours, mins, secs: s };
}

// datetime-local value (YYYY-MM-DDTHH:MM) for a Date, in local time.
export function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
