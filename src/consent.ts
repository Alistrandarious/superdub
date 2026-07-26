// Analytics consent — the pure, posthog-free half, so it stays testable without
// mocking a browser SDK. analytics.ts builds the PostHog wiring on top of this.
//
// Consent is captured ONCE (per product decision): new users accept during
// signup, existing users see a single full-screen notice, and it never re-asks.

export const CONSENT_KEY = 'superdub.analyticsConsent';
export type Consent = 'granted' | 'denied';

/** The stored decision, or null when the user has not been asked yet. */
export function analyticsConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null; // private mode / storage disabled
  }
}

/** Persist the one-time decision. */
export function storeConsent(granted: boolean): void {
  try {
    localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
  } catch {
    /* private mode: analytics simply stays off */
  }
}

/**
 * The whole gate, as one pure decision: analytics runs only when a key is
 * configured AND the user has explicitly granted consent. No key OR no consent
 * (including a "denied" or not-yet-asked null) means it stays dormant.
 */
export function analyticsActive(key: string | undefined | null, consent: Consent | null): boolean {
  return !!key && consent === 'granted';
}
