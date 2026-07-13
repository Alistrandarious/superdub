import React from 'react';
import './App.css';
import SuperdubHeader from './SuperdubHeader';
import GlobalHabitCard from './GlobalHabitCard';
import GlobalPlanet from './GlobalPlanet';
import FriendsPanel from './FriendsPanel';
import { pageTheme, GOLD } from './theme';

// Global & Friends — the community tab. Houses this month's shared Global habit
// (climbed by every Superdubber) and, soon, a friends layer. Logging a deed opens
// the existing GlobalPrompt overlay (mounted app-wide) via superdub:show-global.
const CommunityPage: React.FC = () => {
  return (
    <div className="app flush" style={pageTheme(GOLD)}>
      <SuperdubHeader />

      {/* Hero — a living planet, pinned to the top third */}
      <div className="community-hero">
        <span className="community-eyebrow">GLOBAL &amp; FRIENDS</span>
        <div className="community-hero-stage">
          <div className="community-hero-orb">
            <span className="community-hero-orbit community-hero-orbit--a" />
            <span className="community-hero-orbit community-hero-orbit--b" />
            <GlobalPlanet size={220} />
          </div>
        </div>
        <div className="community-hero-copy">
          <h2 className="community-hero-title">One planet, one habit</h2>
          <p className="community-sub">Climb one shared habit with every Superdubber, and cheer on the friends you add.</p>
        </div>
      </div>

      <div className="page-content community-content">
        <GlobalHabitCard />

        <button
          className="community-deed-btn"
          onClick={() => window.dispatchEvent(new CustomEvent('superdub:show-global'))}
        >
          Log a good deed
        </button>

        <FriendsPanel />
      </div>
    </div>
  );
};

export default CommunityPage;
