import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useXP } from './XPContext';
import './App.css';
import { api } from './api';
import { loggingNow, getLoggingDay } from './day';
import { cycleState, type HabitState } from './habitState';
import { scheduleLabel, scheduledDateInPeriod, scheduleDdmm, WEEKDAYS_FULL } from './habitSchedule';
import WeeklyRecap from './WeeklyRecap';
import CadenceCarousel from './CadenceCarousel';
import { useUserStage } from './userStage';
import SuperdubHeader from './SuperdubHeader';
import DailyLog from './DailyLog';
import LapseBanner from './LapseBanner';
import HomeOnTrack from './HomeOnTrack';
import AnimatedFlame from './AnimatedFlame';
import LevelHeroRing from './LevelHeroRing';
import PinnedXpBar from './PinnedXpBar';
import LevelCustomizer from './LevelCustomizer';
import LevelLadder from './LevelLadder';
import { eveningPending } from './EveningPrompt';
import { weatherEnabled } from './promptPrefs';
import { hoursForDay, type WeatherHour } from './weatherHours';
import './HabitsPopup.css';
import {
  CalendarIc, TrophyIc, WalkIc, BookIc, NoSmokeIc, MealIc, MoneyIc, HealthIc,
  SunIc, CloudSunIc, CloudIc, RainIc, SnowIc, StormIc, type IconProps,
} from './icons';
import { pageTheme, HEALTH } from './theme';
import { quitProgress, quitElapsed, toLocalDatetimeValue } from './quit';
import { moveItem, applyGroupReorder } from './reorder';
import { weekMonday, weekRangeLabel, weekTitle } from './weekRange';
import { RECENT_ADD_DAYS, daysSince } from './habitAdd';
import {
  HABIT_LEVEL_TIERS as LEVEL_TIERS, HABIT_LEVEL_RATES as LEVEL_RATES,
  MAX_HABIT_LEVEL as MAX_LEVEL, habitLevelFromDays as levelFromDays, habitXPForDoneDays, cadenceXpMultiplier,
} from './levels';

export type Cadence = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'quit';
// Quit sits leftmost so a left-swipe off Daily reaches it; the carousel still
// opens on Daily each day (see startIndex where CadenceCarousel is mounted).
export const CADENCE_ORDER: Cadence[] = ['quit', 'daily', 'weekly', 'monthly', 'yearly'];
// Add-habit "How often?" picker keeps a daily-first order (Quit last) — reads
// more naturally there than leading with Quit.
export const ADD_CADENCE_ORDER: Cadence[] = ['daily', 'weekly', 'monthly', 'yearly', 'quit'];
export const CADENCE_META: Record<Cadence, { label: string; color: string; icon: string; period: string }> = {
  daily:   { label: 'Daily',   color: '#2FD27E', icon: '✓',  period: 'today' },
  weekly:  { label: 'Weekly',  color: '#2E8BFF', icon: '📅', period: 'this week' },
  monthly: { label: 'Monthly', color: '#8B5CF6', icon: '🗓️', period: 'this month' },
  yearly:  { label: 'Yearly',  color: '#FF8A00', icon: '🔥', period: 'this year' },
  quit:    { label: 'Quit',    color: '#8A8F98', icon: '⏱',  period: 'so far' },
};
const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

// A completion "dot" for a habit card. Daily = 7 weekday dots; weekly = 4 week
// dots (of the month); monthly = 12 month dots; yearly = 1 dot. Each carries the
// days that back it so completing/clearing can write the underlying tracker.
interface PeriodUnit { key: string; label: string; done: boolean; isFuture: boolean; isCurrent: boolean; repDay: string; doneDays: string[]; }

function ddmmToDateNum(ddmm: string): number {
  return new Date(YEAR, parseInt(ddmm.slice(3)) - 1, parseInt(ddmm.slice(0, 2))).getTime();
}

function computePeriodUnits(habit: string, cadence: Cadence, ht: HabitTracker, today: string, schedule?: string | null): PeriodUnit[] {
  const now = new Date();
  const todayNum = ddmmToDateNum(today);
  const doneIn = (days: string[]) => days.filter(d => ht[d]?.[habit] === 'done');
  // When the habit is anchored to a specific day, the current period's target/toggle
  // day is that scheduled day, not just today.
  const sd = scheduledDateInPeriod(cadence, schedule ?? null, now);
  const schedKey = sd ? scheduleDdmm(sd) : null;

  if (cadence === 'weekly') {
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const monthDays = ALL_DAYS.filter(d => d.slice(3) === mm);
    const weekOf = (d: string) => Math.min(4, Math.ceil(parseInt(d.slice(0, 2)) / 7));
    return [1, 2, 3, 4].map(w => {
      const bucket = monthDays.filter(d => weekOf(d) === w);
      const doneDays = doneIn(bucket);
      const inBucket = bucket.includes(today);
      const repDay = inBucket ? (schedKey && bucket.includes(schedKey) ? schedKey : today) : (bucket[0] ?? today);
      return { key: `w${w}`, label: `W${w}`, done: doneDays.length > 0, isFuture: bucket.length > 0 && ddmmToDateNum(bucket[0]) > todayNum, isCurrent: inBucket, repDay, doneDays };
    });
  }
  if (cadence === 'monthly') {
    return Array.from({ length: 12 }, (_, m) => {
      const mm = String(m + 1).padStart(2, '0');
      const bucket = ALL_DAYS.filter(d => d.slice(3) === mm);
      const doneDays = doneIn(bucket);
      const isCurrent = m === now.getMonth();
      const repDay = isCurrent ? (schedKey ?? today) : (bucket[0] ?? today);
      return { key: `m${m}`, label: MONTH_INITIALS[m], done: doneDays.length > 0, isFuture: m > now.getMonth(), isCurrent, repDay, doneDays };
    });
  }
  if (cadence === 'yearly') {
    const doneDays = doneIn(ALL_DAYS);
    return [{ key: 'y', label: String(YEAR), done: doneDays.length > 0, isFuture: false, isCurrent: true, repDay: schedKey ?? today, doneDays }];
  }
  // daily handled inline by the existing weekday row
  return [];
}

const PWA_PROMPT_VERSION = '1.0';
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;

const INSTALL_XP_KEY = 'superdub.installXP';

const OVERLAY_REFRESH_KEY = 'superdub.overlay.refresh';
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/* ── helpers ─────────────────────────────────────────────── */

const YEAR = new Date().getFullYear();

function buildAllDays(): string[] {
  const d: string[] = [];
  for (let m = 0; m < 12; m++) {
    const n = new Date(YEAR, m + 1, 0).getDate();
    for (let day = 1; day <= n; day++) {
      d.push(`${String(day).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}`);
    }
  }
  return d;
}
const ALL_DAYS = buildAllDays();

// ── Single progression system: LEVEL ────────────────────────────────────────
// A habit's level is driven by TOTAL days logged (persistent — never resets when
// you miss). Each level pays a higher XP-per-completion rate: that raise IS the
// bonus for levelling up. LV1 = just started … LV8 = maxed (a year of days).


function todayKey(): string {
  return getLoggingDay(); // 2 AM boundary: before 2 AM this is still yesterday's key
}

function startDateToKey(startDate: string | null | undefined): string | null {
  if (!startDate) return null;
  const parts = startDate.split('-');
  if (parts.length !== 3) return null;
  return `${parts[2]}/${parts[1]}`;
}

function getWeekDays(weekOffset = 0): { key: string; label: string; isFuture: boolean; isToday: boolean }[] {
  const now = loggingNow();
  const mon = weekMonday(now, weekOffset); // offset 0 = this week, -1 = last week …
  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = todayKey();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const nowStart = new Date(now);
    nowStart.setHours(0, 0, 0, 0);
    return { key, label: DAY_LABELS[i], isFuture: dayStart > nowStart, isToday: key === today };
  });
}

function getRank(totalDays: number): { title: string; color: string } {
  if (totalDays === 0)  return { title: '6ft Under', color: '#555' };
  if (totalDays >= 365) return { title: 'Master', color: '#FFD233' };
  if (totalDays >= 100) return { title: 'In the Hundreds', color: '#2E8BFF' };
  if (totalDays >= 50)  return { title: 'Habit Tracking Superstar', color: '#FF8A00' };
  if (totalDays >= 30)  return { title: 'Rising Star', color: '#2FD27E' };
  if (totalDays >= 10)  return { title: 'Gathering Momentum', color: '#FFB928' };
  return { title: 'Habitteaur', color: '#888' };
}

// WMO weather code → SVG icon (was an emoji; style guide: no emoji chrome).
const WeatherIc: React.FC<IconProps & { code: number }> = ({ code, ...p }) => {
  if (code === 0)  return <SunIc {...p} />;
  if (code <= 2)   return <CloudSunIc {...p} />;  // 3 is overcast — no sun peeking through
  if (code <= 48)  return <CloudIc {...p} />;
  if (code <= 65)  return <RainIc {...p} />;   // drizzle + rain
  if (code <= 77)  return <SnowIc {...p} />;
  if (code <= 82)  return <RainIc {...p} />;    // rain showers
  return <StormIc {...p} />;
};

/* ── habit stats computation ─────────────────────────────── */

interface HabitStats {
  streak: number;
  totalDays: number;
  totalXP: number;
  level: number;          // 1..MAX_LEVEL
  xpPerDay: number;       // XP per completion at the current level
  nextLevelAt: number;    // total days required to reach the next level
  daysToNext: number;     // days remaining to next level
  levelProgress: number;  // 0..1 within the current level band
  nextRate: number;       // XP/day at the next level (the bonus you unlock)
  maxed: boolean;
  misses: number;
}

// HabitState + cycleState live in ./habitState (unit-testable in isolation).
// Derived-only render state: a past due day left untouched shows the yellow "?"
// ("undeclared"), distinct from an explicit red fail or an N/A skip. Never persisted.
type DisplayState = HabitState | 'undeclared';
type HabitTracker = Record<string, Record<string, HabitState>>;

function computeHabitStats(
  habit: string,
  ht: HabitTracker,
  today: string,
  startDate?: string | null,
  carryDays: number = 0, // done-days from previous calendar years (server aggregate)
  cadenceMult: number = 1, // weekly/monthly/yearly earn more XP per completion
): HabitStats {
  const todayIdx = ALL_DAYS.indexOf(today);
  if (todayIdx < 0) {
    return { streak: 0, totalDays: 0, totalXP: 0, level: 1, xpPerDay: LEVEL_RATES[0], nextLevelAt: LEVEL_TIERS[1], daysToNext: LEVEL_TIERS[1], levelProgress: 0, nextRate: LEVEL_RATES[1], maxed: false, misses: 0 };
  }

  let startIdx = 0;
  if (startDate) {
    const key = startDateToKey(startDate);
    if (key) {
      const si = ALL_DAYS.indexOf(key);
      if (si >= 0) startIdx = si;
    }
  } else {
    const firstDone = ALL_DAYS.findIndex(d => ht[d]?.[habit] === 'done');
    startIdx = firstDone >= 0 ? firstDone : todayIdx;
  }

  // Seed with prior-year done days so levels and XP survive the Jan 1 rollover
  let totalDays = carryDays;

  for (let i = startIdx; i <= todayIdx; i++) {
    if (ht[ALL_DAYS[i]]?.[habit] === 'done') totalDays++;
  }
  const totalXP = habitXPForDoneDays(totalDays, cadenceMult);

  // Consecutive misses (done=null or failed) before today. 'na' days are neutral
  // skips — they don't count as a miss and don't end the run.
  let misses = 0;
  if (totalDays > 0) {
    for (let i = todayIdx - 1; i > startIdx && i >= todayIdx - 4; i--) {
      const state = ht[ALL_DAYS[i]]?.[habit];
      if (state === 'na') continue;
      if (state !== 'done') misses++;
      else break;
    }
  }

  // Streak with 1-grace for blank days; 'failed' gets no grace; 'na' is skipped entirely
  let streak = 0;
  if (misses < 2) {
    const todayState = ht[today]?.[habit];
    let graceUsed = false;
    let idx = todayState === 'done' ? todayIdx : todayIdx - 1;
    while (idx >= startIdx) {
      const state = ht[ALL_DAYS[idx]]?.[habit];
      if (state === 'na') {
        idx--; // neutral skip: doesn't advance or break the streak
      } else if (state === 'done') {
        streak++;
        idx--;
      } else if (state !== 'failed' && !graceUsed) {
        graceUsed = true;
        idx--;
      } else {
        break;
      }
    }
  }

  // ── Level (persistent, total-days driven) ──
  const level = levelFromDays(totalDays);
  const maxed = level >= MAX_LEVEL;
  const xpPerDay = Math.round(LEVEL_RATES[Math.min(level - 1, LEVEL_RATES.length - 1)] * cadenceMult);
  const curThreshold = LEVEL_TIERS[level - 1];
  const nextLevelAt = maxed ? LEVEL_TIERS[MAX_LEVEL - 1] : LEVEL_TIERS[level];
  const daysToNext = Math.max(0, nextLevelAt - totalDays);
  const band = nextLevelAt - curThreshold;
  const levelProgress = maxed ? 1 : (band > 0 ? Math.min((totalDays - curThreshold) / band, 1) : 1);
  const nextRate = maxed ? xpPerDay : Math.round(LEVEL_RATES[level] * cadenceMult);

  return { streak, totalDays, totalXP, level, xpPerDay, nextLevelAt, daysToNext, levelProgress, nextRate, maxed, misses };
}

