import React, { useEffect, useState } from 'react';
import './App.css';
import { api } from './api';
import { buildCoachReport, type CoachReport as Report } from './coach';
import { buildHabitInsights, type DubInsight } from './dubInsights';
import { getMascot, type MascotSpecies } from './DubMascot';
import DubRoom from './DubRoom';
import SuperdubHeader from './SuperdubHeader';
import { pageTheme, GROWTH } from './theme';
import { isSystemHabit } from './systemHabits';

const YEAR = new Date().getFullYear();
const DUB_SEEN_KEY = 'superdub.dubSeen';

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

// Dub's home is just his room now — tap Dub to chat (the coach report opens with
// everything he's spotted). The report/insights are still computed in the
// background purely to drive the "!" badge: gold when there's something new to
// hear, grey once you've tapped through.
const DubPage: React.FC = () => {
  const [report, setReport] = useState<Report | null>(null);
  const [insights, setInsights] = useState<DubInsight[]>([]);
  const [advisableSteps, setAdvisableSteps] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [species, setSpecies] = useState<MascotSpecies>(getMascot);
  const [seen, setSeen] = useState(() => localStorage.getItem(DUB_SEEN_KEY) || '');

  useEffect(() => {
    const sync = () => setSpecies(getMascot());
    window.addEventListener('superdub:mascot-changed', sync);
    return () => window.removeEventListener('superdub:mascot-changed', sync);
  }, []);

  // A signature of everything Dub currently "knows". Gold "!" until you tap him
  // (which opens the chat and marks this exact read as seen), then it goes grey
  // and only relights when the report, insights, or step nudge actually change.
  const dubSig = JSON.stringify({
    h: report?.headline ?? '',
    l: (report?.lines ?? []).map(l => l.title),
    i: insights.map(x => x.habit + '|' + x.text),
    s: advisableSteps,
  });
  const hasNew = loaded && dubSig !== seen;
  const chatToDub = () => {
    window.dispatchEvent(new CustomEvent('superdub:show-coach'));
    localStorage.setItem(DUB_SEEN_KEY, dubSig);
    setSeen(dubSig);
  };

  useEffect(() => {
    (async () => {
      try {
        const [tracker, habits, plan, moods, journal, coaching] = await Promise.all([
          api.getTracker(),
          api.getHabits(),
          api.getPlanStatus().catch(() => null),
          api.getCheckInHistory(180).catch(() => ({ entries: [] as any[] })),
          api.getJournal().catch(() => [] as any[]),
          api.getCoachingMessage().catch(() => null),
        ]);
        setAdvisableSteps((coaching as any)?.advisableSteps ?? null);

        // ── Coaching report (same inputs as the post-weigh-in modal) ──
        const weights = (tracker.days ?? [])
          .filter((d: any) => d.weight)
          .map((d: any) => ({ day: d.day, weight: Number(d.weight) }));
        const goal = (plan && (plan as any).active && (plan as any).goal)
          ? { goalType: (plan as any).goal.goalType, targetWeight: (plan as any).goal.targetWeight }
          : null;
        setReport(buildCoachReport(weights, habits as any, (tracker.habits ?? []) as any, ALL_DAYS, todayKey(), goal));

        // ── Insight inputs: steps + weight by day, mood by DD/MM ──
        const stepsByDay: Record<string, number> = {};
        const weightByDay: Record<string, number> = {};
        for (const d of (tracker.days ?? []) as any[]) {
          const s = parseInt(d.steps ?? '', 10);
          if (s > 0) stepsByDay[d.day] = s;
          const w = Number(d.weight);
          if (w > 0) weightByDay[d.day] = w;
        }
        const moodByDay: Record<string, number> = {};
        for (const e of ((moods as any).entries ?? [])) {
          if (e.mood == null || !e.date) continue;
          // check-in dates are ISO (YYYY-MM-DD); insights key on DD/MM.
          const parts = String(e.date).split('-');
          if (parts.length === 3) moodByDay[`${parts[2]}/${parts[1]}`] = e.mood;
        }
        // Journal moods are an extra signal — fill days the check-in didn't cover.
        for (const j of (journal as any[])) {
          if (j.mood == null || !j.createdAt) continue;
          const d = new Date(j.createdAt);
          if (isNaN(d.getTime())) continue;
          const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (moodByDay[key] == null) moodByDay[key] = j.mood;
        }

        const realHabits = (habits as any[]).map(h => h.name).filter((n: string) => !isSystemHabit(n));
        setInsights(buildHabitInsights({
          habits: realHabits,
          trackerHabits: (tracker.habits ?? []) as any,
          stepsByDay, weightByDay, moodByDay,
          allDays: ALL_DAYS, today: todayKey(),
        }));
      } catch {
        // coaching is a nicety, not critical
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  return (
    <div className="app flush" style={pageTheme(GROWTH, '0D')}>
      <SuperdubHeader />
      {/* Just Dub's room — tap Dub to chat; the "!" badge flags fresh info */}
      <DubRoom species={species} hasNew={hasNew} onChat={chatToDub} />
    </div>
  );
};

export default DubPage;
