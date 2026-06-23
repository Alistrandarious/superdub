import React, { useRef, useState, useCallback } from 'react';

export interface CarouselPanel {
  key: string;
  label: string;
  color: string;
  icon: string;
  content: React.ReactNode;
}

const CHIP_W = 76; // px per chip in the little coloured carousel

// Cadence switcher: a big title + a small coloured carousel of chips you swipe
// to change level. The habit list below cross-fades in from the swipe direction.
const CadenceCarousel: React.FC<{ panels: CarouselPanel[]; startIndex?: number }> = ({ panels, startIndex = 0 }) => {
  const [index, setIndex] = useState(startIndex);
  const [dir, setDir] = useState(1);
  const [dragPx, setDragPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<'h' | 'v' | null>(null);
  const n = panels.length;

  const go = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(n - 1, next));
    if (clamped === index) return;
    setDir(clamped > index ? 1 : -1);
    setIndex(clamped);
  }, [index, n]);

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
    if (dragPx < -CHIP_W * 0.45) go(index + 1);
    else if (dragPx > CHIP_W * 0.45) go(index - 1);
    setDragPx(0);
    axis.current = null;
  }, [dragging, dragPx, index, go]);

  const active = panels[index];
  const trackShift = -(index * CHIP_W + CHIP_W / 2) + dragPx;

  return (
    <div className="cadx">
      <div className="cadx-title" style={{ color: active.color }}>
        <span className="cadx-title-icon">{active.icon}</span>{active.label}
      </div>

      <div
        className="cadx-swipe"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
      >
        <div className="cadx-strip">
          <div
            className="cadx-strip-track"
            style={{ transform: `translateX(${trackShift}px)`, transition: dragging ? 'none' : 'transform 0.32s cubic-bezier(0.22,1,0.36,1)' }}
          >
            {panels.map((p, i) => {
              const offset = Math.abs(i - index - (dragging ? -dragPx / CHIP_W : 0));
              const isActive = i === index;
              return (
                <button
                  key={p.key}
                  className={`cadx-chip${isActive ? ' active' : ''}`}
                  style={{
                    width: CHIP_W,
                    transform: `scale(${Math.max(0.74, 1.12 - offset * 0.26)})`,
                    opacity: Math.max(0.35, 1 - offset * 0.4),
                    ['--chip' as any]: p.color,
                  }}
                  onClick={() => go(i)}
                >
                  <span className="cadx-chip-dot">{p.icon}</span>
                  <span className="cadx-chip-label">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="cadx-content" key={index} data-dir={dir}>
          {active.content}
        </div>
      </div>
    </div>
  );
};

export default CadenceCarousel;
