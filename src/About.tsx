import React from 'react';
import { Link } from 'react-router-dom';
import './App.css';

const LEVEL_GATES = [
  [0, 'Rookie'], [100, 'Beginner'], [300, 'Novice'], [700, 'Apprentice'],
  [1500, 'Adept'], [3000, 'Journeyman'], [5000, 'Expert'], [8000, 'Elite'],
  [12000, 'Champion'], [18000, 'Legend'], [28000, 'Grandmaster'],
  [42000, 'Mythic'], [60000, 'Immortal'], [85000, 'Eternal'], [120000, 'Transcendent'],
];

const XP_GATES = [
  { streak: '0d', xp: 10, label: 'Base' },
  { streak: '7d', xp: 15, label: 'Week streak' },
  { streak: '14d', xp: 20, label: 'Two weeks' },
  { streak: '30d', xp: 25, label: 'Monthly' },
  { streak: '60d', xp: 30, label: 'Two months' },
  { streak: '100d', xp: 35, label: 'Triple digits' },
  { streak: '200d', xp: 40, label: 'Elite' },
  { streak: '365d', xp: 50, label: 'Year strong' },
];

const About: React.FC = () => {
  return (
    <div className="app" style={{ '--theme': '#0a84ff', '--theme-dim': '#0a84ff66', '--theme-glow': '#0a84ff22' } as React.CSSProperties}>
      <header className="header">
        <div className="header-left">
          <Link to="/" className="back-link">← Back</Link>
        </div>
        <h1 className="title">About</h1>
      </header>

      <div className="page-content" style={{ maxWidth: 680, margin: '0 auto', overflowY: 'auto', flex: 1, paddingBottom: 60 }}>

        {/* Who made it */}
        <div className="diet-section" style={{ marginBottom: 20 }}>
          <h2 className="diet-heading">Who made this?</h2>
          <p className="about-text">
            Superdub was built by <a href="https://linkedin.com/in/alis" target="_blank" rel="noreferrer" className="about-name-link">Ali Shah</a> — a builder who wanted one clean place to track habits, nutrition, and weight without subscriptions, dark patterns, or bloat.
          </p>
          <p className="about-text">
            Everything runs on your data. No ads. No algorithms trying to keep you addicted. Just the tools you need.
          </p>
        </div>

        {/* Why */}
        <div className="diet-section" style={{ marginBottom: 20 }}>
          <h2 className="diet-heading">Why Superdub?</h2>
          <p className="about-text">
            Most habit apps feel like a chore. They nag you with notifications, gate features behind paywalls, or bury the information you actually care about.
          </p>
          <p className="about-text">
            Superdub is designed to feel good to open. The XP system rewards consistency rather than perfection — one grace miss per streak means life happens, and that's okay.
          </p>
        </div>

        {/* The math — XP */}
        <div className="diet-section" style={{ marginBottom: 20 }}>
          <h2 className="diet-heading">The XP System</h2>
          <p className="about-text">
            Each habit earns XP per day completed. The longer your streak, the more XP you earn per completion.
          </p>
          <div className="about-table-wrap">
            <table className="about-table">
              <thead>
                <tr><th>Streak</th><th>XP / day</th><th>Gate</th></tr>
              </thead>
              <tbody>
                {XP_GATES.map(g => (
                  <tr key={g.streak}>
                    <td>{g.streak}</td>
                    <td>+{g.xp} XP</td>
                    <td>{g.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="about-text" style={{ marginTop: 12 }}>
            One grace miss is allowed per streak — miss a day and your streak holds. Miss two in a row and it resets. Misses in the first week of a new habit don't count against you.
          </p>
        </div>

        {/* The math — Levels */}
        <div className="diet-section" style={{ marginBottom: 20 }}>
          <h2 className="diet-heading">Levels</h2>
          <p className="about-text">
            Your total XP across all habits determines your account level. XP accumulates forever — it never resets.
          </p>
          <div className="about-table-wrap">
            <table className="about-table">
              <thead>
                <tr><th>Level</th><th>Title</th><th>XP required</th></tr>
              </thead>
              <tbody>
                {LEVEL_GATES.map(([xp, title], i) => (
                  <tr key={i}>
                    <td>Lv.{i + 1}</td>
                    <td>{title as string}</td>
                    <td>{(xp as number).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Calorie math */}
        <div className="diet-section" style={{ marginBottom: 20 }}>
          <h2 className="diet-heading">Calorie Targets</h2>
          <p className="about-text">
            Calorie targets are calculated using the <strong>Mifflin–St Jeor equation</strong> for Basal Metabolic Rate (BMR), then multiplied by an activity factor (TDEE).
          </p>
          <div className="about-formula">
            <code>BMR (male) = 10 × weight(kg) + 6.25 × height(cm) − 5 × age + 5</code>
            <code>BMR (female) = 10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161</code>
            <code>TDEE = BMR × activity factor</code>
          </div>
          <p className="about-text" style={{ marginTop: 12 }}>
            Macros are split from your calorie target: protein at 4 kcal/g, carbs at 4 kcal/g, fat at 9 kcal/g. You can lock individual macros to prevent recalculation.
          </p>
        </div>

        {/* Ideas / contact */}
        <div className="diet-section" style={{ marginBottom: 40 }}>
          <h2 className="diet-heading">Got an idea?</h2>
          <p className="about-text">
            Feature requests, feedback, and ideas are always welcome. Send them directly to Ali:
          </p>
          <a
            href="mailto:Ali.Shah@Layerdigital.uk"
            className="about-contact-btn"
          >
            Ali.Shah@Layerdigital.uk
          </a>
        </div>

      </div>
    </div>
  );
};

export default About;
