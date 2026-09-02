import React, { useState, useCallback, useEffect } from 'react';
import { api, setToken, isNative } from './api';
import GoogleAuthButton from './GoogleAuthButton';
import OnboardingCustomize from './OnboardingCustomize';
import { onboardingScreens, onbProgressPct, screenPrompt } from './onboarding';
import { planTargetDate } from './planBootstrap';
import { markSignupDay } from './promptPrefs';
import { getLoggingDay } from './day';
import { requestNotificationPermission, enableReminders } from './push';
import { healthAvailable, requestStepPermission } from './health';
import { ageFromDob, isUnderMinAge, MIN_AGE_YEARS } from './age';
import HealthDisclaimer from './HealthDisclaimer';
import { capture } from './analytics';
import './App.css';
import { GROWTH } from './theme';
import { nickToWordmark, setBrandNick } from './brand';

interface AuthProps {
  onAuth: () => void;
}

type Mode = 'landing' | 'login' | 'signup' | 'forgot' | 'reset';

// Only Walking is pre-checked. 'Praying' and 'Duolingo' used to arrive ticked for
// every user on earth — a religious practice and a third-party brand. Both are still
// offered, neither is assumed.
const DEFAULT_HABITS = ['Walking'];
const EXTRA_HABITS = ['Praying', 'Duolingo', 'Reading', 'Meditation', 'Gym', 'Running', 'Cold shower', 'Journaling', 'No sugar', 'Sleep by 11pm'];

export const JOB_OPTS = [
  { id: 'desk',     label: '🪑 Desk',      desc: 'Sitting most of the day' },
  { id: 'mixed',    label: '🚶 Mixed',     desc: 'Sit and move around' },
  { id: 'standing', label: '🏪 On feet',   desc: 'Retail, teaching, waiting' },
  { id: 'physical', label: '🔨 Physical',  desc: 'Labour, construction, farming' },
];
export const GYM_OPTS = [
  { id: 'never', label: 'Never' },
  { id: '1-2',   label: '1–2×/wk' },
  { id: '3-4',   label: '3–4×/wk' },
  { id: '5-6',   label: '5–6×/wk' },
  { id: 'daily', label: 'Daily+' },
];
export const WALK_OPTS = [
  { id: 'barely',   label: '🚗 Barely',   desc: 'Drive everywhere, <3k steps' },
  { id: 'little',   label: '🦶 A little', desc: 'Short walks, ~3–5k steps' },
  { id: 'moderate', label: '🚶 Moderate', desc: '5–10k steps/day' },
  { id: 'alot',     label: '🏃 A lot',    desc: '10k+ steps, very active' },
];
const JOB_FACTOR:  Record<string, number> = { desk: 0, mixed: 0.05, standing: 0.1, physical: 0.3 };
const GYM_FACTOR:  Record<string, number> = { never: 0, '1-2': 0.1, '3-4': 0.175, '5-6': 0.25, daily: 0.35 };
const WALK_FACTOR: Record<string, number> = { barely: 0, little: 0.05, moderate: 0.1, alot: 0.175 };
export function computeActivity(job: string, gym: string, walk: string): number {
  return Math.min(1.9, parseFloat((1.2 + (JOB_FACTOR[job] ?? 0) + (GYM_FACTOR[gym] ?? 0) + (WALK_FACTOR[walk] ?? 0)).toFixed(4)));
}

const THEME = GROWTH;

