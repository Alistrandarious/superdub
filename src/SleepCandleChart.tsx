import React from 'react';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ── Sleep candlestick ────────────────────────────────────────────────────────
// Each night is a "candle" whose BODY spans actual bed → wake clock time, so its
// length is the sleep duration. The Y axis is clock time on a 6pm→6pm scale
// (evening at top, morning at bottom) so nights that cross midnight don't wrap.
// Each night is a violet "I" (line capped top & bottom); mood shows in the tooltip.

export interface SleepCandle {
  day: string;          // 'DD/MM' x-axis label
  bedVal: number;       // hours after 6pm (0..24)
  wakeVal: number;      // hours after 6pm (0..24), > bedVal
  hours: number;        // duration
  mood: number | null;  // 1..5 that morning, or null
  bedtime: string;      // 'HH:MM' for the tooltip
  waketime: string;     // 'HH:MM'
}

// 6pm→6pm axis: 0 = 18:00, 6 = 00:00, 12 = 06:00, 18 = 12:00.
export function hhmmToAxis(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const frac = (h || 0) + (m || 0) / 60;
  return frac >= 18 ? frac - 18 : frac + 6;
}
const axisToClock = (v: number): string => {
  const h = Math.round((v + 18) % 24);
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${h < 12 ? 'am' : 'pm'}`;
};

// Render each night as an "I": a thin vertical line from bed → wake, capped
// with a short horizontal tick at the top (bedtime) and bottom (wake).
const SleepIBar = (props: any) => {
  const { x, y, width, height } = props;
  const cx = x + width / 2;
  const tick = Math.max(width / 2, 4);
  const bottom = y + height;
  return (
    <g stroke="#8B5CF6" strokeWidth={2} strokeLinecap="round">
      <line x1={cx} y1={y} x2={cx} y2={bottom} />
      <line x1={cx - tick} y1={y} x2={cx + tick} y2={y} />
      <line x1={cx - tick} y1={bottom} x2={cx + tick} y2={bottom} />
    </g>
  );
};

const SleepCandleChart: React.FC<{ data: SleepCandle[]; height?: number | `${number}%` }> = ({ data, height = 180 }) => (
  <ResponsiveContainer width="100%" height={height}>
    <ComposedChart data={data} margin={{ left: 0, right: 10, top: 10, bottom: 8 }}>
      <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
      <XAxis
        dataKey="day" stroke="rgba(255,255,255,0.1)"
        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 9, fontFamily: "'Space Mono',monospace" }}
        tickLine={false} height={28} interval="preserveStartEnd" padding={{ left: 8, right: 8 }}
      />
      <YAxis
        stroke="rgba(255,255,255,0.1)" width={34} axisLine={false} tickLine={false}
        reversed domain={[0, 24]} ticks={[0, 6, 12, 18, 24]} tickFormatter={axisToClock}
        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 9, fontFamily: "'Space Mono',monospace" }}
      />
      <Tooltip
        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
        contentStyle={{ background: '#100E16', border: '1px solid #2c2440', borderRadius: 10, fontSize: 12 }}
        labelStyle={{ color: '#ac9' }}
        formatter={(_v: any, _n: any, p: any) => {
          const d = p?.payload as SleepCandle;
          if (!d) return ['', ''];
          const moodTxt = d.mood != null ? ` · mood ${d.mood}/5` : '';
          return [`${d.bedtime} → ${d.waketime} (${d.hours.toFixed(1)}h)${moodTxt}`, 'Sleep'];
        }}
      />
      {/* Floating bar: a [start,end] array dataKey gives recharts the bed→wake span;
          SleepIBar draws it as a capped vertical line instead of a solid body. */}
      <Bar dataKey={(d: SleepCandle) => [d.bedVal, d.wakeVal]} barSize={12} shape={SleepIBar} isAnimationActive={false} />
    </ComposedChart>
  </ResponsiveContainer>
);

export default SleepCandleChart;
