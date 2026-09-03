import React, { useEffect, useState } from 'react';
import { outboxCount } from './outbox';
import './App.css';

// "Your taps are kept" — the one visible sign that a write is waiting on a
// connection. Without it, ticking a habit offline looks identical to ticking it
// online right up until the tick disappears, which is the trust problem the outbox
// exists to fix.
//
// Deliberately quiet: it reuses the update-banner pill (already fixed above the
// bottom nav and safe-area aware), carries no action and no dismiss control, and
// removes itself the moment the queue drains. It is a status line, not a pop-up, so
// it stays outside the pop-up law and adds nothing to the prompt stack.
const OutboxBanner: React.FC = () => {
  const [count, setCount] = useState(outboxCount);

  useEffect(() => {
    const sync = () => setCount(outboxCount());
    window.addEventListener('superdub:outbox-changed', sync);
    // Another tab may have drained the queue.
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('superdub:outbox-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (count < 1) return null;

  return (
    <div className="update-banner outbox-banner" role="status" aria-live="polite">
      <span className="update-banner-text">
        {count === 1 ? '1 change saved on this device' : `${count} changes saved on this device`}
      </span>
      <span className="outbox-banner-sub">Syncing when you're back online</span>
    </div>
  );
};

export default OutboxBanner;
