import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';
import { api } from './api';
import { getNutritionHour } from './push';

// ── Nutrition prompt (#4) — the evening "Eating Today vs Target" ring from the
// spec. Time-locked: auto-appears once you're past your nutrition hour (default
// 8 PM) if you haven't logged food, and its push deep-links here (?prompt=
// nutrition). "Log Quick Calories" jumps to the food logger.

const NUT_KEY = 'superdub.nutrition.checkin'; // YYYY-MM-DD once dismissed
const todayISO = () => new Date().toISOString().slice(0, 10);

const NutritionPrompt: React.FC = () => {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [target, setTarget] = useState(0);
  const [eaten, setEaten] = useState(0);

  const load = useCallback(async () => {
    const [t, logs] = await Promise.all([
      api.getDietTarget().catch(() => ({ calories: 0 } as any)),
      api.getFoodLogsToday().catch(() => [] as any[]),
    ]);
    setTarget(Number(t?.calories) || 0);
    const total = Array.isArray(logs)
      ? logs.reduce((s: number, r: any) => s + (Number(r?.totals?.kcal) || 0), 0)
      : 0;
    setEaten(Math.round(total));
    return total;
  }, []);

  useEffect(() => {
    const open = () => { load(); setShow(true); };
    window.addEventListener('superdub:show-nutrition', open);
    // Time-lock: past the nutrition hour, once/day, only if nothing logged yet.
    let t: ReturnType<typeof setTimeout> | undefined;
    if (localStorage.getItem(NUT_KEY) !== todayISO() && new Date().getHours() >= getNutritionHour()) {
      t = setTimeout(() => { load().then(total => { if (total === 0) setShow(true); }); }, 1500);
    }
    return () => { window.removeEventListener('superdub:show-nutrition', open); if (t) clearTimeout(t); };
  }, [load]);

  const dismiss = () => { localStorage.setItem(NUT_KEY, todayISO()); setShow(false); };
  const goLog = () => { dismiss(); navigate('/food-log'); };

  if (!show) return null;

  const pct = target > 0 ? eaten / target : 0;
  const over = target > 0 && eaten > target;
  const remaining = target - eaten;
  const R = 52, C = 2 * Math.PI * R;
  const dash = Math.max(0, Math.min(1, pct)) * C;

  return (
    <div className="checkin-overlay">
      <div className="checkin-modal nutrition-modal">
        <h2 className="checkin-title">Eating today</h2>
        <p className="checkin-subtitle">How today's landing against your target.</p>

        <div className="nut-ring-wrap">
          <svg viewBox="0 0 120 120" className="nut-ring">
            <defs>
              <linearGradient id="nut-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFD233" /><stop offset="100%" stopColor="#FF8A00" /></linearGradient>
              <linearGradient id="nut-violet" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#7C3AED" /><stop offset="100%" stopColor="#B84DFF" /></linearGradient>
            </defs>
            <circle cx="60" cy="60" r={R} className="nut-ring-track" />
            <circle cx="60" cy="60" r={R} className="nut-ring-fill" stroke={over ? 'url(#nut-violet)' : 'url(#nut-gold)'} strokeDasharray={`${dash} ${C}`} transform="rotate(-90 60 60)" />
          </svg>
          <div className="nut-ring-center">
            {target > 0 ? (
              <>
                <span className={`nut-ring-num${over ? ' over' : ''}`}>{eaten.toLocaleString()}</span>
                <span className="nut-ring-sub">of {target.toLocaleString()} kcal</span>
              </>
            ) : (
              <span className="nut-ring-sub">set a calorie target</span>
            )}
          </div>
        </div>

        {target > 0 && (
          <p className={`nut-verdict${over ? ' over' : ''}`}>
            {over ? `${Math.abs(remaining).toLocaleString()} kcal over target` : `${remaining.toLocaleString()} kcal left today`}
          </p>
        )}

        <div className="checkin-actions">
          <button className="checkin-save-btn" onClick={goLog}>Log Quick Calories</button>
          <button className="checkin-skip-btn" onClick={dismiss}>Looks good</button>
        </div>
      </div>
    </div>
  );
};

export default NutritionPrompt;
