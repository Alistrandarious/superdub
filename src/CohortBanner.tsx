import React, { useState } from 'react';
import { UsersIc } from './icons';

// The cold-start framing a new account gets: which community cohort they landed in
// and the step baseline that comes with it.
//
// This used to render on /dashboard, which a new user has no reason to open — they
// land on home. So the one piece of "here is your day one" context was shown to
// the people least likely to see it. It lives on home now.
//
// The step number it quotes is real: signup writes cohort.baselineSteps to
// profile.step_target (server/routes/auth.ts), where it used to keep the 10000
// default while this banner promised something else.

const CohortBanner: React.FC = () => {
  const [msg] = useState<string | null>(() => localStorage.getItem('superdub:cohort-msg'));
  const [name] = useState<string | null>(() => localStorage.getItem('superdub:cohort-name'));
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem('superdub:cohort-dismissed'));

  if (!msg || dismissed) return null;

  return (
    <div className="cohort-banner">
      <div className="cohort-banner-inner">
        <div className="cohort-banner-header">
          <span className="cohort-banner-icon"><UsersIc size={16} /></span>
          <span className="cohort-banner-label">Expert Coach · Community Cohort</span>
          <button
            className="cohort-banner-dismiss"
            aria-label="Dismiss"
            onClick={() => {
              setDismissed(true);
              localStorage.setItem('superdub:cohort-dismissed', '1');
            }}
          >✕</button>
        </div>
        {name && <div className="cohort-banner-name">{name}</div>}
        <p className="cohort-banner-msg">{msg}</p>
      </div>
    </div>
  );
};

export default CohortBanner;
