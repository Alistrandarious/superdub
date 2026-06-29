import { useEffect } from 'react';
import { getBackground } from './levels';

// Applies the equipped app-background theme globally by setting the --app-bg-base
// CSS variable that .app paints under its per-page glow. Re-applies on change.
const BackgroundApplier: React.FC = () => {
  useEffect(() => {
    const apply = () => {
      document.documentElement.style.setProperty('--app-bg-base', getBackground().grad);
    };
    apply();
    window.addEventListener('superdub:bg-changed', apply);
    window.addEventListener('storage', apply);
    return () => {
      window.removeEventListener('superdub:bg-changed', apply);
      window.removeEventListener('storage', apply);
    };
  }, []);
  return null;
};

export default BackgroundApplier;
