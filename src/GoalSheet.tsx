import React, { useState, useEffect, useMemo } from 'react';
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

interface GoalSheetProps {
  open: boolean;
  onClose: () => void;
  latestWeight: number | null; // from tracker, read-only
  onGoalSaved: () => void;
}

// Risk zone thresholds as % body weight per week
const ZONE_GENTLE    = 0.0035;  // 0–0.35%
const ZONE_MODERATE  = 0.0070;  // 0.35–0.70%
const ZONE_AGGRESSIVE = 0.0100; // 0.70–1.00%
// > 1.00% = warning zone

const SLIDER_MAX_PCT = 0.0200; // 2% max on slider

function rateZone(pct: number): { label: string; color: string } {
  if (pct <= ZONE_GENTLE)    return { label: 'Gentle',           color: '#2FD27E' };
  if (pct <= ZONE_MODERATE)  return { label: 'Moderate',         color: '#FFD233' };
  if (pct <= ZONE_AGGRESSIVE) return { label: 'Aggressive',      color: '#FF8A00' };
  return                              { label: 'Not recommended', color: '#FF5470' };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addWeeks(from: Date, weeks: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + Math.round(weeks * 7));
  return d;
}

const GoalSheet: React.FC<GoalSheetProps> = ({ open, onClose, latestWeight, onGoalSaved }) => {
  const [activeGoal, setActiveGoal] = useState<ActiveGoal | null>(null);
  const [currentTarget, setCurrentTarget] = useState<CurrentTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [abandoned, setAbandoned] = useState(false);

  // Form state
  const [targetWeight, setTargetWeight] = useState('');
  const [targetDate, setTargetDate] = useState('');

  // Load current plan status on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    setAbandoned(false);
    api.getPlanStatus()
      .then((d: any) => {
        if (d.active) {
          setActiveGoal(d.goal);
          setCurrentTarget(d.currentTarget);
          // Pre-fill form from active goal
          setTargetWeight(String(d.goal.targetWeight));
          setTargetDate(d.goal.targetDate.slice(0, 10));
        } else {
          setActiveGoal(null);
          setCurrentTarget(null);
          setTargetWeight('');
          setTargetDate('');
        }
      })
      .catch(() => setError('Failed to load plan'))
      .finally(() => setLoading(false));
  }, [open]);

  const currentWeight = latestWeight;

  // ── Derived rate from target weight + date ─────────────────────────────────
  const impliedRate = useMemo(() => {
    const tw = parseFloat(targetWeight);
    if (!tw || !targetDate || !currentWeight) return null;
    const dt = new Date(targetDate);
    if (isNaN(dt.getTime()) || dt <= new Date()) return null;
    const weeksLeft = (dt.getTime() - Date.now()) / (7 * 86400000);
    if (weeksLeft <= 0) return null;
    const pct = Math.abs(tw - currentWeight) / currentWeight / weeksLeft;
    const kgPerWk = Math.abs(tw - currentWeight) / weeksLeft;
    return { pct, kgPerWk };
  }, [targetWeight, targetDate, currentWeight]);

  const zone = impliedRate ? rateZone(impliedRate.pct) : null;
  const overWarning = impliedRate ? impliedRate.pct > ZONE_AGGRESSIVE : false;

  // ── Slider drives target date (keeping target weight fixed) ────────────────
  const sliderValue = impliedRate
    ? Math.min(impliedRate.pct / SLIDER_MAX_PCT, 1)
    : 0;

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tw = parseFloat(targetWeight);
    if (!tw || !currentWeight) return;
    const pct = parseFloat(e.target.value) * SLIDER_MAX_PCT;
    if (pct <= 0) return;
    const weeksNeeded = Math.abs(tw - currentWeight) / currentWeight / pct;
    const newDate = addWeeks(new Date(), weeksNeeded);
    setTargetDate(formatDate(newDate));
  };

  const handleSave = async () => {
    const tw = parseFloat(targetWeight);
    if (!tw || !targetDate) { setError('Enter a target weight and date'); return; }
    if (!currentWeight) { setError('No weigh-in found — log your weight first'); return; }
    setSaving(true);
    setError('');
    try {
      await api.createPlanGoal(tw, targetDate);
      onGoalSaved();
      onClose();
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
      setAbandoned(true);
      onGoalSaved();
    } catch {
      setError('Failed to abandon goal');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const todayStr = formatDate(new Date());
  // Minimum target date: 1 week from today
  const minDate = formatDate(addWeeks(new Date(), 1));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal goal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Weight Goal</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="goal-sheet-loading">Loading…</div>
        ) : (
          <div className="goal-sheet-body">

            {/* ── Current weight (read-only from tracker) ── */}
            <div className="goal-field">
              <span className="goal-field-label">Current weight</span>
              <span className="goal-field-readonly">
                {currentWeight != null ? `${currentWeight} kg` : '— no weigh-in yet'}
              </span>
            </div>

            {/* ── Target weight ── */}
            <div className="goal-field">
              <label className="goal-field-label" htmlFor="gs-target-weight">Target weight (kg)</label>
              <input
                id="gs-target-weight"
                className="goal-input"
                type="text"
                inputMode="decimal"
                value={targetWeight}
                onChange={e => { if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) setTargetWeight(e.target.value); }}
                placeholder={currentWeight != null ? `e.g. ${(currentWeight - 5).toFixed(1)}` : 'e.g. 80'}
              />
            </div>

            {/* ── Target date ── */}
            <div className="goal-field">
              <label className="goal-field-label" htmlFor="gs-target-date">Target date</label>
              <input
                id="gs-target-date"
                className="goal-input"
                type="date"
                min={minDate}
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
              />
            </div>

            {/* ── Implied rate ── */}
            {impliedRate && (
              <div className="goal-rate-section">
                <div className="goal-rate-row">
                  <span className="goal-rate-label">Implied rate</span>
                  <span className="goal-rate-value" style={{ color: zone?.color }}>
                    {impliedRate.kgPerWk.toFixed(2)} kg/wk
                    <span className="goal-rate-pct">({(impliedRate.pct * 100).toFixed(2)}% BW/wk)</span>
                  </span>
                </div>

                {/* ── Risk zone slider (visual + interactive) ── */}
                <div className="goal-slider-wrap">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.001}
                    value={sliderValue}
                    onChange={handleSlider}
                    className="goal-slider"
                    disabled={!targetWeight || !currentWeight}
                  />
                  <div className="goal-slider-track">
                    <div className="goal-slider-zone zone-gentle"   title="Gentle (0–0.35%)" />
                    <div className="goal-slider-zone zone-moderate" title="Moderate (0.35–0.7%)" />
                    <div className="goal-slider-zone zone-aggressive" title="Aggressive (0.7–1%)" />
                    <div className="goal-slider-zone zone-warn"     title="Not recommended (>1%)" />
                  </div>
                  <div className="goal-slider-labels">
                    <span>Gentle</span>
                    <span>Moderate</span>
                    <span>Aggressive</span>
                    <span>⚠</span>
                  </div>
                </div>

                {/* ── Zone badge ── */}
                <div className="goal-zone-badge" style={{ background: zone?.color + '20', borderColor: zone?.color + '50', color: zone?.color }}>
                  {zone?.label}
                  {overWarning && ' — consider a longer timeline'}
                </div>

                {/* ── Warning ── */}
                {overWarning && (
                  <div className="goal-warning">
                    This implies {impliedRate.kgPerWk.toFixed(2)} kg/week — above 1% of your body weight per week,
                    where research suggests a higher proportion of weight lost comes from lean mass rather than fat.
                    You can still proceed, but a longer timeline is generally safer.
                  </div>
                )}
              </div>
            )}

            {/* ── Active goal summary ── */}
            {activeGoal && !abandoned && (
              <div className="goal-active-card">
                <div className="goal-active-label">Active goal</div>
                <div className="goal-active-row">
                  <span>{activeGoal.goalType === 'lose' ? '↓' : activeGoal.goalType === 'gain' ? '↑' : '~'}</span>
                  <span>{activeGoal.startWeight} → {activeGoal.targetWeight} kg</span>
                  <span className="goal-active-date">by {new Date(activeGoal.targetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                {currentTarget && (
                  <div className="goal-active-cal">
                    Prescribed: <strong>{currentTarget.calories} kcal/day</strong>
                  </div>
                )}
              </div>
            )}

            {error && <div className="goal-error">{error}</div>}

            {/* ── Actions ── */}
            <div className="goal-actions">
              {activeGoal && !abandoned && (
                <button className="goal-btn-abandon" onClick={handleAbandon} disabled={saving}>
                  Abandon goal
                </button>
              )}
              <button
                className="goal-btn-save"
                onClick={handleSave}
                disabled={saving || !targetWeight || !targetDate || !currentWeight}
              >
                {saving ? 'Saving…' : activeGoal ? 'Update goal' : 'Set goal'}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default GoalSheet;
