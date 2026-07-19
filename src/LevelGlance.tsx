import React, { useEffect, useState } from 'react';
import { api } from './api';
import { computeGlance, GlanceModel } from './glanceModel';
import { getLoggingDay, loggingNow } from './day';
import { getWeightUnit, kgToUnitValue, unitLabel } from './weightUnit';

// The single-page "at a glance" snapshot on the level-up screen: streak, step goal,
// this-week weight vs goal, and the habits you've starred as priorities. Each section
// hides itself when there's no data (computeGlance returns null/[]).

const kFmt = (n: number): string =>
  n >= 1000 ? `${(Math.round(n / 100) / 10).toString().replace(/\.0$/, '')}k` : String(n);

const clampPct = (n: number): number => Math.max(0, Math.min(100, Math.round(n * 100)));

const LevelGlance: React.FC = () => {
  const [model, setModel] = useState<GlanceModel | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.getTracker(),
      api.getHabits(),
      api.getProfile().catch(() => ({} as any)),
      api.getWeightSettings().catch(() => ({} as any)),
    ])
      .then(([tracker, habits, profile, ws]) => {
        if (!alive) return;
        const goalKg = parseFloat((ws as any).goalWeight ?? '') || null;
        setModel(computeGlance({
          streak: parseInt(localStorage.getItem('superdub.dayStreak') || '0', 10) || 0,
          today: getLoggingDay(),
          year: tracker.year ?? loggingNow().getFullYear(),
          days: tracker.days,
          habitStates: tracker.habits,
          habits,
          stepTarget: parseInt((profile as any).stepTarget, 10) || 0,
          goalKg,
        }));
      })
      .catch(() => { /* leave the card celebration-only if data can't load */ });
    return () => { alive = false; };
  }, []);

  if (!model) return null;
  const { streak, steps, weight, starred } = model;
  if (streak == null && !steps && !weight && starred.length === 0) return null;

  const unit = getWeightUnit();

  return (
    <div className="lvlg">
      {(streak != null || steps) && (
        <div className="lvlg-row2">
          {streak != null && (
            <div className="lvlg-tile flame">
              <span className="lvlg-k">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M12 1C12 1 7 8 7 13a5 5 0 0 0 10 0c0-5-5-12-5-12z" /></svg>
                streak
              </span>
              <span className="lvlg-v">{streak}<small>days</small></span>
            </div>
          )}
          {steps && (
            <div className="lvlg-tile step">
              <span className="lvlg-k">step goal</span>
              <span className="lvlg-v">{kFmt(steps.today)}<small>/ {kFmt(steps.target)}</small></span>
              <span className="lvlg-bar"><i style={{ width: `${clampPct(steps.today / steps.target)}%` }} /></span>
            </div>
          )}
        </div>
      )}

      {weight && (() => {
        const dispDelta = weight.weekDeltaKg == null ? null : -weight.weekDeltaKg; // <0 = lost
        const good = dispDelta != null && ((weight.goalType === 'lose' && dispDelta < 0) || (weight.goalType === 'gain' && dispDelta > 0));
        const toGoalKg = weight.goalKg != null ? Math.abs(weight.currentKg - weight.goalKg) : null;
        return (
          <div className="lvlg-wcard">
            <span className="lvlg-k">weight · this week</span>
            {dispDelta != null ? (
              <span className={`lvlg-wval${good ? ' good' : dispDelta === 0 ? '' : ' bad'}`}>
                {dispDelta > 0 ? '+' : dispDelta < 0 ? '−' : ''}
                {(Math.round(kgToUnitValue(Math.abs(dispDelta), unit) * 10) / 10)} {unitLabel(unit)}
              </span>
            ) : (
              <span className="lvlg-wval">{(Math.round(kgToUnitValue(weight.currentKg, unit) * 10) / 10)} {unitLabel(unit)}</span>
            )}
            {toGoalKg != null && (
              <span className="lvlg-wto">{(Math.round(kgToUnitValue(toGoalKg, unit) * 10) / 10)} {unitLabel(unit)} to goal</span>
            )}
          </div>
        );
      })()}

      {starred.length > 0 && (
        <div className="lvlg-targets">
          <span className="lvlg-k">priority habits</span>
          {starred.map(h => (
            <div className="lvlg-tr" key={h.name}>
              <span className={`lvlg-dot${h.done ? ' done' : ''}`} aria-hidden="true" />
              <span className="lvlg-nm">{h.name}</span>
              <span className={`lvlg-st${h.done ? ' done' : ''}`}>{h.done ? 'done' : 'open'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LevelGlance;
