import React, { useRef, useState, useCallback } from 'react';

export interface CarouselPanel {
  key: string;
  label: string;
  color: string;
  icon: string;
  content: React.ReactNode;
}

// Touch-driven horizontal carousel. Drag follows the finger in real time with a
// half-and-half peek of the adjacent panel, then snaps to the nearest on release.
// Used for the habit cadence levels (Daily → Weekly → Monthly → Yearly).
const CadenceCarousel: React.FC<{ panels: CarouselPanel[]; startIndex?: number }> = ({ panels, startIndex = 0 }) => {
  const [index, setIndex] = useState(startIndex);
  const [dragPx, setDragPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const axisLock = useRef<'h' | 'v' | null>(null);
  const n = panels.length;

  const width = () => wrapRef.current?.clientWidth ?? 1;

  const onDown = useCallback((e: React.PointerEvent) => {
    // Don't hijack drags that begin on an interactive swipe card / button.
    if ((e.target as HTMLElement).closest('[data-no-carousel]')) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    axisLock.current = null;
    setDragging(true);
  }, []);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (axisLock.current === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axisLock.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }
    if (axisLock.current === 'v') return; // let the page scroll vertically
    // Rubber-band at the ends.
    let d = dx;
    if ((index === 0 && d > 0) || (index === n - 1 && d < 0)) d *= 0.35;
    setDragPx(d);
  }, [dragging, index, n]);

  const onUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    const threshold = width() * 0.2;
    let next = index;
    if (dragPx < -threshold && index < n - 1) next = index + 1;
    else if (dragPx > threshold && index > 0) next = index - 1;
    setIndex(next);
    setDragPx(0);
    axisLock.current = null;
  }, [dragging, dragPx, index, n]);

  const pct = -index * 100 + (dragPx / width()) * 100;

  return (
    <div className="cad-carousel">
      <div className="cad-tabs">
        {panels.map((p, i) => (
          <button
            key={p.key}
            className={`cad-tab${i === index ? ' active' : ''}`}
            style={i === index ? { color: p.color, borderColor: p.color, background: `${p.color}1f` } : undefined}
            onClick={() => setIndex(i)}
          >
            <span className="cad-tab-icon">{p.icon}</span>
            <span className="cad-tab-label">{p.label}</span>
          </button>
        ))}
      </div>

      <div
        className="cad-viewport"
        ref={wrapRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
      >
        <div
          className="cad-track"
          style={{
            width: `${n * 100}%`,
            transform: `translateX(${pct / n}%)`,
            transition: dragging ? 'none' : 'transform 0.34s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          {panels.map(p => (
            <div className="cad-panel" key={p.key} style={{ width: `${100 / n}%` }}>
              {p.content}
            </div>
          ))}
        </div>
      </div>

      <div className="cad-dots">
        {panels.map((p, i) => (
          <span
            key={p.key}
            className={`cad-dot${i === index ? ' active' : ''}`}
            style={i === index ? { background: p.color, width: 18 } : undefined}
          />
        ))}
      </div>
    </div>
  );
};

export default CadenceCarousel;
