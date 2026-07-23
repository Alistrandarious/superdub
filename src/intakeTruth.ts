// =====================================================================
// SUPERDUB — does what you say you ate match what the scale says?
//
// Superdub doesn't keep a food diary, on purpose (see APP_OVERVIEW): intake is
// ESTIMATED from weight trend + steps + training, and the evening "how did
// eating land?" answer is a confidence signal, not a measurement. That leaves
// one genuinely useful comparison nobody was making:
//
//   what you REPORTED eating  vs  what your weight says you ATE
//
// A persistent gap isn't a moral failing, it's a calibration error — the single
// most common reason a plan stalls while someone swears they're on target.
// Naming it kindly, with a number, is how the logging habit gets built.
//
// Pure math over data the app already has — see intakeTruth.check.ts.
// =====================================================================
import { ADHERENCE_OFFSET } from './energy';

export interface IntakeTruthInput {
  /** Per-day self-reports from the evening prompt. −2..+2 vs that day's target. */
  reports: { adherenceLevel: number; targetCalories: number }[];
  /** Energy-balance intake for the same window, from estimateIntakeKcal(). */
  estimatedIntake: number | null;
  /** Days the window spans — a fortnight of weigh-ins beats a long thin stretch. */
  spanDays: number;
}

export type IntakeVerdict = 'aligned' | 'under_reporting' | 'over_reporting';

export interface IntakeTruth {
  verdict: IntakeVerdict;
  reportedKcal: number;    // mean daily kcal their answers claim
  actualKcal: number;      // mean daily kcal the weight trend implies
  gapKcal: number;         // actual − reported (positive = eating more than they think)
  daysCounted: number;
  headline: string;
  detail: string;
}

/** Under this gap the two estimates agree well enough to call it aligned. Both
 *  sides are noisy (±350 is one rung of the self-report), so the threshold sits
 *  a little above one rung — we only speak when the gap is bigger than the
 *  resolution of the question we asked.
 *  ponytail: a flat threshold, not a confidence interval. Fine at these sample
 *  sizes; upgrade path is to widen it when the weigh-ins are sparse. */
const MEANINGFUL_GAP = 400;
/** Fewest self-reports worth drawing a conclusion from. */
const MIN_REPORTS = 8;
/** Fewest days the window must span for the weight trend to mean anything. */
const MIN_SPAN_DAYS = 10;

export function assessIntakeTruth(input: IntakeTruthInput): IntakeTruth | null {
  const { reports, estimatedIntake, spanDays } = input;
  // Only speak when there's enough of both signals. Same honesty bar as coach.ts.
  if (estimatedIntake == null || reports.length < MIN_REPORTS || spanDays < MIN_SPAN_DAYS) return null;

  const reportedKcal = Math.round(
    reports.reduce((sum, r) => sum + r.targetCalories + (ADHERENCE_OFFSET[r.adherenceLevel] ?? 0), 0) / reports.length,
  );
  const gapKcal = Math.round(estimatedIntake - reportedKcal);
  const verdict: IntakeVerdict =
    Math.abs(gapKcal) < MEANINGFUL_GAP ? 'aligned' : gapKcal > 0 ? 'under_reporting' : 'over_reporting';

  const perWeekKg = ((Math.abs(gapKcal) * 7) / 7700).toFixed(1);
  const kcal = (n: number) => Math.abs(n).toLocaleString();

  const copy: Record<IntakeVerdict, { headline: string; detail: string }> = {
    aligned: {
      headline: 'Your eating reports match the scale',
      detail: `Over ${reports.length} evenings your answers averaged ${kcal(reportedKcal)} kcal, and your weight trend says about ${kcal(estimatedIntake)}. That is close. You can trust your own read, which is the whole point of logging.`,
    },
    under_reporting: {
      headline: `About ${kcal(gapKcal)} kcal a day more than you think`,
      detail: `Your evening answers average ${kcal(reportedKcal)} kcal a day. Your weight trend says nearer ${kcal(estimatedIntake)}. That gap is roughly ${perWeekKg} kg a week of progress. This is normal and it is almost never willpower: it is the oil, the finishing of plates, the drinks. Log one meal a day for a week and the gap usually names itself.`,
    },
    over_reporting: {
      headline: `About ${kcal(gapKcal)} kcal a day less than you think`,
      detail: `Your evening answers average ${kcal(reportedKcal)} kcal a day, but your weight trend says nearer ${kcal(estimatedIntake)}. You are eating less than you are giving yourself credit for. Under-eating stalls progress as surely as over-eating does, so this is worth a look rather than a pat on the back.`,
    },
  };

  return { verdict, reportedKcal, actualKcal: Math.round(estimatedIntake), gapKcal, daysCounted: reports.length, ...copy[verdict] };
}
