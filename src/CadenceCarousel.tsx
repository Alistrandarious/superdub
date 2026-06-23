import React, { useRef, useState, useCallback } from 'react';

export interface CarouselPanel {
  key: string;
  label: string;
  color: string;
  icon: string;
  content: React.ReactNode;
}

// Touch-driven cadence wheel — no buttons. Drag follows the finger and the
// panels rotate past each other like a revolving door (perspective + rotateY),
// snapping to the nearest level on release. Starts on the given index.
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
    if ((e.target as HTMLElement).closest('[data-no-carousel]')) return;
    startX.current = e.clientX; startY.current = e.clientY; axisLock.current = null;
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
    if (axisLock.current === 'v') return;
    let d = dx;
    if ((index === 0 && d > 0) || (index === n - 1 && d < 0)) d *= 0.35;
    setDragPx(d);
  }, [dragging, index, n]);

  const onUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    const threshold = width() * 0.18;
    let next = index;
    if (dragPx < -threshold && index < n - 1) next = index + 1;
    else if (dragPx > threshold && index > 0) next = index - 1;
    setIndex(next);
    setDragPx(0);
    axisLock.current = null;
  }, [dragging, dragPx, index, n]);

  // Continuous position; centre panel sits at `current`.
  const current = index - dragPx / width();

  return (
    <div className="cad-carousel">
      <div
        className="cad-stage"
        ref={wrapRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
      >
        {panels.map((p, i) => {
          const offset = i - current;            // 0 = centred
          const abs = Math.abs(offset);
          const rotateY = Math.max(-80, Math.min(80, offset * -55));
          const translate = offset * 100;          // % — neighbours sit fully to the side
          const depth = -abs * 160;                // px — push neighbours back
          // Fade out by the time a panel is one step away, so other cadences never
          // linger in the centre at rest — only the active level shows when settled.
          const opacity = Math.max(0, 1 - abs * 1.1);
          const hidden = abs > 1.02;
          // The nearest panel flows in the document so the stage takes its height;
          // the others overlay it absolutely.
          const nearest = i === Math.round(current);
          return (
            <div
              key={p.key}
              className="cad-door"
              aria-hidden={i !== index}
              style={{
                position: nearest ? 'relative' : 'absolute',
                top: nearest ? undefined : 0,
                left: nearest ? undefined : 0,
                right: nearest ? undefined : 0,
                transform: `translateX(${translate}%) translateZ(${depth}px) rotateY(${rotateY}deg)`,
                opacity,
                zIndex: 100 - Math.round(abs * 10),
                pointerEvents: i === index ? 'auto' : 'none',
                visibility: hidden ? 'hidden' : 'visible',
                transition: dragging ? 'none' : 'transform 0.4s cubic-bezier(0.22,1,0.36,1), opacity 0.4s ease',
              }}
            >
              {p.content}
            </div>
          );
        })}
      </div>

      <div className="cad-dots">
        {panels.map((p, i) => (
          <span
            key={p.key}
            className={`cad-dot${i === index ? ' active' : ''}`}
            style={i === index ? { background: p.color, width: 20 } : undefined}
          />
        ))}
      </div>
    </div>
  );
};

export default CadenceCarousel;
