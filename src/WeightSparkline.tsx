import React from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useWeightUnit, formatWeightKg, kgToUnitValue } from './weightUnit';
import { DAY_SHORT, linearReg, localYMD, isoToDDMM, emaStep } from './weightMath';

// "Weight This Week" — a weekly weight chart (logged + EMA-smoothed + 28-day trend
// + a golden safe-zone corridor) with Mon–Sun day circles and a plain-English
// insight box. Extracted from the Plan page so both it and Progress→Today share it.

const DayCircleTick = (props: any) => {
  const { x, y, payload, doneFlags } = props;
  const letter = (payload.value as string)?.[0] ?? '';
  const done = Array.isArray(doneFlags) ? !!doneFlags[payload.index] : false;
  return (
    <g transform={`translate(${x},${y + 16})`}>
      <circle r={10} fill={done ? '#2FD27E' : '#2A2D3A'} stroke={done ? '#2FD27E' : '#252532'} strokeWidth={1} />
      <text textAnchor="middle" dominantBaseline="central" fill={done ? '#06210F' : '#555'} fontSize={10} fontWeight={700}>
        {letter}
      </text>
    </g>
  );
};

const WeightSparkline: React.FC<{
  allTrackerDays: any[];
  currentWeight: number;
  goalWeight: number;
  lossPerWeek: number;
}> = ({ allTrackerDays, currentWeight, goalWeight, lossPerWeek }) => {
  const unit = useWeightUnit();
  const isBulk = goalWeight > currentWeight && currentWeight > 0;
  const now = new Date();

  const dow = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  mon.setHours(0, 0, 0, 0);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    return localYMD(d);
  });

  // 28-day history → linear-reg trend + an EMA(α=0.25) smoothed series,
  // mirroring the Progress weight chart logic.
  const histPts: { x: number; y: number }[] = [];
  const emaByDDMM: Record<string, number> = {};
  let emaAcc: number | null = null;
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const ddmm = isoToDDMM(localYMD(d));
    const found = allTrackerDays.find((day: any) => day.day === ddmm);
    const w = found ? parseFloat(found.weight) : NaN;
    if (w > 0) {
      const x = 27 - i;
      const prevX = histPts.length > 0 ? histPts[histPts.length - 1].x : x;
      histPts.push({ x, y: w });
      emaAcc = emaStep(emaAcc, w, x - prevX);
      emaByDDMM[ddmm] = parseFloat(emaAcc.toFixed(2));
    }
  }

  const reg = linearReg(histPts);
  const weeklyRate = reg?.weeklyRate ?? null;

  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const ZONE_HALF = 0.75; // ±0.75 kg safe corridor around the ideal weekly path
  const weekData = weekDays.map((iso, i) => {
    const ddmm = isoToDDMM(iso);
    const found = allTrackerDays.find((d: any) => d.day === ddmm);
    const actual = found && parseFloat(found.weight) > 0 ? parseFloat(found.weight) : undefined;
    const ema = emaByDDMM[ddmm];
    const direction = isBulk ? 1 : -1;
    const expected = currentWeight > 0 && lossPerWeek > 0
      ? parseFloat((currentWeight + direction * (lossPerWeek / 7) * i).toFixed(2))
      : undefined;
    // Trendline: the 28-day regression evaluated at this day's position in that window
    const dayDate = new Date(iso + 'T00:00:00');
    const daysFromToday = Math.round((todayStart.getTime() - dayDate.getTime()) / 86400000);
    const x = 27 - daysFromToday;
    const trend = reg ? parseFloat((reg.intercept + reg.slope * x).toFixed(2)) : undefined;
    // Corridor band around the ideal path
    const zoneLow = expected !== undefined ? parseFloat((expected - ZONE_HALF).toFixed(2)) : undefined;
    const zoneBand = expected !== undefined ? ZONE_HALF * 2 : undefined;
    const zoneHigh = expected !== undefined ? parseFloat((expected + ZONE_HALF).toFixed(2)) : undefined;
    // "Done" = logged that day (weight or a completed habit), and not in the future
    const isFuture = dayDate.getTime() > todayStart.getTime();
    const done = !isFuture && !!found && (
      (parseFloat(found.weight) > 0) ||
      (found.habits && Object.values(found.habits).some((v: any) => v === true))
    );
    return { label: DAY_SHORT[i], actual, expected, ema, emaHalo: ema, trend, zoneLow, zoneBand, zoneHigh, done };
  });
  const weekDone = weekData.map(d => d.done);

  let insightLevel: 'good' | 'great' | 'behind' | 'nodata' = 'nodata';
  let insightMsg = 'Log your weight for a few more days to unlock your trend analysis.';

  if (lossPerWeek <= 0) {
    insightMsg = 'Set a goal weight and weekly target in Profile to see your progress prediction.';
  } else if (histPts.length >= 3 && weeklyRate !== null) {
    if (isBulk) {
      const g = weeklyRate;
      if (g >= lossPerWeek + 0.1) { insightLevel = 'behind'; insightMsg = `Gaining ${g.toFixed(2)} kg/week, faster than your ${lossPerWeek} kg target. Slow bulk means more muscle, less fat. Check your surplus.`; }
      else if (g >= lossPerWeek - 0.1) { insightLevel = 'great'; insightMsg = `Right on track, gaining ${g.toFixed(2)} kg/week matches your ${lossPerWeek} kg bulk target.`; }
      else if (g >= 0.05) { insightLevel = 'good'; insightMsg = `Gaining ${g.toFixed(2)} kg/week vs your ${lossPerWeek} kg target. A little more food or one extra gym session could close the gap.`; }
      else { insightLevel = 'behind'; insightMsg = `Minimal weight change. To bulk, you need a consistent calorie surplus every day.`; }
    } else {
      const l = -weeklyRate;
      if (l >= lossPerWeek + 0.15) { insightLevel = 'great'; insightMsg = `Losing ${l.toFixed(2)} kg/week, ahead of your ${lossPerWeek} kg target. Keep meals protein-forward to protect muscle.`; }
      else if (l >= lossPerWeek - 0.1) { insightLevel = 'good'; insightMsg = `Right on track, ${l.toFixed(2)} kg/week matches your ${lossPerWeek} kg target. Keep the routine going.`; }
      else if (l >= 0.05) { insightLevel = 'behind'; const gap = Math.round((lossPerWeek - l) * 7700 / 7); insightMsg = `Losing ${l.toFixed(2)} kg/week vs your ${lossPerWeek} kg target. Tighten up ~${gap} kcal/day to close the gap.`; }
      else { insightLevel = 'behind'; insightMsg = `Minimal change recently. Focus on hitting your calorie target this week.`; }
    }
  }

  const hasAny = weekData.some(d => d.actual !== undefined);
  // Fixed ±2.5 kg window around your weight (a 5 kg band) so the line never
  // sits flat in a huge 0–90 range. Expands only if a weigh-in lands outside it.
  const wVals = weekData.flatMap(d => [d.actual, d.ema].filter(v => v !== undefined) as number[]);
  const center = currentWeight > 0
    ? currentWeight
    : (wVals.length > 0 ? wVals.reduce((a, b) => a + b, 0) / wVals.length : 80);
  let minW = +(center - 2.5).toFixed(1);
  let maxW = +(center + 2.5).toFixed(1);
  if (wVals.length > 0) {
    minW = Math.min(minW, Math.floor(Math.min(...wVals)));
    maxW = Math.max(maxW, Math.ceil(Math.max(...wVals)));
  }

  // Tooltip mirroring the Progress chart (Logged / Smoothed / Expected)
  const renderTip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const HIDE = ['emaHalo', 'zoneLow', 'zoneHigh', 'zoneBand'];
    const rows = payload.filter((e: any) => !HIDE.includes(e.dataKey) && e.value != null);
    if (!rows.length) return null;
    return (
      <div style={{ background: 'rgba(12,12,18,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 11px', minWidth: 120 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontFamily: "'Space Mono', monospace", fontSize: 11, marginBottom: 5 }}>{label}</div>
        {rows.map((e: any, i: number) => {
          const nm = e.dataKey === 'actual' ? 'Logged' : e.dataKey === 'ema' ? 'Smoothed' : e.dataKey === 'trend' ? 'Trend' : 'Expected';
          const swatch = e.dataKey === 'ema' ? '#E8ECF4' : e.dataKey === 'actual' ? '#FFFFFF' : e.dataKey === 'trend' ? '#FF8A00' : '#2E8BFF';
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '1px 0' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: swatch, flexShrink: 0 }} />
              <span style={{ color: '#c8ccd8', fontSize: 11, fontFamily: "'Sora', sans-serif" }}>{nm}</span>
              <span style={{ marginLeft: 'auto', paddingLeft: 12, color: '#fff', fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700 }}>{formatWeightKg(e.value, unit)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="diet-section weight-sparkline-card">
      <div className="ws-head">
        <h2 className="diet-heading">Weight This Week</h2>
        {lossPerWeek > 0 && (
          <span className="ws-potential">
            <strong>{isBulk ? '+' : '−'}{lossPerWeek}kg</strong> possible
          </span>
        )}
      </div>

      {hasAny || weekData.some(d => d.expected !== undefined) ? (
        <ResponsiveContainer width="100%" height={132}>
          <ComposedChart data={weekData} margin={{ top: 8, right: 14, bottom: 0, left: -8 }}>
            <XAxis dataKey="label" tick={(p: any) => <DayCircleTick {...p} doneFlags={weekDone} />} axisLine={false} tickLine={false} height={40} interval={0} padding={{ left: 16, right: 16 }} />
            <YAxis domain={[minW, maxW]} allowDataOverflow={true} tick={{ fill: '#444', fontSize: 10 }} axisLine={false} tickLine={false} width={34} tickFormatter={(v: number) => String(Math.round(kgToUnitValue(v, unit) * 10) / 10)} />
            <Tooltip content={renderTip} />
            {/* Golden safe-zone corridor: light fill + gold edge lines (no vertical cap) */}
            <Area type="linear" dataKey="zoneLow" stackId="zone" stroke="none" fill="none" connectNulls={false} dot={false} activeDot={false} isAnimationActive={false} />
            <Area type="linear" dataKey="zoneBand" stackId="zone" stroke="none" fill="rgba(255,190,30,0.16)" connectNulls={false} dot={false} activeDot={false} isAnimationActive={false} />
            <Line type="linear" dataKey="zoneLow" stroke="rgba(255,200,60,0.8)" strokeWidth={1.5} dot={false} activeDot={false} connectNulls isAnimationActive={false} />
            <Line type="linear" dataKey="zoneHigh" stroke="rgba(255,200,60,0.8)" strokeWidth={1.5} dot={false} activeDot={false} connectNulls isAnimationActive={false} />
            {/* Expected/ideal path, faint blue dashed */}
            <Line type="linear" dataKey="expected" stroke="#2E8BFF55" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls name="expected" isAnimationActive={false} />
            {/* Trendline, amber regression of your last 28 days */}
            <Line type="linear" dataKey="trend" stroke="#FF8A00" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls name="trend" isAnimationActive={false} />
            {/* EMA smoothed, black line with a white halo */}
            <Line type="monotone" dataKey="emaHalo" stroke="rgba(255,255,255,0.6)" strokeWidth={5} dot={false} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="ema" stroke="#000000" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} name="ema" />
            {/* Actual logged weight, white line with hollow dots */}
            <Line type="monotone" dataKey="actual" stroke="#FFFFFF" strokeWidth={2.5} dot={{ r: 4, fill: '#0E0E14', stroke: '#FFFFFF', strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls={false} name="actual" />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <p className="diet-hint" style={{ marginTop: 8 }}>No weight data this week, log your morning weight via the daily check-in.</p>
      )}

      <div className={`insight-box insight-${insightLevel}`}>{insightMsg}</div>

      {weeklyRate !== null && (
        <div className="trend-stats">
          <div className="trend-stat">
            <span className="trend-stat-label">28-day trend</span>
            <span className="trend-stat-val">{(-weeklyRate) >= 0 ? '−' : '+'}{Math.abs(weeklyRate).toFixed(2)} kg/wk</span>
          </div>
          <div className="trend-stat">
            <span className="trend-stat-label">Your target</span>
            <span className="trend-stat-val">{isBulk ? '+' : '−'}{lossPerWeek} kg/wk</span>
          </div>
          <div className="trend-stat">
            <span className="trend-stat-label">Data points</span>
            <span className="trend-stat-val">{histPts.length} days</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeightSparkline;
