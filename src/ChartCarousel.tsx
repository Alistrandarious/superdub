import React, { useRef, useState, useCallback, useEffect } from 'react';
import DubMascot, { getMascot, type MascotSpecies } from './DubMascot';

// ── ChartCarousel — swipe between full-width charts instead of scrolling ─────
// Each child chart becomes a scroll-snap slide with a short Dub write-up
// underneath. Tabs and dots jump between slides. Falsy children (charts with
// no data yet) are dropped, and `tabs`/`notes` are expected to be filtered to
// match the rendered children in the same order.
const ChartCarousel: React.FC<{
  tabs: string[];
  notes: (string | null)[];
  children: React.ReactNode;
}> = ({ tabs, notes, children }) => {
  const slides = React.Children.toArray(children).filter(Boolean);
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [species] = useState<MascotSpecies>(getMascot);

  const onScroll = useCallback(() => {
    const t = trackRef.current;
    if (!t) return;
    const i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth));
    setActive(Math.max(0, Math.min(slides.length - 1, i)));
  }, [slides.length]);

  const goTo = useCallback((i: number) => {
    const t = trackRef.current;
    if (t) t.scrollTo({ left: i * t.clientWidth, behavior: 'smooth' });
  }, []);

  // Keep active tab visible in the (scrollable) tab bar
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = tabsRef.current;
    if (!bar) return;
    const btn = bar.children[active] as HTMLElement | undefined;
    btn?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [active]);

  // Chips sit BELOW the visualization space (per the Today layout spec) and are
  // the only navigation — the pagination dots are gone. Taps switch instantly.
  return (
    <div className="chart-carousel">
      <div className="cc-track" ref={trackRef} onScroll={onScroll}>
        {slides.map((child, i) => (
          <div className="cc-slide" key={i}>
            {/* Dub speaks at the top; tapping him opens the full coach read. */}
            {notes[i] && (
              <button
                className="cc-dubbar"
                onClick={() => window.dispatchEvent(new CustomEvent('superdub:show-coach'))}
                aria-label="Ask Dub for more"
              >
                <span className="cc-dubbar-pet"><DubMascot size={38} mood="happy" species={species} /></span>
                <p className="cc-dubbar-text">{notes[i]}</p>
                <span className="cc-dubbar-more" aria-hidden>›</span>
              </button>
            )}
            {/* Height-locked visualization — fills the rest; swipe here pages. */}
            <div className="cc-slide-viz">{child}</div>
          </div>
        ))}
      </div>

      <div className="cc-tabs cc-tabs--under" ref={tabsRef}>
        {tabs.map((name, i) => (
          <button key={name} className={`cc-tab${active === i ? ' active' : ''}`} onClick={() => goTo(i)}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ChartCarousel;
