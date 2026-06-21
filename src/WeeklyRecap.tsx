import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { api } from './api';

const XP_GATES: [number, number][] = [
  [0, 10], [7, 15], [14, 20], [30, 25], [60, 30], [100, 35], [200, 40], [365, 50],
];
const LEVEL_GATES: [number, string][] = [
  [0, 'Rookie'], [100, 'Beginner'], [300, 'Novice'], [700, 'Apprentice'],
  [1500, 'Adept'], [3000, 'Journeyman'], [5000, 'Expert'], [8000, 'Elite'],
  [12000, 'Champion'], [18000, 'Legend'], [28000, 'Grandmaster'],
  [42000, 'Mythic'], [60000, 'Immortal'], [85000, 'Eternal'], [120000, 'Transcendent'],
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getPlayerLevel(totalXP: number) {
  let idx = 0;
  for (let i = LEVEL_GATES.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_GATES[i][0]) { idx = i; break; }
  }
  const xpForLevel = LEVEL_GATES[idx][0];
  const xpForNext = idx < LEVEL_GATES.length - 1 ? LEVEL_GATES[idx + 1][0] : null;
  const nextTitle = idx < LEVEL_GATES.length - 1 ? LEVEL_GATES[idx + 1][1] : null;
  const progress = xpForNext ? (totalXP - xpForLevel) / (xpForNext - xpForLevel) : 1;
  return { level: idx + 1, title: LEVEL_GATES[idx][1], progress, xpForLevel, xpForNext, nextTitle };
}

type HabitState = true | 'failed' | false;
interface DayData {
  weight: string;
  habits: Record<string, HabitState>;
  steps: string;
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
}

interface WeeklyRecapProps {
  habits: string[];
  tracker: Record<string, DayData>;
}

