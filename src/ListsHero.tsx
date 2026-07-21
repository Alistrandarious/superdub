import React from 'react';

/** What a Lists tab tells you about itself before you look at the list. */
export interface HeroData {
  eyebrow: string;
  count: React.ReactNode;
  label: string;
  /** 0..100. Omit to hide the bar — Journal has no denominator to fill. */
  pct?: number;
  sub?: React.ReactNode;
}

// The hero sits full-bleed above the scroller, so it can't live inside a panel
// (.page-content pads its children). Goals and Journal fetch their own data, so
// they hand their numbers up to Tasks.tsx and it renders this for them.
// Colour comes from the page's --theme, which Tasks.tsx sets per tab.
const ListsHero: React.FC<HeroData> = ({ eyebrow, count, label, pct, sub }) => (
  <section className="lists-hero">
    <span className="lists-hero-eyebrow">{eyebrow}</span>
    <div className="lists-hero-line">
      <span className="lists-hero-count">{count}</span>
      <span className="lists-hero-label">{label}</span>
    </div>
    {pct !== undefined && (
      <div
        className="lists-hero-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${eyebrow}: ${pct}% ${label}`}
      >
        <div className="lists-hero-fill" style={{ width: `${pct}%` }} />
      </div>
    )}
    {sub && <div className="lists-hero-sub">{sub}</div>}
  </section>
);

export default ListsHero;
