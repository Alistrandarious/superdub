import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api';
import { buildCoachReport, ddmmToEpochDay } from './coach';
import { classifyTrend, resolveAction, TREND_BUTTONS, type TrendAct } from './trendKinds';

// The detail sheet behind the home "WHERE YOU'RE TRENDING" strip. Opens on
// superdub:show-trend (mirroring superdub:show-coach → DubChat). It answers the
// two questions the strip can't: WHY you're trending this way (the coach's own
// read + the server stall factors we already fetch but used to discard) and
// WHAT to do next (one concrete action + state-tuned buttons). Every state
// opens it; warn states additionally surface the named cause factors.

const YEAR = new Date().getFullYear();
function buildAllDays(): string[] {
  const d: string[] = [];
  for (let m = 0; m < 12; m++) {
    const n = new Date(YEAR, m + 1, 0).getDate();
    for (let day = 1; day <= n; day++) d.push(`${String(day).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}`);
  }
  return d;
}
const ALL_DAYS = buildAllDays();
function todayKey() {
  const n = new Date();
  return `${String(n.getDate()).padStart(2, '0')}/${String(n.getMonth() + 1).padStart(2, '0')}`;
}

const TONE: Record<'good' | 'warn' | 'neutral', string> = { good: '#2FD27E', warn: '#FFB020', neutral: '#7F9AC4' };

interface SheetData {
  title: string;
  tone: 'good' | 'warn' | 'neutral';
  body: string;
  spark: number[];
  factors: string[];
  action: string;
}

// A tiny dependency-free weight sparkline (the real WeightSparkline is a full
// recharts weekly chart that needs a goal — overkill here, and the no-goal
// states have no goal to give it). Shape only, so it's weight-unit agnostic.
const Spark: React.FC<{ vals: number[]; color: string }> = ({ vals, color }) => {
  const w = 300, h = 54, p = 6;
  if (vals.length < 2) {
    return <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={54} aria-hidden="true"><circle cx={w / 2} cy={h / 2} r={5} fill={color} /></svg>;
  }
  const mn = Math.min(...vals), mx = Math.max(...vals), rng = (mx - mn) || 1;
  const pts = vals.map((v, i) => {
    const x = p + (w - 2 * p) * i / (vals.length - 1);
    const y = p + (h - 2 * p) * (1 - (v - mn) / rng);
    return [x, y] as const;
  });
  const d = pts.map((pt, i) => `${i ? 'L' : 'M'}${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={54} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r={4} fill={color} />
    </svg>
  );
};

const TrendSheet: React.FC = () => {
  const [data, setData] = useState<SheetData | null>(null);
  const [closing, setClosing] = useState(false);
  const navigate = useNavigate();

  const dismiss = useCallback(() => {
    setClosing(true);
    setTimeout(() => { setData(null); setClosing(false); }, 300);
  }, []);

  const load = useCallback(async () => {
    try {
      const [tracker, habits, plan] = await Promise.all([
        api.getTracker(), api.getHabits(), api.getPlanStatus().catch(() => null),
      ]);
      const days = (tracker.days ?? []) as any[];
      const weights = days.filter(d => d.weight).map(d => ({ day: d.day, weight: Number(d.weight) }));
      const goal = (plan && (plan as any).active && (plan as any).goal)
        ? { goalType: (plan as any).goal.goalType, targetWeight: (plan as any).goal.targetWeight }
        : null;
      const report = buildCoachReport(weights, habits as any, (tracker.habits ?? []) as any, ALL_DAYS, todayKey(), goal);
      const wl = report?.lines[0];
      if (!wl) { // no verdict to explain — hand off to the full coach read instead
        window.dispatchEvent(new CustomEvent('superdub:show-coach'));
        return;
      }
      // recent weigh-ins (last ~14 clean points, oldest→newest) for the sparkline
      const spark = weights
        .filter(w => w.weight > 0)
        .map(w => ({ x: ddmmToEpochDay(w.day), y: w.weight }))
        .sort((a, b) => a.x - b.x)
        .slice(-14)
        .map(p => p.y);

      const kind = classifyTrend(wl.title);
      const stall = (plan && (plan as any).active) ? (plan as any).stall : null;
      const factors: string[] = (wl.tone === 'warn' && stall && stall.risk !== 'none' && Array.isArray(stall.factors))
        ? stall.factors.slice(0, 3)
        : [];
      const action = resolveAction(kind, wl.tone, stall?.action);

      setData({ title: wl.title, tone: wl.tone, body: wl.body, spark, factors, action });
    } catch { /* non-critical — the sheet just doesn't open */ }
  }, []);

  useEffect(() => {
    const onShow = () => load();
    window.addEventListener('superdub:show-trend', onShow);
    return () => window.removeEventListener('superdub:show-trend', onShow);
  }, [load]);

  if (!data) return null;
  const color = TONE[data.tone];
  const kind = classifyTrend(data.title);

  const run = (act: TrendAct) => {
    if (act === 'plan') { dismiss(); navigate('/plan'); }
    else if (act === 'maths') { dismiss(); navigate('/maths'); }
    else { // 'checkin' | 'coach' — hand off to another overlay after this one closes
      dismiss();
      const evt = act === 'checkin' ? 'superdub:show-checkin' : 'superdub:show-coach';
      setTimeout(() => window.dispatchEvent(new CustomEvent(evt)), 300);
    }
  };

  return (
    <div className={`coach-overlay${closing ? ' closing' : ''}`} onClick={dismiss}>
      <div className="coach-card trend-card" onClick={e => e.stopPropagation()}>
        <button className="coach-close" onClick={dismiss} aria-label="Close">✕</button>

        <div className="coach-hero">
          <span className="trend-badge" style={{ background: `${color}22`, color }} aria-hidden="true">
            <span className="trend-badge-dot" style={{ background: color }} />
          </span>
          <div className="coach-hero-text">
            <span className="coach-eyebrow" style={{ color }}>WHERE YOU'RE TRENDING</span>
            <h2 className="coach-headline">{data.title}</h2>
          </div>
        </div>

        <p className="trend-read">{data.body}</p>

        <div className="trend-spark"><Spark vals={data.spark} color={color} />
          <div className="trend-spark-axis"><span>{data.spark.length > 1 ? 'earlier' : ''}</span><span>today</span></div>
        </div>

        {data.factors.length > 0 && (
          <>
            <div className="trend-eyebrow">WHY THIS IS HAPPENING</div>
            <ul className="trend-factors">
              {data.factors.map((f, i) => (
                <li key={i}><span className="trend-factor-dot" style={{ color }}>•</span>{f}</li>
              ))}
            </ul>
          </>
        )}

        <div className="trend-eyebrow">WHAT NOW</div>
        <p className="trend-action">{data.action}</p>
        <div className="trend-btns">
          {TREND_BUTTONS[kind].map((b, i) => (
            <button
              key={b.act + b.label}
              className={`trend-btn${i === 0 ? ' trend-btn--primary' : ''}`}
              style={i === 0 ? { background: color, borderColor: color } : { borderColor: color }}
              onClick={() => run(b.act)}
            >{b.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrendSheet;
