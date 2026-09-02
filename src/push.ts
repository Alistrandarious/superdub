// Reminders. Two delivery mechanisms behind one door:
//
//   web    → Web Push (VAPID), scheduled server-side by runReminders.
//   native → local notifications scheduled on the device.
//
// The native branch exists because Web Push does not work inside a Capacitor
// WKWebView: 'PushManager' in window is false there, so pushSupported() returned
// false and the whole reminders block was hidden. Every daily reminder in
// PROMPTS.md was silently missing from the iOS build — for a habit tracker, the
// one feature it cannot do without.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { api } from './api';

const isNativeApp = () => Capacitor.isNativePlatform();

const ENABLED_KEY = 'superdub.push.enabled';
const REMINDER_HOUR_KEY = 'superdub.push.reminderHour';
const EVENING_HOUR_KEY = 'superdub.push.eveningHour';   // evening reflection nudge
const WORKOUT_HOUR_KEY = 'superdub.push.workoutHour';   // 'off' or 0–23

function hourOr(key: string, dflt: number): number {
  const v = parseInt(localStorage.getItem(key) ?? String(dflt), 10);
  return Number.isInteger(v) && v >= 0 && v <= 23 ? v : dflt;
}

export function getReminderHour(): number { return hourOr(REMINDER_HOUR_KEY, 8); }
export function getEveningHour(): number { return hourOr(EVENING_HOUR_KEY, 20); }

// Exercise prompt is opt-in: null = off.
export function getWorkoutHour(): number | null {
  const raw = localStorage.getItem(WORKOUT_HOUR_KEY);
  if (raw == null || raw === 'off') return null;
  const v = parseInt(raw, 10);
  return Number.isInteger(v) && v >= 0 && v <= 23 ? v : null;
}

export async function setReminderHour(hour: number): Promise<void> {
  localStorage.setItem(REMINDER_HOUR_KEY, String(hour));
  try { await api.pushSetReminderTime(hour); } catch { /* will apply on next subscribe */ }
  await syncLocalReminders();
}

export async function setEveningHour(hour: number): Promise<void> {
  localStorage.setItem(EVENING_HOUR_KEY, String(hour));
  try { await api.pushSetPromptTimes({ eveningHour: hour }); } catch { /* applies on next subscribe */ }
  await syncLocalReminders();
}

export async function setWorkoutHour(hour: number | null): Promise<void> {
  localStorage.setItem(WORKOUT_HOUR_KEY, hour == null ? 'off' : String(hour));
  try { await api.pushSetPromptTimes({ workoutHour: hour }); } catch { /* applies on next subscribe */ }
  await syncLocalReminders();
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  if (isNativeApp()) return true; // local notifications, not Web Push
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function pushIsEnabled(): boolean {
  if (isNativeApp()) return localStorage.getItem(ENABLED_KEY) === '1';
  return localStorage.getItem(ENABLED_KEY) === '1'
    && typeof Notification !== 'undefined'
    && Notification.permission === 'granted';
}

/** Ask the OS for permission to post notifications. Safe to call before an account exists. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (isNativeApp()) {
    try {
      const res = await LocalNotifications.requestPermissions();
      return res.display === 'granted';
    } catch { return false; }
  }
  if (typeof Notification === 'undefined') return false;
  try { return (await Notification.requestPermission()) === 'granted'; } catch { return false; }
}

// The three daily reminders, matching the hours already in the cog menu. Fixed ids
// so rescheduling replaces rather than stacks.
const DAILY = [
  { id: 1, hour: getReminderHour, title: 'Morning check-in', body: 'Weigh in and set up your day.' },
  { id: 2, hour: getEveningHour, title: 'Evening check-in', body: 'How did today go?' },
  { id: 3, hour: getWorkoutHour, title: 'Training', body: 'Time to move.' },
];

/** Reschedule the device's daily reminders from the stored hours. Native only. */
export async function syncLocalReminders(): Promise<void> {
  if (!isNativeApp()) return;
  const ids = DAILY.map(d => ({ id: d.id }));
  try { await LocalNotifications.cancel({ notifications: ids }); } catch { /* none pending */ }
  if (localStorage.getItem(ENABLED_KEY) !== '1') return;
  const notifications = DAILY
    .map(d => ({ d, hour: d.hour() }))
    .filter((x): x is { d: typeof DAILY[number]; hour: number } => x.hour != null)
    .map(({ d, hour }) => ({
      id: d.id,
      title: d.title,
      body: d.body,
      schedule: { on: { hour, minute: 0 }, allowWhileIdle: true },
    }));
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}

/** Turn reminders on through whichever mechanism this platform actually has. */
export async function enableReminders(): Promise<{ ok: boolean; reason?: string }> {
  if (!isNativeApp()) return enablePush();
  if (!(await requestNotificationPermission())) {
    return { ok: false, reason: 'Notifications are blocked. Turn them on for Superdub in Settings.' };
  }
  localStorage.setItem(ENABLED_KEY, '1');
  await syncLocalReminders();
  return { ok: true };
}

/** Turn reminders off through whichever mechanism this platform actually has. */
export async function disableReminders(): Promise<void> {
  if (!isNativeApp()) return disablePush();
  localStorage.removeItem(ENABLED_KEY);
  await syncLocalReminders();
}

export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: 'This device/browser does not support push.' };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'Notifications were blocked. Enable them in your browser settings.' };

  const reg = await navigator.serviceWorker.ready;
  let key = '';
  try { key = (await api.getVapidKey()).key; } catch { /* */ }
  if (!key) return { ok: false, reason: 'Push is not configured on the server yet.' };

  try {
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });
    await api.pushSubscribe(sub.toJSON(), new Date().getTimezoneOffset(), getReminderHour(), getWorkoutHour(), getEveningHour());
    localStorage.setItem(ENABLED_KEY, '1');
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? 'Could not subscribe to push.' };
  }
}

export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api.pushUnsubscribe(sub.endpoint).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch { /* */ }
  localStorage.removeItem(ENABLED_KEY);
}
