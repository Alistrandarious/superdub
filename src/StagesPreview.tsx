import React from 'react';
import { Link } from 'react-router-dom';
import './App.css';
import './StagesPreview.css';
import { pageTheme, GROWTH } from './theme';
import { readStage, type UserStage } from './userStage';

// A design/QA screen: the three surfaces that adapt (Home, Dub's brief, Progress)
// shown side by side for each stage, with the viewer's own stage marked.
// ponytail: the brief body is representative (prod composes it live from data);
// the home caption and Dub thought here mirror the exact prod strings in
// Habits.tsx / dubBrief.ts — if those change, update these two to match.

type Stage = { id: UserStage; name: string; who: string; rule: React.ReactNode };
const STAGES: Stage[] = [
  { id: 'new', name: 'New', who: 'day 3 · level 1', rule: <>joined <b>&lt; 7 days</b>, or level <b>≤ 2</b></> },
  { id: 'regular', name: 'Regular', who: 'wk 5 · level 4', rule: <>the broad middle: <b>momentum, not mastery</b></> },
  { id: 'super', name: 'Super', who: '212-day streak · lvl 9', rule: <>level <b>≥ 7</b> and a live <b>21-day</b> streak</> },
];

const StagesPreview: React.FC = () => {
  const mine = readStage();

  return (
    <div className="app flush" style={pageTheme(GROWTH, '22')}>
      <div className="page-content" style={{ maxWidth: 1180, margin: '0 auto', overflowY: 'auto', flex: 1, paddingBottom: 60 }}>
        <div className="page-intro-row">
          <Link to="/profile" className="page-back"><span className="page-back-arrow">‹</span> More</Link>
          <h1 className="page-intro-title">Your stages</h1>
        </div>

        <div className="stages-preview">
          <p className="sp-lede">
            The same three surfaces, read by <span className="sp-brand">super</span>dub for who's looking.
            Your stage comes from one blend of signals you already track: tenure, level, and your live check-in streak.
          </p>

          <div className="sp-rules">
            {STAGES.map(s => (
              <div key={s.id} className={`sp-rule${mine === s.id ? ' mine' : ''}`} style={{ ['--rc' as any]: `var(--sp-${s.id === 'new' ? 'health' : s.id === 'regular' ? 'growth' : 'gold'})` }}>
                <span className="sp-tag">{s.name}</span>
                <span className="sp-cond">{s.rule}</span>
                {mine === s.id && <span className="sp-here">You're here</span>}
              </div>
            ))}
          </div>

          <div className="sp-grid">

            {/* ── NEW ── */}
            <div className="sp-col" data-stage="new">
              <div className="sp-colhead"><span className="sp-dot" /><span className="sp-name">New</span><span className="sp-who">day 3 · level 1</span></div>
              <div className="sp-phone">
                <div className="sp-card">
                  <div className="sp-lbl"><span className="t">Home · Habits</span><span className="sp-flag">teaches</span></div>
                  <div className="sp-week"><div className="sp-day">M</div><div className="sp-day">T</div><div className="sp-day done">W</div><div className="sp-day today">T</div><div className="sp-day">F</div><div className="sp-day">S</div><div className="sp-day">S</div></div>
                  <div className="sp-cap teach">Tick a habit each day to grow your streak. Dub coaches you as you go.</div>
                  <div className="sp-pwa"><div className="ic" /><div className="tx">Add <b>super</b>dub to your home screen</div><div className="xp">+100 XP</div></div>
                </div>
                <div className="sp-card">
                  <div className="sp-lbl"><span className="t">Dub · morning brief</span><span className="sp-flag">warmer</span></div>
                  <div className="sp-brief">Morning. You slept 7.4 hours last night. That's a strong base. The scale says 86.2 kg, down 0.1 on your last weigh-in. <span className="nu">You're just getting started, so keep it simple: tick one habit today.</span></div>
                  <div className="sp-dubrow"><div className="sp-face" /><div className="sp-thought intro">Hi, I'm Dub. Tap me.</div></div>
                </div>
                <div className="sp-card">
                  <div className="sp-lbl"><span className="t">Progress</span><span className="sp-flag">cohort framing</span></div>
                  <div className="sp-cohort"><span className="t">Expert Coach · Community Cohort</span><div className="cn">Steady starters, losing gently</div><div className="cm">Your day-one targets come from people who started where you are, no 2-week wait to calibrate.</div></div>
                </div>
              </div>
            </div>

            {/* ── REGULAR ── */}
            <div className="sp-col" data-stage="regular">
              <div className="sp-colhead"><span className="sp-dot" /><span className="sp-name">Regular</span><span className="sp-who">wk 5 · level 4</span></div>
              <div className="sp-phone">
                <div className="sp-card">
                  <div className="sp-lbl"><span className="t">Home · Habits</span></div>
                  <div className="sp-week"><div className="sp-day done">M</div><div className="sp-day done">T</div><div className="sp-day done">W</div><div className="sp-day today done">T</div><div className="sp-day">F</div><div className="sp-day">S</div><div className="sp-day">S</div></div>
                  <div className="sp-cap"><span className="n">6</span>-day check-in streak · keep it alive</div>
                  <div className="sp-pwa"><div className="ic" /><div className="tx">Add <b>super</b>dub to your home screen</div><div className="xp">+100 XP</div></div>
                </div>
                <div className="sp-card">
                  <div className="sp-lbl"><span className="t">Dub · morning brief</span></div>
                  <div className="sp-brief">Morning. You slept 7.4 hours last night. That's a strong base. The scale says 86.2 kg, down 0.1 on your last weigh-in. Today's one job: Reading. Pair it with your coffee so it always has a slot. Aim for about 11,000 steps and 1,950 kcal.</div>
                  <div className="sp-dubrow"><div className="sp-face" /><div className="sp-thought">Tap me for a chat.</div></div>
                </div>
                <div className="sp-card">
                  <div className="sp-lbl"><span className="t">Progress</span></div>
                  <div className="sp-absent">no cohort banner, past cold start</div>
                </div>
              </div>
            </div>

            {/* ── SUPER ── */}
            <div className="sp-col" data-stage="super">
              <div className="sp-colhead"><span className="sp-dot" /><span className="sp-name">Super</span><span className="sp-who">212-day streak · lvl 9</span></div>
              <div className="sp-phone">
                <div className="sp-card">
                  <div className="sp-lbl"><span className="t">Home · Habits</span><span className="sp-flag">denser</span></div>
                  <div className="sp-week"><div className="sp-day done">M</div><div className="sp-day done">T</div><div className="sp-day done">W</div><div className="sp-day today done">T</div><div className="sp-day done">F</div><div className="sp-day done">S</div><div className="sp-day done">S</div></div>
                  <div className="sp-cap"><span className="n">212</span>-day check-in streak · keep it alive</div>
                  <div className="sp-absent">install nudge hidden, already installed</div>
                </div>
                <div className="sp-card">
                  <div className="sp-lbl"><span className="t">Dub · morning brief</span><span className="sp-flag">terser</span></div>
                  <div className="sp-brief"><span className="v">You slept 7.4 hours last night. That's a strong base. The scale says 86.2 kg, down 0.1 on your last weigh-in.</span></div>
                  <div className="sp-dubrow"><div className="sp-face" /><div className="sp-thought">Tap me for a chat.</div></div>
                </div>
                <div className="sp-card">
                  <div className="sp-lbl"><span className="t">Progress</span></div>
                  <div className="sp-absent">no cohort framing, veteran</div>
                </div>
              </div>
            </div>

          </div>

          <div className="sp-foot">
            <span>Signals: <code>accountCreatedAt</code> · <code>playerLevel</code> · <code>dayStreak</code></span>
            <span>Thresholds live in <code>src/userStage.ts</code></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StagesPreview;