/* ── featured habits ─────────────────────────────────────── */

const FEATURED: { id: string; name: string; tagline: string; icon: React.FC<IconProps>; accent: string; bgClass: string; cadence: Cadence }[] = [
  // 3 daily
  {
    id: 'walk-10k', name: '10K Steps', cadence: 'daily',
    tagline: 'Build the daily movement habit, one step at a time.',
    icon: WalkIc, accent: '#2FD27E', bgClass: 'featured-bg-walk',
  },
  {
    id: 'reading', name: 'Reading', cadence: 'daily',
    tagline: 'Sharpen your mind with just 20 pages a day.',
    icon: BookIc, accent: '#2FD27E', bgClass: 'featured-bg-read',
  },
  {
    id: 'quit-smoking', name: 'Quit Smoking', cadence: 'daily',
    tagline: 'Every cigarette-free day is a victory. Start yours now.',
    icon: NoSmokeIc, accent: '#2FD27E', bgClass: 'featured-bg-smoke',
  },
  // 1 weekly
  {
    id: 'meal-prep', name: 'Meal Prep', cadence: 'weekly',
    tagline: 'Cook ahead once a week, eat well all week.',
    icon: MealIc, accent: '#2E8BFF', bgClass: 'featured-bg-walk',
  },
  // 1 monthly
  {
    id: 'budget-review', name: 'Budget Review', cadence: 'monthly',
    tagline: 'Check your spending once a month and stay on track.',
    icon: MoneyIc, accent: '#8B5CF6', bgClass: 'featured-bg-read',
  },
  // 1 yearly
  {
    id: 'health-checkup', name: 'Health Check-up', cadence: 'yearly',
    tagline: 'Book your annual check-up, future you will thank you.',
    icon: HealthIc, accent: '#FF8A00', bgClass: 'featured-bg-yoga',
  },
];

/* ── types ───────────────────────────────────────────────── */

interface WeatherDay { date: string; code: number; hi: number; lo: number; }
interface WeatherState { temp: number; code: number; city: string; feels?: number; hours?: WeatherHour[]; days?: WeatherDay[]; }

/* ── sub-components ──────────────────────────────────────── */

// Mini month calendar for one habit — tappable past days for backfill
const MINI_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MINI_DOW = ['M','T','W','T','F','S','S'];
export const MiniMonthHeatmap: React.FC<{
  habit: string;
  year: number;
  monthIdx: number;
  ht: HabitTracker;
  onEdit?: (habit: string, day: string, cur: HabitState) => void;
  startDate?: string | null;
  readOnly?: boolean;
}> = ({ habit, year, monthIdx, ht, onEdit, startDate, readOnly }) => {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const firstDow = (new Date(year, monthIdx, 1).getDay() + 6) % 7; // Mon=0
  const pad = (n: number) => String(n).padStart(2, '0');
  // Only flag days on/after the habit's start as "not reported" (yellow ?), so days
  // before the habit existed stay blank. No start date → don't guess, no ? in month view.
  const startKey = startDateToKey(startDate ?? null);
  const startMs = startKey ? new Date(year, parseInt(startKey.slice(3)) - 1, parseInt(startKey.slice(0, 2))).getTime() : null;
  const cells: ({ d: number; ddmm: string; state: HabitState; future: boolean; undeclared: boolean } | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const ddmm = `${pad(d)}/${pad(monthIdx + 1)}`;
    const ms = new Date(year, monthIdx, d).getTime();
    const future = ms > todayStart.getTime();
    const state = ht[ddmm]?.[habit] ?? null;
    const undeclared = !future && state === null && startMs != null && ms >= startMs;
    cells.push({ d, ddmm, state, future, undeclared });
  }
  return (
    <div className="mini-hm">
      <div className="mini-hm-grid">
        {MINI_DOW.map((l, i) => <span key={`h${i}`} className="mini-hm-dow">{l}</span>)}
        {cells.map((c, i) => c === null
          ? <span key={`p${i}`} className="mini-hm-cell mini-hm-pad" />
          : (
            <button
              key={c.ddmm}
              className={`mini-hm-cell ${c.state === 'done' ? 'done' : c.state === 'failed' ? 'failed' : c.state === 'na' ? 'na' : c.undeclared ? 'undeclared' : ''} ${c.future ? 'future' : ''}`}
              disabled={c.future || readOnly}
              onClick={() => { if (!c.future && !readOnly) onEdit?.(habit, c.ddmm, c.state); }}
              title={`${c.ddmm}: ${c.state ?? (c.undeclared ? 'not reported' : 'blank')}`}
            >{c.d}</button>
          )
        )}
      </div>
    </div>
  );
};

const CheckSVG: React.FC<{ size?: number; strokeWidth?: number }> = ({ size = 14, strokeWidth = 2.8 }) => (
  <svg viewBox="0 0 14 14" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2.5,7.5 5.5,10.5 11.5,4" />
  </svg>
);

// Cadence-aware calendar for non-daily habits: instead of a daily month grid, each
// cell is one PERIOD (a week of the month for weekly, a month for monthly, the year
// for yearly). A cell is "done" if any day inside it is done. Tapping cycles that
// period's representative day through the honesty-gated editor.
// ponytail: a period toggle only edits its representative day (latest past day),
// not every day in the bucket — keeps the tap simple; full-bucket clear is a later upgrade.
export const CadenceCalendar: React.FC<{
  habit: string; cadence: Cadence; year: number; monthIdx: number;
  ht: HabitTracker; onEdit?: (habit: string, day: string, cur: HabitState) => void;
  readOnly?: boolean;
}> = ({ habit, cadence, year, monthIdx, ht, onEdit, readOnly }) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayMs = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const dnum = (ddmm: string) => new Date(year, parseInt(ddmm.slice(3)) - 1, parseInt(ddmm.slice(0, 2))).getTime();

  type Cell = { key: string; label: string; done: boolean; failed: boolean; na: boolean; future: boolean; repDay: string };
  const mkCell = (key: string, label: string, bucket: string[]): Cell => {
    const doneDays = bucket.filter(d => ht[d]?.[habit] === 'done');
    const failedDays = bucket.filter(d => ht[d]?.[habit] === 'failed');
    const naDays = bucket.filter(d => ht[d]?.[habit] === 'na');
    const past = bucket.filter(d => dnum(d) <= todayMs);
    const repDay = past.length ? past[past.length - 1] : (bucket[0] ?? '');
    return {
      key, label,
      done: doneDays.length > 0,
      failed: failedDays.length > 0 && doneDays.length === 0,
      na: naDays.length > 0 && doneDays.length === 0 && failedDays.length === 0,
      future: past.length === 0, repDay,
    };
  };

  let cells: Cell[] = [];
  if (cadence === 'monthly') {
    cells = Array.from({ length: 12 }, (_, m) => mkCell(`m${m}`, MINI_MONTHS[m], ALL_DAYS.filter(d => d.slice(3) === pad(m + 1))));
  } else if (cadence === 'yearly') {
    cells = [mkCell('y', String(year), ALL_DAYS.slice())];
  } else { // weekly — the weeks of the shown month
    const mm = pad(monthIdx + 1);
    const monthDays = ALL_DAYS.filter(d => d.slice(3) === mm);
    const weekOf = (d: string) => Math.min(4, Math.ceil(parseInt(d.slice(0, 2)) / 7));
    cells = [1, 2, 3, 4].map(w => mkCell(`w${w}`, `W${w}`, monthDays.filter(d => weekOf(d) === w)));
  }

  return (
    <div className={`cadence-cal cadence-cal--${cadence}`}>
      {cells.map(c => (
        <button
          key={c.key}
          className={`cadence-cal-cell ${c.done ? 'done' : c.failed ? 'failed' : c.na ? 'na' : ''} ${c.future ? 'future' : ''}`}
          disabled={c.future || !c.repDay || readOnly}
          onClick={() => { if (!c.future && c.repDay && !readOnly) onEdit?.(habit, c.repDay, ht[c.repDay]?.[habit] ?? null); }}
          aria-label={`${c.label}: ${c.done ? 'done' : c.failed ? 'missed' : c.na ? 'not applicable' : 'blank'}`}
        >
          <span className="cadence-cal-tick">{c.done ? <CheckSVG size={13} strokeWidth={2} /> : c.failed ? '✕' : c.na ? '–' : ''}</span>
          <span className="cadence-cal-lbl">{c.label}</span>
        </button>
      ))}
    </div>
  );
};

// One weekday mini-circle. Single tap toggles done↔blank (the primary action);
// double tap toggles failed↔blank; a long-press toggles na↔blank ("not applicable").
// A short timer disambiguates tap vs double-tap, so the first tap is deferred ~220ms.
// `displayState` may differ from the stored state (past due days show a "?"), so
// the toggles are driven by `rawState` (what's actually persisted).
const TAP_DELAY_MS = 220;
const LONGPRESS_MS = 500;
const DayCircle: React.FC<{
  label: string;
  displayState: DisplayState;
  rawState: HabitState;
  isFuture: boolean;
  isToday: boolean;
  onSetState: (state: HabitState) => void;
}> = ({ label, displayState, rawState, isFuture, isToday, onSetState }) => {
  const tapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  useEffect(() => () => {
    if (tapRef.current) clearTimeout(tapRef.current);
    if (longRef.current) clearTimeout(longRef.current);
  }, []);
  // Celebrate the moment a day BECOMES done (not already-done cells on mount).
  const prevDisplay = useRef(displayState);
  const [pop, setPop] = useState(false);
  useEffect(() => {
    const was = prevDisplay.current;
    prevDisplay.current = displayState;
    if (was !== 'done' && displayState === 'done') {
      setPop(true);
      const t = setTimeout(() => setPop(false), 500);
      return () => clearTimeout(t);
    }
  }, [displayState]);
  const cancelLong = () => { if (longRef.current) { clearTimeout(longRef.current); longRef.current = null; } };
  const handlePointerDown = () => {
    if (isFuture) return;
    longFired.current = false;
    // ponytail: plain hold timer, no pointer-move cancel — a small drag could still
    // fire N/A on these tiny circles; add a move threshold if that ever bites.
    longRef.current = setTimeout(() => {
      longRef.current = null;
      longFired.current = true;
      if (tapRef.current) { clearTimeout(tapRef.current); tapRef.current = null; }
      onSetState(rawState === 'na' ? null : 'na');
    }, LONGPRESS_MS);
  };
  const handleTap = () => {
    if (isFuture) return;
    if (longFired.current) { longFired.current = false; return; } // hold already handled it
    if (tapRef.current) {                       // second tap within window → fail
      clearTimeout(tapRef.current);
      tapRef.current = null;
      onSetState(rawState === 'failed' ? null : 'failed');
    } else {                                     // first tap → wait, then toggle done
      tapRef.current = setTimeout(() => {
        tapRef.current = null;
        onSetState(rawState === 'done' ? null : 'done');
      }, TAP_DELAY_MS);
    }
  };
  return (
    <div className={`hcard-day ${displayState === 'done' ? 'done' : ''} ${displayState === 'failed' ? 'failed' : ''} ${displayState === 'na' ? 'na' : ''} ${displayState === 'undeclared' ? 'undeclared' : ''} ${isFuture ? 'future' : ''} ${isToday ? 'is-today' : ''}${pop ? ' pop' : ''}`}>
      <button
        className="hcard-day-circle"
        disabled={isFuture}
        onClick={handleTap}
        onPointerDown={handlePointerDown}
        onPointerUp={cancelLong}
        onPointerLeave={cancelLong}
        aria-label={`${label}: ${displayState ?? 'blank'}, tap to mark done, double-tap to mark failed, long-press for not applicable`}
      >
        {displayState === 'done' && <span className="hcard-day-tick"><CheckSVG size={15} strokeWidth={2} /></span>}
        {displayState === 'failed' && <span className="hcard-day-tick hcard-day-fail">✗</span>}
        {displayState === 'na' && <span className="hcard-day-tick hcard-day-na">–</span>}
        {displayState === 'undeclared' && <span className="hcard-day-tick hcard-day-undeclared">?</span>}
      </button>
      <span className="hcard-day-label">{label}</span>
    </div>
  );
};

