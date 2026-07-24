import React from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceDot, ResponsiveContainer } from 'recharts';
import { useWeightUnit, formatWeightKg, kgToUnitValue } from './weightUnit';
import { buildJourneySeries, JourneyGoal } from './journeyMath';

// "The Journey" — the hero chart on the Adaptive Weight Plan page. One green
// EMA-smoothed line of your real weight from the goal start to today, then a
// blue dashed projection of that trend forward to your target date, with the
// goal weight marked. Trend + projection math lives in journeyMath.ts (checked).

const HEALTH = '#2FD27E';   // your real body trend
const PROJECT = '#46C2FF';  // where the plan is headed

const PlanJourneyChart: React.FC<{ days: any[]; goal: JourneyGoal }> = ({ days, goal }) => {
  const unit = useWeightUnit();
  const series = buildJourneySeries(days ?? [], goal);

  if (series.points < 2) {
    return (
      <div className="plan-journey-empty">
        Log your weight for a few more days and your trend line appears here.
      </div>
    );
  }

  // Y window: hug the data and the goal, with 1 kg of breathing room.
  const vals: number[] = [];
  for (const row of series.data) {
    if (row.ema != null) vals.push(row.ema);
    if (row.projection != null) vals.push(row.projection);
  }
  vals.push(goal.targetWeight, goal.startWeight);
  const lo = Math.floor(Math.min(...vals) - 1);
  const hi = Math.ceil(Math.max(...vals) + 1);

  const renderTip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const rows = payload.filter((e: any) => e.value != null);
    if (!rows.length) return null;
    return (
      <div className="plan-journey-tip">
        <div className="pjt-day">{label}</div>
        {rows.map((e: any, i: number) => (
          <div className="pjt-row" key={i}>
            <span className="pjt-dot" style={{ background: e.dataKey === 'projection' ? PROJECT : HEALTH }} />
            <span className="pjt-name">{e.dataKey === 'projection' ? 'Projected' : 'Your trend'}</span>
            <span className="pjt-val">{formatWeightKg(e.value, unit)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={188}>
      <ComposedChart data={series.data} margin={{ top: 10, right: 12, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="pjFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={HEALTH} stopOpacity={0.28} />
            <stop offset="1" stopColor={HEALTH} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" hide />
        <YAxis
          domain={[lo, hi]}
          width={34}
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10, fontFamily: "'Space Mono', monospace" }}
          tickFormatter={(v: number) => String(Math.round(kgToUnitValue(v, unit) * 10) / 10)}
        />
        <Tooltip content={renderTip} cursor={{ stroke: 'rgba(255,255,255,0.12)' }} />

        {/* Goal weight line */}
        <ReferenceLine
          y={goal.targetWeight}
          stroke={PROJECT}
          strokeWidth={1.5}
          strokeDasharray="8 4"
          label={(props: any) => {
            const { viewBox } = props;
            const text = `Goal ${formatWeightKg(goal.targetWeight, unit)}`;
            const w = text.length * 6.2 + 14;
            return (
              <g transform={`translate(${viewBox.x + viewBox.width - w - 4}, ${viewBox.y - 8})`}>
                <rect x={0} y={0} width={w} height={15} rx={4} fill="rgba(10,12,18,0.92)" stroke="rgba(70,194,255,0.45)" strokeWidth={1} />
                <text x={7} y={11} fill={PROJECT} fontSize={10} fontWeight={700} fontFamily="'Space Mono', monospace">{text}</text>
              </g>
            );
          }}
        />

        {/* Green smoothed trend: area fill + line */}
        {/* No connectNulls: journeyMath bridges the days between weigh-ins, so a
            hole that survives to here is a real break and the line should break too. */}
        <Area type="monotone" dataKey="ema" stroke="none" fill="url(#pjFill)" isAnimationActive={false} />
        <Line type="monotone" dataKey="ema" stroke={HEALTH} strokeWidth={3} dot={false} isAnimationActive={false} name="Your trend" />

        {/* Blue dashed projection to target */}
        <Line type="monotone" dataKey="projection" stroke={PROJECT} strokeWidth={2.4} strokeDasharray="2 6" strokeLinecap="round" dot={false} connectNulls isAnimationActive={false} name="Projected" />

        {/* "Now" and target markers */}
        {series.nowLabel != null && series.nowValue != null && (
          <ReferenceDot x={series.nowLabel} y={series.nowValue} r={5} fill={HEALTH} stroke="#07090C" strokeWidth={2.5} />
        )}
        <ReferenceDot x={series.targetLabel} y={goal.targetWeight} r={5} fill="none" stroke={PROJECT} strokeWidth={2.5} />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default PlanJourneyChart;
