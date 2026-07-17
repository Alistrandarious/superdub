// =====================================================================
// SUPERDUB — Dub's morning brief / evening debrief
// One short, plain-English readout of "here's where things stand", composed
// from the same engines as the coach report and chat (coach.ts, energy.ts).
// Pure, no network, no LLM. Every sentence is individually data-gated: a
// missing input drops its sentence, never a placeholder.
// =====================================================================

import { weekPace, ddmmToEpochDay, tipFor, type WeighIn, type CoachReport } from './coach';
import { estimateIntakeRange } from './energy';
import type { PlanStatusResponse, CoachingResponse } from './api';
import type { UserStage } from './userStage';

export interface BriefSources {
  hour: number;                                   // local hour, injected for testability
  weights: WeighIn[];                             // from tracker days (weight > 0), day 'DD/MM'
  today: string;                                  // 'DD/MM'
  report: CoachReport | null;                     // buildCoachReport output
  plan: PlanStatusResponse | null;
  coaching: CoachingResponse | null;
  sleepLastNight: number | null;                  // latest check-in sleep (caller derives)
  adherenceToday: number | null;                  // today's evening self-report level, or null
  habitsDone: number;
  habitsTotal: number;                            // today's real daily habits
  stage?: UserStage;                              // adapt verbosity/tone; absent → 'regular' voice
}