// Full habit card — XP bar · gate dots · weekly M-T-W circles · big done button
const HabitCard: React.FC<{
  habit: string;
  stats: HabitStats;
  weekDays: ReturnType<typeof getWeekDays>;
  ht: HabitTracker;
  today: string;
  cadence: Cadence;
  onToggleDay: (habit: string, dayKey: string, state: HabitState) => void;
  onEditDay: (habit: string, dayKey: string, cur: HabitState) => void;
  onRequestRemove: (habit: string) => void;
  startDate?: string | null;
  starred?: boolean;
  onToggleStar: (habit: string) => void;
  dueDate?: string | null;
  onSetDueDate: (habit: string, dueDate: string | null) => void;
  reminderHour?: number | null;
  onSetReminder: (habit: string, hour: number | null) => void;
  schedule?: string | null;
  onSetSchedule: (habit: string, schedule: string | null) => void;
  sharedWithFriends?: boolean;
  onToggleShare: (habit: string, shared: boolean) => void;
  dragHandle?: React.ReactNode;
  focused?: boolean;
}> = ({ habit, stats, weekDays, ht, today, cadence, onToggleDay, onEditDay, onRequestRemove, startDate, starred, onToggleStar, dueDate, onSetDueDate, reminderHour, onSetReminder, schedule, onSetSchedule, sharedWithFriends, onToggleShare, dragHandle, focused }) => {
  const [histOpen, setHistOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false); // per-habit config, hidden by default
  const [monthOffset, setMonthOffset] = useState(0); // 0 = this month, -1 = last month …
  // Shrink the name font when it wraps to more than one line. Measured at the base
  // size on mount / name change; deps are [habit] only so applying the smaller font
  // never re-triggers the measure (no oscillation).
  // ponytail: not re-measured on resize — the card width is fixed by the carousel.
  const nameRef = useRef<HTMLSpanElement>(null);
  const [nameWrapped, setNameWrapped] = useState(false);
  useLayoutEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 18;
    setNameWrapped(el.offsetHeight > lh * 1.4);
  }, [habit]);
  const nowD = new Date();
  const dispBase = new Date(nowD.getFullYear(), nowD.getMonth() + monthOffset, 1);
  const dispMonth = dispBase.getMonth();
  const dispYear = dispBase.getFullYear();
  const rank = getRank(stats.totalDays);
  const isDaily = cadence === 'daily';
  const todayState = ht[today]?.[habit] ?? null;
  const hasDanger = isDaily && stats.misses >= 2;
  const hasWarning = isDaily && stats.misses === 1 && todayState !== 'done';
  // Period dots for non-daily cadences (weekly 4 · monthly 12 · yearly 1).
  const units = isDaily ? [] : computePeriodUnits(habit, cadence, ht, today, schedule);
  const toggleUnit = (u: PeriodUnit) => {
    if (u.done) u.doneDays.forEach(d => onToggleDay(habit, d, null));
    else onToggleDay(habit, u.repDay, 'done');
  };
  const currentUnit = units.find(u => u.isCurrent) ?? units[0];
  const accent = CADENCE_META[cadence].color;
  const [expanded, setExpanded] = useState(!!focused);
  const cardRef = useRef<HTMLDivElement>(null);
  // Deep-linked from the Today feed: expand + jump straight to this card (no scroll
  // animation — 'auto' takes you there instantly).
  useEffect(() => {
    if (focused) cardRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' });
  }, [focused]);
  const currentDone = isDaily ? todayState === 'done' : !!currentUnit?.done;
  // What the header circle shows. Daily reflects today's full state (done/failed/na)
  // so it mirrors the weekday circles' double-tap / long-press. Non-daily units only
  // carry done, so they stay done-or-blank.
  const headState: HabitState = isDaily ? todayState : (currentUnit?.done ? 'done' : null);
  const toggleCurrent = () => {
    if (isDaily) onToggleDay(habit, today, cycleState(todayState));
    else if (currentUnit) toggleUnit(currentUnit);
  };

  // Undeclared: a past due day (on/after the habit's start, before today) that was
  // never marked shows the yellow "?", not red. Explicit fails stay red; N/A shows the
  // grey dash. Derived render state — 'undeclared' is never persisted.
  const startKey = startDateToKey(startDate ?? null);
  const startIdx = startKey ? ALL_DAYS.indexOf(startKey) : 0;
  const todayIdx = ALL_DAYS.indexOf(today);
  const dayState = (key: string): DisplayState => {
    const raw = ht[key]?.[habit] ?? null;
    if (raw === 'done') return 'done';
    if (raw === 'failed') return 'failed';
    if (raw === 'na') return 'na';
    const idx = ALL_DAYS.indexOf(key);
    if (idx >= startIdx && idx < todayIdx) return 'undeclared'; // missed a due day
    return null;
  };

  return (
    <div
      ref={cardRef}
      className={`hcard ${expanded ? 'hcard--expanded' : 'hcard--collapsed'} ${hasDanger ? 'hcard-danger' : hasWarning ? 'hcard-warning' : ''}${focused ? ' hcard--focused' : ''}`}
      style={{ '--theme': accent, '--theme-dim': `${accent}66`, '--theme-glow': `${accent}22` } as React.CSSProperties}
    >
      {/* Header — top row: circle + name; bottom row: level · chevron · streak.
          Controls (star + archive) sit to the right. */}
      <div className="hcard-summary" onClick={() => setExpanded(e => { const next = !e; if (!next) setHistOpen(false); return next; })}>
        {dragHandle}
        <button
          className={`hcard-icon hcard-icon-btn ${headState === 'done' ? 'done' : headState === 'failed' ? 'failed' : headState === 'na' ? 'na' : ''}`}
          onClick={e => { e.stopPropagation(); toggleCurrent(); }}
          aria-label={`${headState ?? 'blank'}, tap to cycle`}
        >
          {headState === 'done' ? <CheckSVG size={14} strokeWidth={2.5} />
            : headState === 'failed' ? <span className="hcard-icon-glyph fail">✗</span>
            : headState === 'na' ? <span className="hcard-icon-glyph na">–</span>
            : <span className="hcard-icon-empty-dot" />}
        </button>
        <div className="hcard-head">
          <span ref={nameRef} className={`hcard-name${nameWrapped ? ' hcard-name--wrapped' : ''}`}>{habit}</span>
          <div className="hcard-head-meta">
            <span className="hcard-level-badge" title={`Level ${stats.level}, ${stats.totalDays} days logged · +${stats.xpPerDay} XP per day`}>LV{stats.level}</span>
          </div>
        </div>
        <div className="hcard-head-controls">
          {/* Star toggle — starred habits surface on Progress Today/Yesterday */}
          <button
            className={`hcard-star${starred ? ' on' : ''}`}
            onClick={e => { e.stopPropagation(); onToggleStar(habit); }}
            aria-label={starred ? 'Unstar habit' : 'Star habit'}
            aria-pressed={!!starred}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
          {/* Archive → confirm dialog. Permanent delete lives only on the Archived page. */}
          <button
            className="hcard-archive-icon visible"
            onClick={e => { e.stopPropagation(); onRequestRemove(habit); }}
            aria-label="Archive habit"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
          </button>
        </div>
        {/* Expand affordance, far right so it reads as "open this card" */}
        <span className={`hcard-chevron hcard-chevron--right ${expanded ? 'open' : ''}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </span>
      </div>


      <div className="hcard-body-wrap">
      <div className="hcard-body">

      {/* Unified stat panel, earned title · level hero w/ progress · streak + XP */}
      <div className="hsp">
        <div className="hsp-title" style={{ color: rank.color }}>
          <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden><path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01z"/></svg>
          <span>{rank.title}</span>
        </div>

        <div className="hsp-hero">
          <div className="hsp-lv" style={{ backgroundImage: `linear-gradient(140deg, ${accent}, ${accent}99)` }}>
            <span className="hsp-lv-tag">LVL</span>
            <span className="hsp-lv-num">{stats.level}</span>
          </div>
          <div className="hsp-prog">
            <div className="hsp-prog-top">
              <span className="hsp-prog-xp">{stats.totalXP.toLocaleString()} XP</span>
              <span className="hsp-prog-next">
                {stats.maxed ? 'MAX' : `+${stats.nextRate} XP/day at LV${stats.level + 1}`}
              </span>
            </div>
            <div className="hsp-bar"><div className="hsp-bar-fill" style={{ width: `${stats.levelProgress * 100}%` }} /></div>
            <span className="hsp-prog-foot">
              {stats.maxed
                ? <>Earning +{stats.xpPerDay} XP/day <TrophyIc size={12} /></>
                : `${stats.daysToNext} ${stats.daysToNext === 1 ? 'day' : 'days'} to next level`}
            </span>
          </div>
        </div>

        <div className="hsp-stats">
          <div className="hsp-stat">
            <span className="hsp-stat-ico"><CalendarIc size={16} /></span>
            <span className="hsp-stat-val">{stats.totalDays}</span>
            <span className="hsp-stat-lbl">days done</span>
          </div>
          <div className={`hsp-stat${stats.misses > 0 ? ' miss' : ''}`}>
            <span className="hsp-stat-ico">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </span>
            <span className="hsp-stat-val">{stats.misses}</span>
            <span className="hsp-stat-lbl">recent {stats.misses === 1 ? 'miss' : 'misses'}</span>
          </div>
        </div>
      </div>

      {/* Streak prompt row — the calendar toggle lives here; opening it swaps the
          M-S breakdown for the month calendar. */}
      <div className={`hcard-streakrow ${hasDanger ? 'danger' : hasWarning ? 'warning' : ''}`}>
        <span className="hcard-streak-label">
          {hasDanger ? 'Start fresh today'
            : hasWarning ? 'Missed yesterday, keep going'
            : 'Tap the calendar for your history'}
        </span>
        <button
          className={`hcard-cal-toggle${histOpen ? ' active' : ''}`}
          onClick={e => { e.stopPropagation(); setMonthOffset(0); setHistOpen(o => !o); }}
          aria-label={histOpen ? 'Hide calendar' : 'Open calendar'}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </button>
      </div>

      {/* Week strip — collapses (slides up) as the calendar opens and slides back
          down as it closes, mirroring the calendar's own grid-rows slide so only
          one is visible at a time and both animate symmetrically. */}
      <div className={`hcard-week-wrap${!histOpen ? ' open' : ''}`}>
        <div className="hcard-week-collapse">
          {isDaily ? (
            <div className="hcard-week">
              {weekDays.map(({ key, label, isFuture, isToday }) => (
                <DayCircle
                  key={key}
                  label={label}
                  displayState={dayState(key)}          // auto-fail past due days
                  rawState={ht[key]?.[habit] ?? null}    // toggles act on what's stored
                  isFuture={isFuture}
                  isToday={isToday}
                  onSetState={s => onToggleDay(habit, key, s)}
                />
              ))}
            </div>
          ) : (
            <div className={`hcard-week hcard-week--${units.length}`} style={{ ['--cad' as any]: accent }}>
              {units.map(u => (
                <div key={u.key} className={`hcard-day cad-unit ${u.done ? 'done' : ''} ${u.isFuture ? 'future' : ''} ${u.isCurrent ? 'is-today' : ''}`}>
                  <button
                    className="hcard-day-circle"
                    disabled={u.isFuture}
                    onClick={() => !u.isFuture && toggleUnit(u)}
                    aria-label={`${u.label}: ${u.done ? 'done' : 'blank'}`}
                  >
                    {u.done && <span className="hcard-day-tick"><CheckSVG size={15} strokeWidth={2} /></span>}
                  </button>
                  <span className="hcard-day-label">{u.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Calendar replaces the week strip when open. Always mounted inside a grid-rows
          collapser so both open AND close animate smoothly (no unmount pop). */}
      <div className={`hcard-history-wrap${histOpen ? ' open' : ''}`}>
        <div className="hcard-history">
          {(isDaily || cadence === 'weekly') && (
            <div className="hcard-month-nav">
              <button className="hcard-month-arrow" onClick={() => setMonthOffset(o => o - 1)} aria-label="Previous month">‹</button>
              <span className="hcard-month-label">{MINI_MONTHS[dispMonth]} {dispYear}</span>
              <button className="hcard-month-arrow" disabled={monthOffset >= 0} onClick={() => setMonthOffset(o => Math.min(0, o + 1))} aria-label="Next month">›</button>
            </div>
          )}
          <p className="hcard-history-hint">
            {isDaily ? 'Tap any past day, cycles done → missed → N/A → blank.' : 'Tap a period, cycles done → missed → N/A → blank.'}
          </p>
          {isDaily
            ? <MiniMonthHeatmap habit={habit} year={dispYear} monthIdx={dispMonth} ht={ht} onEdit={onEditDay} startDate={startDate} />
            : <CadenceCalendar habit={habit} cadence={cadence} year={dispYear} monthIdx={dispMonth} ht={ht} onEdit={onEditDay} />}
        </div>
      </div>

      {/* Per-habit config (schedule · due date · reminder · share) is rarely
          touched, so it hides behind one tap instead of stacking at the bottom of
          every expanded card. Same grid-rows collapser as the calendar. */}
      <button
        className={`hcard-settings-toggle${settingsOpen ? ' active' : ''}`}
        onClick={e => { e.stopPropagation(); setSettingsOpen(o => !o); }}
        aria-expanded={settingsOpen}
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        <span>Habit settings</span>
        <span className={`hcard-settings-chev${settingsOpen ? ' open' : ''}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </span>
      </button>
      <div className={`hcard-settings-wrap${settingsOpen ? ' open' : ''}`}>
      <div className="hcard-settings-collapse">

      {/* One-off due date (optional, any cadence). Overdue = past + not done. */}
      {/* Scheduling anchor — the day a non-daily habit runs on. */}
      {!isDaily && cadence !== 'quit' && (
        <div className="hcard-schedule" onClick={e => e.stopPropagation()}>
          <span className="hcard-schedule-text">
            <CalendarIc size={12} />
            {scheduleLabel(cadence, schedule) ?? 'Runs any day'}
          </span>
          {cadence === 'weekly' && (
            <select className="hcard-schedule-select" value={schedule ?? ''} onChange={e => onSetSchedule(habit, e.target.value || null)}>
              <option value="">Any day</option>
              {WEEKDAYS_FULL.map((d, i) => <option key={i} value={String(i)}>{d}</option>)}
            </select>
          )}
          {cadence === 'monthly' && (
            <select className="hcard-schedule-select" value={schedule ?? ''} onChange={e => onSetSchedule(habit, e.target.value || null)}>
              <option value="">Any day</option>
              {Array.from({ length: 31 }, (_, i) => <option key={i} value={String(i + 1)}>Day {i + 1}</option>)}
            </select>
          )}
          {cadence === 'yearly' && (
            <input
              type="date"
              className="hcard-schedule-input"
              value={schedule ? `${YEAR}-${String(parseInt(schedule.split('-')[0], 10)).padStart(2, '0')}-${String(parseInt(schedule.split('-')[1], 10)).padStart(2, '0')}` : ''}
              onChange={e => {
                if (!e.target.value) { onSetSchedule(habit, null); return; }
                const [, mo, dd] = e.target.value.split('-');
                onSetSchedule(habit, `${parseInt(mo, 10)}-${parseInt(dd, 10)}`);
              }}
            />
          )}
          {schedule && <button type="button" className="hcard-due-clear" onClick={() => onSetSchedule(habit, null)}>clear</button>}
        </div>
      )}

      {/* A one-off due date only makes sense for non-daily habits. A daily habit
          runs every day, so it just gets a time reminder (below), not a due day. */}
      {!isDaily && (() => {
        const localToday = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
        const overdue = !!dueDate && dueDate < localToday && !currentDone;
        return (
          <label className={`hcard-due${overdue ? ' overdue' : ''}`} onClick={e => e.stopPropagation()}>
            <span className="hcard-due-text">
              <CalendarIc size={12} />
              {dueDate
                ? `Due ${new Date(dueDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}${overdue ? ' · overdue' : ''}`
                : 'Set a due date'}
            </span>
            <input
              type="date"
              className="hcard-due-input"
              value={dueDate ?? ''}
              onChange={e => onSetDueDate(habit, e.target.value || null)}
            />
            {dueDate && <button type="button" className="hcard-due-clear" onClick={() => onSetDueDate(habit, null)}>clear</button>}
          </label>
        );
      })()}

      {/* Per-habit reminder — a local hour to get a push nudge. Needs notifications on. */}
      <div className="hcard-remind" onClick={e => e.stopPropagation()}>
        <span className="hcard-remind-text">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          Reminder
        </span>
        <select
          className="hcard-remind-select"
          value={reminderHour == null ? '' : String(reminderHour)}
          onChange={e => onSetReminder(habit, e.target.value === '' ? null : parseInt(e.target.value, 10))}
        >
          <option value="">Off</option>
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
            </option>
          ))}
        </select>
      </div>

      {/* Share with friends — off by default. When on, accepted friends can see this
          habit's name in their friends list. Streaks/logins are governed separately by
          the global "share my activity" toggle on the Global tab. */}
      <button
        type="button"
        className={`hcard-share${sharedWithFriends ? ' on' : ''}`}
        onClick={e => { e.stopPropagation(); onToggleShare(habit, !sharedWithFriends); }}
        role="switch"
        aria-checked={!!sharedWithFriends}
      >
        <span className="hcard-share-text">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          {sharedWithFriends ? 'Shared with friends' : 'Share with friends'}
        </span>
        <span className="hcard-share-knob" />
      </button>

      </div>
      </div>
      </div>
      </div>
    </div>
  );
};

