import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './Coach.css';
import { api } from './api';
import { buildCoachReport, type CoachReport as Report } from './coach';
import { buildBrief } from './dubBrief';
import { buildHabitInsights } from './dubInsights';
import { buildQuestionBank, type DubData, type DubQuestion } from './dubQuestions';
import { isSystemHabit } from './systemHabits';
import { useXP } from './XPContext';
import { readStage } from './userStage';

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
function isoOffset(daysAgo: number): string {
  const d = new Date(); d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Msg { from: 'dub' | 'you'; text: string }
const TRAY_SIZE = 5;

// Dub's chat. The old post-weigh-in coach report is the OPENING of a
// conversation now: Dub's read arrives as bubbles, then tappable questions,
// each answered instantly and deterministically from the user's own numbers
// (buildQuestionBank in dubChat.ts). Same two triggers as the old report, so
// the weigh-in flow and every "Talk to Dub" button land here.
const DubChat: React.FC = () => {
  const [report, setReport] = useState<Report | null>(null);
  const [bank, setBank] = useState<DubQuestion[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [asked, setAsked] = useState<Set<string>>(new Set());
  const [queue, setQueue] = useState<string[]>([]);   // followUps floated forward
  const [typing, setTyping] = useState(false);
  const [closing, setClosing] = useState(false);
  const { totalXP } = useXP();
  const msgsRef = useRef<HTMLDivElement>(null);
  const typeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Accent follows the nav-glow cosmetic so the read matches the Coach page + tab.
  const [navGlow, setNavGlow] = useState(() => localStorage.getItem('superdub.navGlow') || '#2FD27E');

  useEffect(() => () => { if (typeTimer.current) clearTimeout(typeTimer.current); }, []);
  useEffect(() => {
    const sync = () => setNavGlow(localStorage.getItem('superdub.navGlow') || '#2FD27E');
    window.addEventListener('superdub:nav-glow-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('superdub:nav-glow-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const dismiss = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setReport(null); setClosing(false);
      setBank([]); setMessages([]); setAsked(new Set()); setQueue([]); setTyping(false);
    }, 300);
  }, []);

  const generate = useCallback(async (manual = false) => {
    try {
      const [tracker, habits, plan, moods, journal, coaching] = await Promise.all([
        api.getTracker(),
        api.getHabits(),
        api.getPlanStatus().catch(() => null),
        api.getCheckInHistory(90).catch(() => ({ entries: [] as any[] })),
        api.getJournal().catch(() => [] as any[]),
        api.getCoachingMessage().catch(() => null),
      ]);
      const weights = (tracker.days ?? [])
        .filter((d: any) => d.weight)
        .map((d: any) => ({ day: d.day, weight: Number(d.weight) }));
      const goal = (plan && plan.active && plan.goal)
        ? { goalType: plan.goal.goalType, targetWeight: plan.goal.targetWeight }
        : null;
      const r = buildCoachReport(weights, habits as any, (tracker.habits ?? []) as any, ALL_DAYS, todayKey(), goal);
      if (!r && !manual) return; // auto-fire with no data: stay quiet, as before

      // Insight inputs mirror DubPage's: steps/weight by day, mood by DD/MM.
      const stepsByDay: Record<string, number> = {};
      const weightByDay: Record<string, number> = {};
      for (const d of (tracker.days ?? []) as any[]) {
        const s = parseInt(d.steps ?? '', 10);
        if (s > 0) stepsByDay[d.day] = s;
        const w = Number(d.weight);
        if (w > 0) weightByDay[d.day] = w;
      }
      const moodByDay: Record<string, number> = {};
      const checkins: { date: string; sleep: number | null; mood: number | null }[] = [];
      for (const e of ((moods as any).entries ?? [])) {
        checkins.push({ date: e.date, sleep: e.sleep ?? null, mood: e.mood ?? null });
        if (e.mood == null || !e.date) continue;
        const parts = String(e.date).split('-');
        if (parts.length === 3) moodByDay[`${parts[2]}/${parts[1]}`] = e.mood;
      }
      for (const j of (journal as any[])) {
        if (j.mood == null || !j.createdAt) continue;
        const d = new Date(j.createdAt);
        if (isNaN(d.getTime())) continue;
        const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (moodByDay[key] == null) moodByDay[key] = j.mood;
      }
      const realHabits = (habits as any[]).map(h => h.name).filter((n: string) => !isSystemHabit(n));
      const insights = buildHabitInsights({
        habits: realHabits,
        trackerHabits: (tracker.habits ?? []) as any,
        stepsByDay, weightByDay, moodByDay,
        allDays: ALL_DAYS, today: todayKey(),
      });

      const openingReport: Report = r ?? {
        emoji: '', headline: 'Your first read is coming',
        lines: [{ icon: '', title: 'Keep logging', tone: 'neutral', body: "Weigh in and tick your habits for a few days and your numbers will start showing trends, wins and what's tripping you up." }],
        closing: 'Come back any time you log. Your read updates with your data.',
      };

      // ── Morning brief / evening debrief (same sources as DubPage) ──
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
        .filter((row: any) => row.day === todayKey() && row.state === 'done').map((row: any) => row.habit_name));
      const brief = buildBrief({
        hour: new Date().getHours(),
        weights, today: todayKey(), report: r,
        plan: plan ?? null, coaching: coaching ?? null,
        sleepLastNight, adherenceToday,
        habitsDone: dailyHabits.filter(h => doneToday.has(h.name)).length,
        habitsTotal: dailyHabits.length,
        stage: readStage(),
      });

      const data: DubData = {
        weights, report: r, insights,
        plan: plan ?? null, coaching: coaching ?? null,
        checkins, totalXP, today: todayKey(),
        brief: brief?.text ?? null,
      };
      setBank(buildQuestionBank(data));
      setMessages([]); setAsked(new Set()); setQueue([]);
      setReport(openingReport);
    } catch {
      // silent — coaching is a nicety, not critical
    }
  }, [totalXP]);

  // Dub is tap-only: the coach opens on intent (any "Talk to Dub" button →
  // superdub:show-coach), never automatically after a save. Auto-firing after
  // every check-in stacked a full-screen modal on top of the weigh-in and the
  // habit sheet. Logging now just lights the "!" dot on the Dub nav tab (see
  // BottomNav), so his read stays discoverable without interrupting the flow.
  useEffect(() => {
    const onShow = () => generate(true);
    window.addEventListener('superdub:show-coach', onShow);
    return () => window.removeEventListener('superdub:show-coach', onShow);
  }, [generate]);

  const scrollDown = () => {
    requestAnimationFrame(() => {
      const el = msgsRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const ask = (q: DubQuestion) => {
    if (typing) return;
    setAsked(prev => new Set(prev).add(q.id));
    setQueue(prev => [...(q.followUps ?? []).filter(id => id !== q.id), ...prev]);
    setMessages(prev => [...prev, { from: 'you', text: q.label }]);
    scrollDown();
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setMessages(prev => [...prev, { from: 'dub', text: q.answer }]);
      scrollDown();
    } else {
      setTyping(true);
      scrollDown();
      typeTimer.current = setTimeout(() => {
        setTyping(false);
        setMessages(prev => [...prev, { from: 'dub', text: q.answer }]);
        scrollDown();
      }, 400); // one fixed pause, never length-proportional
    }
  };

  if (!report) return null;

  // Tray: floated followUps first, then bank order; asked chips never return.
  const unasked = bank.filter(q => !asked.has(q.id));
  const floated = queue.map(id => unasked.find(q => q.id === id)).filter((q): q is DubQuestion => !!q);
  const rest = unasked.filter(q => !queue.includes(q.id));
  const tray = [...floated, ...rest].slice(0, TRAY_SIZE);

  return (
    <div className={`coach-overlay${closing ? ' closing' : ''}`} style={{ ['--theme' as any]: navGlow }} onClick={dismiss}>
      <div className="coach-card dchat-card" onClick={e => e.stopPropagation()}>
        <button className="coach-close" onClick={dismiss} aria-label="Close">✕</button>

        <div className="dchat-head">
          <span className="coach-eyebrow">YOUR READ</span>
          <h2 className="dchat-verdict">{report.headline}</h2>
        </div>

        <div className="dchat-msgs" ref={msgsRef}>
          {/* The opening read: the coach report as the first messages, tone-coded */}
          {report.lines.map((l, i) => (
            <div key={`r${i}`} className={`dchat-bubble dchat-bubble--dub dchat-bubble--${l.tone}`} style={{ animationDelay: `${i * 120}ms` }}>
              <span className="dchat-line-title"><span className={`dchat-dot dchat-dot--${l.tone}`} aria-hidden="true" />{l.title}</span>
              <span className="dchat-line-body">{l.body}</span>
            </div>
          ))}
          {messages.length === 0 && !typing && (
            <div className="dchat-bubble dchat-bubble--dub" style={{ animationDelay: `${report.lines.length * 120}ms` }}>
              <span className="dchat-line-body">{report.closing}{bank.length > 0 ? ' Ask me anything below.' : ''}</span>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={`m${i}`} className={`dchat-bubble dchat-bubble--${m.from}`}>
              <span className="dchat-line-body">{m.text}</span>
            </div>
          ))}
          {typing && (
            <div className="dchat-bubble dchat-bubble--dub dchat-typing" aria-label="Dub is typing">
              <span /><span /><span />
            </div>
          )}
        </div>

        {tray.length > 0 && (
          <div className="dchat-chips">
            {tray.map(q => (
              <button key={q.id} className="dchat-chip" onClick={() => ask(q)} disabled={typing}>
                {q.label}
              </button>
            ))}
          </div>
        )}

        <p className="dchat-foot">
          All answers come from your own numbers. <Link to="/maths" onClick={dismiss}>See the maths</Link>
        </p>
      </div>
    </div>
  );
};

export default DubChat;
