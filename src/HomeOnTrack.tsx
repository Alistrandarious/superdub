import React, { useEffect, useState } from 'react';
import { api } from './api';
import { buildCoachReport } from './coach';

// One-line "are you on track?" read for the home screen, so the question needs
// no navigation. It reuses the coach's WEIGHT verdict — buildCoachReport's first
// line is always the weight line (coach.ts) — the exact same source Progress and
// Dub use, so the three never disagree. Tapping opens Progress for the full trend.
// Hidden until there's data to build a report from.
//
// ponytail: refetches tracker/habits/plan rather than threading Habits' already-
// loaded data down. One extra parallel fetch on the home screen, non-blocking.
// Upgrade path: lift the coach report into Habits and pass the line in as a prop.

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

const HomeOnTrack: React.FC = () => {
  const [line, setLine] = useState<{ title: string; tone: 'good' | 'warn' | 'neutral' } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tracker, habits, plan] = await Promise.all([
          api.getTracker(), api.getHabits(), api.getPlanStatus().catch(() => null),
        ]);
        if (cancelled) return;
        const weights = (tracker.days ?? [])
          .filter((d: any) => d.weight)
          .map((d: any) => ({ day: d.day, weight: Number(d.weight) }));
        const goal = (plan && (plan as any).active && (plan as any).goal)
          ? { goalType: (plan as any).goal.goalType, targetWeight: (plan as any).goal.targetWeight }
          : null;
        const r = buildCoachReport(weights, habits as any, (tracker.habits ?? []) as any, ALL_DAYS, todayKey(), goal);
        const wl = r?.lines[0];
        if (wl) setLine({ title: wl.title, tone: wl.tone });
      } catch { /* non-critical — the strip just stays hidden */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!line) return null;
  return (
    <button
      className={`home-ontrack home-ontrack--${line.tone}`}
      onClick={() => window.dispatchEvent(new CustomEvent('superdub:show-trend'))}
      aria-label={`Where you're trending: ${line.title}. Open the full read: why, and what to do next.`}
    >
      <span className="home-ontrack-dot" aria-hidden="true" />
      <span className="home-ontrack-body">
        <span className="home-ontrack-eyebrow">WHERE YOU'RE TRENDING</span>
        <span className="home-ontrack-text">{line.title}</span>
      </span>
      <span className="home-ontrack-chev" aria-hidden="true">›</span>
    </button>
  );
};

export default HomeOnTrack;
