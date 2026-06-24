import React from 'react';
import { BUILD_TAG } from './version';

// The standard superdub brand header, shared across the main nav pages so the
// logo + wordmark + build tag sit identically everywhere. Optional right-side
// actions slot in via children.
const SuperdubHeader: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="hb-topbar">
    <div className="hb-brand">
      <img className="hb-brand-logo" src="/superdub-logo.png" alt="" />
      <span className="hb-brand-name">super<span className="hb-brand-dub">dub</span></span>
      <span className="hb-build-tag">{BUILD_TAG}</span>
    </div>
    {children && <div className="hb-topbar-actions">{children}</div>}
  </div>
);

export default SuperdubHeader;
