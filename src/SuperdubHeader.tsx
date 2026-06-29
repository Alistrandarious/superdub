import React from 'react';
import CogMenu from './CogMenu';
import StreakFlame from './StreakFlame';

// The standard superdub brand header, shared across the main nav pages so the
// logo + wordmark sit identically everywhere. The day-streak flame + cog menu
// show on the right by default (every page gets them); extra actions passed via
// children appear to their left. Pass cog={false} to hide the cog.
const SuperdubHeader: React.FC<{ children?: React.ReactNode; cog?: boolean }> = ({ children, cog = true }) => (
  <div className="hb-topbar">
    <div className="hb-brand">
      <img className="hb-brand-logo" src="/superdub-logo.png" alt="" />
      <span className="hb-brand-name">super<span className="hb-brand-dub">dub</span></span>
    </div>
    <div className="hb-topbar-actions">
      {children}
      <StreakFlame />
      {cog && <CogMenu />}
    </div>
  </div>
);

export default SuperdubHeader;
