// Thin wrapper around the unified capacitor-health plugin (HealthKit on iOS,
// Health Connect on Android). Read-only step access. No-ops gracefully on web.
import { Capacitor } from '@capacitor/core';
import { Health } from 'capacitor-health';
import type { StepSource } from './api';

export interface DailySteps {
  /** local calendar date as YYYY-MM-DD */
  date: string;
  steps: number;
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Which provenance source this platform's data should be tagged with. */
export function platformSource(): StepSource | null {
  const p = Capacitor.getPlatform();
  if (p === 'android') return 'health_connect';
  if (p === 'ios') return 'healthkit';
  return null;
}

/** True if the OS health store is usable (Health Connect installed / HealthKit present). */
export async function healthAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { available } = await Health.isHealthAvailable();
    return available;
  } catch {
    return false;
  }
}

/** Prompt for read-steps permission. Returns true if we can proceed to read. */
export async function requestStepPermission(): Promise<boolean> {
  if (!(await healthAvailable())) return false;
  try {
    const res = await Health.requestHealthPermissions({ permissions: ['READ_STEPS'] });
    // Android reports per-permission booleans; iOS can't reliably report grants and
    // returns an optimistic response — treat a non-empty response as "go ahead and read".
    const granted = res?.permissions?.some(p => Object.values(p).some(Boolean));
    return granted ?? true;
  } catch {
    return false;
  }
}

// Format a Date as local-time YYYY-MM-DD (avoids UTC slice off-by-one).
function localYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Read daily step totals for the last `days` days (including today), bucketed per day.
 * Returns [] on web or if unavailable/denied.
 */
export async function readDailySteps(days = 7): Promise<DailySteps[]> {
  if (!isNative()) return [];
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  try {
    const res = await Health.queryAggregated({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      dataType: 'steps',
      bucket: 'day',
    });
    return (res.aggregatedData ?? [])
      .map(sample => ({
        date: localYMD(new Date(sample.startDate)),
        steps: Math.round(sample.value),
      }))
      .filter(s => s.steps > 0);
  } catch {
    return [];
  }
}
