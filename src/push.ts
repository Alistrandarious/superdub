// Client-side Web Push: permission, subscribe, and persist to the server.
import { api } from './api';

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
}

export async function setEveningHour(hour: number): Promise<void> {
  localStorage.setItem(EVENING_HOUR_KEY, String(hour));
  try { await api.pushSetPromptTimes({ eveningHour: hour }); } catch { /* applies on next subscribe */ }
}

export async function setWorkoutHour(hour: number | null): Promise<void> {
  localStorage.setItem(WORKOUT_HOUR_KEY, hour == null ? 'off' : String(hour));
  try { await api.pushSetPromptTimes({ workoutHour: hour }); } catch { /* applies on next subscribe */ }
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
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function pushIsEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === '1'
    && typeof Notification !== 'undefined'
    && Notification.permission === 'granted';
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