// Pointer-based vertical reorder for a habit group. Touch-friendly (HTML5 drag
// doesn't work on mobile). The grip captures the pointer and stops propagation so
// the horizontal cadence carousel doesn't also swipe. Measures live row midpoints,
// so it copes with cards of different heights (collapsed vs expanded).
const GripIc: React.FC = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
    <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
  </svg>
);
const ReorderableList: React.FC<{
  names: string[];
  onCommit: (order: string[]) => void;
  renderItem: (name: string, handle: React.ReactNode) => React.ReactNode;
}> = ({ names, onCommit, renderItem }) => {
  const [order, setOrder] = useState(names);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dy, setDy] = useState(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const startY = useRef(0);
  const orderRef = useRef(order);
  useEffect(() => { orderRef.current = order; }, [order]);

  // Resync when the parent list actually changes (by content), never mid-drag.
  const namesKey = names.join('');
  useEffect(() => {
    if (dragIdx === null) { setOrder(names); orderRef.current = names; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesKey]);

  const onDown = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragIdx(i); setDy(0); startY.current = e.clientY;
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragIdx === null) return;
    e.stopPropagation();
    const y = e.clientY;
    setDy(y - startY.current);
    let target = orderRef.current.length - 1;
    for (let j = 0; j < itemRefs.current.length; j++) {
      const el = itemRefs.current[j];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (y < r.top + r.height / 2) { target = j; break; }
    }
    if (target !== dragIdx) {
      setOrder(prev => {
        const next = moveItem(prev, dragIdx, target);
        orderRef.current = next;
        return next;
      });
      setDragIdx(target);
      startY.current = y;
      setDy(0);
    }
  };
  const onUp = (e: React.PointerEvent) => {
    if (dragIdx === null) return;
    e.stopPropagation();
    setDragIdx(null); setDy(0);
    onCommit(orderRef.current);
  };

  return (
    <>
      {order.map((name, i) => {
        const handle = (
          <button
            className="hcard-grip"
            aria-label="Drag to reorder"
            onClick={e => e.stopPropagation()}
            onPointerDown={onDown(i)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <GripIc />
          </button>
        );
        return (
          <div
            key={name}
            ref={el => { itemRefs.current[i] = el; }}
            className={`reorder-item${dragIdx === i ? ' dragging' : ''}`}
            style={dragIdx === i ? { transform: `translateY(${dy}px)`, position: 'relative', zIndex: 5 } : undefined}
          >
            {renderItem(name, handle)}
          </div>
        );
      })}
    </>
  );
};

// Quit habit card — a continual abstinence timer with a 30-day fill bar. The
// icon-circle slot becomes a Rewind button (resets the clock to now). No "done".
const QuitCard: React.FC<{
  name: string;
  startedAt: string | null;
  onRewind: (name: string) => void;
  onRequestRemove: (name: string) => void;
}> = ({ name, startedAt, onRewind, onRequestRemove }) => {
  const [now, setNow] = useState(Date.now());
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  // No start yet (just added, write in flight) reads as freshly started.
  const startMs = startedAt ? new Date(startedAt).getTime() : now;
  const { days, hours, mins, secs } = quitElapsed(startMs, now);
  const prog = quitProgress(startMs, now);
  const accent = CADENCE_META.quit.color;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="hcard hcard--collapsed quitcard" style={{ '--theme': accent, '--theme-dim': `${accent}66`, '--theme-glow': `${accent}22` } as React.CSSProperties}>
      <div className="hcard-summary">
        <button
          className="hcard-icon quit-rewind"
          onClick={() => setConfirming(c => !c)}
          aria-label="Rewind, restart the timer"
          title="Rewind, restart the timer"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
        <span className="hcard-name">{name}</span>
        <span className="hcard-streak-mini on"><span className="hsm-ico"><AnimatedFlame size={12} /></span>{days}d</span>
        <button className="hcard-archive-icon visible" onClick={() => onRequestRemove(name)} aria-label="Archive habit">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
        </button>
      </div>

      <div className="quit-timer">
        <div className="quit-seg"><span className="quit-seg-num">{days}</span><span className="quit-seg-lbl">days</span></div>
        <div className="quit-seg"><span className="quit-seg-num">{pad(hours)}</span><span className="quit-seg-lbl">hrs</span></div>
        <div className="quit-seg"><span className="quit-seg-num">{pad(mins)}</span><span className="quit-seg-lbl">min</span></div>
        <div className="quit-seg"><span className="quit-seg-num">{pad(secs)}</span><span className="quit-seg-lbl">sec</span></div>
      </div>

      <div className="quit-bar"><div className="quit-bar-fill" style={{ width: `${prog * 100}%` }} /></div>
      <p className="quit-pct">{prog >= 1 ? '30 days clean, milestone reached' : `${Math.round(prog * 100)}% of your first 30 days`}</p>

      {confirming && (
        <div className="quit-confirm">
          <span className="quit-confirm-q">Slipped? Restart the clock from now.</span>
          <div className="quit-confirm-actions">
            <button className="quit-confirm-cancel" onClick={() => setConfirming(false)}>Keep going</button>
            <button className="quit-confirm-ok" onClick={() => { onRewind(name); setConfirming(false); }}>Rewind</button>
          </div>
        </div>
      )}
    </div>
  );
};

