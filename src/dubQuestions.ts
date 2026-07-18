// =====================================================================
// SUPERDUB — Dub's chat question bank
// The deterministic conversation engine behind "Chat to Dub": every question
// the user can tap, gated on the data actually existing, with the answer
// precomputed from the same engines the charts use (coach.ts, energy.ts,
// levels.ts, dubInsights.ts). Pure functions, no network, no LLM. Answers obey
// SUPERDUB_VOICE.md (no dashes as punctuation, no jargon) and dubChat.check.ts
// asserts that, so voice is a CI property here, not a review hope.
// =====================================================================

import {
  weekPace, fmtDate, ddmmToEpochDay, tipFor,
  type WeighIn, type CoachReport,
} from './coach';
import { FAT_CAP_KG_PER_DAY } from './energy';
import { getWeightUnit, kgToUnitValue, unitLabel } from './weightUnit';
import { computePlayerLevel } from './levels';
import type { DubInsight } from './dubInsights';
import type { PlanStatusResponse, CoachingResponse } from './api';

export interface DubCheckin { date: string; sleep: number | null; mood: number | null }

// Everything Dub knows for one chat session, assembled once when the chat
// opens. `report` is the same buildCoachReport output the opening bubbles show.
export interface DubData {
  weights: WeighIn[];
  report: CoachReport | null;
  insights: DubInsight[];
  plan: PlanStatusResponse | null;
  coaching: CoachingResponse | null;
  checkins: DubCheckin[];        // recent first or last, order doesn't matter
  totalXP: number;
  today: string;                 // 'DD/MM'
  brief?: string | null;         // the morning/evening brief text (wired in E5.2)
}

export interface DubQuestion {
  id: string;
  label: string;                 // the chip the user taps
  answer: string;                // fully formed, deterministic
  followUps?: string[];          // question ids to float forward after this one
}

const fmt1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

// Insight chips get a question-shaped label from the insight's kind (its icon).
function insightLabel(ins: DubInsight): string {
  if (ins.icon === '📅') return `Why does ${ins.habit} slip?`;
  if (ins.icon === '👟' || ins.icon === '🐢') return `What does ${ins.habit} do for my steps?`;
  if (ins.icon === '😊' || ins.icon === '☁️') return `Does ${ins.habit} change my mood?`;
  return `Is ${ins.habit} moving my weight?`;
}

