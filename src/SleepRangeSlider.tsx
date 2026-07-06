import React, { useRef } from 'react';

// ── Sleep "between" slider — a 24h track with two thumbs: when you went to bed
// and when you woke. Axis is 6pm→6pm (0 = 6pm … 6 = midnight … 12 = 6am …
// 24 = 6pm), matching the candlestick chart, so a normal night reads left→right
// with no midnight wrap. Emits bedtime/waketime (HH:MM) so we get the wake data.

const MIN = 0, MAX = 24, GAP = 0.5, STEP = 0.25; // 15-min granularity, ≥30min asleep

const pad = (n: number) => String(n).padStart(2, '0');

// axis value (hours after 6pm) → 24h clock parts
function axisParts(v: number) {
  let frac = (18 + v) % 24;
  let hh = Math.floor(frac);
  let mm = Math.round((frac - hh) * 60);
  if (mm === 60) { hh = (hh + 1) % 24; mm = 0; }
  return { hh, mm };
}
export function axisToHHMM(v: number): string {
  const { hh, mm } = axisParts(v);
  return `${pad(hh)}:${pad(mm)}`;
}
export function axisToLabel(v: number): string {
  const { hh, mm } = axisParts(v);
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${pad(mm)} ${hh < 12 ? 'AM' : 'PM'}`;
}
// Default night: bed 11pm (axis 5) → wake 7am (axis 13).
export const DEFAULT_BED = 5;
export const DEFAULT_WAKE = 13;

const TICKS = [
  { v: 0, label: '6PM' }, { v: 6, label: '12AM' }, { v: 12, label: '6AM' }, { v: 18, label: '12PM' }, { v: 24, label: '6PM' },
];

const SleepRangeSlider: React.FC<{
  bed: number; wake: number;
  onChange: (bed: number, wake: number) => void;
}> = ({ bed, wake, onChange }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<'bed' | 'wake' | null>(null);

  const valAt = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return Math.round((MIN + t * (MAX - MIN)) / STEP) * STEP;
  };

  const down = (which: 'bed' | 'wake') => (e: React.PointerEvent) => {
    dragRef.current = which;
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* */ }
  };
  const move = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const v = valAt(e.clientX);
    if (dragRef.current === 'bed') onChange(Math.max(MIN, Math.min(v, wake - GAP)), wake);
    else onChange(bed, Math.min(MAX, Math.max(v, bed + GAP)));
  };
  const up = () => { dragRef.current = null; };

  const pct = (v: number) => (v / MAX) * 100;
  const hours = +(wake - bed).toFixed(2);
  const hoursLabel = hours % 1 === 0 ? hours : hours.toFixed(1);

  return (
    <div className="srs">
      <div className="srs-readout">
        <span className="srs-end"><span className="srs-end-cap">BED</span>{axisToLabel(bed)}</span>
        <span className="srs-dur">{hoursLabel}h asleep</span>
        <span className="srs-end srs-end--r"><span className="srs-end-cap">WOKE</span>{axisToLabel(wake)}</span>
      </div>
      <div className="srs-track" ref={trackRef} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="srs-band" style={{ left: `${pct(bed)}%`, width: `${pct(wake) - pct(bed)}%` }} />
        <button
          className="srs-thumb" style={{ left: `${pct(bed)}%` }}
          onPointerDown={down('bed')} onPointerMove={move} onPointerUp={up}
          aria-label={`Bedtime ${axisToLabel(bed)}`}
        />
        <button
          className="srs-thumb" style={{ left: `${pct(wake)}%` }}
          onPointerDown={down('wake')} onPointerMove={move} onPointerUp={up}
          aria-label={`Wake time ${axisToLabel(wake)}`}
        />
      </div>
      <div className="srs-ticks">
        {TICKS.map(t => <span key={t.v} className="srs-tick" style={{ left: `${pct(t.v)}%` }}>{t.label}</span>)}
      </div>
    </div>
  );
};

export default SleepRangeSlider;
