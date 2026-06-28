import React from 'react';
import { BUILD_TAG } from './version';
import CogMenu from './CogMenu';

// The standard superdub brand header, shared across the main nav pages so the
// logo + wordmark + build tag sit identically everywhere. The cog menu shows on
// the right by default (every page gets it); extra actions passed via children
// appear to its left. Pass cog={false} to hide it.
const SuperdubHeader: React.FC<{ children?: React.ReactNode; cog?: boolean }> = ({ children, cog = true }) => (
  <div className="hb-topbar">
    <div className="hb-brand">
      <img className="hb-brand-logo" src="/superdub-logo.png" alt="" />
      <span className="hb-brand-name">super<span className="hb-brand-dub">dub</span></span>
      <span className="hb-build-tag">{BUILD_TAG}</span>
    </div>
    <div className="hb-topbar-actions">
      {children}
      {cog && <CogMenu />}
    </div>
  </div>
);

export default SuperdubHeader;