export const Auth: React.FC<AuthProps> = ({ onAuth }) => {
  const [mode, setMode] = useState<Mode>('landing');
  // Onboarding is an ordered screen list (see onboarding.ts); screenIdx points
  // into it. Google signups get a shorter list (no account screen).
  const [screenIdx, setScreenIdx] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Forgot / reset fields
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Sign-up fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Google sign-up: when set, the account is created from a verified Google token
  // instead of a password, and step 1 (email/password) is skipped.
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [dietGoal, setDietGoal] = useState<'cut' | 'maintain' | 'bulk'>('cut');
  const [goalWeight, setGoalWeight] = useState('');
  const [lossPerWeek, setLossPerWeek] = useState('0.5');
  const [gainPerWeek, setGainPerWeek] = useState('0.25');
  const [jobType, setJobType] = useState('desk');
  const [gymFreq, setGymFreq] = useState('3-4');
  const [walkFreq, setWalkFreq] = useState('moderate');
  const activityLevel = String(computeActivity(jobType, gymFreq, walkFreq));
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

  // Matches MIN_AGE_YEARS — the picker must not offer an age the gate rejects.
  const maxDob = new Date(new Date().setFullYear(new Date().getFullYear() - MIN_AGE_YEARS)).toISOString().split('T')[0];

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

  // Google sign-in: existing users log straight in; new users drop into onboarding
  // (email + name pre-filled, password step skipped) and finish with a Google token.
  const handleGoogle = useCallback(async (idToken: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await api.googleAuth(idToken);
      if (res.token) { setToken(res.token); onAuth(); return; }
      if (res.needsOnboarding) {
        setGoogleToken(idToken);
        setEmail(res.email || '');
        const parts = (res.name || '').trim().split(/\s+/);
        setFirstName(parts[0] || '');
        setLastName(parts.slice(1).join(' '));
        setMode('signup');
        setScreenIdx(0); // Google flow opens on 'name' (no account screen)
      }
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  }, [onAuth]);

  // Advance to the next onboarding screen, validating the current one first.
  const advance = () => {
    setError('');
    const scr = onboardingScreens(!!googleToken);
    const cur = scr[screenIdx];
    if (cur === 'account') {
      if (!email.trim()) { setError('Email is required'); return; }
      if (!email.includes('@')) { setError('Enter a valid email'); return; }
      if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
      if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    }
    if (cur === 'body') {
      if (!dob) { setError('Please enter your date of birth'); return; }
      if (ageFromDob(dob) === null) { setError('That date of birth does not look right'); return; }
      // The privacy policy says under-13s aren't permitted; enforce it here
      // rather than only promising it. The server checks again at signup.
      if (isUnderMinAge(dob)) {
        setError(`You need to be at least ${MIN_AGE_YEARS} to use Superdub`);
        return;
      }
      // Height and weight drive the calorie target and the whole weight plan. Blank
      // used to pass silently and land the user on a flat 2000 kcal with no plan.
      if (!heightCm) { setError('Please enter your height'); return; }
      if (!weightKg) { setError('Please enter your current weight'); return; }
    }
    if (cur === 'habits') {
      if (habits.length === 0) { setError('Pick at least one habit.'); return; }
    }
    setScreenIdx(i => Math.min(i + 1, scr.length - 1));
  };

  // The two optional asks on the finish screen. Permission is requested here, with
  // the reason on screen, instead of firing OS dialogs unannounced at the home
  // screen. The account doesn't exist yet, so anything needing a token (the push
  // subscription) is finished off after signup in applyAsks().
  const [wantsReminders, setWantsReminders] = useState(false);
  const [wantsSteps, setWantsSteps] = useState(false);
  const [canAskSteps, setCanAskSteps] = useState(false);

  useEffect(() => { healthAvailable().then(setCanAskSteps).catch(() => setCanAskSteps(false)); }, []);

  const askReminders = async () => {
    if (wantsReminders) { setWantsReminders(false); return; }
    const granted = await requestNotificationPermission();
    setWantsReminders(granted);
    if (!granted) setError('Notifications are blocked for Superdub. You can turn them on later in Settings.');
  };

  const askSteps = async () => {
    if (wantsSteps) { setWantsSteps(false); return; }
    const granted = await requestStepPermission();
    setWantsSteps(granted);
  };

  // Finish the wiring that needed an account: the push subscription is saved
  // server-side against the new user.
  const applyAsks = async () => {
    if (!wantsReminders) return;
    try { await enableReminders(); } catch { /* the cog menu can turn them on later */ }
  };

  // Turn the goal answers into a live plan, so the weigh-in prompt is on and /plan
  // works from day one. Reuses the real endpoints rather than a second copy of the
  // calorie/cycle maths: POST /plan/goal needs a logged weigh-in, so the day-0
  // weight goes in first. Best-effort — a failure here just leaves the account
  // exactly where it landed before, with no plan.
  const bootstrapPlan = async () => {
    try {
      const current = parseFloat(weightKg);
      const goal = parseFloat(goalWeight);
      const perWeek = dietGoal === 'cut' ? parseFloat(lossPerWeek)
                    : dietGoal === 'bulk' ? parseFloat(gainPerWeek) : 0;
      await api.updateTrackerDay(getLoggingDay(), { weight: weightKg });
      const targetDate = planTargetDate(current, goal, perWeek);
      if (!targetDate) return; // maintain, or no goal weight — the weigh-in still counts
      const plan = await api.createPlanGoal(goal, targetDate);
      // planActive() reads this badge, and it gates the morning weigh-in prompt.
      // Writing it here means the prompt is live on day one instead of waiting for
      // the first visit to Progress.
      localStorage.setItem('superdub.plan.badge', JSON.stringify({
        active: true, calories: plan.initialCalories ?? null, onTrack: null,
      }));
      window.dispatchEvent(new Event('superdub:plan-badge-updated'));
    } catch { /* no plan today; the user can still set one on /plan */ }
  };

  const handleSignup = async () => {
    setError('');
    setLoading(true);
    try {
      const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
      // Falls back to first name so the wordmark always has something ("superali").
      const nick = nickname.trim() || firstName.trim();
      setBrandNick(nick); // wordmark reads from localStorage — make it live on landing
      const result = await api.signup({
        email, name, nickname: nick, dob, sex, heightCm, weightKg,
        goalWeight, lossPerWeek, gainPerWeek, activityLevel, dietGoal, habits,
        jobType, gymFreq, walkFreq,
        // Google accounts have no password; the server uses the verified token instead.
        ...(googleToken ? { googleToken } : { password }),
      });
      setToken(result.token);
      capture('signup_completed'); // funnel top — no-ops until analytics is live
      // Persist cohort onboarding message so the dashboard can display it on first load
      if (result.cohort?.onboardingMessage) {
        localStorage.setItem('superdub:cohort-msg', result.cohort.onboardingMessage);
        localStorage.setItem('superdub:cohort-name', result.cohort.cohortName);
      }
      markSignupDay(new Date().toISOString().slice(0, 10));
      await bootstrapPlan();
      await applyAsks();
      onAuth();
    } catch (err: any) {
      setError(err.message);
      // Stay on the screen they're on. This used to jump back to screen 0, so
      // "email already exists" cost the user the whole flow again — and on the
      // Google path landed them on a screen with no account fields at all.
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
          <div className="auth-card auth-card--landing">
            <img className="auth-logo-img" src="/superdub-logo.png" alt="Superdub" />
            <h1 className="auth-logo">super<span className="hb-brand-dub">dub</span></h1>
            <p className="auth-tagline">Meet your future self, today.<br />Go super. Go dub.</p>
            <div className="auth-landing-btns">
              <button className="auth-btn-primary" onClick={() => setMode('signup')}>Create account</button>
              <button className="auth-btn-ghost" onClick={() => setMode('login')}>Log in</button>
              <GoogleAuthButton onCredential={handleGoogle} text="continue_with" />
              {error && <p className="auth-error">{error}</p>}
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
            {!isNative && <div className="auth-or"><span>or</span></div>}
            <GoogleAuthButton onCredential={handleGoogle} text="signin_with" />
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

  // ── Sign-up (soft flow) ───────────────────────────────────────────────────
  const screens = onboardingScreens(!!googleToken);
  const idx = Math.min(screenIdx, screens.length - 1);
  const screen = screens[idx];
  const greetName = nickname.trim() || firstName.trim();
  const pct = onbProgressPct(idx, screens.length);
  return (
    <div className="app auth-page" style={themeStyle}>
      <div className="auth-center">
        <div className="auth-card">
          <button className="auth-back" onClick={() => {
            if (idx > 0) setScreenIdx(i => i - 1);
            else { setMode('landing'); clearError(); }
          }}>← {idx > 0 ? 'Back' : 'Home'}</button>

          {/* Progress — one soft bar filling across the whole flow */}
          <div className="auth-progress">
            <div className="auth-progress-track">
              <div className="auth-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="auth-progress-pct">{pct}%</span>
          </div>

          {/* Each screen keys its own mount so it fades in and Dub hops back in */}
          <div className="onb-screen" key={screen}>

          {/* Each screen asks its own question in its heading */}
          {screen !== 'finish' && (
            <h2 className="auth-step-title">{screenPrompt(screen, greetName)}</h2>
          )}

          {/* Account */}
          {screen === 'account' && (
            <>
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
                    onKeyDown={e => e.key === 'Enter' && advance()} />
                </div>
              </div>
              {!isNative && <div className="auth-or"><span>or</span></div>}
              <GoogleAuthButton onCredential={handleGoogle} text="signup_with" />
            </>
          )}

          {/* Name — what should we call you */}
          {screen === 'name' && (
            <>
              <p className="auth-step-sub">This is how Dub greets you, and it names your app.</p>
              <div className="auth-form">
                <div className="auth-field">
                  <label>Your name</label>
                  <input type="text" autoFocus autoComplete="nickname" maxLength={15}
                    value={nickname} onChange={e => setNickname(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && advance()}
                    placeholder={firstName.trim() || 'Ali'} />
                  <span className="auth-step-sub">Your app becomes super<span className="hb-brand-dub">{nickToWordmark(nickname.trim() || firstName.trim())}</span></span>
                </div>
                <div className="auth-row">
                  <div className="auth-field">
                    <label>First name</label>
                    <input type="text" autoComplete="given-name"
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
              </div>
            </>
          )}

          {/* Body */}
          {screen === 'body' && (
            <>
              <p className="auth-step-sub">Sets your starting targets. You can edit these any time.</p>
              <div className="auth-form">
                <div className="auth-row">
                  <div className="auth-field">
                    <label>Date of Birth</label>
                    <input type="date" autoFocus
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

          {/* Goal */}
          {screen === 'goal' && (() => {
            const w = parseFloat(weightKg) || 0;
            const h = parseFloat(heightCm) || 0;
            const act = parseFloat(activityLevel) || 1.55;
            const dobAge = ageFromDob(dob) ?? 25;
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
                <p className="auth-step-sub">This sets your starting calorie target, you can change it any time.</p>
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
                          <option value="0.25">0.25 kg/wk, gentle</option>
                          <option value="0.5">0.5 kg/wk, steady</option>
                          <option value="0.75">0.75 kg/wk, fast</option>
                          <option value="1.0">1.0 kg/wk, aggressive</option>
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
                          <option value="0.125">0.1 kg/wk, lean</option>
                          <option value="0.25">0.25 kg/wk, steady</option>
                          <option value="0.5">0.5 kg/wk, fast</option>
                        </select>
                      </div>
                    </div>
                  )}
                  <div className="auth-field">
                    <label>Job type</label>
                    <div className="activity-picker">
                      {JOB_OPTS.map(o => (
                        <button key={o.id} type="button" className={`activity-pick-btn${jobType === o.id ? ' active' : ''}`} onClick={() => setJobType(o.id)}>
                          <span className="apb-label">{o.label}</span>
                          <span className="apb-desc">{o.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="auth-field">
                    <label>Gym / training</label>
                    <div className="freq-selector">
                      {GYM_OPTS.map(o => {
                        const [main, sub] = o.id === 'never' ? ['—', 'Never']
                          : o.id === 'daily' ? ['7+', 'Daily']
                          : [o.label.split('×')[0], '/wk'];
                        return (
                          <button key={o.id} type="button"
                            className={`freq-option${gymFreq === o.id ? ' active' : ''}`}
                            onClick={() => setGymFreq(o.id)}>
                            <span className="freq-main">{main}</span>
                            <span className="freq-sub">{sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="auth-field">
                    <label>Walking / steps</label>
                    <div className="activity-picker">
                      {WALK_OPTS.map(o => (
                        <button key={o.id} type="button" className={`activity-pick-btn${walkFreq === o.id ? ' active' : ''}`} onClick={() => setWalkFreq(o.id)}>
                          <span className="apb-label">{o.label}</span>
                          <span className="apb-desc">{o.desc}</span>
                        </button>
                      ))}
                    </div>
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
                  {/* The first calorie target the user ever sees. If the
                      "not medical advice" line appears anywhere, it appears
                      the first time the app tells someone what to eat. */}
                  {targetCals > 0 && <HealthDisclaimer />}
                </div>
              </>
            );
          })()}

          {/* Habits */}
          {screen === 'habits' && (
            <>
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
                {habits.filter(h => !DEFAULT_HABITS.includes(h) && !EXTRA_HABITS.includes(h)).map(h => (
                  <button
                    key={h}
                    type="button"
                    className="auth-habit-pill selected"
                    onClick={() => toggleHabit(h)}
                    title="Tap to remove"
                  >
                    ✓ {h}
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

          {/* Finish — the reveal that it's running, your look, and the two asks */}
          {screen === 'finish' && (
            <div className="onb-finish">
              <div className="onb-finish-badge">super<span className="hb-brand-dub">{nickToWordmark(greetName)}</span></div>
              <h2 className="auth-step-title">You're all set{greetName ? `, ${greetName}` : ''}</h2>
              <p className="auth-step-sub">Your habits and your plan are ready. Two things Superdub can do for you, if you want them.</p>

              {/* Asked here, with a reason, instead of firing an OS dialog at the
                  home screen before the user has seen anything. Both are optional
                  and the app works without either. */}
              <div className="onb-asks">
                <button
                  type="button"
                  className={`onb-ask${wantsReminders ? ' onb-ask--on' : ''}`}
                  onClick={askReminders}
                >
                  <span className="onb-ask-title">Remind me{wantsReminders ? ' ✓' : ''}</span>
                  <span className="onb-ask-sub">A morning nudge and an evening check-in, at hours you choose.</span>
                </button>
                {canAskSteps && (
                  <button
                    type="button"
                    className={`onb-ask${wantsSteps ? ' onb-ask--on' : ''}`}
                    onClick={askSteps}
                  >
                    <span className="onb-ask-title">Count my steps{wantsSteps ? ' ✓' : ''}</span>
                    <span className="onb-ask-sub">Reads your daily step count from Health, so you never log it by hand.</span>
                  </button>
                )}
              </div>

              <div className="onb-finish-look">
                <p className="auth-step-sub">Make it yours. You can change all of this later.</p>
                <OnboardingCustomize />
              </div>
            </div>
          )}

          </div>{/* /.onb-screen */}

          {error && <p className="auth-error">{error}</p>}

          <div className="auth-actions">
            {screen !== 'finish' ? (
              <button className="auth-btn-primary" onClick={advance}>Continue →</button>
            ) : (
              <button
                className="auth-btn-primary"
                onClick={handleSignup}
                disabled={loading || habits.length === 0}
              >
                {loading ? 'Creating account…' : `Enter super${nickToWordmark(greetName)}`}
              </button>
            )}
          </div>

          {screen === 'account' && (
            <p className="auth-switch">
              Already have an account?{' '}
              <button className="auth-link" onClick={() => { setMode('login'); clearError(); }}>Log in</button>
            </p>
          )}
        </div>
      </div>
      {(screen === 'account' || screen === 'finish') && (
        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#4b5563', marginTop: 16, paddingBottom: 8 }}>
          By creating an account you agree to our{' '}
          <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: '#6b7280', textDecoration: 'underline' }}>Privacy Policy</a>
        </p>
      )}
    </div>
  );
};
