import React, { useEffect, useState } from 'react';
import { api } from './api';
import { buildCoachReport, type CoachReport } from './coach';
import DubMascot, { getMascot, type MascotSpecies } from './DubMascot';

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

// A rating Dub gives your momentum, from the coach report's tone balance.
function rating(r: CoachReport): { label: string; cls: string } {
  const good = r.lines.filter(l => l.tone === 'good').length;
  const warn = r.lines.filter(l => l.tone === 'warn').length;
  if (r.wantsWalk || warn > good) return { label: 'Needs a nudge', cls: 'warn' };
  if (good > warn) return { label: 'On track', cls: 'good' };
  return { label: 'Steady', cls: 'neutral' };
}

// Dub at the top of Progress — a glanceable summary + rating, tap to hear more.
const DubProgressSummary: React.FC = () => {
  const [report, setReport] = useState<CoachReport | null>(null);
  const [species, setSpecies] = useState<MascotSpecies>(getMascot);

  useEffect(() => {
    const sync = () => setSpecies(getMascot());
    window.addEventListener('superdub:mascot-changed', sync);
    return () => window.removeEventListener('superdub:mascot-changed', sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tracker, habits, plan] = await Promise.all([
          api.getTracker(), api.getHabits(), api.getPlanStatus().catch(() => null),
        ]);
        if (cancelled) return;
        const weights = (tracker.days ?? []).filter((d: any) => d.weight).map((d: any) => ({ day: d.day, weight: Number(d.weight) }));
        const goal = (plan && (plan as any).active && (plan as any).goal)
          ? { goalType: (plan as any).goal.goalType, targetWeight: (plan as any).goal.targetWeight } : null;
        setReport(buildCoachReport(weights, habits as any, (tracker.habits ?? []) as any, ALL_DAYS, todayKey(), goal));
      } catch { /* non-critical */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const mood = !report ? 'happy'
    : report.lines.some(l => l.tone === 'warn') ? 'concerned'
    : report.lines.some(l => l.tone === 'good') ? 'happy' : 'neutral';
  const rate = report ? rating(report) : null;
  const lead = report?.lines[0];

  return (
    <button className="dub-summary" onClick={() => window.dispatchEvent(new CustomEvent('superdub:show-coach'))}>
      <div className="dub-summary-pet"><DubMascot size={66} mood={mood as any} species={species} /></div>
      <div className="dub-summary-text">
        <div className="dub-summary-top">
          <span className="dub-summary-name">DUB</span>
          {rate && <span className={`dub-summary-rate dub-summary-rate--${rate.cls}`}>{rate.label}</span>}
        </div>
        <p className="dub-summary-msg">
          {report
            ? <>{report.emoji} {report.headline}.{lead ? ` ${lead.title} — tap for the full read.` : ''}</>
            : 'Weigh in and tick your habits — I\'ll start tracking your progress and rate how it\'s going.'}
        </p>
      </div>
      <span className="dub-summary-chev">›</span>
    </button>
  );
};

export default DubProgressSummary;
