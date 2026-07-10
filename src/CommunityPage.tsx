import React from 'react';
import './App.css';
import SuperdubHeader from './SuperdubHeader';
import GlobalHabitCard from './GlobalHabitCard';
import { pageTheme, GOLD } from './theme';

// Global & Friends — the community tab. Houses this month's shared Global habit
// (climbed by every Superdubber) and, soon, a friends layer. Logging a deed opens
// the existing GlobalPrompt overlay (mounted app-wide) via superdub:show-global.
const CommunityPage: React.FC = () => {
  return (
    <div className="app flush" style={pageTheme(GOLD)}>
      <SuperdubHeader />
      <div className="page-content community-content">
        <div className="community-intro">
          <span className="community-eyebrow">GLOBAL &amp; FRIENDS</span>
          <p className="community-sub">Climb one shared habit with every Superdubber — and soon, with your friends.</p>
        </div>

        <GlobalHabitCard />

        <button
          className="community-deed-btn"
          onClick={() => window.dispatchEvent(new CustomEvent('superdub:show-global'))}
        >
          Log a good deed
        </button>

        <section className="community-friends">
          <span className="community-eyebrow">FRIENDS</span>
          <div className="community-soon">
            <p className="community-soon-title">Friends are coming soon</p>
            <p className="community-soon-sub">You'll be able to add friends, cheer each other on, and climb the habit together.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CommunityPage;
