import { useEffect } from 'react';
import { getBackground, getTheme } from './levels';

// Applies the equipped app-background theme and the light/dark mode globally.
// - data-theme on <html> flips the colour tokens (see App.css :root[data-theme="light"]).
// - --app-bg-base is the base layer .app paints under its per-page glow. In dark mode we set
//   the chosen coloured gradient inline; in light mode we clear it so the light default (from the
//   [data-theme="light"] block) wins — an inline value would otherwise beat the stylesheet.
const BackgroundApplier: React.FC = () => {
  useEffect(() => {
    const apply = () => {
      const root = document.documentElement;
      const theme = getTheme();
      root.dataset.theme = theme;
      if (theme === 'light') root.style.removeProperty('--app-bg-base');
      else root.style.setProperty('--app-bg-base', getBackground().grad);
      // Keep the PWA status bar with the theme. index.html sets this at boot from
      // storage; without this the bar stays on the old colour until a full reload.
      document.querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', theme === 'light' ? '#F5F6FA' : '#07090C');
    };
    apply();
    window.addEventListener('superdub:bg-changed', apply);
    window.addEventListener('superdub:theme-changed', apply);
    window.addEventListener('storage', apply);
    return () => {
      window.removeEventListener('superdub:bg-changed', apply);
      window.removeEventListener('superdub:theme-changed', apply);
      window.removeEventListener('storage', apply);
    };
  }, []);
  return null;
};

export default BackgroundApplier;