// Build every question whose data exists, in tray order. The component shows
// the first ~5 unasked and floats followUps forward as chips get tapped.
export function buildQuestionBank(d: DubData): DubQuestion[] {
  const qs: DubQuestion[] = [];
  const seed = ddmmToEpochDay(d.today);
  const wp = weekPace(d.weights, seed);
  const plan = d.plan && d.plan.active ? d.plan : null;
  const goal = plan?.goal ?? null;

  // Weight display in the user's unit (storage/detection stay kg). kgToUnitValue
  // is linear so it's right for deltas and per-week rates too. Guarded — this
  // runs in node under dubQuestions.check.ts, where localStorage is absent.
  const unit = (() => { try { return getWeightUnit(); } catch { return 'kg' as const; } })();
  const wLbl = unitLabel(unit);
  const wt = (kg: number) => fmt1(kgToUnitValue(kg, unit));

  // ── The brief (when the composer produced one, E5.2) ──
  if (d.brief) {
    qs.push({ id: 'brief', label: "What's my brief?", answer: d.brief, followUps: ['focus', 'steps'] });
  }

  // ── Conditional insight questions float near the front ──
  d.insights.slice(0, 2).forEach((ins, i) => {
    const extra = ins.icon === '📅' ? ` ${tipFor(ins.habit)}` : '';
    qs.push({ id: `insight:${i}`, label: insightLabel(ins), answer: `${ins.text}${extra}`, followUps: ['focus'] });
  });

  // ── Weight and pace ──
  if (wp) {
    const losing = wp.rate < 0;
    const move = `${wt(Math.abs(wp.rate))} ${wLbl} ${losing ? 'down' : 'up'} ${wp.hasWeek ? 'this week' : 'lately'}`;
    const span = wp.hasWeek ? ` (${wt(wp.first!.y)} to ${wt(wp.last!.y)} ${wLbl} since ${fmtDate(wp.first!.x)})` : '';
    let paceAnswer: string;
    if (Math.abs(wp.rate) < 0.1) {
      paceAnswer = `The scale's held flat ${wp.hasWeek ? 'this week' : 'lately'}${span}. That's normal. Judge the month, not the week.`;
    } else if (goal?.targetWeight != null) {
      const remaining = Math.abs(wp.latest - goal.targetWeight);
      const rightWay = (goal.goalType === 'lose' && losing) || (goal.goalType === 'gain' && !losing);
      const weeks = wp.perWeek > 0 ? remaining / wp.perWeek : Infinity;
      const eta = rightWay && isFinite(weeks) && weeks < 104
        ? ` At this pace you'll hit ${wt(goal.targetWeight)} ${wLbl} around ${fmtDate(seed + Math.round(weeks * 7))}.`
        : '';
      paceAnswer = `You're ${move}${span}.${eta} ${wt(remaining)} ${wLbl} to go. ${rightWay ? 'Keep it steady.' : 'One solid day turns the line.'}`;
    } else {
      paceAnswer = `You're ${move}${span}, now at ${wt(wp.latest)} ${wLbl}. Set a goal in the Adaptive Weight Plan and I'll tell you your finish date.`;
    }
    qs.push({ id: 'pace', label: 'Am I on pace?', answer: paceAnswer, followUps: ['goalDate', 'target'] });

    // Why is my weight up? Only when the latest weigh-in rose.
    if (wp.prev != null && wp.latest > wp.prev) {
      const delta = wp.latest - wp.prev;
      const real = Math.min(FAT_CAP_KG_PER_DAY, delta);
      qs.push({
        id: 'whyUp', label: 'Why is my weight up?',
        answer: `You're up ${wt(delta)} ${wLbl} since your last weigh-in. At most ${wt(real)} ${wLbl} of that can be real tissue. The rest is water and food still moving through. Judge the week, not the morning.`,
        followUps: ['pace'],
      });
    }

    // Will I hit my goal by its date?
    if (goal?.targetWeight != null && goal.targetDate) {
      const targetEpoch = Math.round(new Date(goal.targetDate).getTime() / 86400000);
      const weeksLeft = (targetEpoch - seed) / 7;
      if (weeksLeft > 0) {
        const remaining = Math.abs(wp.latest - goal.targetWeight);
        const needed = remaining / weeksLeft;
        const dateStr = fmtDate(targetEpoch);
        const verdict = wp.perWeek >= needed * 1.1 ? 'so yes, with room to spare'
          : wp.perWeek >= needed * 0.9 ? 'so yes, if you hold this pace'
          : `and your last week ran at ${wt(wp.perWeek)} ${wLbl}, so it needs a step up`;
        qs.push({
          id: 'goalDate', label: `Will I hit my goal by ${dateStr}?`,
          answer: `You need ${wt(remaining)} ${wLbl} off by ${dateStr}. That works out to ${wt(needed)} ${wLbl} a week. Your last week ran at ${wt(wp.perWeek)} ${wLbl}, ${verdict}.`,
          followUps: ['target', 'steps'],
        });
      }
    }
  }

  // ── Calories ──
  if (plan?.currentTarget) {
    qs.push({
      id: 'target', label: 'How many calories should I eat?',
      answer: `Your Adaptive Weight Plan says ${plan.currentTarget.calories.toLocaleString()} kcal today. That keeps you moving at the pace you picked without running on empty.`,
      followUps: ['burn'],
    });
  }
  if (plan?.tdee) {
    const conf = plan.tdee.confidence;
    qs.push({
      id: 'burn', label: 'How much does my body burn?',
      answer: `About ${Math.round(plan.tdee.blendedTDEE).toLocaleString()} kcal a day. That blends the formula for your size with what your weigh-ins actually show. ${conf >= 0.5 ? 'That number is mostly from your own weigh-ins now.' : 'The weigh-ins get more say as they stack up.'}`,
      followUps: ['target'],
    });
  }

  // ── Habits ──
  const struggle = d.report?.lines.find(l => l.icon === '🎯');
  if (struggle) {
    qs.push({ id: 'focus', label: 'What should I focus on?', answer: `${struggle.title}. ${struggle.body}`, followUps: ['wins'] });
  }
  const winLine = d.report?.lines.find(l => l.tone === 'good' && l.icon !== '📉' && l.icon !== '🏆');
  if (winLine) {
    qs.push({ id: 'wins', label: "What's going well?", answer: `${winLine.title}. ${winLine.body}`, followUps: ['week'] });
  }
  if (d.report?.weekStats && d.report.weekStats.possibleTicks >= 7) {
    const { weekTicks, possibleTicks } = d.report.weekStats;
    const pct = Math.round((weekTicks / possibleTicks) * 100);
    const weightBit = wp && Math.abs(wp.rate) >= 0.1
      ? ` The scale ${wp.rate < 0 ? 'gave back' : 'added'} ${wt(Math.abs(wp.rate))} ${wLbl} too.`
      : '';
    qs.push({
      id: 'week', label: "How's my week looking?",
      answer: `${weekTicks} of ${possibleTicks} habit ticks closed, ${pct}%.${weightBit} ${pct >= 70 ? 'Solid week. One clean day tops it off.' : 'Plenty of week left to turn it.'}`,
      followUps: ['wins', 'focus'],
    });
  }

  // ── Sleep ──
  const sleeps = d.checkins.filter(c => c.sleep != null).slice(-14).map(c => c.sleep!) ;
  if (sleeps.length >= 5) {
    const avg = sleeps.reduce((a, b) => a + b, 0) / sleeps.length;
    const short = sleeps.filter(s => s < 7).length;
    qs.push({
      id: 'sleep', label: 'Am I sleeping enough?',
      answer: avg >= 7
        ? `You're averaging ${fmt1(avg)} hours over your last ${sleeps.length} logs. That's a real base. Sleep is where the repair happens, keep it.`
        : `You're averaging ${fmt1(avg)} hours over your last ${sleeps.length} logs, and ${short} of them came in under 7. Short sleep makes hunger louder and willpower quieter. Aim for lights out 30 minutes earlier tonight.`,
      followUps: ['focus'],
    });
  }

  // ── Steps ──
  if (d.coaching?.advisableSteps) {
    qs.push({
      id: 'steps', label: 'How many steps today?',
      answer: `Aim for about ${d.coaching.advisableSteps.toLocaleString()} today. ${d.coaching.trend === 'behind' ? "You're a touch behind pace, so a longer walk pays double." : 'Every step is energy your body has to pull from storage.'}`,
      followUps: ['pace'],
    });
  }

  // ── Level ──
  const lvl = computePlayerLevel(d.totalXP);
  qs.push({
    id: 'level', label: 'How do I level up faster?',
    answer: lvl.xpForNext != null
      ? `You're ${(lvl.xpForNext - d.totalXP).toLocaleString()} XP from ${lvl.nextTitle ?? 'the next level'}. A clean sweep of your dailies is the fastest XP in the app, and older habits pay more per tick. String a few clean days together and it's yours.`
      : `You're at the top of the ladder. Nothing left to unlock, everything left to keep. That's the harder game.`,
    followUps: ['week'],
  });

  // ── Catch-all, always last ──
  const spare = d.insights[2];
  qs.push({
    id: 'else', label: 'Anything else?',
    answer: spare
      ? spare.text
      : `That's everything I've got today. Weigh in tomorrow morning and I'll have fresh numbers for you.`,
  });

  return qs;
}
