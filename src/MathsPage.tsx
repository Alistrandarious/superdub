import React from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';
import SuperdubHeader from './SuperdubHeader';
import { STRIDE_M, KCAL_PER_KG_KM, KCAL_PER_KG, kcalPerStep } from './energy';

// ── The Maths — every number the app shows, written out so you can
// cross-reference it against what you see. This page documents what the code
// ACTUALLY does (same constants imported where possible), not an idealised
// version. If a number on screen disagrees with this page, that's a bug —
// report it.

interface MathSection {
  emoji: string;
  title: string;
  where: string;
  formula: string[];
  explain: string[];
  example?: string;
}

const KG = 88; // worked-example body weight

const SECTIONS: MathSection[] = [
  {
    emoji: '🔥',
    title: 'BMR & maintenance (TDEE)',
    where: 'Progress · Diet · Plan engine',
    formula: [
      'BMR = 10·kg + 6.25·cm − 5·age + 5   (male)',
      'BMR = 10·kg + 6.25·cm − 5·age − 161 (female)',
      'TDEE = BMR × activity (1.2–1.9)',
    ],
    explain: [
      'Mifflin–St Jeor equation. Weight, height and age come from your Profile; sex picks the constant.',
      'TDEE ("maintenance") is what you burn in a normal day at your activity level — eat exactly this and your weight holds.',
    ],
    example: `88 kg, 178 cm, 30y male, 1.55 activity → BMR ≈ 1,842 kcal → TDEE ≈ 2,855 kcal.`,
  },
  {
    emoji: '🎯',
    title: 'Calorie target',
    where: 'Progress · Diet',
    formula: [
      'dailyDeficit = lossPerWeek × 7700 ÷ 7',
      'target = max(TDEE − dailyDeficit, 1200)',
    ],
    explain: [
      `1 kg of body weight stores ≈ ${KCAL_PER_KG.toLocaleString()} kcal — the one constant behind almost everything here.`,
      'The target never prescribes below 1,200 kcal, and the adaptive plan engine additionally floors at your BMR.',
    ],
    example: '0.5 kg/wk → 550 kcal/day deficit → 2,855 − 550 = 2,305 kcal target.',
  },
  {
    emoji: '👟',
    title: 'Steps & walking burn',
    where: 'Progress · Diet · Weekly recap — same constants everywhere',
    formula: [
      `stride = ${STRIDE_M} m   →   km = steps × ${STRIDE_M} ÷ 1000`,
      `burn = ${KCAL_PER_KG_KM} kcal per kg per km`,
      'kcal/step = stride(km) × 0.5 × your kg',
    ],
    explain: [
      'Walking cost scales with body weight: heavier body, more energy per step.',
      'Previously three pages used three different per-step values (0.034–0.050 kcal at 88 kg). They now all share this one formula.',
    ],
    example: `At ${KG} kg: ${kcalPerStep(KG).toFixed(3)} kcal/step → 10,000 steps ≈ ${Math.round(kcalPerStep(KG) * 10000)} kcal.`,
  },
  {
    emoji: '🐶',
    title: "Dub's weekly change",
    where: 'Dub on Progress + coach report',
    formula: [
      'week = weigh-ins from the last 7 days (incl. today)',
      'change = LAST weigh-in − FIRST weigh-in in that window',
    ],
    explain: [
      'No regression, no extrapolation: literally your first and last logged weights inside the trailing 7 days, and Dub quotes both numbers so you can check him.',
      'Needs the two points to be ≥ 3 days apart to call it "this week"; with fewer points he falls back to a 14-day trend and says "lately" instead.',
      'His goal ETA divides the remaining kg by this pace (normalised to a full 7 days).',
    ],
    example: 'Weigh-ins 88.6 (Mon) … 87.9 (Sun) → "0.7 kg down this week (88.6 → 87.9)".',
  },
  {
    emoji: '📉',
    title: 'Weight chart: trend, smoothed & projection',
    where: 'Progress weight chart',
    formula: [
      'Smoothed (EMA): today = 0.25 × weight + 0.75 × yesterday\'s EMA',
      'Trend: least-squares straight line through the plotted weigh-ins',
      'Projection: trend line extended forward from today',
    ],
    explain: [
      'The EMA damps daily water-weight noise — the same α = 0.25 the server engine uses.',
      'The dashed trend is fitted to whichever date range you have selected, so switching ranges changes its slope. That is expected.',
    ],
  },
  {
    emoji: '🛟',
    title: 'Safe-zone corridor',
    where: 'Progress weight chart (gold band)',
    formula: [
      'ideal(t) = startWeight + t × (targetWeight − startWeight)',
      't = days since plan start ÷ total plan days',
      'corridor = ideal ± 1.5 kg, from plan start to target date',
    ],
    explain: [
      'A straight line from your plan\'s start anchor to your goal, with 1.5 kg of grace either side.',
      'The anchor survives plan edits (v2.294) and the dates are compared at local midnight, so the band starts exactly on your start day.',
    ],
  },
  {
    emoji: '🍽️',
    title: 'Estimated intake',
    where: 'Progress · Estimated Intake chart',
    formula: [
      'slope = 7-day change in smoothed weight, per day',
      'intake ≈ TDEE(day) + (steps − your avg steps) × kcal/step + slope × 7700',
    ],
    explain: [
      'You never log calories — this reverse-engineers them from energy balance: what you burned, plus or minus what your weight trend says you stored or released.',
      'TDEE(day) uses your smoothed weight that day, so it falls as you lose. Step deviation is measured against your own average, not a fixed 10k.',
      'It is an estimate: day-to-day it can be off by hundreds of kcal (water, sodium, timing); over 1–2 weeks the average is meaningful.',
      'Values under 600 kcal are hidden as noise.',
    ],
    example: 'Maintenance 2,855; walked 3,000 over your average (+99 kcal); smoothed weight falling 0.1 kg/day (−770 kcal) → estimated intake ≈ 2,184 kcal.',
  },
  {
    emoji: '⚙️',
    title: 'Adaptive plan engine',
    where: 'Weight Goal page (server-side, weekly)',
    formula: [
      'actual slope = weekly change of smoothed weight',
      'target slope = your chosen kg/week rate',
      'gap = target − actual → calorie correction = gap × 7700 ÷ 7',
      'new target = max(current ± correction, BMR)',
    ],
    explain: [
      'Runs at most once every 7 days. If your smoothed trend is slower than plan, calories come down (and vice versa) — never below your BMR.',
      'Your daily check-ins modulate it: if you consistently report eating "about right" but the trend is off, the engine trusts the data more (correction × 1.2). If your reports are mixed, it corrects gently (× 0.5).',
      'Outlier weigh-ins (sudden spikes) are flagged and down-weighted rather than deleted.',
    ],
  },
  {
    emoji: '⭐',
    title: 'XP & levels',
    where: 'Habits page · Level page',
    formula: [
      'XP/day per habit: 10 base → 15 (7d streak) → 20 (14d) → 25 (30d) → 30 (60d) → 35 (100d) → 40 (200d) → 50 (365d)',
      'level = total XP measured against the level gates (100, 300, 700, 1,500, …)',
    ],
    explain: [
      'Longer streaks earn more per tick — consistency compounds, literally.',
      'One grace miss per streak: a single missed day doesn\'t reset the chain.',
    ],
  },
  {
    emoji: '🦴',
    title: "Dub's rules",
    where: 'Dub everywhere',
    formula: [
      'rating: more good lines than warnings → "On track"; more warnings → "Needs a nudge"; tied → "Steady"',
      'win line: rotates daily between best streak · most-improved week · weekly tick count · best adherence',
      'walk nudge: ONLY when no habit has a live streak, max once every 3 days',
    ],
    explain: [
      'The win line used to always pick your longest streak (hence weeks of "17-day Iggy streak"). It now rotates through every kind of win you have, seeded by the date.',
      'The walk nudge no longer fires just because one habit slipped — that\'s the rescue line\'s job. Dub asks for a walk only when everything has genuinely stalled, and then leaves you alone for 3 days.',
    ],
  },
];

const MathsPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="app flush" style={{ '--theme': '#5AD1FF', '--theme-dim': '#5AD1FF66', '--theme-glow': '#5AD1FF14' } as React.CSSProperties}>
      <SuperdubHeader />
      <div className="page-content" style={{ maxWidth: 680, margin: '0 auto', overflowY: 'auto', flex: 1, paddingBottom: 90 }}>
        <div className="page-intro-row">
          <button className="page-back" onClick={() => navigate(-1)}><span className="page-back-arrow">‹</span> Back</button>
          <h1 className="page-intro-title">The Maths</h1>
        </div>
        <p className="about-text" style={{ marginBottom: 18 }}>
          Every number Superdub shows, written out so you can cross-reference it.
          This documents what the code <em>actually does</em> — if something on
          screen disagrees with this page, that's a bug: tell us in About.
        </p>

        {SECTIONS.map(s => (
          <div key={s.title} className="diet-section" style={{ marginBottom: 16 }}>
            <h2 className="diet-heading">{s.title}</h2>
            <p className="maths-where">{s.where}</p>
            <div className="maths-formula">
              {s.formula.map((f, i) => <code key={i}>{f}</code>)}
            </div>
            {s.explain.map((e, i) => <p key={i} className="about-text">{e}</p>)}
            {s.example && <p className="maths-example">Worked: {s.example}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MathsPage;