const WeeklyRecap: React.FC<WeeklyRecapProps> = ({ habits, tracker }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [hideWeight, setHideWeight] = useState(false);
  const [scale, setScale] = useState(1);
  const [open, setOpen] = useState(false);

  // Sunday Review state
  const [intentionText, setIntentionText] = useState('');
  const [intentionSaved, setIntentionSaved] = useState(false);
  const [lastWeekIntention, setLastWeekIntention] = useState<string | null>(null);

  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const isSunday = dow === 0;
  const daysFromMon = dow === 0 ? 6 : dow - 1;

  const mon = new Date(today);
  mon.setDate(today.getDate() - daysFromMon);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);

  // Week start key for intention storage (YYYY-MM-DD of Monday)
  const weekStartISO = useMemo(
    () => mon.toISOString().slice(0, 10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mon.getTime()]
  );

  // Previous week's Monday
  const prevWeekStartISO = useMemo(() => {
    const prev = new Date(mon);
    prev.setDate(prev.getDate() - 7);
    return prev.toISOString().slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mon.getTime()]);

  const toKey = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

  const weekKeys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    weekKeys.push(toKey(d));
  }

  // ── Week stats ─────────────────────────────────────────────────────────────
  let weekDone = 0, weekPossible = 0, weekSteps = 0, daysTracked = 0;
  const weights: number[] = [];
  const dayConsistency: number[] = [];

  weekKeys.forEach(day => {
    const d = tracker[day];
    if (!d) { dayConsistency.push(0); return; }
    const done = habits.filter(h => d.habits?.[h] === true).length;
    const hasAny = habits.some(h => d.habits?.[h] === true || d.habits?.[h] === 'failed');
    if (hasAny) {
      daysTracked++;
      weekDone += done;
      weekPossible += habits.length;
    }
    dayConsistency.push(habits.length > 0 ? done / habits.length : 0);
    weekSteps += parseInt(d.steps ?? '') || 0;
    const w = parseFloat(d.weight ?? '');
    if (w > 0) weights.push(w);
  });

  const consistency = weekPossible > 0 ? Math.round((weekDone / weekPossible) * 100) : 0;
  const stepKm = +(weekSteps * 0.00075).toFixed(1);
  const weightChange =
    weights.length >= 2 ? +(weights[weights.length - 1] - weights[0]).toFixed(1) : null;

  // Approximate total XP from full tracker (simplified: done × gate_xp)
  const totalXP = (() => {
    let xp = 0;
    const streakMap: Record<string, number> = {};
    // Walk chronologically through all days
    const allDays = Object.keys(tracker).sort((a, b) => {
      const [ad, am] = a.split('/').map(Number);
      const [bd, bm] = b.split('/').map(Number);
      return am !== bm ? am - bm : ad - bd;
    });
    allDays.forEach(day => {
      const d = tracker[day];
      if (!d) return;
      habits.forEach(h => {
        if (d.habits?.[h] === true) {
          streakMap[h] = (streakMap[h] ?? 0) + 1;
          const streak = streakMap[h];
          const gateIdx = XP_GATES.filter(([t]) => t > 0 && streak >= t).length;
          xp += XP_GATES[Math.min(gateIdx, XP_GATES.length - 1)][1];
        } else if (d.habits?.[h] === 'failed') {
          streakMap[h] = 0;
        }
      });
    });
    return xp;
  })();

  // Weekly XP (done completions this week × base XP)
  const weekXP = weekDone * 10;

  const playerLevel = getPlayerLevel(totalXP);
  const xpToNext = playerLevel.xpForNext !== null ? playerLevel.xpForNext - totalXP : 0;
  const xpBarWidth = Math.round(playerLevel.progress * 100);

  // Best day of the week
  const bestDayIdx = dayConsistency.reduce(
    (bi, v, i) => (v > dayConsistency[bi] ? i : bi),
    0
  );
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const dateRange = `Mon ${mon.getDate()} ${MONTH_SHORT[mon.getMonth()]} – Sun ${sun.getDate()} ${MONTH_SHORT[sun.getMonth()]} ${sun.getFullYear()}`;

  // ── Sunday Review: load this week's intention + last week's intention ────────
  useEffect(() => {
    if (!open || !isSunday) return;
    api.getWeeklyIntention(weekStartISO)
      .then((d: any) => { if (d.intention) setIntentionText(d.intention); })
      .catch(() => {});
    api.getWeeklyIntention(prevWeekStartISO)
      .then((d: any) => { setLastWeekIntention(d.intention ?? null); })
      .catch(() => {});
  }, [open, isSunday, weekStartISO, prevWeekStartISO]);

  const saveIntention = () => {
    if (!intentionText.trim()) return;
    api.saveWeeklyIntention(weekStartISO, intentionText)
      .then(() => setIntentionSaved(true))
      .catch(() => {});
  };

  // ── Sunday Review computed values ─────────────────────────────────────────
  // Biggest win: day with highest step count OR highest consistency, whichever is clearer
  const biggestWin = useMemo(() => {
    const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let bestStepsDay = -1, bestSteps = 0;
    let bestConsDay = -1, bestCons = 0;
    weekKeys.forEach((key, i) => {
      const d = tracker[key];
      if (!d) return;
      const steps = parseInt(d.steps ?? '') || 0;
      if (steps > bestSteps) { bestSteps = steps; bestStepsDay = i; }
      const done = habits.filter(h => d.habits?.[h] === true).length;
      const cons = habits.length > 0 ? done / habits.length : 0;
      if (cons > bestCons) { bestCons = cons; bestConsDay = i; }
    });
    if (bestSteps > 0 && bestStepsDay >= 0) {
      return `${DAY_NAMES[bestStepsDay]} — ${bestSteps.toLocaleString()} steps`;
    }
    if (bestCons > 0 && bestConsDay >= 0) {
      return `${DAY_NAMES[bestConsDay]} — ${Math.round(bestCons * 100)}% habit consistency`;
    }
    return null;
  }, [weekKeys, tracker, habits]);

  // Friction point: lowest-energy day (needs check-in data) or lowest-consistency habit
  const frictionPoint = useMemo(() => {
    const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let worstConsDay = -1, worstCons = Infinity;
    weekKeys.forEach((key, i) => {
      const d = tracker[key];
      if (!d) return;
      const done = habits.filter(h => d.habits?.[h] === true).length;
      const poss = habits.some(h => d.habits?.[h] === true || d.habits?.[h] === 'failed') ? habits.length : null;
      if (poss !== null) {
        const cons = done / poss;
        if (cons < worstCons) { worstCons = cons; worstConsDay = i; }
      }
    });
    if (worstConsDay >= 0 && worstCons < 1) {
      return `${DAY_NAMES[worstConsDay]} was the toughest — ${Math.round(worstCons * 100)}% consistency`;
    }
    return null;
  }, [weekKeys, tracker, habits]);

  // ── Responsive scaling ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const w = wrapRef.current?.clientWidth ?? 390;
      setScale(Math.min(1, (w - 32) / 540));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open]);

  // ── PNG export ──────────────────────────────────────────────────────────────
  const download = useCallback(async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: '#07090C',
        useCORS: true,
        logging: false,
        allowTaint: true,
      });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `superdub-week-${weekKeys[0].replace('/', '-')}.png`;
      a.click();
    } catch (e) {
      console.error('[WeeklyRecap] export failed', e);
    } finally {
      setDownloading(false);
    }
  }, [weekKeys]);

  // ── Collapsed trigger ───────────────────────────────────────────────────────
  return (
    <section className="report-card wr-section" ref={wrapRef}>
      <button className="wr-toggle-row" onClick={() => setOpen(o => !o)}>
        <span className="wr-toggle-eyebrow">
          Weekly Recap
          {!isSunday && <span className="wr-preview-chip">Preview</span>}
          {isSunday && <span className="wr-sunday-chip">Download ready</span>}
        </span>
        <span className={`wr-chevron ${open ? 'open' : ''}`}>›</span>
      </button>

      {open && (
        <>
          {/* Scaled card */}
          <div
            className="wr-scaler-wrap"
            style={{ height: 760 * scale + 16 }}
          >
            <div
              className="wr-scaler"
              style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
            >
              {/* ── THE CARD ─────────────────────────────────────────────── */}
              <div className="wr-card" ref={cardRef}>
                {/* Grid texture overlay */}
                <div className="wr-grid-tex" />
                {/* Ambient blobs */}
                <div className="wr-blob wr-blob-1" />
                <div className="wr-blob wr-blob-2" />

                {/* Brand row */}
                <div className="wr-brandrow">
                  <div className="wr-brand">
                    <img src="/superdub-logo.png" className="wr-mark" alt="" />
                    <span className="wr-wordmark">super<span className="wr-dub">dub</span></span>
                  </div>
                  <span className="wr-recap-label">WEEKLY RECAP</span>
                </div>

                <div className="wr-daterange">{dateRange}</div>

                {/* Hero */}
                <div className="wr-hero">
                  <div className="wr-hero-eyebrow">HABIT CONSISTENCY</div>
                  <div className="wr-hero-stat">
                    <span className="wr-hero-number">{consistency}</span>
                    <span className="wr-hero-unit">%</span>
                  </div>

                  <div className="wr-levelup-pill">
                    <div className="wr-pill-badge">L{playerLevel.level}</div>
                    <span className="wr-pill-label">
                      {playerLevel.title}
                      {playerLevel.nextTitle ? ` → ${playerLevel.nextTitle}` : ''}
                    </span>
                    <span className="wr-pill-xp">{totalXP.toLocaleString()} XP</span>
                  </div>

                  <div className="wr-progress-wrap">
                    <div className="wr-progress-row">
                      <span>Level {playerLevel.level}</span>
                      <span>
                        {playerLevel.xpForNext
                          ? `${xpToNext.toLocaleString()} to ${playerLevel.nextTitle}`
                          : 'MAX LEVEL'}
                      </span>
                    </div>
                    <div className="wr-bar-track">
                      <div className="wr-bar-fill" style={{ width: `${xpBarWidth}%` }} />
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="wr-divider">
                  <div className="wr-divider-line" />
                  <div className="wr-divider-dot" />
                  <div className="wr-divider-line" />
                </div>

                {/* KPI 2×2 grid */}
                <div className="wr-kpi-grid">
                  <div className="wr-kpi">
                    <div className="wr-kpi-top">
                      <span className="wr-kpi-label">STEPS THIS WEEK</span>
                      <span className="wr-kpi-dot" style={{ background: '#2FD27E' }} />
                    </div>
                    <div className="wr-kpi-value">
                      {weekSteps > 0 ? `${stepKm} km` : '—'}
                    </div>
                    {weekSteps > 0 && (
                      <div className="wr-kpi-delta">{weekSteps.toLocaleString()} steps total</div>
                    )}
                  </div>

                  <div className="wr-kpi">
                    <div className="wr-kpi-top">
                      <span className="wr-kpi-label">DAYS TRACKED</span>
                      <span className="wr-kpi-dot" style={{ background: '#2E8BFF' }} />
                    </div>
                    <div className="wr-kpi-value">{daysTracked}/7</div>
                    <div className="wr-kpi-delta">
                      {daysTracked === 7
                        ? 'Perfect week!'
                        : daysTracked === 0
                        ? 'Log habits to track'
                        : `${7 - daysTracked} day${7 - daysTracked !== 1 ? 's' : ''} missed`}
                    </div>
                  </div>

                  <div className="wr-kpi">
                    <div className="wr-kpi-top">
                      <span className="wr-kpi-label">XP EARNED</span>
                      <span className="wr-kpi-dot" style={{ background: '#FFD233' }} />
                    </div>
                    <div className="wr-kpi-value wr-kpi-gold">{weekXP}</div>
                    <div className="wr-kpi-delta">
                      {dayConsistency[bestDayIdx] > 0
                        ? `Best: ${DAY_NAMES[bestDayIdx]} (${Math.round(dayConsistency[bestDayIdx] * 100)}%)`
                        : 'Start logging to earn XP'}
                    </div>
                  </div>

                  <div className="wr-kpi">
                    <div className="wr-kpi-top">
                      <span className="wr-kpi-label">WEIGHT CHANGE</span>
                      <span className="wr-kpi-dot" style={{ background: '#8B5CF6' }} />
                    </div>
                    {hideWeight ? (
                      <div className="wr-kpi-value wr-kpi-hidden">● ● ●</div>
                    ) : (
                      <>
                        <div
                          className={`wr-kpi-value ${weightChange !== null && weightChange < 0 ? 'wr-kpi-green' : ''}`}
                        >
                          {weightChange !== null
                            ? `${weightChange > 0 ? '+' : ''}${weightChange} kg`
                            : '—'}
                        </div>
                        <div className="wr-kpi-delta">
                          {weights.length >= 2
                            ? 'vs. Monday'
                            : weights.length === 1
                            ? 'Only 1 weigh-in'
                            : 'No weigh-ins'}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="wr-footer">
                  <span className="wr-footer-url">superdub.app</span>
                  <span className="wr-tagline">
                    No logging.<br /><b>Just living.</b>
                  </span>
                </div>
              </div>
              {/* ── END CARD ─────────────────────────────────────────────── */}
            </div>
          </div>

          {/* Actions */}
          <div className="wr-actions">
            <button
              className="wr-btn-secondary"
              onClick={() => setHideWeight(h => !h)}
            >
              {hideWeight ? '👁 Show weight' : '🙈 Hide weight'}
            </button>
            {isSunday ? (
              <button
                className="wr-btn-primary"
                onClick={download}
                disabled={downloading}
              >
                {downloading ? 'Saving…' : '⬇ Save PNG'}
              </button>
            ) : (
              <button className="wr-btn-primary" disabled>
                ⬇ Available Sunday
              </button>
            )}
          </div>

          {/* ── Sunday Review ──────────────────────────────────────────────── */}
          {isSunday && (
            <div className="sunday-review">
              <div className="sunday-review-title">Sunday Review</div>

              {lastWeekIntention && (
                <div className="sunday-intention-recall">
                  <span className="sunday-recall-label">Last week you said:</span>
                  <span className="sunday-recall-text">"{lastWeekIntention}"</span>
                </div>
              )}

              {biggestWin && (
                <div className="sunday-review-row">
                  <span className="sunday-review-eyebrow">Biggest win</span>
                  <span className="sunday-review-value">{biggestWin}</span>
                </div>
              )}

              {frictionPoint && (
                <div className="sunday-review-row">
                  <span className="sunday-review-eyebrow">Friction point</span>
                  <span className="sunday-review-value">{frictionPoint}</span>
                </div>
              )}

              {!biggestWin && !frictionPoint && (
                <p className="sunday-review-empty">Log habits or steps this week to see your review here.</p>
              )}

              <div className="sunday-intention-wrap">
                <span className="sunday-review-eyebrow">Next week's intention</span>
                <textarea
                  className="sunday-intention-input"
                  placeholder="What do you want to focus on next week?"
                  value={intentionText}
                  onChange={e => { setIntentionText(e.target.value); setIntentionSaved(false); }}
                  rows={2}
                />
                <button
                  className="sunday-intention-save"
                  onClick={saveIntention}
                  disabled={!intentionText.trim() || intentionSaved}
                >
                  {intentionSaved ? '✓ Saved' : 'Save intention'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default WeeklyRecap;
