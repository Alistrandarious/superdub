import React, { useEffect, useRef, useState } from 'react';
import './App.css';

// Returns the filename of the main JS bundle currently executing (e.g. "main.8e8f5eb7.js").
// Each production build emits a new content-hash, so this is a reliable build fingerprint.
function currentMainBundle(): string | null {
  const src = Array.from(document.getElementsByTagName('script'))
    .map(el => el.getAttribute('src') || '')
    .find(s => /\/static\/js\/main\.[\w]+\.js/.test(s));
  return src ? src.replace(/^.*\/static\/js\//, '') : null;
}

/**
 * Polls the deployed index.html and compares its main-bundle hash to the one
 * we're running. When they differ, a new version has shipped — we surface a
 * banner that does a cache-busting reload so the user always lands on latest.
 */
const UpdateBanner: React.FC = () => {
  const [stale, setStale] = useState(false);
  const running = useRef<string | null>(currentMainBundle());

  useEffect(() => {
    let active = true;

    const check = async () => {
      if (!running.current || !active) return;
      try {
        const res = await fetch(`/index.html?_=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const html = await res.text();
        const m = html.match(/\/static\/js\/main\.[\w]+\.js/);
        if (!m) return;
        const deployed = m[0].replace(/^.*\/static\/js\//, '');
        if (deployed !== running.current && active) setStale(true);
      } catch {
        /* offline or fetch blocked — ignore, try again later */
      }
    };

    check();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    const id = window.setInterval(check, 5 * 60 * 1000); // every 5 min

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(id);
    };
  }, []);

  if (!stale) return null;

  const reload = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.update()));
      }
    } catch {
      /* best-effort cache clear */
    }
    window.location.reload();
  };

  return (
    <div className="update-banner">
      <span className="update-banner-text">New version available</span>
      <button className="update-banner-btn" onClick={reload}>Update</button>
    </div>
  );
};

export default UpdateBanner;
