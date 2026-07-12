import React, { useEffect, useState } from 'react';
import './App.css';
import { api } from './api';
import { buildCoachReport, type CoachReport as Report } from './coach';
import { buildHabitInsights, type DubInsight } from './dubInsights';
import DubMascot, { getMascot, type MascotSpecies } from './DubMascot';
import SuperdubHeader from './SuperdubHeader';
import { pageTheme, GROWTH } from './theme';
import { dubPronouns, getDubGender, dubHas, type DubGender } from './dubPronouns';
import { isSystemHabit } from './systemHabits';

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

// Dub's home: a check-in button (opens the existing coach report), a live read of
// where things stand, and the data findings Dub has dug out of your own history.
const DubPage: React.FC = () => {
  const [report, setReport] = useState<Report | null>(null);
  const [insights, setInsights] = useState<DubInsight[]>([]);
  const [dataDays, setDataDays] = useState(0);
  const [advisableSteps, setAdvisableSteps] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [species, setSpecies] = useState<MascotSpecies>(getMascot);
  const [gender, setGender] = useState<DubGender>(getDubGender);

  useEffect(() => {
    const sync = () => { setSpecies(getMascot()); setGender(getDubGender()); };
    window.addEventListener('superdub:mascot-changed', sync);
    return () => window.removeEventListener('superdub:mascot-changed', sync);
  }, []);
  const pn = dubPronouns(gender);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
        const r = buildCoachReport(weights, habits as any, (tracker.habits ?? []) as any, ALL_DAYS, todayKey(), goal);
        setReport(r);

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
      } catch {
        // coaching is a nicety, not critical
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const mood = report && report.lines.some(l => l.tone === 'warn') ? 'concerned'
    : report && report.lines.some(l => l.tone === 'good') ? 'happy' : 'neutral';

  if (!loaded) {
    return (
      <div className="app" style={pageTheme(GROWTH)}>
        <div className="sd-loader-wrap"><div className="sd-loader"><img className="sd-loader-logo" src="/superdub-logo.png" alt="" /></div></div>
      </div>
    );
  }

  return (
    <div className="app flush" style={pageTheme(GROWTH, '0D')}>
      <div className="habits-page-scroll">
        <SuperdubHeader />

        {/* Hero — Dub + a check-in button (opens the coach report modal) */}
        <div className="dub-hero">
          <DubMascot size={112} mood={mood as any} species={species} />
          <div className="dub-hero-text">
            <span className="coach-eyebrow">DUB · YOUR COACH</span>
            <h2 className="dub-hero-headline">{report ? report.headline : "Hey, I'm Dub"}</h2>
            <button className="dub-checkin-btn" onClick={() => window.dispatchEvent(new CustomEvent('superdub:show-coach'))}>
              Check in with Dub
            </button>
          </div>
        </div>

        {/* Steps nudge — moved here from the Progress step chart so Dub owns coaching */}
        {advisableSteps != null && (
          <section className="dub-section">
            <div className="coach-line coach-line--neutral">
              <span className="coach-line-ico">🚶</span>
              <div className="coach-line-text">
                <span className="coach-line-title">Steps today</span>
                <span className="coach-line-body">Aim for about {advisableSteps.toLocaleString()} steps today.</span>
              </div>
            </div>
          </section>
        )}

        {/* Coaching read — the same lines the weigh-in report shows */}
        {report && report.lines.length > 0 && (
          <section className="dub-section">
            <h3 className="dub-section-title">Where you're at</h3>
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
          </section>
        )}

        {/* Insights — what Dub has found in your data */}
        <section className="dub-section">
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
              {dataDays < 10
                ? `Keep logging. ${cap(pn.subject)} ${dubHas(gender)} enough to read patterns at 10 days of data (${dataDays}/10 so far).`
                : `Nothing jumps out yet. Keep ticking your habits and ${pn.subject}'ll surface what's driving your steps, mood and weight.`}
            </p>
          )}
        </section>

        <div style={{ height: 100 }} />
      </div>
    </div>
  );
};

export default DubPage;
