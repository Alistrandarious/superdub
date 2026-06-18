import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './App.css';
import { api } from './api';

interface MacroSet {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

const DEFAULT_TARGET: MacroSet = { calories: 0, protein: 0, carbs: 0, fats: 0 };

const MEAL_SPLITS = [
  { name: 'Breakfast', icon: '🌅', pct: 0.25 },
  { name: 'Lunch',     icon: '☀️', pct: 0.35 },
  { name: 'Dinner',    icon: '🌙', pct: 0.30 },
  { name: 'Snacks',    icon: '🍎', pct: 0.10 },
];

const MealPlans: React.FC = () => {
  const navigate = useNavigate();
  const [target, setTarget] = useState<MacroSet>(DEFAULT_TARGET);
  const [kg, setKg] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([api.getDietTarget(), api.getProfile()]).then(([t, p]: any[]) => {
      setTarget(t as MacroSet);
      const profileKg = parseFloat(p.weightKg) || 0;
      setKg(profileKg);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const hasTarget = target.calories > 0;

  return (
    <div className="app" style={{ '--theme': '#00e5ff', '--theme-dim': '#00e5ff66', '--theme-glow': '#00e5ff33' } as React.CSSProperties}>
      <header className="header">
        <div className="header-left">
          <Link to="/diet" className="back-link">← Back</Link>
        </div>
        <h1 className="title">Meal Plans</h1>
      </header>

      {!loaded ? (
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '4rem', color: '#00e5ff' }}>
          Loading…
        </div>
      ) : hasTarget ? (
        <div className="page-content" style={{ padding: '20px 16px 100px' }}>
          <p className="diet-hint" style={{ marginBottom: 20 }}>
            Your daily macro targets split across meals. Use this as a guide when planning what to eat.
          </p>

          <div className="meal-plan-day-card">
            <div className="meal-plan-day-header">
              <span className="meal-plan-day-title">Daily Macro Template</span>
              <span className="meal-plan-day-total">{target.calories} kcal</span>
            </div>
            {MEAL_SPLITS.map(m => {
              const kcal  = Math.round(target.calories * m.pct);
              const prot  = Math.round(target.protein  * m.pct);
              const carbs = Math.round(target.carbs    * m.pct);
              const fats  = Math.round(target.fats     * m.pct);
              return (
                <div key={m.name} className="meal-plan-row">
                  <div className="meal-plan-row-left">
                    <span className="meal-plan-icon">{m.icon}</span>
                    <div>
                      <div className="meal-plan-name">{m.name}</div>
                      <div className="meal-plan-macros">P {prot}g · C {carbs}g · F {fats}g</div>
                    </div>
                  </div>
                  <div className="meal-plan-kcal">{kcal} kcal</div>
                </div>
              );
            })}
          </div>

          <div className="meal-plan-tips">
            <div className="meal-plan-tip-title">Quick tips</div>
            <div className="meal-plan-tip">Hit protein at breakfast — it reduces cravings all day.</div>
            <div className="meal-plan-tip">Front-load carbs around training for best performance.</div>
            <div className="meal-plan-tip">Keep fats mostly at lunch and dinner, away from workouts.</div>
            {kg > 0 && (
              <div className="meal-plan-tip">
                Your protein target ({target.protein}g) = {(target.protein / kg).toFixed(1)}g per kg bodyweight.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="page-content">
          <div className="meal-plan-empty">
            <div className="meal-plan-empty-icon">🥗</div>
            <div className="meal-plan-empty-title">No targets set yet</div>
            <div className="meal-plan-empty-sub">
              Set your macro targets in Profile → Plan to see your meal template here.
            </div>
            <button className="meal-plan-empty-btn" onClick={() => navigate('/profile')}>
              Go to Profile →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MealPlans;
