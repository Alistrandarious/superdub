import React, { useEffect, useRef } from 'react';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

// Loads Google Identity Services once and resolves when window.google is ready.
let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if ((window as any).google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`) as HTMLScriptElement | null;
    if (existing) { existing.addEventListener('load', () => resolve()); return; }
    const s = document.createElement('script');
    s.src = GIS_SRC; s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google sign-in'));
    document.head.appendChild(s);
  });
  return gisPromise;
}

// Renders Google's official sign-in button. On success it hands back the ID token.
const GoogleAuthButton: React.FC<{ onCredential: (idToken: string) => void; text?: 'signin_with' | 'signup_with' | 'continue_with' }> = ({ onCredential, text = 'continue_with' }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CLIENT_ID) return; // not configured — render nothing
    let cancelled = false;
    loadGis().then(() => {
      if (cancelled || !ref.current) return;
      const g = (window as any).google;
      g.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (resp: any) => { if (resp?.credential) onCredential(resp.credential); },
      });
      ref.current.innerHTML = '';
      g.accounts.id.renderButton(ref.current, {
        type: 'standard', theme: 'filled_black', size: 'large', shape: 'pill',
        text, logo_alignment: 'center', width: 280,
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [onCredential, text]);

  if (!CLIENT_ID) return null;
  return (
    <div className="google-auth-wrap">
      <div ref={ref} className="google-auth-btn" />
    </div>
  );
};

export default GoogleAuthButton;
