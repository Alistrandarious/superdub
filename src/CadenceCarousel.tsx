import React, { useRef, useState, useCallback } from 'react';

export interface CarouselPanel {
  key: string;
  label: string;
  color: string;
  icon: string;
  content: React.ReactNode;
}

const CHIP_W = 76; // px per chip in the little coloured carousel

// Cadence switcher: a big title + a little coloured carousel of chips, with the
// habit list sliding purely along the X axis (no skew/rotate/scale) as you swipe.
const CadenceCarousel: React.FC<{ panels: CarouselPanel[]; startIndex?: number; compact?: boolean }> = ({ panels, startIndex = 0, compact = false }) => {
  const [index, setIndex] = useState(startIndex);
  const [dragPx, setDragPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const vpRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<'h' | 'v' | null>(null);
  const n = panels.length;
  const width = () => vpRef.current?.clientWidth ?? 1;

  const go = useCallback((next: number) => {
    setIndex(Math.max(0, Math.min(n - 1, next)));
  }, [n]);

  const onDown = useCallback((e: React.PointerEvent) => {
    startX.current = e.clientX; startY.current = e.clientY; axis.current = null;
    setDragging(true);
  }, []);
  const onMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (axis.current === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }
    if (axis.current === 'v') return;
    let d = dx;
    if ((index === 0 && d > 0) || (index === n - 1 && d < 0)) d *= 0.35;
    setDragPx(d);
  }, [dragging, index, n]);
  const onUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    const frac = dragPx / width();
    if (frac < -0.2 && index < n - 1) go(index + 1);
    else if (frac > 0.2 && index > 0) go(index - 1);
    setDragPx(0);
    axis.current = null;
  }, [dragging, dragPx, index, n, go]);

  // Continuous position; the centred panel sits at `current`.
  const current = index - dragPx / width();
  const active = panels[index];
  const chipShift = -(index * CHIP_W + CHIP_W / 2) + (dragPx / width()) * CHIP_W;

  const swipeProps = {
    onPointerDown: onDown,
    onPointerMove: onMove,
    onPointerUp: onUp,
    onPointerCancel: onUp,
    onPointerLeave: onUp,
  };

  return (
    <div className={`cadx${compact ? ' cadx--compact' : ''}`}>
      <div className="cadx-header">
        <div className="cadx-title" style={{ color: active.color }}>{active.label}</div>

        {compact ? (
          // Collapsed: just the four colour dots, evenly spaced, still tappable.
          <div className="cadx-dotrow">
            {panels.map((p, i) => (
              <button
                key={p.key}
                className={`cadx-dot2${i === index ? ' active' : ''}`}
                style={{ ['--chip' as any]: p.color }}
                onClick={() => go(i)}
                aria-label={p.label}
              />
            ))}
          </div>
        ) : (
          <div className="cadx-strip" {...swipeProps}>
            <div
              className="cadx-strip-track"
              style={{ transform: `translateX(${chipShift}px)`, transition: dragging ? 'none' : 'transform 0.32s cubic-bezier(0.22,1,0.36,1)' }}
            >
              {panels.map((p, i) => {
                const off = Math.abs(i - current);
                return (
                  <button
                    key={p.key}
                    className={`cadx-chip${i === index ? ' active' : ''}`}
                    style={{
                      width: CHIP_W,
                      transform: `scale(${Math.max(0.74, 1.12 - off * 0.26)})`,
                      opacity: Math.max(0.35, 1 - off * 0.4),
                      ['--chip' as any]: p.color,
                    }}
                    onClick={() => go(i)}
                  >
                    <span className="cadx-chip-dot" />
                    <span className="cadx-chip-label">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="cadx-swipe">
        <div className="cadx-viewport" ref={vpRef} {...swipeProps}>
          {panels.map((p, i) => {
            const offset = i - current;
            const nearest = i === Math.round(current);
            const off = Math.abs(offset);
            if (off > 1.5) return null; // off-screen — don't render
            return (
              <div
                key={p.key}
                className="cadx-slide"
                style={{
                  position: nearest ? 'relative' : 'absolute',
                  top: nearest ? undefined : 0,
                  left: nearest ? undefined : 0,
                  right: nearest ? undefined : 0,
                  transform: `translateX(${offset * 100}%)`,
                  transition: dragging ? 'none' : 'transform 0.34s cubic-bezier(0.22,1,0.36,1)',
                  pointerEvents: i === index ? 'auto' : 'none',
                }}
              >
                {p.content}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CadenceCarousel;
