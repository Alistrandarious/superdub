import React, { useState } from 'react';
import { api, setToken } from './api';
import './App.css';

interface AuthProps {
  onAuth: () => void;
}

type Mode = 'landing' | 'login' | 'signup' | 'forgot' | 'reset';

const DEFAULT_HABITS = ['Walking', 'Praying', 'Duolingo'];
const EXTRA_HABITS = ['Reading', 'Meditation', 'Gym', 'Running', 'Cold shower', 'Journaling', 'No sugar', 'Sleep by 11pm'];

const ACTIVITY_OPTS = [
  { value: '1.2',   label: 'Sedentary — desk job, little exercise' },
  { value: '1.375', label: 'Light — exercise 1–3×/week' },
  { value: '1.55',  label: 'Moderate — exercise 3–5×/week' },
  { value: '1.725', label: 'Very active — hard exercise 6–7×/week' },
  { value: '1.9',   label: 'Extra active — athlete / physical job' },
];

const THEME = '#00e5ff';

export const Auth: React.FC<AuthProps> = ({ onAuth }) => {
  const [mode, setMode] = useState<Mode>('landing');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Forgot / reset fields
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Sign-up fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [dietGoal, setDietGoal] = useState<'cut' | 'maintain' | 'bulk'>('cut');
  const [goalWeight, setGoalWeight] = useState('');
  const [lossPerWeek, setLossPerWeek] = useState('0.5');
  const [gainPerWeek, setGainPerWeek] = useState('0.25');
  const [activityLevel, setActivityLevel] = useState('1.55');
  const [habits, setHabits] = useState<string[]>([...DEFAULT_HABITS]);
  const [customHabit, setCustomHabit] = useState('');

  // Unit preferences
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb' | 'st'>('kg');
  // Display values (in chosen units)
  const [heightDisplay, setHeightDisplay] = useState('');
  const [weightDisplay, setWeightDisplay] = useState('');
  const [goalWeightDisplay, setGoalWeightDisplay] = useState('');

  const toCm = (val: string, unit: 'cm' | 'ft') => {
    if (!val) return '';
    if (unit === 'cm') return val;
    // ft format: 5.11 = 5ft 11in, or plain 5.9
    const parts = val.split('.');
    const ft = parseFloat(parts[0]) || 0;
    const inches = parseFloat(parts[1] || '0');
    return String(Math.round(ft * 30.48 + inches * 2.54));
  };

  const toKg = (val: string, unit: 'kg' | 'lb' | 'st') => {
    if (!val) return '';
    const n = parseFloat(val);
    if (isNaN(n)) return '';
    if (unit === 'kg') return val;
    if (unit === 'lb') return String(Math.round(n * 0.453592 * 10) / 10);
    // stone: e.g. 13.7 = 13st 7lb
    const parts = val.split('.');
    const st = parseFloat(parts[0]) || 0;
    const lb = parseFloat(parts[1] || '0');
    return String(Math.round((st * 6.35029 + lb * 0.453592) * 10) / 10);
  };

  const onHeightChange = (val: string) => {
    setHeightDisplay(val);
    setHeightCm(toCm(val, heightUnit));
  };

  const onWeightChange = (val: string) => {
    setWeightDisplay(val);
    setWeightKg(toKg(val, weightUnit));
  };

  const onGoalWeightChange = (val: string) => {
    setGoalWeightDisplay(val);
    setGoalWeight(toKg(val, weightUnit));
  };

  const switchHeightUnit = (unit: 'cm' | 'ft') => {
    setHeightUnit(unit);
    setHeightDisplay('');
    setHeightCm('');
  };

  const switchWeightUnit = (unit: 'kg' | 'lb' | 'st') => {
    setWeightUnit(unit);
    setWeightDisplay('');
    setWeightKg('');
    setGoalWeightDisplay('');
    setGoalWeight('');
  };

  const maxDob = new Date(new Date().setFullYear(new Date().getFullYear() - 10)).toISOString().split('T')[0];

  const TOTAL_STEPS = 4;

  const clearError = () => setError('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await api.login({ email: loginEmail, password: loginPassword });
      setToken(token);
      onAuth();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    setError('');
    if (step === 1) {
      if (!email.trim()) { setError('Email is required'); return; }
      if (!email.includes('@')) { setError('Enter a valid email'); return; }
      if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
      if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    }
    if (step === 2) {
      if (!dob) { setError('Please enter your date of birth'); return; }
    }
    setStep(s => s + 1);
  };

  const handleSignup = async () => {
    setError('');
    setLoading(true);
    try {
      const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
      const { token } = await api.signup({
        email, password, name, dob, sex, heightCm, weightKg,
        goalWeight, lossPerWeek, gainPerWeek, activityLevel, dietGoal, habits,
      });
      setToken(token);
      onAuth();
    } catch (err: any) {
      setError(err.message);
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!resetEmail.trim()) { setError('Please enter your email'); return; }
    setLoading(true);
    try {
      await api.forgotPassword(resetEmail.trim());
      setMode('reset');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!resetCode.trim()) { setError('Please enter the code from your email'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const { token } = await api.resetPassword(resetEmail.trim(), resetCode.trim(), newPassword);
      setToken(token);
      onAuth();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleHabit = (h: string) => {
    setHabits(prev =>
      prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h]
    );
  };

  const addCustomHabit = () => {
    const h = customHabit.trim();
    if (h && !habits.includes(h)) setHabits(prev => [...prev, h]);
    setCustomHabit('');
  };

  const themeStyle = {
    '--theme': THEME,
    '--theme-dim': THEME + '66',
    '--theme-glow': THEME + '33',
  } as React.CSSProperties;

  // ── Landing ──────────────────────────────────────────────────────────────
  if (mode === 'landing') {
    return (
      <div className="app auth-page" style={themeStyle}>
        <div className="auth-center">
          <div className="auth-card">
            <h1 className="auth-logo">Superdub</h1>
            <p className="auth-tagline">Track habits. Hit goals. Every day.</p>
            <div className="auth-landing-btns">
              <button className="auth-btn-primary" onClick={() => setMode('signup')}>Create account</button>
              <button className="auth-btn-ghost" onClick={() => setMode('login')}>Log in</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  if (mode === 'login') {
    return (
      <div className="app auth-page" style={themeStyle}>
        <div className="auth-center">
          <div className="auth-card">
            <button className="auth-back" onClick={() => { setMode('landing'); clearError(); }}>← Back</button>
            <h2 className="auth-step-title">Welcome back</h2>
            <form onSubmit={handleLogin} className="auth-form">
              <div className="auth-field">
                <label>Email</label>
                <input
                  type="email" autoComplete="email" autoFocus
                  value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="auth-field">
                <label>Password</label>
                <input
                  type="password" autoComplete="current-password"
                  value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className="auth-btn-primary" disabled={loading}>
                {loading ? 'Logging in…' : 'Log in'}
              </button>
            </form>
            <p className="auth-switch">No account? <button className="auth-link" onClick={() => { setMode('signup'); clearError(); }}>Sign up</button></p>
            <p className="auth-switch"><button className="auth-link" onClick={() => { setResetEmail(loginEmail); setMode('forgot'); clearError(); }}>Forgot password?</button></p>
          </div>
        </div>
      </div>
    );
  }

  // ── Forgot password ───────────────────────────────────────────────────────
  if (mode === 'forgot') {
    return (
      <div className="app auth-page" style={themeStyle}>
        <div className="auth-center">
          <div className="auth-card">
            <button className="auth-back" onClick={() => { setMode('login'); clearError(); }}>← Back</button>
            <h2 className="auth-step-title">Forgot password</h2>
            <p className="auth-step-sub">Enter your email and we'll send you a reset code.</p>
            <form onSubmit={handleForgot} className="auth-form">
              <div className="auth-field">
                <label>Email</label>
                <input
                  type="email" autoFocus autoComplete="email"
                  value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className="auth-btn-primary" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset code'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Reset password ────────────────────────────────────────────────────────
  if (mode === 'reset') {
    return (
      <div className="app auth-page" style={themeStyle}>
        <div className="auth-center">
          <div className="auth-card">
            <button className="auth-back" onClick={() => { setMode('forgot'); clearError(); }}>← Back</button>
            <h2 className="auth-step-title">Reset password</h2>
            <p className="auth-step-sub">Check your email for the 6-character code, then choose a new password.</p>
            <form onSubmit={handleReset} className="auth-form">
              <div className="auth-field">
                <label>Reset code</label>
                <input
                  type="text" autoFocus autoComplete="off"
                  value={resetCode} onChange={e => setResetCode(e.target.value.toUpperCase())}
                  placeholder="e.g. A3F9B2"
                  maxLength={6}
                  style={{ letterSpacing: '4px', fontFamily: 'monospace', fontSize: '1.2rem' }}
                />
              </div>
              <div className="auth-field">
                <label>New password</label>
                <input
                  type="password" autoComplete="new-password"
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                />
              </div>
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className="auth-btn-primary" disabled={loading}>
                {loading ? 'Resetting…' : 'Set new password'}
              </button>
            </form>
            <p className="auth-switch">
              Didn't get the email?{' '}
              <button className="auth-link" onClick={() => { setMode('forgot'); clearError(); }}>Try again</button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Sign-up (multi-step) ──────────────────────────────────────────────────
  return (
    <div className="app auth-page" style={themeStyle}>
      <div className="auth-center">
        <div className="auth-card">
          <button className="auth-back" onClick={() => {
            if (step > 1) setStep(s => s - 1);
            else { setMode('landing'); clearError(); }
          }}>← {step > 1 ? 'Back' : 'Home'}</button>

          {/* Progress bar */}
          <div className="auth-progress">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div key={i} className={`auth-progress-dot ${i + 1 <= step ? 'done' : ''}`} />
            ))}
          </div>

          {/* Step 1 — Account */}
          {step === 1 && (
            <>
              <h2 className="auth-step-title">Create your account</h2>
              <p className="auth-step-sub">You'll use these to log in from any device.</p>
              <div className="auth-form">
                <div className="auth-field">
                  <label>Email</label>
                  <input type="email" autoFocus autoComplete="email"
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" />
                </div>
                <div className="auth-field">
                  <label>Password</label>
                  <input type="password" autoComplete="new-password"
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 6 characters" />
                </div>
                <div className="auth-field">
                  <label>Confirm password</label>
                  <input type="password" autoComplete="new-password"
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Same as above"
                    onKeyDown={e => e.key === 'Enter' && nextStep()} />
                </div>
              </div>
            </>
          )}

          {/* Step 2 — About You */}
          {step === 2 && (
            <>
              <h2 className="auth-step-title">About you</h2>
              <p className="auth-step-sub">Used to personalise your targets — you can edit these later.</p>
              <div className="auth-form">
                <div className="auth-row">
                  <div className="auth-field">
                    <label>First name</label>
                    <input type="text" autoFocus autoComplete="given-name"
                      value={firstName} onChange={e => setFirstName(e.target.value)}
                      placeholder="Ali" />
                  </div>
                  <div className="auth-field">
                    <label>Last name</label>
                    <input type="text" autoComplete="family-name"
                      value={lastName} onChange={e => setLastName(e.target.value)}
                      placeholder="Shah" />
                  </div>
                </div>
                <div className="auth-row">
                  <div className="auth-field">
                    <label>Date of Birth</label>
                    <input type="date"
                      value={dob} onChange={e => setDob(e.target.value)}
                      max={maxDob} />
                  </div>
                  <div className="auth-field">
                    <label>Sex</label>
                    <select value={sex} onChange={e => setSex(e.target.value as 'male' | 'female')}>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>
                <div className="auth-field">
                  <div className="auth-label-row">
                    <label>Height</label>
                    <div className="auth-unit-toggle">
                      {(['cm','ft'] as const).map(u => (
                        <button key={u} type="button" className={`auth-unit-btn ${heightUnit===u?'active':''}`} onClick={() => switchHeightUnit(u)}>{u}</button>
                      ))}
                    </div>
                  </div>
                  <input type="text" inputMode="decimal"
                    value={heightDisplay}
                    onChange={e => onHeightChange(e.target.value)}
                    placeholder={heightUnit === 'cm' ? 'e.g. 175' : 'e.g. 5.11 (5ft 11in)'} />
                </div>
                <div className="auth-field">
                  <div className="auth-label-row">
                    <label>Weight</label>
                    <div className="auth-unit-toggle">
                      {(['kg','lb','st'] as const).map(u => (
                        <button key={u} type="button" className={`auth-unit-btn ${weightUnit===u?'active':''}`} onClick={() => switchWeightUnit(u)}>{u}</button>
                      ))}
                    </div>
                  </div>
                  <input type="text" inputMode="decimal"
                    value={weightDisplay}
                    onChange={e => onWeightChange(e.target.value)}
                    placeholder={weightUnit === 'kg' ? 'e.g. 85' : weightUnit === 'lb' ? 'e.g. 187' : 'e.g. 13.7 (13st 7lb)'} />
                </div>
              </div>
            </>
          )}

          {/* Step 3 — Goals */}
          {step === 3 && (() => {
            const w = parseFloat(weightKg) || 0;
            const h = parseFloat(heightCm) || 0;
            const act = parseFloat(activityLevel) || 1.55;
            const dobAge = dob ? (() => { const b = new Date(dob); const t = new Date(); let a = t.getFullYear() - b.getFullYear(); if (t.getMonth() - b.getMonth() < 0 || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--; return a; })() : 25;
            const bmr = w && h ? (sex === 'male' ? 10*w + 6.25*h - 5*dobAge + 5 : 10*w + 6.25*h - 5*dobAge - 161) : 0;
            const tdee = Math.round(bmr * act);
            const lpw = parseFloat(lossPerWeek) || 0.5;
            const gpw = parseFloat(gainPerWeek) || 0.25;
            const delta = dietGoal === 'cut' ? -Math.round(lpw * 7700 / 7)
                        : dietGoal === 'bulk' ? Math.round(gpw * 7700 / 7)
                        : 0;
            const targetCals = tdee > 0 ? Math.max(1200, tdee + delta) : 0;
            const gw = parseFloat(goalWeight) || 0;
            const weeksToGoal = dietGoal === 'cut' && w > 0 && gw > 0 && gw < w && lpw > 0
              ? Math.ceil((w - gw) / lpw) : 0;
            const weeksToGain = dietGoal === 'bulk' && w > 0 && gw > 0 && gw > w && gpw > 0
              ? Math.ceil((gw - w) / gpw) : 0;
            const GOAL_OPTIONS = [
              { id: 'cut' as const, icon: '🔥', label: 'Lose weight', desc: 'Eat in a calorie deficit to lean down' },
              { id: 'maintain' as const, icon: '⚖️', label: 'Stay healthy', desc: 'Maintain current weight and feel great' },
              { id: 'bulk' as const, icon: '💪', label: 'Build & Grow', desc: 'Gain muscle with a calorie surplus' },
            ];
            return (
              <>
                <h2 className="auth-step-title">What's your goal?</h2>
                <p className="auth-step-sub">This sets your starting calorie target — you can change it any time.</p>
                <div className="auth-goal-picker">
                  {GOAL_OPTIONS.map(g => (
                    <button
                      key={g.id}
                      type="button"
                      className={`auth-goal-card${dietGoal === g.id ? ' selected' : ''}`}
                      onClick={() => setDietGoal(g.id)}
                    >
                      <span className="auth-goal-icon">{g.icon}</span>
                      <span className="auth-goal-label">{g.label}</span>
                      <span className="auth-goal-desc">{g.desc}</span>
                    </button>
                  ))}
                </div>
                <div className="auth-form" style={{ marginTop: 16 }}>
                  {dietGoal === 'cut' && (
                    <div className="auth-row">
                      <div className="auth-field">
                        <label>Goal weight ({weightUnit})</label>
                        <input type="text" inputMode="decimal"
                          value={goalWeightDisplay} onChange={e => onGoalWeightChange(e.target.value)}
                          placeholder={weightUnit === 'kg' ? 'e.g. 75' : weightUnit === 'lb' ? 'e.g. 165' : 'e.g. 11.7'} />
                      </div>
                      <div className="auth-field">
                        <label>Loss per week</label>
                        <select value={lossPerWeek} onChange={e => setLossPerWeek(e.target.value)}>
                          <option value="0.25">0.25 kg/wk — gentle</option>
                          <option value="0.5">0.5 kg/wk — steady</option>
                          <option value="0.75">0.75 kg/wk — fast</option>
                          <option value="1.0">1.0 kg/wk — aggressive</option>
                        </select>
                      </div>
                    </div>
                  )}
                  {dietGoal === 'bulk' && (
                    <div className="auth-row">
                      <div className="auth-field">
                        <label>Target weight ({weightUnit})</label>
                        <input type="text" inputMode="decimal"
                          value={goalWeightDisplay} onChange={e => onGoalWeightChange(e.target.value)}
                          placeholder={weightUnit === 'kg' ? 'e.g. 85' : weightUnit === 'lb' ? 'e.g. 185' : 'e.g. 13.5'} />
                      </div>
                      <div className="auth-field">
                        <label>Gain per week</label>
                        <select value={gainPerWeek} onChange={e => setGainPerWeek(e.target.value)}>
                          <option value="0.125">0.1 kg/wk — lean</option>
                          <option value="0.25">0.25 kg/wk — steady</option>
                          <option value="0.5">0.5 kg/wk — fast</option>
                        </select>
                      </div>
                    </div>
                  )}
                  <div className="auth-field">
                    <label>Activity level</label>
                    <select value={activityLevel} onChange={e => setActivityLevel(e.target.value)}>
                      {ACTIVITY_OPTS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  {targetCals > 0 && (
                    <div className="auth-hint-box">
                      <div className="auth-hint-row">
                        <span>Daily calories</span>
                        <strong>{targetCals.toLocaleString()} kcal</strong>
                      </div>
                      {weeksToGoal > 0 && (
                        <div className="auth-hint-row">
                          <span>Time to goal</span>
                          <strong>{weeksToGoal} weeks</strong>
                        </div>
                      )}
                      {weeksToGain > 0 && (
                        <div className="auth-hint-row">
                          <span>Time to target</span>
                          <strong>{weeksToGain} weeks</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          {/* Step 4 — Habits */}
          {step === 4 && (
            <>
              <h2 className="auth-step-title">Starting habits</h2>
              <p className="auth-step-sub">Pick the ones you want to track daily. You can change these any time.</p>
              <div className="auth-habits-grid">
                {[...DEFAULT_HABITS, ...EXTRA_HABITS].map(h => (
                  <button
                    key={h}
                    type="button"
                    className={`auth-habit-pill ${habits.includes(h) ? 'selected' : ''}`}
                    onClick={() => toggleHabit(h)}
                  >
                    {habits.includes(h) ? '✓ ' : '+ '}{h}
                  </button>
                ))}
              </div>
              <div className="auth-custom-habit">
                <input
                  type="text"
                  value={customHabit}
                  onChange={e => setCustomHabit(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomHabit()}
                  placeholder="Add your own habit…"
                />
                <button type="button" onClick={addCustomHabit} className="auth-add-btn">+</button>
              </div>
              {habits.length === 0 && <p className="auth-error">Pick at least one habit.</p>}
            </>
          )}

          {error && <p className="auth-error">{error}</p>}

          <div className="auth-actions">
            {step < TOTAL_STEPS ? (
              <button className="auth-btn-primary" onClick={nextStep}>
                Continue →
              </button>
            ) : (
              <button
                className="auth-btn-primary"
                onClick={handleSignup}
                disabled={loading || habits.length === 0}
              >
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            )}
          </div>

          <p className="auth-switch">
            Already have an account?{' '}
            <button className="auth-link" onClick={() => { setMode('login'); clearError(); }}>Log in</button>
          </p>
        </div>
      </div>
      <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#4b5563', marginTop: 16, paddingBottom: 8 }}>
        By creating an account you agree to our{' '}
        <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: '#6b7280', textDecoration: 'underline' }}>Privacy Policy</a>
      </p>
    </div>
  );
};
