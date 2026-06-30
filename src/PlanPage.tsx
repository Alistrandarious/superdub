import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api';

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
  onTrack: boolean;
  actualSlope: number | null;
  targetSlope: number;
  flaggedDays: string[];
  ran: boolean;
}

const ZONE_GENTLE    = 0.0035;
const ZONE_MODERATE  = 0.0070;
const ZONE_AGGRESSIVE = 0.0100;
const SLIDER_MAX_PCT = 0.0200;

function rateZone(pct: number): { label: string; color: string } {
  if (pct <= ZONE_GENTLE)     return { label: 'Gentle',           color: '#2FD27E' };
  if (pct <= ZONE_MODERATE)   return { label: 'Moderate',         color: '#FFD233' };
  if (pct <= ZONE_AGGRESSIVE) return { label: 'Aggressive',       color: '#FF8A00' };
  return                               { label: 'Not recommended', color: '#FF5470' };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addWeeks(from: Date, weeks: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + Math.round(weeks * 7));
  return d;
}

function fmtSlope(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)} kg/wk`;
}

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
      } else {
        setActiveGoal(null);
        setCurrentTarget(null);
        setHistory([]);
        setTargetWeight('');
        setTargetDate('');
      }

      // Find latest logged weight from tracker
      const days: any[] = trackerData.days ?? [];
      let lw: number | null = null;
      for (let i = days.length - 1; i >= 0; i--) {
        const w = parseFloat(days[i].weight);
        if (w > 0) { lw = w; break; }
      }
      setLatestWeight(lw);

    } catch {
      setError('Could not load plan data — check your connection and try again.');
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
    if (!latestWeight) { setError('No weigh-in found — log your weight first'); return; }
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
      setError('Failed to abandon goal');
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

  return (
    <div className="plan-page">
      <div className="plan-page-header">
        <button className="plan-page-back" onClick={() => navigate(-1)} aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="plan-page-title">Weight Goal</span>
      </div>

      {loading ? (
        <div className="plan-page-loading">Loading…</div>
      ) : (
        <div className="plan-page-body">

          {/* ── Status card (if active goal) ── */}
          {activeGoal && !abandoned && currentTarget && (
            <div className={`plan-status-card ${onTrack === false ? 'plan-status-off' : 'plan-status-on'}`}>
              <div className="plan-status-top">
                <div className="plan-status-cal">
                  <span className="plan-status-cal-num">{currentTarget.calories}</span>
                  <span className="plan-status-cal-unit">kcal/day</span>
                </div>
                <div className={`plan-status-badge ${onTrack === false ? 'badge-off' : 'badge-on'}`}>
                  {onTrack === null ? 'calculating' : onTrack ? 'on pace' : 'off pace'}
                </div>
              </div>

              <div className="plan-status-goal-row">
                <span className="plan-status-arrow">
                  {activeGoal.goalType === 'lose' ? '↓' : activeGoal.goalType === 'gain' ? '↑' : '→'}
                </span>
                <span className="plan-status-weights">{activeGoal.startWeight} → {activeGoal.targetWeight} kg</span>
                <span className="plan-status-date">by {new Date(activeGoal.targetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>

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
                    <button className="plan-start-date-cancel" onClick={() => setEditingStartDate(false)}>✕</button>
                  </span>
                ) : (
                  <span className="plan-start-date-value" onClick={() => { setStartDateDraft(activeGoal.startDate.slice(0, 10)); setEditingStartDate(true); }}>
                    {new Date(activeGoal.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} ✎
                  </span>
                )}
              </div>

              {cycle && cycle.actualSlope != null && (
                <div className="plan-status-slopes">
                  <span className="plan-status-slope-item">
                    <span className="plan-status-slope-label">Trend</span>
                    <span className="plan-status-slope-val" style={{ color: onTrack === false ? '#FF5470' : '#2FD27E' }}>
                      {fmtSlope(cycle.actualSlope)}
                    </span>
                  </span>
                  <span className="plan-status-slope-sep">·</span>
                  <span className="plan-status-slope-item">
                    <span className="plan-status-slope-label">Target</span>
                    <span className="plan-status-slope-val">{fmtSlope(cycle.targetSlope)}</span>
                  </span>
                  <span className="plan-status-slope-sep">·</span>
                  <span className="plan-status-slope-item">
                    <span className="plan-status-slope-label">Weeks left</span>
                    <span className="plan-status-slope-val">
                      {Math.max(0, Math.round((new Date(activeGoal.targetDate).getTime() - Date.now()) / (7 * 86400000)))}
                    </span>
                  </span>
                </div>
              )}

              <div className="plan-status-reason">{currentTarget.reason}</div>

              {cycle?.flaggedDays && cycle.flaggedDays.length > 0 && (
                <div className="plan-status-flagged">
                  {cycle.flaggedDays.length} weigh-in{cycle.flaggedDays.length > 1 ? 's' : ''} flagged as outliers ({cycle.flaggedDays.join(', ')}) — included with reduced EMA weight.
                </div>
              )}
            </div>
          )}

          {/* ── How the engine works ── */}
          {activeGoal && !abandoned && (
            <details className="plan-explainer">
              <summary className="plan-explainer-summary">How does this work?</summary>
              <div className="plan-explainer-body">
                <p>Every week, the engine looks at your actual weight trend (using an exponential moving average to filter noise) and compares it to the rate you need to hit your goal on time.</p>
                <p>If you're off pace, it adjusts your prescribed calories up or down — proportionally to how far off you are, capped at 40% of your weekly caloric budget. The minimum floor is your calculated BMR, so it will never prescribe a deficit unsafe for your body size.</p>
                <p>You don't need to log food for this to work. Weight trend is the observable output of your energy balance — whatever the cause.</p>
              </div>
            </details>
          )}

          {/* ── Adjustment history ── */}
          {history.filter(h => h.previousCalories != null).length > 0 && (
            <div className="plan-history">
              <div className="plan-history-title">Adjustments</div>
              {history.filter(h => h.previousCalories != null).map(h => (
                <div className="plan-history-row" key={h.id}>
                  <span className="plan-history-cal">
                    {h.previousCalories} → {h.calories} kcal
                  </span>
                  <span className="plan-history-date">
                    {new Date(h.effectiveFrom).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="plan-history-reason">{h.reason}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Set / update goal form ── */}
          <div className="plan-form-section">
            <div className="plan-form-title">{activeGoal && !abandoned ? 'Update goal' : 'Set a goal'}</div>

            <div className="goal-field">
              <span className="goal-field-label">Current weight</span>
              <span className="goal-field-readonly">
                {latestWeight != null ? `${latestWeight} kg` : '— no weigh-in yet'}
              </span>
            </div>

            <div className="goal-field">
              <label className="goal-field-label" htmlFor="pp-target-weight">Target weight (kg)</label>
              <input
                id="pp-target-weight"
                className="goal-input"
                type="text"
                inputMode="decimal"
                value={targetWeight}
                onChange={e => { if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) setTargetWeight(e.target.value); }}
                placeholder={latestWeight != null ? `e.g. ${(latestWeight - 5).toFixed(1)}` : 'e.g. 80'}
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
                  <span className="goal-rate-label">Implied rate</span>
                  <span className="goal-rate-value" style={{ color: zone?.color }}>
                    {impliedRate.kgPerWk.toFixed(2)} kg/wk
                    <span className="goal-rate-pct">({(impliedRate.pct * 100).toFixed(2)}% BW/wk)</span>
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
                    disabled={!targetWeight || !latestWeight}
                  />
                  <div className="goal-slider-track">
                    <div className="goal-slider-zone zone-gentle"    title="Gentle (0–0.35%)" />
                    <div className="goal-slider-zone zone-moderate"  title="Moderate (0.35–0.7%)" />
                    <div className="goal-slider-zone zone-aggressive" title="Aggressive (0.7–1%)" />
                    <div className="goal-slider-zone zone-warn"      title="Not recommended (>1%)" />
                  </div>
                  <div className="goal-slider-labels">
                    <span>Gentle</span>
                    <span>Moderate</span>
                    <span>Aggressive</span>
                    <span>⚠</span>
                  </div>
                </div>

                <div className="goal-zone-badge" style={{ background: zone?.color + '20', borderColor: zone?.color + '50', color: zone?.color }}>
                  {zone?.label}{overWarning && ' — consider a longer timeline'}
                </div>

                {overWarning && (
                  <div className="goal-warning">
                    This implies {impliedRate.kgPerWk.toFixed(2)} kg/week — above 1% of your body weight per week,
                    where research suggests a higher proportion of weight lost comes from lean mass rather than fat.
                    You can still proceed, but a longer timeline is generally safer.
                  </div>
                )}
              </div>
            )}

            {error && <div className="goal-error">{error}</div>}

            <div className="goal-actions">
              {activeGoal && !abandoned && (
                <button className="goal-btn-abandon" onClick={handleAbandon} disabled={saving}>
                  Abandon goal
                </button>
              )}
              <button
                className="goal-btn-save"
                onClick={handleSave}
                disabled={saving || !targetWeight || !targetDate || !latestWeight}
              >
                {saving ? 'Saving…' : activeGoal && !abandoned ? 'Update goal' : 'Set goal'}
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default PlanPage;
