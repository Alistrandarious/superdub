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

  return (
    <div className="chart-carousel">
      <div className="cc-tabs" ref={tabsRef}>
        {tabs.map((name, i) => (
          <button key={name} className={`cc-tab${active === i ? ' active' : ''}`} onClick={() => goTo(i)}>
            {name}
          </button>
        ))}
      </div>

      <div className="cc-track" ref={trackRef} onScroll={onScroll}>
        {slides.map((child, i) => (
          <div className="cc-slide" key={i}>
            {child}
            {notes[i] && (
              <div className="cc-note">
                <span className="cc-note-pet"><DubMascot size={34} mood="happy" species={species} /></span>
                <p className="cc-note-text">{notes[i]}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="cc-dots">
        {slides.map((_, i) => (
          <button key={i} className={`cc-dot${active === i ? ' active' : ''}`} onClick={() => goTo(i)} aria-label={`Go to ${tabs[i] ?? `chart ${i + 1}`}`} />
        ))}
      </div>
    </div>
  );
};

export default ChartCarousel;
