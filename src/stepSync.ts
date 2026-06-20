// On-launch / on-resume step sync. Reads recent daily steps from the phone's
// health store and pushes them to the backend, tagged with the platform source.
// Completely inert on web/PWA — guarded by isNative().
import { api, isLoggedIn } from './api';
import { isNative, platformSource, requestStepPermission, readDailySteps } from './health';

const LAST_SYNC_KEY = 'superdub.steps.lastSync';
const MIN_INTERVAL_MS = 60 * 60 * 1000; // throttle to at most hourly
const SYNC_DAYS = 7;

let installed = false;

function throttled(): boolean {
  const last = Number(localStorage.getItem(LAST_SYNC_KEY) || 0);
  return Date.now() - last < MIN_INTERVAL_MS;
}

/**
 * Pull recent steps from the device and POST them. Returns the number of days written.
 * `force` bypasses the hourly throttle (used by a manual "sync now" action).
 */
export async function syncSteps(force = false): Promise<number> {
  if (!isNative() || !isLoggedIn()) return 0;
  if (!force && throttled()) return 0;

  const source = platformSource();
  if (!source) return 0;

  const ok = await requestStepPermission();
  if (!ok) return 0;

  const daily = await readDailySteps(SYNC_DAYS);
  if (daily.length === 0) {
    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
    return 0;
  }

  try {
    const res = await api.bulkSteps(daily.map(d => ({ day: d.date, source, steps: d.steps })));
    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
    // Let the rest of the app (charts, KPIs, tracker grid) refresh.
    window.dispatchEvent(new CustomEvent('superdub:tracker-updated'));
    return res?.written ?? daily.length;
  } catch {
    return 0;
  }
}

/** Wire up sync on launch and whenever the app returns to the foreground. */
export function initStepSync() {
  if (installed || !isNative()) return;
  installed = true;

  // Initial sync shortly after boot (don't block first paint).
  setTimeout(() => { void syncSteps(); }, 1500);

  // Re-sync when the app returns to the foreground. The Capacitor webview fires
  // visibilitychange on resume (same mechanism the heartbeat in index.tsx uses),
  // so we avoid a hard dependency on the @capacitor/app plugin.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncSteps();
  });
}
