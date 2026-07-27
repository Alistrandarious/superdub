// Pure trend + projection math for the Adaptive Weight Plan "journey" chart.
// Kept free of React/recharts so it stays unit-checkable under node
// (see PlanJourneyChart.check.ts). The α=0.25 EMA mirrors the server engine
// and the Progress chart (App.tsx) / WeightSparkline.
import { linearReg, localYMD, isoToDDMM, emaStep, sinceLastGap, bridgeGaps } from './weightMath';

const DAY = 86400000;

export interface JourneyGoal {
  goalType: 'lose' | 'gain' | 'maintain';
  startWeight: number;
  startDate: string;
  targetWeight: number;
  targetDate: string;
}

export interface JourneySeries {
  data: { label: string; ema: number | null; projection: number | null }[];
  nowLabel: string | null;
  nowValue: number | null;
  targetLabel: string;
  points: number;             // logged weigh-ins used
  weeklyRate: number | null;  // smoothed trend, kg/week (negative = losing)
}

// Parse a plan date (UTC ISO from the server) to LOCAL midnight. A naive
// new Date(iso) is 01:00 under BST, one day later than the chart's local-midnight
// timestamps, which drops the first day. Mirrors App.tsx:903.
export function localDayMs(iso: string): number {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return new Date(iso).getTime();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

export function buildJourneySeries(
  days: { day: string; weight: string }[],
  goal: JourneyGoal,
  now: Date = new Date(),
): JourneySeries {
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startMs = Math.min(localDayMs(goal.startDate), todayMs);
  const targetMs = Math.max(localDayMs(goal.targetDate), todayMs + DAY);

  // ponytail: weigh-ins are keyed by DD/MM only (no year), so a goal window that
  // crosses a year boundary could match a same-day weigh-in from the wrong year.
  // Matches WeightSparkline/App today; upgrade path = key tracker rows by full ISO.
  const weightByDDMM = new Map<string, number>();
  for (const d of days) {
    const w = parseFloat(d?.weight ?? '');
    if (w > 0) weightByDDMM.set(d.day, w);
  }

  const histLen = Math.max(1, Math.round((todayMs - startMs) / DAY) + 1);
  const regPts: { x: number; y: number }[] = [];
  const emaByIdx: Record<number, number> = {};
  let emaAcc: number | null = null;
  const labels: string[] = [];

  for (let i = 0; i < histLen; i++) {
    const date = new Date(startMs + i * DAY);
    const ddmm = isoToDDMM(localYMD(date));
    labels.push(ddmm);
    const w = weightByDDMM.get(ddmm);
    if (w != null && w > 0) {
      const prevIdx = regPts.length > 0 ? regPts[regPts.length - 1].x : i;
      regPts.push({ x: i, y: w });
      emaAcc = emaStep(emaAcc, w, i - prevIdx);
      emaByIdx[i] = +emaAcc.toFixed(2);
    }
  }

  bridgeGaps(emaByIdx, regPts.map(p => p.x));

  // Project from who you are now, not from an average of you and who you were
  // before the break.
  const reg = linearReg(sinceLastGap(regPts));
  const lastIdx = regPts.length > 0 ? regPts[regPts.length - 1].x : -1;
  const lastEMA = lastIdx >= 0 ? emaByIdx[lastIdx] : null;
  const nowLabel = lastIdx >= 0 ? labels[lastIdx] : null;

  const data: JourneySeries['data'] = labels.map((label, i) => ({
    label,
    ema: emaByIdx[i] != null ? emaByIdx[i] : null,
    projection: null as number | null,
  }));

  // Forward projection: extend the smoothed trend day by day to the target date.
  let targetLabel = isoToDDMM(localYMD(new Date(targetMs)));
  if (reg && lastEMA != null && lastIdx >= 0) {
    // Anchor the dashed line to the "now" EMA point so it joins the green line.
    data[lastIdx] = { ...data[lastIdx], projection: lastEMA };
    const futureLen = Math.max(1, Math.round((targetMs - todayMs) / DAY));
    for (let f = 1; f <= futureLen; f++) {
      const date = new Date(todayMs + f * DAY);
      const idx = histLen - 1 + f;
      const label = isoToDDMM(localYMD(date));
      const proj = +(lastEMA + reg.slope * (idx - lastIdx)).toFixed(1);
      data.push({ label, ema: null, projection: proj });
      targetLabel = label;
    }
  }

  return {
    data,
    nowLabel,
    nowValue: lastEMA,
    targetLabel,
    points: regPts.length,
    weeklyRate: reg ? +(reg.slope * 7).toFixed(2) : null,
  };
}
