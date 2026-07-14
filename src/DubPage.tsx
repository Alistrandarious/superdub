import React, { useEffect, useState } from 'react';
import './App.css';
import { api } from './api';
import { buildCoachReport, type CoachReport as Report } from './coach';
import { buildBrief, dubDayState, type DubDayState } from './dubBrief';
import { buildHabitInsights, type DubInsight } from './dubInsights';
import { getMascot, type MascotSpecies } from './DubMascot';
import DubRoom from './DubRoom';
import SuperdubHeader from './SuperdubHeader';
import { pageTheme, GROWTH } from './theme';
import { dubPronouns, getDubGender, dubHas, type DubGender } from './dubPronouns';
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
function isoOffset(daysAgo: number): string {
  const d = new Date(); d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Dub's home is just his room now — tap Dub to chat (the coach report opens with
// everything he's spotted). The insights list also renders right under the room;
// the "!" badge stays gold until you tap through, then greys until the read changes.
const DubPage: React.FC = () => {
  const [report, setReport] = useState<Report | null>(null);
  const [brief, setBrief] = useState<{ kind: 'morning' | 'evening' | 'day'; text: string } | null>(null);
  const [dayState, setDayState] = useState<DubDayState | null>(null);
  const [insights, setInsights] = useState<DubInsight[]>([]);
  const [dataDays, setDataDays] = useState(0);
  const [advisableSteps, setAdvisableSteps] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [species, setSpecies] = useState<MascotSpecies>(getMascot);
  const [gender, setGender] = useState<DubGender>(getDubGender);
  const [seen, setSeen] = useState(() => localStorage.getItem(DUB_SEEN_KEY) || '');

  useEffect(() => {
    const sync = () => { setSpecies(getMascot()); setGender(getDubGender()); };
    window.addEventListener('superdub:mascot-changed', sync);
    return () => window.removeEventListener('superdub:mascot-changed', sync);
  }, []);
  const pn = dubPronouns(gender);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // A signature of everything Dub currently "knows". Gold "!" until you tap him
  // (which opens the chat and marks this exact read as seen), then it goes grey
  // and only relights when the report, insights, or step nudge actually change.
  const dubSig = JSON.stringify({
    h: report?.headline ?? '',
    l: (report?.lines ?? []).map(l => l.title),
    i: insights.map(x => x.habit + '|' + x.text),
    s: advisableSteps,
    b: brief?.text ?? '',
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
        const rpt = buildCoachReport(weights, habits as any, (tracker.habits ?? []) as any, ALL_DAYS, todayKey(), goal);
        setReport(rpt);

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

        // count of days with any real signal — gates the "keep logging" state
        const signalDays = new Set<string>([...Object.keys(stepsByDay), ...Object.keys(weightByDay), ...Object.keys(moodByDay)]);
        for (const row of ((tracker.habits ?? []) as any[])) if (row.state && !isSystemHabit(row.habit_name)) signalDays.add(row.day);
        setDataDays(signalDays.size);

        const realHabits = (habits as any[]).map(h => h.name).filter((n: string) => !isSystemHabit(n));
        setInsights(buildHabitInsights({
          habits: realHabits,
          trackerHabits: (tracker.habits ?? []) as any,
          stepsByDay, weightByDay, moodByDay,
          allDays: ALL_DAYS, today: todayKey(),
        }));

        // ── Morning brief / evening debrief ──
        const checkinEntries = ((moods as any).entries ?? []) as { date: string; sleep: number | null; adherenceLevel?: number | null }[];
        const todayISO = isoOffset(0);
        const yesterdayISO = isoOffset(1);
        const latestSleepEntry = [...checkinEntries]
          .filter(e => e.sleep != null)
          .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
        const sleepLastNight = (latestSleepEntry && (latestSleepEntry.date === todayISO || latestSleepEntry.date === yesterdayISO))
          ? latestSleepEntry.sleep : null;
        const adherenceToday = checkinEntries.find(e => e.date === todayISO)?.adherenceLevel ?? null;
        const dailyHabits = (habits as any[]).filter(h => (h.cadence ?? 'daily') === 'daily' && !isSystemHabit(h.name));
        const doneToday = new Set(((tracker.habits ?? []) as any[])
          .filter((r: any) => r.day === todayKey() && r.state === 'done').map((r: any) => r.habit_name));
        const briefSrc = {
          hour: new Date().getHours(),
          weights, today: todayKey(), report: rpt,
          plan: plan ?? null, coaching: coaching ?? null,
          sleepLastNight, adherenceToday,
          habitsDone: dailyHabits.filter(h => doneToday.has(h.name)).length,
          habitsTotal: dailyHabits.length,
        };
        setBrief(buildBrief(briefSrc));
        // Same sources drive Dub's live mood, room and speech-bubble thought.
        setDayState(dubDayState(briefSrc));
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
      {/* Dub's room spans from the header down; tap Dub (or his thought) to chat.
          His mood, glow and speech bubble follow the live day state. */}
      <DubRoom
        species={species} hasNew={hasNew} onChat={chatToDub}
        mood={dayState?.mood ?? 'happy'}
        celebrate={dayState?.celebrate ?? false}
        thought={dayState?.thought ?? null}
      />

      {brief && (
        <div className="dub-brief">
          <span className="dub-brief-eyebrow">{brief.kind === 'morning' ? 'MORNING BRIEF' : brief.kind === 'evening' ? 'EVENING DEBRIEF' : 'TODAY SO FAR'}</span>
          <p className="dub-brief-text">{brief.text}</p>
        </div>
      )}

      {/* Dub's insights, right under the room */}
      <div className="dub-insights">
        {advisableSteps != null && (
          <div className="coach-line coach-line--neutral">
            <span className="coach-line-ico">🚶</span>
            <div className="coach-line-text">
              <span className="coach-line-title">Steps today</span>
              <span className="coach-line-body">Aim for about {advisableSteps.toLocaleString()} steps today.</span>
            </div>
          </div>
        )}
        <h3 className="dub-section-title">What {pn.subject} spotted</h3>
        {insights.length > 0 ? (
          <div className="coach-lines">
            {insights.map((ins, i) => (
              <div key={i} className="coach-line coach-line--neutral">
                <span className="coach-line-ico">{ins.icon}</span>
                <div className="coach-line-text">
                  <span className="coach-line-title">{ins.habit}</span>
                  <span className="coach-line-body">{ins.text}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="dub-empty">
            {!loaded ? 'Having a look at your data…'
              : dataDays < 10
                ? `Keep logging. ${cap(pn.subject)} ${dubHas(gender)} enough to read patterns at 10 days of data (${dataDays}/10 so far).`
                : `Nothing jumps out yet. Keep ticking your habits and ${pn.subject}'ll surface what's driving your steps, mood and weight.`}
          </p>
        )}
      </div>
    </div>
  );
};

export default DubPage;
