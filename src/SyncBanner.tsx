import React, { useEffect, useState } from 'react';
import { outboxCount } from './outbox';
import { cacheSavedAt } from './readCache';
import './App.css';

// The one place the app admits it is working offline. Two states, one pill:
//
//   writes waiting  → "N changes saved on this device"
//   offline, none   → "Showing your saved data · last updated <when>"
//
// Both fold into the same pill rather than becoming a fourth banner in the
// .update-banner family, because offline reads and pending writes co-occur by
// definition and two stacked pills for one condition is noise.
//
// Deliberately quiet: no action, no dismiss, and it removes itself the moment the
// queue drains and the connection is back. A status line, not a pop-up, so it stays
// outside the pop-up law and adds nothing to the prompt stack.

function since(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs === 1 ? 'an hour ago' : `${hrs} hours ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

const SyncBanner: React.FC = () => {
  const [pending, setPending] = useState(outboxCount);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const [savedAt, setSavedAt] = useState(cacheSavedAt);

  useEffect(() => {
    const sync = () => {
      setPending(outboxCount());
      setSavedAt(cacheSavedAt());
      setOffline(navigator.onLine === false);
    };
    window.addEventListener('superdub:outbox-changed', sync);
    window.addEventListener('superdub:outbox-flushed', sync);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    // Another tab may have drained the queue or refreshed the cache.
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('superdub:outbox-changed', sync);
      window.removeEventListener('superdub:outbox-flushed', sync);
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (pending < 1 && !offline) return null;

  const [title, sub] = pending > 0
    ? [
        pending === 1 ? '1 change saved on this device' : `${pending} changes saved on this device`,
        offline ? "Syncing when you're back online" : 'Syncing now',
      ]
    : ['Showing your saved data', savedAt ? `Last updated ${since(savedAt)}` : "You're offline"];

  return (
    <div className="update-banner outbox-banner" role="status" aria-live="polite">
      <span className="update-banner-text">{title}</span>
      <span className="outbox-banner-sub">{sub}</span>
    </div>
  );
};

export default SyncBanner;
