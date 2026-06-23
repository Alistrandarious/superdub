import React, { useMemo, useState } from 'react';

// One joined day of signals, prepared by the parent (Progress page).
export interface PatternDay {
  dow: number;              // 0 = Monday … 6 = Sunday
  steps: number | null;
  habitRate: number | null; // 0..1 of habits done that day
  mood: number | null;      // 1..5
}

type MetricKey = 'steps' | 'habitRate' | 'mood';

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const METRICS: { key: MetricKey; label: string; color: string; fmt: (v: number) => string }[] = [
  { key: 'steps',     label: 'Steps',  color: '#2E8BFF', fmt: v => Math.round(v).toLocaleString() },
  { key: 'habitRate', label: 'Habits', color: '#2FD27E', fmt: v => `${Math.round(v * 100)}%` },
  { key: 'mood',      label: 'Mood',   color: '#FFB928', fmt: v => `${v.toFixed(1)}/5` },
];

// Pearson correlation over paired samples; null if too few points or no variance.
function pearson(pairs: [number, number][]): number | null {
  const n = pairs.length;
  if (n < 6) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pairs) { sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
  const cov = sxy - (sx * sy) / n;
  const vx = sxx - (sx * sx) / n;
  const vy = syy - (sy * sy) / n;
  if (vx <= 0 || vy <= 0) return null;
  return cov / Math.sqrt(vx * vy);
}

function strength(r: number): string {
  const a = Math.abs(r);
  if (a >= 0.5) return 'strong';
  if (a >= 0.3) return 'clear';
  return 'slight';
}

const PatternsCard: React.FC<{ days: PatternDay[] }> = ({ days }) => {
  // Which metrics actually have enough data to show.
  const available = useMemo(() => METRICS.filter(m =>
    days.filter(d => d[m.key] != null).length >= 4
  ), [days]);

  const [metric, setMetric] = useState<MetricKey>('steps');
  const active = available.find(m => m.key === metric) ?? available[0];

  // Per-weekday average for the active metric.
  const byDow = useMemo(() => {
    if (!active) return [];
    return DOW_LABELS.map((label, dow) => {
      const vals = days.filter(d => d.dow === dow && d[active.key] != null).map(d => d[active.key] as number);
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return { label, avg, n: vals.length };
    });
  }, [days, active]);

  const withData = byDow.filter(d => d.avg != null) as { label: string; avg: number; n: number }[];
  const maxVal = withData.length ? Math.max(...withData.map(d => d.avg)) : 0;
  const minVal = withData.length ? Math.min(...withData.map(d => d.avg)) : 0;
  const bestDay = withData.find(d => d.avg === maxVal);
  const worstDay = withData.find(d => d.avg === minVal);

  // Correlation insights across all paired days.
  const insights = useMemo(() => {
    const out: { text: string; r: number }[] = [];
    const pairUp = (a: MetricKey, b: MetricKey): [number, number][] =>
      days.filter(d => d[a] != null && d[b] != null).map(d => [d[a] as number, d[b] as number]);

    const moodSteps = pearson(pairUp('mood', 'steps'));
    if (moodSteps != null && Math.abs(moodSteps) >= 0.25)
      out.push({
        r: moodSteps,
        text: moodSteps > 0
          ? `You tend to feel better on days you walk more (${strength(moodSteps)} link).`
          : `Your mood dips on higher-step days (${strength(moodSteps)} link).`,
      });

    const moodHabits = pearson(pairUp('mood', 'habitRate'));
    if (moodHabits != null && Math.abs(moodHabits) >= 0.25)
      out.push({
        r: moodHabits,
        text: moodHabits > 0
          ? `Hitting your habits goes with a better mood (${strength(moodHabits)} link).`
          : `More habits done tracks with a lower mood (${strength(moodHabits)} link).`,
      });

    const stepsHabits = pearson(pairUp('steps', 'habitRate'));
    if (stepsHabits != null && Math.abs(stepsHabits) >= 0.3)
      out.push({
        r: stepsHabits,
        text: stepsHabits > 0
          ? `Your most active days are also your best habit days (${strength(stepsHabits)} link).`
          : `Busy-habit days tend to be lower-step days (${strength(stepsHabits)} link).`,
      });

    return out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 2);
  }, [days]);

  // Need a reasonable amount of data before patterns mean anything.
  if (days.length < 10 || !active) return null;

  return (
    <section className="chart-section patterns-card">
      <div className="patterns-head">
        <h3 className="chart-title"><span className="chart-title-dot" style={{ background: active.color }} />Your Patterns</h3>
        <div className="patterns-tabs">
          {available.map(m => (
            <button
              key={m.key}
              className={`patterns-tab${m.key === active.key ? ' active' : ''}`}
              style={m.key === active.key ? { color: m.color, borderColor: m.color } : undefined}
              onClick={() => setMetric(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="patterns-bars">
        {byDow.map(d => {
          const pct = d.avg != null && maxVal > 0 ? Math.max(6, (d.avg / maxVal) * 100) : 0;
          const isBest = d.avg != null && d.avg === maxVal && withData.length > 1;
          const isWorst = d.avg != null && d.avg === minVal && withData.length > 1;
          return (
            <div key={d.label} className="patterns-bar-col">
              <div className="patterns-bar-track">
                <div
                  className={`patterns-bar-fill${isBest ? ' best' : ''}${isWorst ? ' worst' : ''}`}
                  style={{ height: `${pct}%`, background: active.color, opacity: d.avg == null ? 0.12 : isWorst ? 0.45 : 1 }}
                />
              </div>
              <span className="patterns-bar-val">{d.avg != null ? active.fmt(d.avg) : '—'}</span>
              <span className={`patterns-bar-label${isBest ? ' best' : ''}`}>{d.label}</span>
            </div>
          );
        })}
      </div>

      {bestDay && worstDay && bestDay.label !== worstDay.label && (
        <p className="patterns-summary">
          Best <strong style={{ color: active.color }}>{active.label.toLowerCase()}</strong> day is{' '}
          <strong>{bestDay.label}</strong> ({active.fmt(bestDay.avg)}), lowest is{' '}
          <strong>{worstDay.label}</strong> ({active.fmt(worstDay.avg)}).
        </p>
      )}

      {insights.length > 0 && (
        <div className="patterns-insights">
          {insights.map((ins, i) => (
            <div key={i} className="patterns-insight">
              <span className="patterns-insight-dot" />
              <span>{ins.text}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default PatternsCard;