// Featured habits bottom-sheet (tap the banner to open, then join)
const FeaturedSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  userHabits: string[];
  onAdd: (name: string, cadence: Cadence) => void;
}> = ({ open, onClose, userHabits, onAdd }) => {
  if (!open) return null;
  return (
    <div className="hb-sheet-overlay" onClick={onClose}>
      <div className="hb-sheet" onClick={e => e.stopPropagation()}>
        <div className="hb-sheet-grip" />
        <div className="hb-sheet-head">
          <h3 className="hb-sheet-title">Featured Habits</h3>
          <button className="hb-sheet-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="hb-sheet-sub">Tap to add one to your list.</p>
        <div className="hb-feat-list">
          {FEATURED.map(f => {
            const added = userHabits.includes(f.name);
            return (
              <div key={f.id} className="hb-feat-item" style={{ '--featured-accent': f.accent } as React.CSSProperties}>
                <span className="hb-feat-icon">{React.createElement(f.icon, { size: 20 })}</span>
                <div className="hb-feat-text">
                  <div className="hb-feat-name">
                    {f.name}
                    <span className="hb-feat-cadence" style={{ background: `${CADENCE_META[f.cadence].color}22`, color: CADENCE_META[f.cadence].color }}>
                      {CADENCE_META[f.cadence].label}
                    </span>
                  </div>
                  <div className="hb-feat-tag">{f.tagline}</div>
                </div>
                <button
                  className={`hb-feat-add ${added ? 'added' : ''}`}
                  onClick={() => !added && onAdd(f.name, f.cadence)}
                  disabled={added}
                >
                  {added ? '✓' : '+ Join'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ── main page ───────────────────────────────────────────── */

const MANDATORY_HABIT = 'Logging into Superdub';

// Title + date range for the swipeable week strip, e.g. { title: 'Last week',
// range: '7–13 Jul' }. Pure formatting lives in weekRange.ts (unit-tested).
function weekMeta(offset: number): { title: string; range: string } {
  const mon = weekMonday(loggingNow(), offset);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { title: weekTitle(offset), range: weekRangeLabel(mon, sun) };
}

// The login-streak week strip — 7 day-circles for the mandatory check-in habit,
// pulled up to the top of the page. Swipe (or the ‹ › arrows) pages back through
// previous weeks; you can't go past the current week. Tapping a past/today circle
// rewinds the page to that day (onPick), same as before.
// ponytail: only the current calendar year is in `ht`, so weeks that fall in a
// previous year read blank — fine until year-boundary history matters.
const WeekStrip: React.FC<{
  ht: HabitTracker;
  rewindDay: string | null;
  onPick: (key: string | null) => void;
  perfectWeek: boolean;
  celebrating: boolean;
}> = ({ ht, rewindDay, onPick, perfectWeek, celebrating }) => {
  const [offset, setOffset] = useState(0); // 0 = this week, negative = weeks back
  const [dir, setDir] = useState(0);        // slide direction for the entrance anim
  const startX = useRef(0);
  const dragging = useRef(false);
  const older = () => { setDir(-1); setOffset(o => o - 1); };
  const newer = () => { if (offset < 0) { setDir(1); setOffset(o => o + 1); } };
  const onDown = (e: React.PointerEvent) => { startX.current = e.clientX; dragging.current = true; };
  const onUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    const dx = e.clientX - startX.current;
    if (dx < -40) older();          // swipe left → older weeks
    else if (dx > 40) newer();      // swipe right → back toward this week
  };
  const days = getWeekDays(offset);
  const meta = weekMeta(offset);
  const isCurrent = offset === 0;
  return (
    <div className="hb-weekcard">
      <div className="hb-weeknav">
        <span className="hb-weeknav-lbl"><b>{meta.title}</b> · {meta.range}</span>
        <span className="hb-weeknav-arrows">
          <button type="button" onClick={older} aria-label="Previous week">‹</button>
          <button type="button" onClick={newer} disabled={offset >= 0} aria-label="Next week">›</button>
        </span>
      </div>
      <div className="hb-weekview" onPointerDown={onDown} onPointerUp={onUp} onPointerLeave={onUp}>
        <div
          key={offset}
          className={`hb-week${isCurrent && perfectWeek ? ' hb-week-gold' : ''}${isCurrent && celebrating ? ' hb-week-celebrating' : ''}${dir < 0 ? ' hb-week-in-l' : dir > 0 ? ' hb-week-in-r' : ''}`}
        >
          {days.map(({ key, label, isFuture, isToday }) => {
            const state = ht[key]?.[MANDATORY_HABIT] ?? null;
            return (
              <button
                key={key}
                type="button"
                className="hb-week-col hb-week-col-btn"
                disabled={isFuture}
                onClick={() => { if (!isFuture) onPick(isToday ? null : key); }}
                aria-label={`${label}: ${state ?? 'not logged'}, ${isToday ? 'go to today' : 'rewind to this day'}`}
              >
                <span className="hb-week-dow">{label}</span>
                <div
                  className={`hb-week-circle ${state === 'done' ? 'done' : ''} ${state === 'failed' ? 'failed' : ''} ${state === 'na' ? 'na' : ''} ${isToday ? 'today' : ''} ${key === rewindDay ? 'viewing' : ''} ${isFuture ? 'future' : ''}`}
                  aria-hidden="true"
                >
                  {state === 'done' && <span className="hb-week-tick"><CheckSVG size={18} strokeWidth={2} /></span>}
                  {state === 'failed' && <span className="hb-week-tick fail">✕</span>}
                  {state === 'na' && <span className="hb-week-tick na">–</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Weather breakdown bottom-sheet — opens when the header weather chip is tapped.
// Current conditions + a horizontal hourly strip + a 7-day forecast. Reuses the
// WeatherIc mapping so every icon matches the header chip.
const WeatherSheet: React.FC<{ weather: WeatherState | null; open: boolean; onClose: () => void }> = ({ weather, open, onClose }) => {
  // Which day of the week the hourly strip is showing. 0 is today, and reopening the
  // sheet always comes back to today rather than to whatever was tapped last time.
  const [selDay, setSelDay] = useState(0);
  useEffect(() => { if (open) setSelDay(0); }, [open]);

  const hourLabel = (t: string, isNow: boolean) => {
    if (isNow) return 'Now';
    const h = new Date(t).getHours();
    return h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
  };
  const dayLabel = (d: string, i: number) => i === 0 ? 'Today' : new Date(d).toLocaleDateString('en-GB', { weekday: 'short' });
  const days = weather?.days ?? [];
  const hours = hoursForDay(weather?.hours ?? [], days[selDay]?.date ?? '', selDay === 0, Date.now());
  return (
    <>
      <div className={`wx-scrim${open ? ' open' : ''}`} onClick={onClose} aria-hidden="true" />
      <div className={`wx-sheet${open ? ' open' : ''}`} role="dialog" aria-label="Weather breakdown" aria-hidden={!open}>
        {weather && (
          <>
            <div className="wx-grab" />
            <div className="wx-now">
              <span className="wx-now-ico"><WeatherIc code={weather.code} size={44} /></span>
              <span className="wx-now-big">{weather.temp}°</span>
              <span className="wx-now-meta">
                {weather.city && <span className="wx-now-city">{weather.city}</span>}
                {weather.feels != null && <span className="wx-now-desc">Feels {weather.feels}°</span>}
              </span>
              <button className="wx-close" onClick={onClose} aria-label="Close weather">✕</button>
            </div>

            {!!hours.length && (
              <>
                <div className="wx-sub">
                  {selDay === 0 ? 'Next hours' : new Date(days[selDay].date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                </div>
                <div className="wx-hours">
                  {hours.map((h, i) => (
                    <div key={h.time} className={`wx-hour${selDay === 0 && i === 0 ? ' now' : ''}`}>
                      <span className="wx-hour-h">{hourLabel(h.time, selDay === 0 && i === 0)}</span>
                      <WeatherIc code={h.code} size={20} />
                      <span className="wx-hour-t">{h.temp}°</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!!days.length && (
              <>
                <div className="wx-sub">This week</div>
                <div className="wx-days">
                  {days.map((d, i) => (
                    <button
                      key={d.date}
                      type="button"
                      className={`wx-day${i === selDay ? ' sel' : ''}`}
                      onClick={() => setSelDay(i)}
                      aria-pressed={i === selDay}
                      aria-label={`${dayLabel(d.date, i)}, high ${d.hi} degrees, low ${d.lo} degrees, show this day's hours`}
                    >
                      <span className={`wx-day-d${i === 0 ? ' today' : ''}`}>{dayLabel(d.date, i)}</span>
                      <WeatherIc code={d.code} size={20} />
                      <span className="wx-day-bar" />
                      <span className="wx-day-temps"><span className="hi">{d.hi}°</span> <span className="lo">{d.lo}°</span></span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
};

const Habits: React.FC = () => {
  const [habits, setHabits] = useState<string[]>([]);
  const [habitCadence, setHabitCadence] = useState<Record<string, Cadence>>({});
  const [newHabitCadence, setNewHabitCadence] = useState<Cadence>('daily');
  const [newHabitSchedule, setNewHabitSchedule] = useState<string | null>(null); // day/date the new habit runs on
  // Deep-link from the Today feed (/?habit=Name): focus + expand that habit's card.
  const [focusHabit] = useState<string | null>(() => {
    try { return new URLSearchParams(window.location.search).get('habit'); } catch { return null; }
  });
  useEffect(() => {
    if (focusHabit) window.history.replaceState(null, '', window.location.pathname);
  }, [focusHabit]);
  // Tapping the level ring reveals the customization pickers in place (no navigation).
  const [customizeOpen, setCustomizeOpen] = useState(false);
  // Which cadence panel the carousel is showing. Level/streak chrome is Daily-only,
  // so we track the active cadence (fed by the carousel's onIndexChange) to gate it.
  const [activeCadence, setActiveCadence] = useState<Cadence>('daily');
  // Seed the active cadence to the carousel's opening panel — normally 'daily', but a
  // /?habit= deep-link can open on that habit's cadence. Stable after load, so it won't
  // clobber later swipes (which update activeCadence via onIndexChange).
  const startCad: Cadence = focusHabit ? (habitCadence[focusHabit] ?? 'daily') : 'daily';
  useEffect(() => { setActiveCadence(startCad); }, [startCad]);
  const cadenceRef = useRef<Record<string, Cadence>>({});
  useEffect(() => { cadenceRef.current = habitCadence; }, [habitCadence]);
  // Persist habit names + their cadence (objects), using the latest cadence map.
  const persistHabits = useCallback((names: string[], overrides?: Record<string, Cadence>) => {
    const map = { ...cadenceRef.current, ...(overrides ?? {}) };
    return api.updateHabits(names.map(n => ({ name: n, cadence: map[n] ?? 'daily' }))).catch(() => {});
  }, []);
  const [startDates, setStartDates] = useState<Record<string, string | null>>({});
  const [quitStarts, setQuitStarts] = useState<Record<string, string | null>>({}); // ISO timestamp per quit habit
  const [starred, setStarred] = useState<Record<string, boolean>>({});
  const [dueDates, setDueDates] = useState<Record<string, string | null>>({}); // 'YYYY-MM-DD' per habit
  const [reminderHours, setReminderHours] = useState<Record<string, number | null>>({}); // local hour 0-23 per habit
  const [schedules, setSchedules] = useState<Record<string, string | null>>({}); // scheduling anchor per non-daily habit
  const [shared, setShared] = useState<Record<string, boolean>>({}); // per-habit share-with-friends opt-in
  const [newQuitStart, setNewQuitStart] = useState<string>(() => toLocalDatetimeValue(new Date()));
  const [xpCarry, setXpCarry] = useState<Record<string, number>>({});
  const [ht, setHt] = useState<HabitTracker>({});
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [weatherOpen, setWeatherOpen] = useState(false); // weather breakdown sheet
  const [weatherOn, setWeatherOn] = useState(weatherEnabled); // menu toggle: show the chip at all
  // `stuck` = the cadence section has reached the top and its header is pinned, so
  // the XP bar + dots show as one glass capsule. One sticky element, no seam.
  const [stuck, setStuck] = useState(false);
  const cadTopRef = useRef<HTMLDivElement>(null);
  const onPageScroll = (e: React.UIEvent<HTMLElement>) => {
    const sc = e.currentTarget;
    const scTop = sc.getBoundingClientRect().top;
    const c = cadTopRef.current;
    if (c) setStuck(c.getBoundingClientRect().top <= scTop + 4);
  };
  const [loaded, setLoaded] = useState(false);
  const [newHabit, setNewHabit] = useState('');
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [featuredOpen, setFeaturedOpen] = useState(false);
  // The Featured banner can be dismissed (X) and brought back from the cog's
  // "Discover Habits". Persisted so it stays hidden across sessions until restored.
  const [featuredDismissed, setFeaturedDismissed] = useState(() => localStorage.getItem('superdub.featured.dismissed') === '1');
  // Bumped on every carousel swipe so the featured banner remounts and replays its
  // swipe-up-from-the-bottom animation.
  const [featuredSwipeKey, setFeaturedSwipeKey] = useState(0);
  const dismissFeatured = () => { setFeaturedDismissed(true); localStorage.setItem('superdub.featured.dismissed', '1'); };
  const [showDayOverlay, setShowDayOverlay] = useState(false);
  const [overlayDay, setOverlayDay] = useState<string | null>(null); // null = today; else a DD/MM key
  const [rewindDay, setRewindDay] = useState<string | null>(null); // null = today; else rewind cards to this DD/MM

  // Week gold — purely derived: gold ONLY on Sunday when all 7 days are logged.
  // Resets to original colour automatically on Monday (no persisted state, no veteran ring).
  const [weekCelebrating, setWeekCelebrating] = useState(false);
  const prevPerfectRef = useRef(false);
  const [honestyPending, setHonestyPending] = useState<{ habit: string; day: string; next: HabitState } | null>(null);

  // Adapt the home surface to the user's stage: teach newcomers, stay out of veterans' way.
  const stage = useUserStage();

  const pwaKey = `superdub.pwa.${PWA_PROMPT_VERSION}`;
  const pwaDayKey = `superdub.pwa.day.${PWA_PROMPT_VERSION}`;
  const todayStr = new Date().toDateString();
  const [showInstall, setShowInstall] = useState(() => {
    if (isInStandaloneMode) return false;
    if ((window as any).Capacitor?.isNativePlatform?.()) return false; // already the native app
    if (localStorage.getItem(pwaKey) === 'dismissed') return false;
    if (localStorage.getItem(pwaDayKey) === todayStr) return false;
    return true;
  });
  const [installClosing, setInstallClosing] = useState(false);
  // +100 XP reward for installing to the home screen (granted once the app runs installed)
  const [, setInstallBonus] = useState(() => localStorage.getItem(INSTALL_XP_KEY) === 'granted');

  // Grant the install reward when the app is actually running as an installed PWA
  useEffect(() => {
    const installed = isInStandaloneMode || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);
    if (installed && localStorage.getItem(INSTALL_XP_KEY) !== 'granted') {
      localStorage.setItem(INSTALL_XP_KEY, 'granted');
      setInstallBonus(true);
    }
  }, []);

  const animateOutInstall = (persist: () => void) => {
    setInstallClosing(true);
    setTimeout(() => { persist(); setShowInstall(false); setInstallClosing(false); }, 320);
  };
  const dismissInstall = () => animateOutInstall(() => localStorage.setItem(pwaDayKey, todayStr));
  const neverShowInstall = () => animateOutInstall(() => localStorage.setItem(pwaKey, 'dismissed'));

  const openDayOverlay = (dayKey?: string) => {
    setOverlayDay(dayKey ?? null); // no arg (weigh-in / auto-refresh) = today
    localStorage.setItem(OVERLAY_REFRESH_KEY, String(Date.now()));
    setShowDayOverlay(true);
  };
  const shouldAutoRefresh = () => {
    const last = parseInt(localStorage.getItem(OVERLAY_REFRESH_KEY) || '0', 10);
    return Date.now() - last >= SIX_HOURS_MS;
  };

  const today = todayKey();
  // Day the habit cards are "rewound" to (tap a past day in the week strip). Stats
  // stay as-of-today; only the completion pointer/checkmarks follow activeDay.
  const activeDay = rewindDay ?? today;
  const weekDays = getWeekDays();
  const { refresh: refreshXP } = useXP();
  // XP bar intro: start at 0 on mount, then let the CSS width transition rise it
  // up to the real value (never animate down from a stale/full width on login).

  useEffect(() => {
    Promise.all([api.getHabits(), api.getTracker()]).then(([loadedHabits, trackerData]) => {
      let names = loadedHabits.map(h => h.name);
      const dates: Record<string, string | null> = {};
      const cad: Record<string, Cadence> = {};
      const quits: Record<string, string | null> = {};
      const stars: Record<string, boolean> = {};
      const dues: Record<string, string | null> = {};
      const rems: Record<string, number | null> = {};
      const scheds: Record<string, string | null> = {};
      const shares: Record<string, boolean> = {};
      loadedHabits.forEach(h => { dates[h.name] = h.startDate; cad[h.name] = ((h as any).cadence as Cadence) || 'daily'; quits[h.name] = (h as any).quitStartedAt ?? null; stars[h.name] = !!(h as any).starred; dues[h.name] = (h as any).dueDate ?? null; rems[h.name] = (h as any).reminderHour ?? null; scheds[h.name] = (h as any).schedule ?? null; shares[h.name] = !!(h as any).sharedWithFriends; });
      cad[MANDATORY_HABIT] = 'daily';
      setHabitCadence(cad);
      setQuitStarts(quits);
      setStarred(stars);
      setDueDates(dues);
      setReminderHours(rems);
      setSchedules(scheds);
      setShared(shares);
      cadenceRef.current = cad;

      // Mandatory habit is always present in state.
      // Only write to DB if getHabits returned a real response — guards against
      // a cold-start empty response wiping existing habits via updateHabits.
      if (!names.includes(MANDATORY_HABIT)) {
        names = [MANDATORY_HABIT, ...names];
        dates[MANDATORY_HABIT] = new Date().toISOString().slice(0, 10);
        if (loadedHabits.length > 0) {
          persistHabits(names, cad);
        }
      }

      setHabits(names);
      setStartDates(dates);
      setXpCarry((trackerData as any).xpCarry ?? {});

      const tod = todayKey();
      const map: HabitTracker = {};
      ALL_DAYS.forEach(d => { map[d] = {}; });
      names.forEach(name => ALL_DAYS.forEach(d => { map[d][name] = null; }));
      (trackerData.habits as any[]).forEach(row => {
        if (map[row.day]) map[row.day][row.habit_name] = row.state as HabitState;
      });
      // Auto-mark mandatory habit done for today
      map[tod] = { ...map[tod], [MANDATORY_HABIT]: 'done' };
      api.toggleTrackerHabit(tod, MANDATORY_HABIT, 'done').catch(() => {});

      setHt(map);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const [wxRes, geoRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,apparent_temperature&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`),
            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`),
          ]);
          const wx = await wxRes.json();
          const geo = await geoRes.json();
          const city = geo.address?.city || geo.address?.town || geo.address?.village || geo.address?.county || '';
          // Hourly: keep the whole 7-day run so tapping a day is a filter, not a refetch.
          const hr = wx.hourly;
          const hours: WeatherHour[] = (hr?.time ?? []).map((t: string, i: number) => ({ time: t, temp: Math.round(hr.temperature_2m[i]), code: hr.weather_code[i] }));
          // Daily: the 7-day forecast.
          const dl = wx.daily;
          const days: WeatherDay[] = (dl?.time ?? []).map((t: string, i: number) => ({ date: t, code: dl.weather_code[i], hi: Math.round(dl.temperature_2m_max[i]), lo: Math.round(dl.temperature_2m_min[i]) })).slice(0, 7);
          setWeather({ temp: Math.round(wx.current.temperature_2m), code: wx.current.weather_code, city, feels: Math.round(wx.current.apparent_temperature), hours, days });
        } catch {}
      },
      () => {}
    );
  }, []);

  // Show habit overlay when habits are first loaded + 6-hour threshold has passed.
  // If the evening reflection is about to auto-show, wait our turn — it hands over
  // via checkin-done (saved) or evening-closed (skipped) so the popups run one by one.
  useEffect(() => {
    if (loaded && shouldAutoRefresh() && !eveningPending()) openDayOverlay();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // The day overlay opens once on load (above). It no longer RE-fires on every
  // superdub:checkin-done — that stacked it on the weigh-in + coach and made it
  // reappear the instant you dismissed it. Only a SKIPPED evening reflection
  // still hands the stage over (evening-closed), so the one deferred show that
  // was suppressed on load isn't lost.
  useEffect(() => {
    const deferred = () => { if (shouldAutoRefresh()) openDayOverlay(); };
    window.addEventListener('superdub:evening-closed', deferred);
    return () => window.removeEventListener('superdub:evening-closed', deferred);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open the add-habit sheet when triggered from the shared cog menu
  useEffect(() => {
    const handler = () => setAddOpen(true);
    window.addEventListener('superdub:open-add-habit', handler);
    return () => window.removeEventListener('superdub:open-add-habit', handler);
  }, []);

  // The weather toggle lives in the cog menu, which sits in our own header — pick the
  // new value up live so the chip goes without waiting for a remount.
  useEffect(() => {
    const handler = () => setWeatherOn(weatherEnabled());
    window.addEventListener('superdub:weather-toggled', handler);
    return () => window.removeEventListener('superdub:weather-toggled', handler);
  }, []);

  // "Discover Habits" from the cog: un-dismiss the banner and open the sheet.
  useEffect(() => {
    const handler = () => {
      setFeaturedDismissed(false);
      localStorage.removeItem('superdub.featured.dismissed');
      setFeaturedOpen(true);
    };
    window.addEventListener('superdub:show-featured', handler);
    return () => window.removeEventListener('superdub:show-featured', handler);
  }, []);

  // Login-streak stats for the mandatory check-in habit — one source for the flame
  // badge cache below and the streak hero on the page.
  const mandatoryStats = useMemo(
    () => computeHabitStats(MANDATORY_HABIT, ht, today, startDates[MANDATORY_HABIT], xpCarry[MANDATORY_HABIT] ?? 0),
    [ht, today, startDates, xpCarry],
  );

  // Cache the check-in streak so the flame badge can show it on every page.
  useEffect(() => {
    if (!loaded) return;
    const s = mandatoryStats.streak;
    if (localStorage.getItem('superdub.dayStreak') !== String(s)) {
      localStorage.setItem('superdub.dayStreak', String(s));
      window.dispatchEvent(new CustomEvent('superdub:streak-updated'));
    }
  }, [loaded, mandatoryStats]);

  // The community habit is now a single dedicated habit ("do a good deed"), logged
  // from the Global planet overlay (GlobalPrompt) — no longer fed by daily-habit
  // completions here.

  // Fallback: check every 5 minutes if 6 hours have passed
  useEffect(() => {
    const id = setInterval(() => {
      if (shouldAutoRefresh() && !eveningPending()) openDayOverlay();
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleDay = useCallback((habit: string, dayKey: string, state: HabitState) => {
    // A soft haptic tick on completion only (not on clear/fail). Single choke point
    // for every completion surface: weekday dots, the big done button, the check-in
    // overlay, past-day backfill, and weekly/monthly unit toggles.
    if (state === 'done' && 'vibrate' in navigator) navigator.vibrate([0, 45, 40, 55]);
    setHt(prev => ({ ...prev, [dayKey]: { ...prev[dayKey], [habit]: state } }));
    // Refresh global XP/level once the write commits so the top-of-page level ring
    // updates on the same tap. (Deliberately NOT superdub:tracker-updated — that
    // event also re-opens the daily check-in overlay.)
    api.toggleTrackerHabit(dayKey, habit, state)
      .then(() => refreshXP())
      .catch(() => {});
  }, [refreshXP]);

  // Backfill past days — gated by a one-time honesty declaration. Persisted in
  // localStorage so it's accepted once per device, not re-prompted every launch
  // (sessionStorage was cleared on each app open, so it kept reappearing).
  const editPast = useCallback((habit: string, day: string, cur: HabitState) => {
    const next = cycleState(cur);
    if (localStorage.getItem('superdub.honesty') === '1') {
      handleToggleDay(habit, day, next);
    } else {
      setHonestyPending({ habit, day, next });
    }
  }, [handleToggleDay]);

  const confirmHonesty = () => {
    localStorage.setItem('superdub.honesty', '1');
    if (honestyPending) handleToggleDay(honestyPending.habit, honestyPending.day, honestyPending.next);
    setHonestyPending(null);
  };

  const handleAddFeatured = useCallback((name: string, cadence: Cadence = 'daily') => {
    if (habits.includes(name)) return;
    const today = new Date().toISOString().slice(0, 10);
    const updated = [...habits, name];
    setHabits(updated);
    setStartDates(prev => ({ ...prev, [name]: today }));
    setHabitCadence(prev => ({ ...prev, [name]: cadence }));
    setHt(prev => {
      const next = { ...prev };
      ALL_DAYS.forEach(d => { next[d] = { ...next[d], [name]: null }; });
      return next;
    });
    persistHabits(updated, { [name]: cadence });
  }, [habits, persistHabits]);

  const addHabit = () => {
    const n = newHabit.trim();
    if (!n || habits.includes(n)) return;
    const startDate = new Date().toISOString().slice(0, 10);
    const updated = [...habits, n];
    setHabits(updated);
    setStartDates(prev => ({ ...prev, [n]: startDate }));
    setHabitCadence(prev => ({ ...prev, [n]: newHabitCadence }));
    setHt(prev => {
      const next = { ...prev };
      ALL_DAYS.forEach(d => { next[d] = { ...next[d], [n]: null }; });
      return next;
    });
    if (newHabitCadence === 'quit') {
      // Set the clean-run start once the habit row exists (persist → set start).
      const startedAtISO = new Date(newQuitStart).toISOString();
      setQuitStarts(prev => ({ ...prev, [n]: startedAtISO }));
      Promise.resolve(persistHabits(updated, { [n]: 'quit' })).then(() => api.setQuitStart(n, startedAtISO).catch(() => {}));
    } else {
      persistHabits(updated, { [n]: newHabitCadence });
      // Persist the chosen run-day (weekly/monthly/yearly) alongside the new habit.
      if (newHabitSchedule) {
        setSchedules(prev => ({ ...prev, [n]: newHabitSchedule }));
        api.setHabitSchedule(n, newHabitSchedule).catch(() => {});
      }
    }
    setNewHabit('');
    setNewHabitCadence('daily');
    setNewHabitSchedule(null);
    setNewQuitStart(toLocalDatetimeValue(new Date()));
    setAddOpen(false);
  };

  const handleRewindQuit = useCallback((name: string) => {
    const startedAtISO = new Date().toISOString();
    setQuitStarts(prev => ({ ...prev, [name]: startedAtISO }));
    if ('vibrate' in navigator) navigator.vibrate(30);
    api.setQuitStart(name, startedAtISO).catch(() => {});
  }, []);

  const handleToggleStar = useCallback((name: string) => {
    setStarred(prev => {
      const next = !prev[name];
      api.setHabitStar(name, next).catch(() => {});
      return { ...prev, [name]: next };
    });
  }, []);

  const handleSetDueDate = useCallback((name: string, dueDate: string | null) => {
    setDueDates(prev => ({ ...prev, [name]: dueDate }));
    api.setHabitDueDate(name, dueDate).catch(() => {});
  }, []);

  const handleSetReminder = useCallback((name: string, hour: number | null) => {
    setReminderHours(prev => ({ ...prev, [name]: hour }));
    api.setHabitReminder(name, hour).catch(() => {});
    // ponytail: reminders only arrive if notifications are enabled (cog → Notifications);
    // the card copy says so rather than auto-prompting here.
  }, []);

  const handleSetSchedule = useCallback((name: string, schedule: string | null) => {
    setSchedules(prev => ({ ...prev, [name]: schedule }));
    api.setHabitSchedule(name, schedule).catch(() => {});
  }, []);

  const handleToggleShare = useCallback((name: string, sharedNow: boolean) => {
    setShared(prev => ({ ...prev, [name]: sharedNow }));
    api.setHabitShare(name, sharedNow).catch(() => setShared(prev => ({ ...prev, [name]: !sharedNow })));
  }, []);

  // Reorder within one cadence group: rebuild the global habits array, keeping
  // members of other groups in their existing slots, then persist (positions).
  const commitGroupReorder = useCallback((newOrder: string[]) => {
    setHabits(prev => {
      const next = applyGroupReorder(prev, newOrder);
      persistHabits(next);
      return next;
    });
  }, [persistHabits]);

  const confirmRemove = (name: string) => {
    if (name === MANDATORY_HABIT) { setPendingRemove(null); return; }
    setPendingRemove(null);
    setHabits(prev => prev.filter(h => h !== name));      // optimistic
    setStartDates(prev => { const next = { ...prev }; delete next[name]; return next; });
    // Archive in DB (soft delete → graveyard), then re-sync the active list.
    api.archiveHabit(name).then(() => {
      api.getHabits().then(active => {
        const names = active.map(h => h.name);
        if (!names.includes(MANDATORY_HABIT)) names.unshift(MANDATORY_HABIT);
        setHabits(names);
      }).catch(() => {});
    }).catch(() => {});
  };

  // Perfect week — gold ONLY lands on Sunday once all 7 days are logged.
  // (Mid-week "all non-future days done" would otherwise trip gold on Monday.)
  const nonFutureDays = weekDays.filter(d => !d.isFuture);
  const isSunday = new Date().getDay() === 0;
  const isPerfectWeek = isSunday && nonFutureDays.length === 7 &&
    nonFutureDays.every(d => ht[d.key]?.[MANDATORY_HABIT] === 'done');

  // Trigger the flip animation the moment the perfect (Sunday) week is achieved
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isPerfectWeek && !prevPerfectRef.current) {
      setWeekCelebrating(true);
      setTimeout(() => setWeekCelebrating(false), 1800);
    }
    prevPerfectRef.current = isPerfectWeek;
  });

  if (!loaded) {
    return (
      <div className="app" style={pageTheme(HEALTH)}>
        <div className="sd-loader-wrap"><div className="sd-loader"><img className="sd-loader-logo" src="/superdub-logo.png" alt="" /></div></div>
      </div>
    );
  }

  const yourHabits = habits.filter(h => h !== MANDATORY_HABIT);

  // ── Cadence grouping + period completion (weekly/monthly/yearly) ─────────────
  const cadenceGroups: Record<Cadence, string[]> = { daily: [], weekly: [], monthly: [], yearly: [], quit: [] };
  yourHabits.forEach(h => { cadenceGroups[habitCadence[h] ?? 'daily'].push(h); });

  // Just added a habit? Hold off on the "add another" affordance for a few days so the
  // new habit gets focus. They can still add from the cog's "Add Habit" any time.
  const addedRecently = yourHabits.some(h => daysSince(startDates[h]) < RECENT_ADD_DAYS);

  // Once a user has a full, spread-out routine (6+ habits across 2+ cadence groups)
  // the Featured discovery nudge has done its job — hide it automatically.
  const featuredEarned =
    yourHabits.length > 5 && CADENCE_ORDER.filter(c => cadenceGroups[c].length > 0).length >= 2;

  const cadencePanels = CADENCE_ORDER.map(cad => {
    const meta = CADENCE_META[cad];
    const list = cadenceGroups[cad];
    const isQuit = cad === 'quit';
    const addLabel = isQuit ? 'Add something to quit' : `Add a ${meta.label.toLowerCase()} habit`;
    const renderHabitCard = (habit: string, handle?: React.ReactNode) => (
      <HabitCard
        habit={habit}
        stats={computeHabitStats(habit, ht, today, startDates[habit], xpCarry[habit] ?? 0, cadenceXpMultiplier(cad))}
        weekDays={weekDays}
        ht={ht}
        today={activeDay}
        cadence={cad}
        onToggleDay={handleToggleDay}
        onEditDay={editPast}
        onRequestRemove={setPendingRemove}
        startDate={startDates[habit]}
        starred={starred[habit]}
        onToggleStar={handleToggleStar}
        dueDate={dueDates[habit] ?? null}
        onSetDueDate={handleSetDueDate}
        reminderHour={reminderHours[habit] ?? null}
        onSetReminder={handleSetReminder}
        schedule={schedules[habit] ?? null}
        onSetSchedule={handleSetSchedule}
        sharedWithFriends={shared[habit]}
        onToggleShare={handleToggleShare}
        dragHandle={handle}
        focused={habit === focusHabit}
      />
    );
    const cards = isQuit
      ? list.map(name => (
          <QuitCard
            key={name}
            name={name}
            startedAt={quitStarts[name] ?? null}
            onRewind={handleRewindQuit}
            onRequestRemove={setPendingRemove}
          />
        ))
      : (
        <ReorderableList
          names={list}
          onCommit={commitGroupReorder}
          renderItem={(name, handle) => renderHabitCard(name, handle)}
        />
      );
    // Add affordance appears only on an empty cadence with no recent add elsewhere.
    // Once a cadence has a habit (habit+1) the mini "add another" is gone entirely — the
    // cog's "Add Habit" is the discovery path from here on.
    const content = list.length === 0 ? (
      <div className="hb-rows">
        {!addedRecently && (
          <button className="hcard hcard-add" onClick={() => { setNewHabitCadence(cad); setAddOpen(true); }} aria-label={addLabel}>
            <span className="hcard-add-plus" style={{ color: meta.color }}>+</span>
            <span className="hcard-add-label">{addLabel}</span>
          </button>
        )}
      </div>
    ) : (
      <div className="hb-rows">
        {cards}
      </div>
    );
    return { key: cad, label: meta.label, color: meta.color, icon: meta.icon, content };
  });

  return (
    <div className="app flush" style={pageTheme(HEALTH, '0D')}>
      {/* Remove confirmation dialog */}
      {pendingRemove && (
        <div className="confirm-overlay" onClick={() => setPendingRemove(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <p className="confirm-title">Archive "{pendingRemove}"?</p>
            <p className="confirm-desc">It'll move to the Graveyard. You can bring it back any time.</p>
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setPendingRemove(null)}>Cancel</button>
              <button className="confirm-ok" onClick={() => confirmRemove(pendingRemove)}>Archive it</button>
            </div>
          </div>
        </div>
      )}


      {/* Add habit sheet */}
      {addOpen && (
        <div className="hb-sheet-overlay" onClick={() => setAddOpen(false)}>
          <div className="hb-sheet" onClick={e => e.stopPropagation()}>
            <div className="hb-sheet-grip" />
            <div className="hb-sheet-head">
              <h3 className="hb-sheet-title">New Habit</h3>
              <button className="hb-sheet-close" onClick={() => setAddOpen(false)} aria-label="Close">✕</button>
            </div>
            <p className="hb-sheet-sub">What do you want to build?</p>
            <div className="habit-add-row">
              <input
                type="text"
                className="habit-add-input"
                value={newHabit}
                autoFocus
                onChange={e => setNewHabit(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addHabit()}
                placeholder="Name your new habit…"
              />
              <button className="habit-add-btn" onClick={addHabit}>+</button>
            </div>
            <p className="hb-sheet-sub" style={{ marginTop: 16, marginBottom: 8 }}>How often?</p>
            <div className="cadence-picker">
              {ADD_CADENCE_ORDER.map(cad => {
                const m = CADENCE_META[cad];
                const active = newHabitCadence === cad;
                return (
                  <button
                    key={cad}
                    className={`cadence-pick${active ? ' active' : ''}`}
                    style={active ? { color: m.color, borderColor: m.color, background: `${m.color}1f` } : undefined}
                    onClick={() => setNewHabitCadence(cad)}
                  >
                    <span className="cadence-pick-dot" style={{ background: m.color }} />
                    <span className="cadence-pick-label">{m.label}</span>
                  </button>
                );
              })}
            </div>
            {(newHabitCadence === 'weekly' || newHabitCadence === 'monthly' || newHabitCadence === 'yearly') && (
              <>
                <p className="hb-sheet-sub" style={{ marginTop: 16, marginBottom: 8 }}>Which day?</p>
                <div className="hcard-schedule" onClick={e => e.stopPropagation()}>
                  <span className="hcard-schedule-text">
                    <CalendarIc size={12} />
                    {scheduleLabel(newHabitCadence, newHabitSchedule) ?? 'Runs any day'}
                  </span>
                  {newHabitCadence === 'weekly' && (
                    <select className="hcard-schedule-select" value={newHabitSchedule ?? ''} onChange={e => setNewHabitSchedule(e.target.value || null)}>
                      <option value="">Any day</option>
                      {WEEKDAYS_FULL.map((d, i) => <option key={i} value={String(i)}>{d}</option>)}
                    </select>
                  )}
                  {newHabitCadence === 'monthly' && (
                    <select className="hcard-schedule-select" value={newHabitSchedule ?? ''} onChange={e => setNewHabitSchedule(e.target.value || null)}>
                      <option value="">Any day</option>
                      {Array.from({ length: 31 }, (_, i) => <option key={i} value={String(i + 1)}>Day {i + 1}</option>)}
                    </select>
                  )}
                  {newHabitCadence === 'yearly' && (
                    <input
                      type="date"
                      className="hcard-schedule-input"
                      value={newHabitSchedule ? `${YEAR}-${String(parseInt(newHabitSchedule.split('-')[0], 10)).padStart(2, '0')}-${String(parseInt(newHabitSchedule.split('-')[1], 10)).padStart(2, '0')}` : ''}
                      onChange={e => {
                        if (!e.target.value) { setNewHabitSchedule(null); return; }
                        const [, mo, dd] = e.target.value.split('-');
                        setNewHabitSchedule(`${parseInt(mo, 10)}-${parseInt(dd, 10)}`);
                      }}
                    />
                  )}
                </div>
              </>
            )}
            {newHabitCadence === 'quit' && (
              <>
                <p className="hb-sheet-sub" style={{ marginTop: 16, marginBottom: 8 }}>When did you quit?</p>
                <input
                  type="datetime-local"
                  className="habit-add-input"
                  value={newQuitStart}
                  max={toLocalDatetimeValue(new Date())}
                  onChange={e => setNewQuitStart(e.target.value)}
                />
                <p className="hb-sheet-hint">Your clock counts up from here. If you slip, tap Rewind to restart it.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Featured habits sheet */}
      <FeaturedSheet open={featuredOpen} onClose={() => setFeaturedOpen(false)} userHabits={habits} onAdd={handleAddFeatured} />

      {/* Honesty declaration, shown once per session before backfilling past days */}
      {honestyPending && (
        <div className="honesty-overlay" onClick={() => setHonestyPending(null)}>
          <div className="honesty-modal" onClick={e => e.stopPropagation()}>
            <div className="honesty-icon">🤝</div>
            <h3 className="honesty-title">Quick honesty check</h3>
            <p className="honesty-text">
              You're editing a past day. Only log what you <strong>genuinely did</strong> —
              your streaks, XP and trends are only worth something if they're real. No one's watching but you.
            </p>
            <button className="honesty-confirm" onClick={confirmHonesty}>I'll be honest, let me edit</button>
            <button className="honesty-cancel" onClick={() => setHonestyPending(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="habits-page-scroll" onScroll={onPageScroll}>
        {/* Top bar: brand + weather + cog (shared header). The streak lives in the
            login-streak ticks at the top of the page now; the weather chip is tappable
            (opens the WeatherSheet breakdown). */}
        <SuperdubHeader>
          {weatherOn && weather && (
            <button
              type="button"
              className="hb-weather"
              onClick={() => setWeatherOpen(true)}
              aria-label={`Weather ${weather.temp} degrees${weather.city ? ` in ${weather.city}` : ''}, tap for the hourly and weekly breakdown`}
            >
              <WeatherIc code={weather.code} size={14} />{weather.temp}°
            </button>
          )}
        </SuperdubHeader>

        {showInstall && stage !== 'super' && (
          <div className={`pwa-banner${installClosing ? ' closing' : ''}`}>
            <button className="pwa-banner-dismiss" onClick={dismissInstall} aria-label="Hide for today">✕</button>
            <div className="pwa-banner-main">
              <img className="pwa-banner-icon" src="/superdub-icon-512.png" alt="" />
              <div className="pwa-banner-text">
                {isIOS ? (
                  <>
                    <strong>Add to Home Screen</strong>
                    <span>Tap <strong>Share</strong> → <strong>Add to Home Screen</strong></span>
                  </>
                ) : (
                  <>
                    <strong>Superdub for Android</strong>
                    <span>The Android app is here. Download it now.</span>
                  </>
                )}
              </div>
            </div>
            {isIOS ? (
              <>
                <div className="pwa-banner-foot">
                  <span className="pwa-reward"><span className="pwa-reward-plus">+</span>100 XP</span>
                  <button className="pwa-banner-never" onClick={neverShowInstall}>Don't show again</button>
                </div>
              </>
            ) : (
              <>
                <div className="pwa-banner-foot">
                  <a
                    className="pwa-banner-btn"
                    href="/downloads/superdub.apk"
                    download="superdub.apk"
                    onClick={dismissInstall}
                  >
                    Download APK
                  </a>
                </div>
                <p className="pwa-banner-note">
                  Not from the Play Store, so Android will ask you to allow “install from unknown sources”. That’s expected, not a problem.
                </p>
                <button className="pwa-banner-never pwa-banner-never--row" onClick={neverShowInstall}>Don't show again</button>
              </>
            )}
          </div>
        )}

        {!customizeOpen && <>
        {/* Date + login-streak ticks — top of the page, under the wordmark. The ticks
            swipe back through previous weeks (WeekStrip); tapping a day rewinds the page
            to it. Shown on every cadence (it's your daily check-in, not level chrome). */}
        {(() => {
          const d = loggingNow();
          return (
            <div className="hb-datehead">
              <span className="hb-datehead-dow">{d.toLocaleDateString('en-GB', { weekday: 'long' })}</span>
              <span className="hb-datehead-dm">{d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</span>
            </div>
          );
        })()}
        <WeekStrip ht={ht} rewindDay={rewindDay} onPick={setRewindDay} perfectWeek={isPerfectWeek} celebrating={weekCelebrating} />

        {/* Rewind banner — the page is showing a past day. It sits directly under the
            ticks that changed the day, so the "Viewing …/Back to today" read lands
            where the tap happened rather than at the foot of the page. */}
        {rewindDay && (
          <div className="hb-rewind-banner">
            <span className="hb-rewind-label">
              Viewing {(() => {
                const d = new Date(loggingNow().getFullYear(), parseInt(rewindDay.slice(3), 10) - 1, parseInt(rewindDay.slice(0, 2), 10));
                return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
              })()}
            </span>
            <button className="hb-rewind-back" onClick={() => setRewindDay(null)}>Back to today</button>
          </div>
        )}

        {/* The comeback strip — only renders for someone who has drifted or lapsed,
            and sits above the day's inputs so the first thing they see is an
            invitation rather than a wall of unmarked days. */}
        <LapseBanner />

        {/* Today's log — the app's own inputs (weigh-in / steps / check-in), pulled up
            with the ticks so your day sits together at the top. Follows the week strip's
            selected day; check-in reuses the mandatory-habit signal. */}
        <DailyLog day={rewindDay} checkedInDay={rewindDay ? ht[rewindDay]?.[MANDATORY_HABIT] === 'done' : undefined} />

        {/* HABITS — the cadence carousel. Zero-height sentinel marks the carousel top
            for the sticky-XP calc. PinnedXpBar + activeCadence kept from master
            (level chrome = Daily only). */}
        <div ref={cadTopRef} aria-hidden="true" style={{ height: 0 }} />
        <CadenceCarousel panels={cadencePanels} startIndex={CADENCE_ORDER.indexOf(startCad)} compact={stuck} header={activeCadence === 'daily' ? <PinnedXpBar /> : null} onIndexChange={(i) => { setActiveCadence(CADENCE_ORDER[i]); setFeaturedSwipeKey(k => k + 1); }} />

        {/* Featured banner, tap to open & join (below the user's habits). Swipes up
            from the bottom (0 → 100% opacity) each time you swipe the carousel above —
            the changing key remounts it so the CSS animation replays.
            Dismissable with the X; bring it back from the cog's Discover Habits. */}
        {!featuredDismissed && !featuredEarned && (
          <div key={featuredSwipeKey} className="hb-featured-wrap">
            <button className="hb-featured" onClick={() => setFeaturedOpen(true)}>
              <div className="hb-featured-text">
                <span className="hb-featured-eyebrow">FEATURED</span>
                <span className="hb-featured-cta">Discover habits to join →</span>
              </div>
              <span className="hb-featured-icon"><WalkIc size={44} /></span>
            </button>
            <button className="hb-featured-x" onClick={dismissFeatured} aria-label="Hide featured habits">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
            </button>
          </div>
        )}

        {/* What the coach says — the "where you're trending" read. Daily-only, matching
            master's chrome gating. The streak now lives in the ticks up top, so there's
            no separate streak tile here anymore. */}
        {activeCadence === 'daily' && !rewindDay && <HomeOnTrack />}

        {/* New / lapsed users get a gentle coaching line instead of a bare gap. */}
        {(stage === 'new' || mandatoryStats.streak < 1) && (
          <p className="hb-week-coach">Tick a habit each day to grow your streak. Dub coaches you as you go.</p>
        )}

        {/* Weekly Recap, Sunday only, right under the gold circles */}
        {isSunday && <WeeklyRecap />}

        </>}

        {/* Level ring — the reward, now docked at the BOTTOM of the page (was at the
            top). Daily-only, matching master's level-chrome gating. Tapping it still
            SWAPS in the customization pickers + ladder (below); tap again to restore. */}
        {activeCadence === 'daily' && (
          <div className="hb-level-dock">
            <span className="hb-level-eyebrow">The Ascension</span>
            <LevelHeroRing onRingTap={() => setCustomizeOpen(o => !o)} />
            <button type="button" className="hb-level-hint" onClick={() => setCustomizeOpen(o => !o)}>
              Tap the ring to customise your look
            </button>
          </div>
        )}
        <div className={`hb-customize${customizeOpen ? ' open' : ''}`}>
          <div className="hb-customize-inner">
            {customizeOpen && (
              <>
                <LevelCustomizer showHero={false} />
                <div className="hb-customize-ladder"><LevelLadder /></div>
              </>
            )}
          </div>
        </div>

        <div style={{ height: 100 }} />
      </div>

      {/* Weather breakdown sheet — opens from the header weather chip (hourly + 7-day). */}
      <WeatherSheet weather={weather} open={weatherOpen} onClose={() => setWeatherOpen(false)} />

      {/* ── Habit day overlay, triggered by weigh-in or 6-hour refresh ── */}
      {showDayOverlay && loaded && (() => {
        const viewingDay = overlayDay ?? today;
        const isTodayView = viewingDay === today;
        const todayHabits = ht[viewingDay] ?? {};
        // Daily check-in popup only covers daily habits (weekly/monthly/yearly are
        // completed via their swipe cards in the cadence carousel).
        const displayHabits = yourHabits.filter(h => (habitCadence[h] ?? 'daily') === 'daily');
        const doneCount = displayHabits.filter(h => todayHabits[h] === 'done').length;
        const total = displayHabits.length;
        const allDone = total > 0 && doneCount === total;
        const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
        const now = loggingNow();
        const hour = now.getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        const viewDate = isTodayView ? now : new Date(now.getFullYear(), parseInt(viewingDay.slice(3), 10) - 1, parseInt(viewingDay.slice(0, 2), 10));
        const dayLabel = viewDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
        return (
          <div className={`hp-overlay${allDone ? ' all-done' : ''}`} onClick={() => setShowDayOverlay(false)}>
            <div className="hp-glow" aria-hidden="true" />
            <div className="hp-screen" onClick={e => e.stopPropagation()}>
              <div className="hp-top">
                <span className="hp-eyebrow">{dayLabel}</span>
                <button className="hp-close" onClick={() => setShowDayOverlay(false)} aria-label="Close">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
                </button>
              </div>

              <div className="hp-hero">
                <div className="hp-greet">
                  <h2 className="hp-greeting">{isTodayView ? (allDone ? 'All done' : greeting) : 'Your log'}</h2>
                  <p className="hp-sub">{isTodayView ? (allDone ? 'Every habit closed today. Nice work.' : "Here's your habit progress for today.") : 'Tap a habit to backfill this day.'}</p>
                </div>
                <div className="hp-ring" aria-label={`${doneCount} of ${total} habits done`}>
                  <svg viewBox="0 0 88 88" aria-hidden="true">
                    <circle cx="44" cy="44" r="39" fill="none" stroke="var(--glass-border, #252532)" strokeWidth="6" />
                    <circle className="hp-ring-arc" cx="44" cy="44" r="39" fill="none" strokeWidth="6" strokeLinecap="round"
                      strokeDasharray="245" strokeDashoffset={245 * (1 - pct / 100)} transform="rotate(-90 44 44)" />
                  </svg>
                  <div className="hp-ring-c"><b>{doneCount}<small>/{total}</small></b><span>done</span></div>
                </div>
              </div>

              {total === 0 ? (
                <p className="hp-empty">No habits yet, add some below.</p>
              ) : (
                <div className="hp-rows">
                  {displayHabits.map(h => {
                    const state = todayHabits[h] ?? null;
                    const done = state === 'done';
                    return (
                      <button
                        key={h}
                        type="button"
                        className={`hp-row ${done ? 'done' : ''} ${state === 'failed' ? 'failed' : ''} ${state === 'na' ? 'na' : ''}`}
                        onClick={() => handleToggleDay(h, viewingDay, cycleState(state))}
                        aria-pressed={done}
                      >
                        <span className="hp-chk">
                          {done
                            ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
                            : state === 'failed'
                              ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
                              : <span className="hp-plus">{state === 'na' ? '–' : '+'}</span>}
                        </span>
                        <span className="hp-name">{h}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="hp-foot">
                {total > 0 && <p className="hp-msg">{allDone ? 'All habits done, perfect day.' : 'Tap to check off habits.'}</p>}
                <button type="button" className="hp-dismiss" onClick={() => setShowDayOverlay(false)}>{allDone ? 'Keep it up' : 'Close'}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Habits;
