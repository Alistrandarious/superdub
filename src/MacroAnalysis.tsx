import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css';
import { api } from './api';

interface MacroSet { calories: number; protein: number; carbs: number; fats: number; }
interface ProfileData { dob: string; heightCm: string; weightKg: string; sex: 'male' | 'female'; activity: string; steps: string; vestKg: string; }

type MacroKey = 'protein' | 'carbs' | 'fats';
const CAL_PER: Record<MacroKey, number> = { protein: 4, carbs: 4, fats: 9 };
const MACRO_COLORS: Record<MacroKey, string> = { protein: '#ff6ec7', carbs: '#7C3AED', fats: '#ffd60a' };
const STRIDE_M = 0.762;

function ageFromDob(dob: string): number {
  if (!dob) return 0;
  const born = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const m = today.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < born.getDate())) age--;
  return Math.max(0, age);
}

const MacroAnalysis: React.FC = () => {
  const [target, setTarget] = useState<MacroSet>({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [profile, setProfile] = useState<ProfileData>({ dob: '', heightCm: '', weightKg: '', sex: 'male', activity: '1.55', steps: '', vestKg: '' });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([api.getDietTarget(), api.getProfile()]).then(([t, p]) => {
      setTarget(t as MacroSet);
      const pd = p as ProfileData & { name: string };
      setProfile({ dob: pd.dob ?? '', heightCm: pd.heightCm ?? '', weightKg: pd.weightKg ?? '', sex: pd.sex ?? 'male', activity: pd.activity ?? '1.55', steps: pd.steps ?? '', vestKg: pd.vestKg ?? '' });
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const kg = parseFloat(profile.weightKg) || 0;
  const cm = parseFloat(profile.heightCm) || 0;
  const age = ageFromDob(profile.dob);
  const activity = parseFloat(profile.activity) || 1.55;
  const steps = parseFloat(profile.steps) || 0;
  const vestKg = parseFloat(profile.vestKg) || 0;

  const bmr = kg > 0 && cm > 0 && age > 0
    ? profile.sex === 'male' ? 10 * kg + 6.25 * cm - 5 * age + 5 : 10 * kg + 6.25 * cm - 5 * age - 161
    : 0;
  const tdee = bmr > 0 ? Math.round(bmr * activity) : 0;
  const walkKm = steps * STRIDE_M / 1000;
  const walkBurn = steps > 0 && kg > 0 ? Math.round(walkKm * (kg + vestKg) * 0.5) : 0;
  const maintenance = tdee + walkBurn;

  const totalKcal = target.protein * 4 + target.carbs * 4 + target.fats * 9;
  const proteinPct = totalKcal > 0 ? (target.protein * 4 / totalKcal) * 100 : 0;
  const carbsPct = totalKcal > 0 ? (target.carbs * 4 / totalKcal) * 100 : 0;
  const fatsPct = totalKcal > 0 ? (target.fats * 9 / totalKcal) * 100 : 0;

  const macroStyle = (() => {
    if (carbsPct < 10) return 'Ketogenic';
    if (carbsPct < 26) return 'Low Carb';
    if (proteinPct > 35) return 'High Protein';
    if (carbsPct > 55) return 'High Carb';
    return 'Balanced';
  })();

  const energyBalance = (() => {
    if (maintenance === 0) return '—';
    const diff = totalKcal - maintenance;
    if (diff > 300) return 'Aggressive Bulk';
    if (diff > 50) return 'Mild Bulk';
    if (diff >= -50) return 'Maintenance';
    if (diff >= -500) return 'Mild Cut';
    return 'Aggressive Cut';
  })();

  const proteinPerKg = kg > 0 ? (target.protein / kg).toFixed(1) : '—';

  const pieData = [
    { name: 'Protein', value: target.protein * 4, color: MACRO_COLORS.protein },
    { name: 'Carbs', value: target.carbs * 4, color: MACRO_COLORS.carbs },
    { name: 'Fats', value: target.fats * 9, color: MACRO_COLORS.fats },
  ].filter(d => d.value > 0);

  if (!loaded) {
    return (
      <div className="app flush" style={{ '--theme': '#7C3AED', '--theme-dim': '#7C3AED66', '--theme-glow': '#7C3AED33' } as React.CSSProperties}>
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '4rem', color: '#7C3AED' }}>Loading…</div>
      </div>
    );
  }

  return (
    <div className="app flush" style={{ '--theme': '#7C3AED', '--theme-dim': '#7C3AED66', '--theme-glow': '#7C3AED33' } as React.CSSProperties}>
      <div className="diet-content page-content">
        <div className="page-intro-row">
          <Link to="/diet" className="page-back"><span className="page-back-arrow">‹</span> Training Plan</Link>
          <h1 className="page-intro-title">Macro Analysis</h1>
        </div>


        {/* Macro Split */}
        <div className="diet-section">
          <h2 className="diet-heading">Macro Split</h2>
          <div className="macro-split">
            <div className="pie-wrap">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={88} paddingAngle={2}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(val) => [`${val} kcal`, '']} contentStyle={{ background: '#0e1022', border: '1px solid #1e2245', color: '#7C3AED', borderRadius: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="macro-legend">
              {(['protein', 'carbs', 'fats'] as MacroKey[]).map(k => (
                <li key={k}>
                  <span className="legend-dot" style={{ background: MACRO_COLORS[k] }} />
                  <span className="legend-name">{k.charAt(0).toUpperCase() + k.slice(1)}</span>
                  <span className="legend-val">{target[k]}g</span>
                  <span style={{ opacity: 0.5, fontSize: '0.78rem', marginLeft: 4 }}>
                    ({totalKcal > 0 ? Math.round(target[k] * CAL_PER[k] / totalKcal * 100) : 0}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="diet-hint" style={{ marginTop: 12 }}>{totalKcal} kcal total — P×4 + C×4 + F×9</p>
        </div>

        {/* Diet Classification */}
        <div className="diet-section">
          <h2 className="diet-heading">Diet Classification</h2>
          <div className="class-grid">
            <div className="class-card">
              <span className="class-label">Macro Style</span>
              <span className="class-value">{macroStyle}</span>
              <span className="class-sub">{Math.round(proteinPct)}% P / {Math.round(carbsPct)}% C / {Math.round(fatsPct)}% F</span>
            </div>
            <div className="class-card">
              <span className="class-label">Energy Balance</span>
              <span className={`class-value${energyBalance.includes('Cut') ? '' : energyBalance === 'Maintenance' ? ' good' : ''}`}>{energyBalance}</span>
              {maintenance > 0 && (
                <span className="class-sub">{totalKcal > maintenance ? '+' : ''}{totalKcal - maintenance} kcal vs maint.</span>
              )}
            </div>
            <div className="class-card">
              <span className="class-label">Protein / kg</span>
              <span className={`class-value${parseFloat(proteinPerKg) >= 1.6 ? ' good' : ''}`}>{proteinPerKg} g/kg</span>
              <span className="class-sub">{parseFloat(proteinPerKg) >= 2.0 ? 'High — optimal' : parseFloat(proteinPerKg) >= 1.6 ? 'Adequate' : 'Low for fat loss'}</span>
            </div>
            <div className="class-card">
              <span className="class-label">Total Calories</span>
              <span className="class-value">{totalKcal} kcal</span>
              {maintenance > 0 && <span className="class-sub">Maint: {maintenance} kcal</span>}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MacroAnalysis;
