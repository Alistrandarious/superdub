// Analytics — a thin wrapper over PostHog that is DORMANT by default.
//
// It captures nothing unless BOTH are true (see analyticsActive in consent.ts):
//   1. REACT_APP_POSTHOG_KEY is set in the build environment, and
//   2. the user has granted consent (stored once, never re-asked).
//
// So this file is safe to ship before a key exists: with no key it is a set of
// no-ops and the app builds and runs exactly as before. The instant a key is
// added to the environment and the user has consented, capture starts.
import posthog from 'posthog-js';
import { analyticsConsent, storeConsent, analyticsActive } from './consent';

const KEY = process.env.REACT_APP_POSTHOG_KEY;
// EU host by default — Superdub is a UK/EU GDPR product, so data residency stays
// in the EU unless the environment overrides it.
const HOST = process.env.REACT_APP_POSTHOG_HOST || 'https://eu.i.posthog.com';

let started = false;

/**
 * Initialise PostHog if — and only if — a key exists and consent is granted.
 * Called on app load and again the moment consent is granted, so it is safe to
 * call more than once; the `started` guard makes every call after the first a
 * no-op. Returns whether analytics is now live.
 */
export function initAnalytics(): boolean {
  if (started) return true;
  if (!analyticsActive(KEY, analyticsConsent())) return false;
  posthog.init(KEY as string, {
    api_host: HOST,
    person_profiles: 'identified_only', // no anonymous person profiles
    autocapture: false,                 // never capture arbitrary clicks or input values
    capture_pageview: true,
    disable_session_recording: true,
    persistence: 'localStorage',
  });
  started = true;
  return true;
}

/** Record the user's one-time decision. Granting starts capture immediately. */
export function setAnalyticsConsent(granted: boolean): void {
  storeConsent(granted);
  if (granted) initAnalytics();
}

/** Capture an event. No-ops silently until analytics is live. */
export function capture(event: string, props?: Record<string, unknown>): void {
  if (!started) return;
  try { posthog.capture(event, props); } catch { /* never let telemetry break the app */ }
}

/** Tie events to a stable user id (called after login). No-ops until live. */
export function identify(id: string | number): void {
  if (!started) return;
  try { posthog.identify(String(id)); } catch { /* ignore */ }
}

/** True when a key is configured at all — lets the UI skip the consent prompt
 *  entirely on builds that ship without analytics. */
export function analyticsConfigured(): boolean {
  return !!KEY;
}
