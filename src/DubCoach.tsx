import React from 'react';
import DubMascot, { getMascot } from './DubMascot';
import { getDubColor } from './levels';

// Dub as the onboarding host (Duolingo-style): he hops in and asks the screen's
// question from a speech bubble. He wears whatever species/colour the user has
// chosen, so once they customise him he keeps showing up as their Dub.
// Placed inside the per-screen keyed wrapper in Auth.tsx, so he re-mounts each
// screen and the hop replays; alternating `side` makes him bounce around.
const DubCoach: React.FC<{
  line: string;
  side?: 'left' | 'right';
  mood?: 'happy' | 'neutral' | 'concerned';
  size?: number;
}> = ({ line, side = 'left', mood = 'happy', size = 84 }) => (
  <div className={`dub-coach dub-coach--${side}`}>
    <div className="dub-coach-pet">
      <DubMascot size={size} mood={mood} species={getMascot()} colorId={getDubColor().id} />
    </div>
    <div className="dub-coach-bubble">{line}</div>
  </div>
);

export default DubCoach;
