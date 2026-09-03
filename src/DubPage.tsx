import React, { useEffect, useState } from 'react';
import './App.css';
import './Coach.css';
import { api } from './api';
import { buildCoachReport, type CoachReport as Report } from './coach';
import { buildBrief, dubDayState, type DubDayState } from './dubBrief';
import { buildHabitInsights, groupInsights, type DubInsight, type InsightTheme } from './dubInsights';
import SuperdubHeader from './SuperdubHeader';
import { pageTheme } from './theme';
import { isSystemHabit } from './systemHabits';
import { readStage } from './userStage';
import { useXP } from './XPContext';
import { CalendarIc, TrendUpIc, TrendDownIc, SmileIc, ScaleIc, WalkIc } from './icons';

const YEAR = new Date().getFullYear();
const DUB_SEEN_KEY = 'superdub.dubSeen';

// One card per insight theme: its icon, its semantic colour (DESIGN_SYSTEM: HEALTH
// for the body, TEAL for mood, GROWTH for trends, FLAME for consistency) and a
// one-line subtitle. Stroke icons only (style guide: no emoji in UI chrome).
const THEME: Record<InsightTheme, { label: string; sub: string; colour: string; icon: React.ReactNode }> = {
  steps:  { label: 'Movement', sub: 'What your habits do to your steps', colour: '#2FD27E', icon: <WalkIc size={15} /> },
  mood:   { label: 'Mood',     sub: 'How your habits sit with how you feel', colour: '#19C5B0', icon: <SmileIc size={15} /> },
  weight: { label: 'Weight',   sub: 'Which habits track with the scale', colour: '#2E8BFF', icon: <ScaleIc size={15} /> },
  rhythm: { label: 'Rhythm',   sub: 'The days a habit tends to slip', colour: '#FF8A00', icon: <CalendarIc size={15} /> },
};

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

