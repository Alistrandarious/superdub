import React, { useLayoutEffect, useRef } from 'react';

interface Props {
  values: number[];
  selected: number;
  onSelect: (v: number) => void;
  format?: (v: number) => string;
}

const ITEM_H = 48;
const VISIBLE = 5;

const WheelPicker: React.FC<Props> = ({ values, selected, onSelect, format = String }) => {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const height = ITEM_H * VISIBLE;
  const pad = ITEM_H * Math.floor(VISIBLE / 2);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = values.indexOf(selected);
    if (idx >= 0) el.scrollTop = idx * ITEM_H;
  }, []); // eslint-disable-line

  const onScroll = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollTop / ITEM_H)));
      el.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' });
      onSelect(values[idx]);
    }, 120);
  };

  return (
    <div style={{ position: 'relative', height, overflow: 'hidden', userSelect: 'none' }}>
      {/* top fade */}
      <div style={{ position: 'absolute', inset: 0, top: 0, height: '38%', background: 'linear-gradient(to bottom, var(--glass-bg, #0e1022) 0%, transparent 100%)', zIndex: 2, pointerEvents: 'none' }} />
      {/* bottom fade */}
      <div style={{ position: 'absolute', inset: 0, top: '62%', background: 'linear-gradient(to top, var(--glass-bg, #0e1022) 0%, transparent 100%)', zIndex: 2, pointerEvents: 'none' }} />
      {/* centre rail */}
      <div style={{ position: 'absolute', top: '50%', left: 8, right: 8, height: ITEM_H, transform: 'translateY(-50%)', borderTop: '1px solid rgba(255,255,255,0.12)', borderBottom: '1px solid rgba(255,255,255,0.12)', zIndex: 1, pointerEvents: 'none', borderRadius: 4 }} />

      <div
        ref={ref}
        onScroll={onScroll}
        style={{
          height: '100%',
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          paddingTop: pad,
          paddingBottom: pad,
          scrollbarWidth: 'none',
        }}
      >
        {values.map((v, i) => {
          const isSel = v === selected;
          return (
            <div
              key={i}
              style={{
                height: ITEM_H,
                scrollSnapAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isSel ? '1.25rem' : '0.95rem',
                fontWeight: isSel ? 700 : 400,
                color: isSel ? '#fff' : '#444',
                transition: 'font-size 0.1s, color 0.1s',
                cursor: 'pointer',
              }}
              onClick={() => {
                const el = ref.current;
                if (el) el.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
                onSelect(v);
              }}
            >
              {format(v)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WheelPicker;
