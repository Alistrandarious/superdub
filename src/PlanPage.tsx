import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, PlanReplanProposal } from './api';
import ReplanCard from './ReplanCard';
import WeightInput from './WeightInput';
import PlanJourneyChart from './PlanJourneyChart';
import { useWeightUnit, formatWeightKg, unitLabel } from './weightUnit';

interface ActiveGoal {
  goalType: 'lose' | 'gain' | 'maintain';
  startWeight: number;
  startDate: string;
  targetWeight: number;
  targetDate: string;
  ratePctBw: number;
}

interface CurrentTarget {
  calories: number;
  reason: string;
  effectiveFrom: string;
}

interface HistoryEntry {
  id: string;
  calories: number;
  previousCalories: number | null;
  reason: string;
  effectiveFrom: string;
}

interface CycleData {
  onTrack: boolean | null;
  actualSlope: number | null;
  targetSlope: number;
  flaggedDays: string[];
  ran: boolean;
}

const ZONE_GENTLE     = 0.0035;
const ZONE_MODERATE   = 0.0070;
const ZONE_AGGRESSIVE = 0.0100;
const SLIDER_MAX_PCT  = 0.0200;

// Plain-language pace names (no jargon per SUPERDUB_VOICE.md).
function rateZone(pct: number): { label: string; color: string } {
  if (pct <= ZONE_GENTLE)     return { label: 'Gentle',    color: '#2FD27E' };
  if (pct <= ZONE_MODERATE)   return { label: 'Steady',    color: '#FFD233' };
  if (pct <= ZONE_AGGRESSIVE) return { label: 'Fast',      color: '#FF8A00' };
  return                             { label: 'Very fast', color: '#FF5470' };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shortDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function addWeeks(from: Date, weeks: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + Math.round(weeks * 7));
  return d;
}

