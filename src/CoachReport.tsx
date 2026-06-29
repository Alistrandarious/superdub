import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api';
import { buildCoachReport, type CoachReport as Report } from './coach';
import DubMascot from './DubMascot';

const YEAR = 2026;
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

// Dub's post-weigh-in coaching report. Listens for the weigh-in event, pulls the
// user's own data, runs the on-device coach, and presents it fronted by the mascot.
const CoachReport: React.FC = () => {
  const [report, setReport] = useState<Report | null>(null);
  const [closing, setClosing] = useState(false);

  const dismiss = useCallback(() => {
    setClosing(true);
    setTimeout(() => { setReport(null); setClosing(false); }, 300);
  }, []);

  const generate = useCallback(async () => {
    try {
      const [tracker, habits, plan] = await Promise.all([
        api.getTracker(),
        api.getHabits(),
        api.getPlanStatus().catch(() => null),
      ]);
      const weights = (tracker.days ?? [])
        .filter((d: any) => d.weight)
        .map((d: any) => ({ day: d.day, weight: Number(d.weight) }));
      const goal = (plan && (plan as any).active && (plan as any).goal)
        ? { goalType: (plan as any).goal.goalType, targetWeight: (plan as any).goal.targetWeight }
        : null;
      const r = buildCoachReport(weights, habits as any, (tracker.habits ?? []) as any, ALL_DAYS, todayKey(), goal);
      if (r) setReport(r);
    } catch {
      // silent — coaching is a nicety, not critical
    }
  }, []);

  useEffect(() => {
    const handler = () => { setTimeout(generate, 1100); }; // let the check-in modal close first
    window.addEventListener('superdub:checkin-done', handler);
    return () => window.removeEventListener('superdub:checkin-done', handler);
  }, [generate]);

  if (!report) return null;
  const mood = report.lines.some(l => l.tone === 'warn') ? 'concerned'
    : report.lines.some(l => l.tone === 'good') ? 'happy' : 'neutral';

  return (
    <div className={`coach-overlay${closing ? ' closing' : ''}`} onClick={dismiss}>
      <div className="coach-card" onClick={e => e.stopPropagation()}>
        <button className="coach-close" onClick={dismiss} aria-label="Close">✕</button>

        <div className="coach-hero">
          <DubMascot size={104} mood={mood as any} talking />
          <div className="coach-hero-text">
            <span className="coach-eyebrow">DUB · YOUR COACH</span>
            <h2 className="coach-headline">{report.emoji} {report.headline}</h2>
          </div>
        </div>

        <div className="coach-lines">
          {report.lines.map((l, i) => (
            <div key={i} className={`coach-line coach-line--${l.tone}`}>
              <span className="coach-line-ico">{l.icon}</span>
              <div className="coach-line-text">
                <span className="coach-line-title">{l.title}</span>
                <span className="coach-line-body">{l.body}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="coach-closing">{report.closing}</p>
        <button className="coach-btn" onClick={dismiss}>Let's go 🚀</button>
      </div>
    </div>
  );
};

export default CoachReport;
