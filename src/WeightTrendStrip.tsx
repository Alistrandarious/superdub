import React from 'react';
import './App.css';
import { useWeightUnit, kgToUnitValue, unitLabel, formatWeightKg } from './weightUnit';
import { trendSeries, STRIP_W, STRIP_H } from './weightMath';

// A postage-stamp weight trend for the logging moments (daily check-in + the Log
// Weight modal): your last few weigh-ins as coloured dots on a line, so you can
// see the map you're adding a point to. Hand-drawn SVG rather than recharts —
// it sits inside a flex prompt shell where a ResponsiveContainer measures 0.
// The geometry and toning live in weightMath.trendSeries.

const WeightTrendStrip: React.FC<{ days: any[]; goalKg?: number }> = ({ days, goalKg }) => {
  const unit = useWeightUnit();
  const { pts, deltaKg } = trendSeries(days, goalKg);

  if (pts.length === 0) {
    return <p className="wts-caption">Your trend map starts with one point. Today's is it.</p>;
  }

  const last = pts[pts.length - 1];
  const delta = Math.round(kgToUnitValue(Math.abs(deltaKg), unit) * 10) / 10;

  return (
    <div className="wts">
      <svg className="wts-svg" viewBox={`0 0 ${STRIP_W} ${STRIP_H}`} role="img"
        aria-label={`Your last ${pts.length} weigh-ins, now ${formatWeightKg(last.kg, unit)}`}>
        {pts.length > 1 && (
          <polyline className="wts-line" points={pts.map(p => `${p.x},${p.y}`).join(' ')} />
        )}
        {pts.map(p => (
          <circle key={p.ddmm} className={`wts-dot wts-${p.tone}`} cx={p.x} cy={p.y} r={4.5} />
        ))}
        <circle className="wts-halo" cx={last.x} cy={last.y} r={8} />
      </svg>
      <p className="wts-caption">
        {pts.length === 1
          ? <>One point on the map, {formatWeightKg(last.kg, unit)}. Add today's and the line appears.</>
          : <>Last {pts.length} weigh-ins · {deltaKg <= 0 ? '−' : '+'}{delta} {unitLabel(unit)}</>}
      </p>
    </div>
  );
};

export default WeightTrendStrip;