// Plain rate string, e.g. "-0.45 kg/wk".
function fmtRate(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)} kg/wk`;
}

// Small feather-style icons (no emoji chrome, per DESIGN_SYSTEM.md).
const IconPencil = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const IconX = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const IconAlert = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
  </svg>
);

const PlanPage: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [activeGoal, setActiveGoal] = useState<ActiveGoal | null>(null);
  const [currentTarget, setCurrentTarget] = useState<CurrentTarget | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cycle, setCycle] = useState<CycleData | null>(null);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [trackerDays, setTrackerDays] = useState<any[]>([]);
  const [replan, setReplan] = useState<PlanReplanProposal | null>(null);
  const unit = useWeightUnit();

  // Form state
  const [targetWeight, setTargetWeight] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [abandoned, setAbandoned] = useState(false);

  // Start-date correction
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [startDateDraft, setStartDateDraft] = useState('');
  const [startDateSaving, setStartDateSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statusData, trackerData] = await Promise.all([
        api.getPlanStatus(),
        api.getTracker(),
      ]);

      if (statusData.active) {
        setActiveGoal(statusData.goal);
        setCurrentTarget(statusData.currentTarget);
        setHistory(statusData.history ?? []);
        setTargetWeight(String(statusData.goal.targetWeight));
        setTargetDate(statusData.goal.targetDate.slice(0, 10));
        setReplan(statusData.replan ?? null);
      } else {
        setActiveGoal(null);
        setCurrentTarget(null);
        setHistory([]);
        setTargetWeight('');
        setTargetDate('');
        setReplan(null);
      }

      // Keep the full day list for the journey chart, and find the latest weigh-in.
      const days: any[] = trackerData.days ?? [];
      setTrackerDays(days);
      let lw: number | null = null;
      for (let i = days.length - 1; i >= 0; i--) {
        const w = parseFloat(days[i].weight);
        if (w > 0) { lw = w; break; }
      }
      setLatestWeight(lw);

    } catch {
      setError('Could not load plan data, check your connection and try again.');
    } finally {
      setLoading(false);
    }

    // Run cycle separately — a failure here must never block the page from loading
    try {
      const c = await api.runPlanCycle();
      setCycle(c);
      if (c.ran && c.adjusted) {
        const fresh = await api.getPlanStatus();
        if (fresh.active) {
          setActiveGoal(fresh.goal);
          setCurrentTarget(fresh.currentTarget);
          setHistory(fresh.history ?? []);
        }
      }
    } catch {
      // cycle failure is non-fatal — page already visible with status data
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Write localStorage badge so BottomNav can show status without an extra API call
  useEffect(() => {
    if (loading) return;
    const badge = {
      active: !!activeGoal,
      calories: currentTarget?.calories ?? null,
      onTrack: cycle?.onTrack ?? null,
    };
    localStorage.setItem('superdub.plan.badge', JSON.stringify(badge));
    window.dispatchEvent(new Event('superdub:plan-badge-updated'));
  }, [loading, activeGoal, currentTarget, cycle]);

  const impliedRate = useMemo(() => {
    const tw = parseFloat(targetWeight);
    if (!tw || !targetDate || !latestWeight) return null;
    const dt = new Date(targetDate);
    if (isNaN(dt.getTime()) || dt <= new Date()) return null;
    const weeksLeft = (dt.getTime() - Date.now()) / (7 * 86400000);
    if (weeksLeft <= 0) return null;
    const pct = Math.abs(tw - latestWeight) / latestWeight / weeksLeft;
    const kgPerWk = Math.abs(tw - latestWeight) / weeksLeft;
    return { pct, kgPerWk };
  }, [targetWeight, targetDate, latestWeight]);

  const zone = impliedRate ? rateZone(impliedRate.pct) : null;
  const overWarning = impliedRate ? impliedRate.pct > ZONE_AGGRESSIVE : false;

  const sliderValue = impliedRate
    ? Math.min(impliedRate.pct / SLIDER_MAX_PCT, 1)
    : 0;

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tw = parseFloat(targetWeight);
    if (!tw || !latestWeight) return;
    const pct = parseFloat(e.target.value) * SLIDER_MAX_PCT;
    if (pct <= 0) return;
    const weeksNeeded = Math.abs(tw - latestWeight) / latestWeight / pct;
    setTargetDate(formatDate(addWeeks(new Date(), weeksNeeded)));
  };

  const handleSave = async () => {
    const tw = parseFloat(targetWeight);
    if (!tw || !targetDate) { setError('Enter a target weight and date'); return; }
    if (!latestWeight) { setError('No weigh-in found, log your weight first'); return; }
    setSaving(true);
    setError('');
    try {
      await api.createPlanGoal(tw, targetDate);
      await loadAll();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  const handleAbandon = async () => {
    setSaving(true);
    try {
      await api.abandonPlanGoal();
      setActiveGoal(null);
      setCurrentTarget(null);
      setHistory([]);
      setCycle(null);
      setAbandoned(true);
      localStorage.setItem('superdub.plan.badge', JSON.stringify({ active: false, calories: null, onTrack: null }));
      window.dispatchEvent(new Event('superdub:plan-badge-updated'));
    } catch {
      setError('Failed to end goal');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStartDate = async () => {
    if (!startDateDraft) return;
    setStartDateSaving(true);
    try {
      await api.patchPlanStartDate(startDateDraft);
      setActiveGoal(g => g ? { ...g, startDate: startDateDraft } : g);
      setEditingStartDate(false);
    } catch (err: any) {
      setError(err?.message ?? 'Could not update start date');
    } finally {
      setStartDateSaving(false);
    }
  };

  const minDate = formatDate(addWeeks(new Date(), 1));
  const onTrack = cycle?.onTrack ?? null;
  const hasGoal = !!(activeGoal && !abandoned && currentTarget);
  const changes = history.filter(h => h.previousCalories != null);

  const weeksLeft = activeGoal
    ? Math.max(0, Math.round((new Date(activeGoal.targetDate).getTime() - Date.now()) / (7 * 86400000)))
    : 0;

  // Plain one-line read of where you stand.
  const oneLiner = (() => {
    if (!activeGoal) return '';
    const by = shortDate(activeGoal.targetDate);
    if (onTrack === null) return 'Superdub is still reading your weight trend. Keep logging and this updates on its own.';
    if (onTrack) return `You're on pace to reach ${formatWeightKg(activeGoal.targetWeight, unit)} by ${by}. Keep it up.`;
    return `You're off pace right now, so Superdub nudged your daily target to bring you back on time for ${by}.`;
  })();

  // The set / adjust form, shared by the empty state and the "Adjust goal" panel.
  const goalForm = (
    <div className="plan-form">
      <div className="goal-field">
        <span className="goal-field-label">Current weight</span>
        <span className="goal-field-readonly">
          {latestWeight != null ? formatWeightKg(latestWeight, unit) : 'No weigh-in yet'}
        </span>
      </div>

      <div className="goal-field">
        <label className="goal-field-label" htmlFor="pp-target-weight">Target weight ({unitLabel(unit)})</label>
        <WeightInput
          id="pp-target-weight"
          valueKg={targetWeight}
          onChangeKg={setTargetWeight}
          unit={unit}
          inputClassName="goal-input"
          ariaLabel="Target weight"
        />
      </div>

      <div className="goal-field">
        <label className="goal-field-label" htmlFor="pp-target-date">Target date</label>
        <input
          id="pp-target-date"
          className="goal-input"
          type="date"
          min={minDate}
          value={targetDate}
          onChange={e => setTargetDate(e.target.value)}
        />
      </div>

      {impliedRate && (
        <div className="goal-rate-section">
          <div className="goal-rate-row">
            <span className="goal-rate-label">How fast</span>
            <span className="goal-rate-value" style={{ color: zone?.color }}>
              about {impliedRate.kgPerWk.toFixed(2)} kg a week
            </span>
          </div>

          <div className="goal-slider-wrap">
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={sliderValue}
              onChange={handleSlider}
              className="goal-slider"
              aria-label="How fast to reach your goal"
              disabled={!targetWeight || !latestWeight}
            />
            <div className="goal-slider-track">
              <div className="goal-slider-zone zone-gentle" />
              <div className="goal-slider-zone zone-moderate" />
              <div className="goal-slider-zone zone-aggressive" />
              <div className="goal-slider-zone zone-warn" />
            </div>
            <div className="goal-slider-labels">
              <span>Gentle</span>
              <span>Steady</span>
              <span>Fast</span>
              <span className="goal-slider-warnicon"><IconAlert /></span>
            </div>
          </div>

          <div className="goal-zone-badge" style={{ background: (zone?.color ?? '') + '20', borderColor: (zone?.color ?? '') + '50', color: zone?.color }}>
            {zone?.label}{overWarning && ', try a longer timeline'}
          </div>

          {overWarning && (
            <div className="goal-warning">
              That's a fast pace. Losing weight this quickly means more of what comes off can be muscle instead of fat. A longer timeline is gentler on your body. You can still set this.
            </div>
          )}
        </div>
      )}

      {error && <div className="goal-error">{error}</div>}

      <div className="goal-actions">
        {hasGoal && (
          <button className="goal-btn-abandon" onClick={handleAbandon} disabled={saving}>
            End goal
          </button>
        )}
        <button
          className="goal-btn-save"
          onClick={handleSave}
          disabled={saving || !targetWeight || !targetDate || !latestWeight}
        >
          {saving ? 'Saving…' : hasGoal ? 'Update goal' : 'Set goal'}
        </button>
      </div>

      {hasGoal && activeGoal && (
        <div className="plan-start-date-row">
          <span className="plan-start-date-label">Plan started</span>
          {editingStartDate ? (
            <span className="plan-start-date-edit">
              <input
                type="date"
                className="plan-start-date-input"
                value={startDateDraft}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => setStartDateDraft(e.target.value)}
              />
              <button className="plan-start-date-save" onClick={handleSaveStartDate} disabled={startDateSaving}>
                {startDateSaving ? '…' : 'Save'}
              </button>
              <button className="plan-start-date-cancel" onClick={() => setEditingStartDate(false)} aria-label="Cancel"><IconX /></button>
            </span>
          ) : (
            <button className="plan-start-date-value" onClick={() => { setStartDateDraft(activeGoal.startDate.slice(0, 10)); setEditingStartDate(true); }}>
              {shortDate(activeGoal.startDate)} <IconPencil />
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="plan-page">
      <div className="plan-page-header">
        <button className="plan-page-back" onClick={() => navigate(-1)} aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="plan-page-title">Adaptive Weight Plan</span>
      </div>

      {loading ? (
        <div className="plan-page-loading">Loading…</div>
      ) : hasGoal && activeGoal && currentTarget ? (
        <div className="plan-page-body">

          {/* ── The plan you're on has stopped being true ── */}
          {replan && (
            <ReplanCard
              replan={replan}
              targetWeightKg={activeGoal.targetWeight}
              onAccepted={loadAll}
              onSkip={() => setReplan(null)}
              onError={setError}
            />
          )}

          {/* ── Hero: the journey chart, calorie target, and pace ── */}
          <div className={`plan-hero ${onTrack === false ? 'plan-hero-off' : 'plan-hero-on'}`}>
            <div className="plan-hero-top">
              <div className="plan-hero-cal">
                <span className="plan-hero-num">{currentTarget.calories.toLocaleString()}</span>
                <span className="plan-hero-unit">calories a day</span>
              </div>
              <span className={`plan-hero-pill ${onTrack === false ? 'pill-off' : 'pill-on'}`}>
                <span className="plan-hero-pill-dot" />
                {onTrack === null ? 'calculating' : onTrack ? 'on pace' : 'off pace'}
              </span>
            </div>

            <PlanJourneyChart days={trackerDays} goal={activeGoal} />

            <div className="plan-hero-axis">
              <span>{formatWeightKg(activeGoal.startWeight, unit)} · {shortDate(activeGoal.startDate)}</span>
              {latestWeight != null && <span className="plan-hero-axis-now">{formatWeightKg(latestWeight, unit)} now</span>}
              <span>{formatWeightKg(activeGoal.targetWeight, unit)} · {shortDate(activeGoal.targetDate)}</span>
            </div>
          </div>

          {/* ── At a glance: your trend vs the target pace ── */}
          <div className="plan-stats">
            <div className="plan-stat">
              <span className="plan-stat-val" style={{ color: onTrack === false ? '#FF5470' : '#2FD27E' }}>{fmtRate(cycle?.actualSlope)}</span>
              <span className="plan-stat-key">Your trend</span>
            </div>
            <div className="plan-stat">
              <span className="plan-stat-val">{fmtRate(cycle?.targetSlope)}</span>
              <span className="plan-stat-key">Target pace</span>
            </div>
            <div className="plan-stat">
              <span className="plan-stat-val">{weeksLeft}<span className="plan-stat-unit"> wks</span></span>
              <span className="plan-stat-key">To go</span>
            </div>
          </div>

          <p className="plan-line">{oneLiner}</p>

          {cycle?.flaggedDays && cycle.flaggedDays.length > 0 && (
            <p className="plan-flagged-note">
              {cycle.flaggedDays.length} weigh-in{cycle.flaggedDays.length > 1 ? 's' : ''} looked like an outlier and counted for less ({cycle.flaggedDays.join(', ')}).
            </p>
          )}

          {/* ── Adjust goal (collapsed) ── */}
          <details className="plan-collapse">
            <summary className="plan-collapse-summary">Adjust goal</summary>
            <div className="plan-collapse-body">{goalForm}</div>
          </details>

          {/* ── How this works (collapsed) ── */}
          <details className="plan-collapse">
            <summary className="plan-collapse-summary">How this works</summary>
            <div className="plan-collapse-body plan-explainer-body">
              <p>Each week Superdub looks at your real weight trend, smoothed so a single heavy or light day doesn't throw it off, and compares it to the pace you need to hit your goal on time.</p>
              <p>If you're off pace, it moves your daily calorie target up or down by how far off you are. It never drops below what your body needs at rest, so the target stays safe for your size.</p>
              <p>You don't need to log food for this to work. Your weight trend already shows the result.</p>
            </div>
          </details>

          {/* ── Adjustment history (collapsed) ── */}
          {changes.length > 0 && (
            <details className="plan-collapse">
              <summary className="plan-collapse-summary">Adjustments <span className="plan-collapse-count">{changes.length}</span></summary>
              <div className="plan-collapse-body">
                {changes.map(h => (
                  <div className="plan-history-row" key={h.id}>
                    <span className="plan-history-cal">{h.previousCalories} → {h.calories} kcal</span>
                    <span className="plan-history-date">{shortDate(h.effectiveFrom)}</span>
                    <span className="plan-history-reason">{h.reason}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

        </div>
      ) : (
        <div className="plan-page-body">
          <div className="plan-empty-intro">
            <div className="plan-empty-title">Set a weight goal</div>
            <p>Pick a target weight and date. Superdub works out how much to eat each day and quietly adjusts it as your weight moves, so you stay on pace without counting every meal.</p>
          </div>
          {goalForm}
        </div>
      )}
    </div>
  );
};

export default PlanPage;