// Sleep hours read "7", not "7.0", when whole; still one decimal otherwise.
function sleepFmt(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
const weightFmt = (n: number) => n.toFixed(1);

// ── Dub's live day state — drives his mood, room and speech bubble ───────────
// Priority mapping over the same sources as the brief; first match wins.
export interface DubDayState {
  mood: 'happy' | 'neutral' | 'concerned';
  celebrate: boolean;                  // sparkles + brighter floor glow in the room
  thought: string;                     // the one-liner in his speech bubble
}
export function dubDayState(src: BriefSources): DubDayState {
  const wp = weekPace(src.weights, ddmmToEpochDay(src.today));
  const plan = src.plan && src.plan.active ? src.plan : null;
  // 1) Every daily habit closed today
  if (src.habitsTotal > 0 && src.habitsDone === src.habitsTotal) {
    return { mood: 'happy', celebrate: true, thought: `Clean sweep. All ${src.habitsTotal} closed.` };
  }
  // 2) Goal essentially reached
  if (plan?.goal?.targetWeight != null && wp && Math.abs(wp.latest - plan.goal.targetWeight) <= 0.3) {
    return { mood: 'happy', celebrate: true, thought: "You're at your goal weight." };
  }
  // 3) Plateau / stall risk / behind pace
  const stallRisk = plan?.stall?.risk;
  const plateau = src.report?.lines.some(l => l.icon === '🪨');
  if (plateau || stallRisk === 'medium' || stallRisk === 'high' || src.coaching?.trend === 'behind') {
    return { mood: 'concerned', celebrate: false, thought: "Scale's gone flat. Hold steady." };
  }
  // 4) The report leans warn — surface its sharpest worry
  const warns = src.report?.lines.filter(l => l.tone === 'warn') ?? [];
  const goods = src.report?.lines.filter(l => l.tone === 'good') ?? [];
  if (warns.length > goods.length && warns[0]) {
    return { mood: 'concerned', celebrate: false, thought: warns[0].title };
  }
  // 5) A live streak (the report's 🔥 win line — reuse, don't re-analyse)
  const streakLine = src.report?.lines.find(l => l.icon === '🔥');
  if (streakLine) return { mood: 'happy', celebrate: false, thought: `${streakLine.title} alive.` };
  return { mood: 'neutral', celebrate: false, thought: src.stage === 'new' ? "Hi, I'm Dub. Tap me." : 'Tap me for a chat.' };
}

export function buildBrief(src: BriefSources): { kind: 'morning' | 'evening' | 'day'; text: string } | null {
  const kind: 'morning' | 'evening' | 'day' = src.hour < 12 ? 'morning' : src.hour >= 18 ? 'evening' : 'day';
  const wp = weekPace(src.weights, ddmmToEpochDay(src.today));
  const plan = src.plan && src.plan.active ? src.plan : null;
  const steps = src.coaching?.advisableSteps ?? null;

  // The struggle line's title is our own "Let's rescue {name}" string (coach.ts);
  // strip that prefix back off to recover the bare habit name.
  const focusLine = src.report?.lines.find(l => l.icon === '🎯');
  const focusName = focusLine && focusLine.title.startsWith("Let's rescue ")
    ? focusLine.title.slice("Let's rescue ".length)
    : null;
  const streakLine = src.report?.lines.find(l => l.icon === '🔥');

  if (kind === 'morning') {
    const body: string[] = [];
    if (src.sleepLastNight != null) {
      const h = sleepFmt(src.sleepLastNight);
      let s = `You slept ${h} hours last night.`;
      if (src.sleepLastNight >= 7) s += " That's a strong base.";
      else if (src.sleepLastNight < 6.5) s += ' Short night, be kind to yourself today.';
      body.push(s);
    }
    if (wp?.latest != null && wp?.prev != null) {
      const delta = wp.latest - wp.prev;
      body.push(Math.abs(delta) < 0.05
        ? `The scale says ${weightFmt(wp.latest)} kg, level with your last weigh-in.`
        : `The scale says ${weightFmt(wp.latest)} kg, ${delta < 0 ? 'down' : 'up'} ${weightFmt(Math.abs(delta))} on your last weigh-in.`);
    }
    if (focusName) body.push(`Today's one job: ${focusName}. ${tipFor(focusName)}`);
    const kcal = plan?.currentTarget?.calories ?? null;
    if (steps != null && kcal != null) body.push(`Aim for about ${steps.toLocaleString()} steps and ${kcal.toLocaleString()} kcal.`);
    else if (steps != null) body.push(`Aim for about ${steps.toLocaleString()} steps.`);
    else if (kcal != null) body.push(`Keep eating to about ${kcal.toLocaleString()} kcal.`);

    if (body.length === 0) return null;
    // super: verdict-first, no greeting, capped. new: one warm next-step nudge.
    if (src.stage === 'super') return { kind, text: body.slice(0, 2).join(' ') };
    if (src.stage === 'new') body.push("You're just getting started, so keep it simple: tick one habit today.");
    return { kind, text: ['Morning.', ...body].join(' ') };
  }

  if (kind === 'evening') {
    const body: string[] = [];
    let net: number | null = null;
    // Needs the calorie target too: the self-report leg is an offset FROM the
    // target, so without one the net would read thousands of kcal off.
    if (plan?.tdee && plan.currentTarget && src.adherenceToday != null) {
      const range = estimateIntakeRange({
        maintenance: plan.tdee.blendedTDEE,
        stepBurn: 0,
        gymBurn: 0,
        weightDeltaKg: null,
        adherenceLevel: src.adherenceToday,
        targetCalories: plan.currentTarget.calories,
      });
      net = range ? Math.round((range.central - plan.tdee.blendedTDEE) / 10) * 10 : null;
    }
    if (net != null) {
      body.push(Math.abs(net) < 50
        ? 'You landed about level with what your body burns.'
        : `You landed about ${Math.abs(net)} kcal ${net < 0 ? 'under' : 'over'} what your body burns.`);
    }
    if (src.adherenceToday != null) {
      body.push(src.adherenceToday <= -1 ? 'You told me eating felt under target.'
        : src.adherenceToday === 0 ? 'You told me eating felt about right.'
        : 'You told me eating felt over target.');
    }
    if (src.habitsTotal > 0) {
      let s = `Habits: ${src.habitsDone} of ${src.habitsTotal} closed.`;
      const missed = src.habitsTotal - src.habitsDone;
      if (missed === 0) s += ' Clean sweep.';
      else if (missed === 1) s += ' One got away.';
      else if (missed >= 2) s += ' A few got away.';
      body.push(s);
    }

    if (body.length === 0) return null;
    const closing = focusName
      ? `Tomorrow's one thing: keep ${focusName} alive. Sleep well.`
      : "Tomorrow's one thing: weigh in before breakfast so I can keep your trend honest. Sleep well.";
    if (src.stage === 'super') return { kind, text: [...body.slice(0, 2), closing].join(' ') };
    return { kind, text: ['Day closed.', ...body, closing].join(' ') };
  }

  // kind === 'day'
  const body: string[] = [];
  if (src.habitsTotal > 0) body.push(`So far today: ${src.habitsDone} of ${src.habitsTotal} habits closed.`);
  if (steps != null) body.push(`There's daylight left. About ${steps.toLocaleString()} steps is the aim.`);
  if (body.length === 0) return null;
  if (streakLine) body.push(`Your ${streakLine.title} is alive. Protect it.`);
  if (src.stage === 'super') return { kind, text: body.slice(0, 2).join(' ') };
  if (src.stage === 'new') body.push('New here? Pick one habit and close it before tonight.');
  return { kind, text: body.join(' ') };
}