// Ambient time-of-day wash for the hero — lifted from DubRoom's timePhase (which
// is being deleted). Anchors the read with a day/dusk/night mood cue, no mascot.
type Phase = 'day' | 'dusk' | 'night';
function timePhase(hour: number): Phase {
  // ponytail: coarse 3-way split on the local clock — a mood cue, not solar time.
  if (hour >= 6 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}
// The wash colours live in Coach.css (.coach-hero-wash--day/dusk/night) so the
// light theme can swap them: the night navy that reads as mood on the dark ground
// read as a grey smear on white.

// The coach's home — mascot-less. All the data intelligence stays (coach report,
// habit insights, brief + day-state, step nudge). The freshness dot lights when
// the read changes; "Open the full read" opens the coaching read and marks it seen.
const DubPage: React.FC = () => {
  const [report, setReport] = useState<Report | null>(null);
  const [brief, setBrief] = useState<{ kind: 'morning' | 'evening' | 'day'; text: string } | null>(null);
  const [dayState, setDayState] = useState<DubDayState | null>(null);
  const [insights, setInsights] = useState<DubInsight[]>([]);
  const [dataDays, setDataDays] = useState(0);
  const [advisableSteps, setAdvisableSteps] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [seen, setSeen] = useState(() => localStorage.getItem(DUB_SEEN_KEY) || '');
  const { playerLevel } = useXP();

  // Coach accent follows the nav-glow cosmetic so the page, the read and the Coach
  // tab all share one colour. ponytail: same 4-line read as BottomNav / DubChat —
  // extract a useNavGlow() hook if a 4th consumer shows up.
  const [navGlow, setNavGlow] = useState(() => localStorage.getItem('superdub.navGlow') || '#2FD27E');
  useEffect(() => {
    const sync = () => setNavGlow(localStorage.getItem('superdub.navGlow') || '#2FD27E');
    window.addEventListener('superdub:nav-glow-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('superdub:nav-glow-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const phase = timePhase(new Date().getHours());

  // A signature of everything the coach currently "knows". The freshness dot stays
  // lit until you open the read (which marks this exact read as seen), then it goes
  // muted and only relights when the report, insights or step nudge actually change.
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
          api.getCheckInHistory(180).catch((): Awaited<ReturnType<typeof api.getCheckInHistory>> => ({ entries: [] })),
          api.getJournal().catch((): Awaited<ReturnType<typeof api.getJournal>> => []),
          api.getCoachingMessage().catch(() => null),
        ]);
        setAdvisableSteps(coaching?.advisableSteps ?? null);

        // ── Coaching report (same inputs as the post-weigh-in modal) ──
        const weights = (tracker.days ?? [])
          .filter(d => d.weight)
          .map(d => ({ day: d.day, weight: Number(d.weight) }));
        const goal = (plan && plan.active && plan.goal)
          ? { goalType: plan.goal.goalType, targetWeight: plan.goal.targetWeight }
          : null;
        const rpt = buildCoachReport(weights, habits, tracker.habits ?? [], ALL_DAYS, todayKey(), goal);
        setReport(rpt);

        // ── Insight inputs: steps + weight by day, mood by DD/MM ──
        const stepsByDay: Record<string, number> = {};
        const weightByDay: Record<string, number> = {};
        for (const d of (tracker.days ?? [])) {
          const s = parseInt(d.steps ?? '', 10);
          if (s > 0) stepsByDay[d.day] = s;
          const w = Number(d.weight);
          if (w > 0) weightByDay[d.day] = w;
        }
        const moodByDay: Record<string, number> = {};
        for (const e of (moods.entries ?? [])) {
          if (e.mood == null || !e.date) continue;
          // check-in dates are ISO (YYYY-MM-DD); insights key on DD/MM.
          const parts = String(e.date).split('-');
          if (parts.length === 3) moodByDay[`${parts[2]}/${parts[1]}`] = e.mood;
        }
        // Journal moods are an extra signal — fill days the check-in didn't cover.
        for (const j of journal) {
          if (j.mood == null || !j.createdAt) continue;
          const d = new Date(j.createdAt);
          if (isNaN(d.getTime())) continue;
          const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (moodByDay[key] == null) moodByDay[key] = j.mood;
        }

        // count of days with any real signal — gates the "keep logging" state
        const signalDays = new Set<string>([...Object.keys(stepsByDay), ...Object.keys(weightByDay), ...Object.keys(moodByDay)]);
        for (const row of (tracker.habits ?? [])) if (row.state && !isSystemHabit(row.habit_name)) signalDays.add(row.day);
        setDataDays(signalDays.size);

        const realHabits = habits.map(h => h.name).filter(n => !isSystemHabit(n));
        setInsights(buildHabitInsights({
          habits: realHabits,
          trackerHabits: tracker.habits ?? [],
          stepsByDay, weightByDay, moodByDay,
          allDays: ALL_DAYS, today: todayKey(),
          goalType: goal?.goalType ?? null,
        }));

        // ── Morning brief / evening debrief ──
        const checkinEntries = moods.entries ?? [];
        const todayISO = isoOffset(0);
        const yesterdayISO = isoOffset(1);
        const latestSleepEntry = [...checkinEntries]
          .filter(e => e.sleep != null)
          .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
        const sleepLastNight = (latestSleepEntry && (latestSleepEntry.date === todayISO || latestSleepEntry.date === yesterdayISO))
          ? latestSleepEntry.sleep : null;
        const adherenceToday = checkinEntries.find(e => e.date === todayISO)?.adherenceLevel ?? null;
        const dailyHabits = habits.filter(h => (h.cadence ?? 'daily') === 'daily' && !isSystemHabit(h.name));
        const doneToday = new Set((tracker.habits ?? [])
          .filter(r => r.day === todayKey() && r.state === 'done').map(r => r.habit_name));
        const briefSrc = {
          hour: new Date().getHours(),
          weights, today: todayKey(), report: rpt,
          plan: plan ?? null, coaching: coaching ?? null,
          sleepLastNight, adherenceToday,
          habitsDone: dailyHabits.filter(h => doneToday.has(h.name)).length,
          habitsTotal: dailyHabits.length,
          stage: readStage(),
        };
        setBrief(buildBrief(briefSrc));
        // Same sources drive the explicit day-state line in the hero.
        setDayState(dubDayState(briefSrc));
      } catch {
        // coaching is a nicety, not critical
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // 64px identity ring — the level as an XP arc, no mascot.
  const RING = 64, RS = 6, RR = (RING - RS) / 2, CIRC = 2 * Math.PI * RR;
  const ringOffset = CIRC * (1 - Math.max(0, Math.min(1, playerLevel.progress)));

  return (
    <div className="app flush" style={pageTheme(navGlow, '0D')}>
      <SuperdubHeader />

      <div className="coach-scroll">
        <div className="coach-topbar">
          <span className="coach-eyebrow">COACH</span>
          <span className={`coach-fresh${hasNew ? ' is-new' : ''}`} aria-hidden="true" />
        </div>

        {/* HERO — today's read, anchored by an ambient time-of-day wash + level ring */}
        {/* The hero says "tap me", so the whole card opens the read, not only the
            button below the insights. */}
        <section
          className="coach-hero"
          role="button"
          tabIndex={0}
          aria-label="Open today's full read"
          onClick={chatToDub}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chatToDub(); } }}
        >
          <div className={`coach-hero-wash coach-hero-wash--${phase}`} aria-hidden="true" />
          <div className="coach-hero-body">
            <span className="coach-hero-ring" role="img" aria-label={`Level ${playerLevel.level}, ${playerLevel.title}`}>
              <svg width={RING} height={RING} aria-hidden="true">
                <circle cx={RING / 2} cy={RING / 2} r={RR} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={RS} />
                <circle cx={RING / 2} cy={RING / 2} r={RR} fill="none" stroke={navGlow} strokeWidth={RS}
                  strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={ringOffset}
                  transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                  style={{ filter: `drop-shadow(0 0 4px ${navGlow}88)` }} />
              </svg>
              <span className="coach-hero-ring-num">{playerLevel.level}</span>
            </span>
            <div className="coach-hero-text">
              <span className="coach-eyebrow">TODAY&rsquo;S READ</span>
              {dayState?.thought
                ? <p className="coach-hero-thought">{dayState.thought}</p>
                : !loaded && <p className="coach-hero-thought coach-hero-thought--wait">Reading your day.</p>}
              {/* Full paragraph brief lives behind "Open the full read" — the hero stays
                  a single punchy verdict so the page is scannable, not a wall of text. */}
            </div>
          </div>
        </section>

        {advisableSteps != null && (
          <p className="coach-steps">
            <svg className="coach-steps-ico" width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 21v-4a4 4 0 0 1 4-4h1a3 3 0 0 0 3-3V4" />
              <path d="M20 21v-3a4 4 0 0 0-4-4h-1a3 3 0 0 1-3-3" />
            </svg>
            Aim for about <span className="coach-steps-num">{advisableSteps.toLocaleString()}</span> steps today.
          </p>
        )}

        {/* WHAT WE SPOTTED — the habit insights, one card per theme, strongest theme
            first. Each line carries its tone dot (good / heads up) and a 3-bar signal
            meter so the read says how sure it is, not just what it found. */}
        <div className="coach-spotted">
          <div className="coach-sec-head">
            <span className="coach-eyebrow">WHAT WE SPOTTED</span>
            <span className="coach-hairline" aria-hidden="true" />
            {insights.length > 0 && (
              <span className="coach-count">{insights.length} pattern{insights.length === 1 ? '' : 's'}</span>
            )}
          </div>
          {insights.length > 0 ? (
            <div className="coach-lines">
              {groupInsights(insights).map(g => (
                <section key={g.theme} className="coach-group" aria-label={THEME[g.theme].label}
                  style={{ ['--ins' as string]: THEME[g.theme].colour }}>
                  <div className="coach-group-head">
                    <span className="coach-group-ico" aria-hidden="true">{THEME[g.theme].icon}</span>
                    <span className="coach-group-title">{THEME[g.theme].label}</span>
                    <span className="coach-group-sub">{THEME[g.theme].sub}</span>
                  </div>
                  {g.items.map((ins, i) => (
                    <div key={i} className="coach-line">
                      <div className="coach-line-text">
                        <span className="coach-line-title">
                          <span className={`dchat-dot dchat-dot--${ins.tone}`} aria-hidden="true" />
                          {ins.habit}
                          {ins.direction && (
                            <span className="coach-line-dir" aria-hidden="true">
                              {ins.direction === 'up' ? <TrendUpIc size={13} /> : <TrendDownIc size={13} />}
                            </span>
                          )}
                        </span>
                        <span className="coach-line-body">{ins.text}</span>
                      </div>
                      <span className={`coach-signal coach-signal--${ins.signal}`} role="img" aria-label={`${ins.signal} signal`}>
                        <span className="coach-signal-bars" aria-hidden="true"><i /><i /><i /></span>
                        <span className="coach-signal-word" aria-hidden="true">{ins.signal}</span>
                      </span>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          ) : (
            <p className="dub-empty">
              {!loaded ? 'Having a look at your data.'
                : dataDays < 10
                  ? `Keep logging. We can read patterns at 10 days of data (${dataDays}/10 so far).`
                  : "Nothing jumps out yet. Keep ticking your habits and we'll surface what's driving your steps, mood and weight."}
            </p>
          )}
        </div>

        <button className="coach-open" onClick={chatToDub}>Open the full read</button>
      </div>
    </div>
  );
};

export default DubPage;
