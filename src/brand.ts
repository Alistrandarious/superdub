import { useSyncExternalStore } from 'react';

// The wordmark is "super<nick>" — superali, superben, or the default superdub.
// The nick is the user's chosen short name; we cache it in localStorage so every
// header (there are several, un-prop-drilled) can render it without a fetch, and
// broadcast changes over a window event so open headers update live.

const KEY = 'superdub.nickname';
const EVENT = 'superdub:nickname';

// Collapse whatever the user typed into a tight lowercase token that sits next to
// "super" like "dub" does. Falls back to "dub" when nothing usable is left.
export function nickToWordmark(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '') || 'dub';
}

export function getBrandNick(): string {
  const raw = (typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) || '';
  return nickToWordmark(raw);
}

export function setBrandNick(nick: string): void {
  localStorage.setItem(KEY, nick ?? '');
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb); // cross-tab
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

// Re-renders the caller whenever the nick changes.
export function useBrandNick(): string {
  return useSyncExternalStore(subscribe, getBrandNick, () => 'dub');
}
