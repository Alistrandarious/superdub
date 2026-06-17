import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './App.css';
import { api, clearToken } from './api';
import { computeActivity, JOB_OPTS, GYM_OPTS, WALK_OPTS } from './Auth';

interface ProfileData {
  dob: string;
  heightCm: string;
  weightKg: string;
  sex: 'male' | 'female' | 'other';
  activity: string;
  steps: string;
  vestKg: string;
}

function ageFromDob(dob: string): number {
  if (!dob) return 0;
  const born = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const m = today.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < born.getDate())) age--;
  return Math.max(0, age);
}

interface MacroSet {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

const DEFAULT_PROFILE: ProfileData = {
  dob: '', heightCm: '', weightKg: '', sex: 'male', activity: '1.55', steps: '', vestKg: '',
};

const DEFAULT_TARGET: MacroSet = { calories: 2003, protein: 150, carbs: 200, fats: 67 };

const DEFAULT_HABITS = ['Walking', 'Praying', 'Duolingo'];

const GYM_MET_P: Record<string, number> = { light: 4, moderate: 6, hard: 8 };

interface WeeklyActivity {
  id: string;
  name: string;
  sessionsPerWeek: number;
  minutesPerSession: number;
  intensity: 'light' | 'moderate' | 'hard';
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface ProfileProps { onLogout?: () => void; }

function useSettingsMenu(onLogout?: () => void) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return { open, setOpen, ref };
}

function useDeleteAccount(onLogout?: () => void) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'deleting'>('idle');
  const [error, setError] = useState('');

  const request = () => setStep('confirm');
  const cancel = () => { setStep('idle'); setError(''); };
  const confirm = async () => {
    setStep('deleting');
    try {
      await api.deleteAccount();
      clearToken();
      if (onLogout) onLogout();
      else window.location.href = '/';
    } catch {
      setError('Something went wrong. Please try again.');
      setStep('confirm');
    }
  };

  return { step, error, request, cancel, confirm };
}

const Profile: React.FC<ProfileProps> = ({ onLogout }) => {
  const navigate = useNavigate();
  const deleteAccount = useDeleteAccount(onLogout);
  const settings = useSettingsMenu(onLogout);
  const [name, setName] = useState('');
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [target, setTarget] = useState<MacroSet>(DEFAULT_TARGET);
  const [habits, setHabits] = useState<string[]>(DEFAULT_HABITS);
  const [newHabit, setNewHabit] = useState('');
  const [jobType, setJobType] = useState('desk');
  const [gymFreq, setGymFreq] = useState('3-4');
  const [walkFreq, setWalkFreq] = useState('moderate');
  const [goalWeight, setGoalWeight] = useState('');
  const [wsRef, setWsRef] = useState<any>({});
  const [stepTarget, setStepTarget] = useState('10000');
  const [dietGoal, setDietGoal] = useState<'cut' | 'maintain' | 'bulk'>('cut');
  const [lossPerWeek, setLossPerWeek] = useState('');
  const [locks, setLocks] = useState({ calories: false, protein: false, carbs: false, fats: false });
  const [gymSessionsPerWeek, setGymSessionsPerWeek] = useState(3);
  const [gymIntensity, setGymIntensity] = useState<'light' | 'moderate' | 'hard'>('moderate');
  const [gymMinutes, setGymMinutes] = useState(60);
  const [weeklyActivities, setWeeklyActivities] = useState<WeeklyActivity[]>([]);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivitySessions, setNewActivitySessions] = useState(2);
  const [newActivityMinutes, setNewActivityMinutes] = useState(45);
  const [newActivityIntensity, setNewActivityIntensity] = useState<'light' | 'moderate' | 'hard'>('moderate');
  const [accountCreatedAt, setAccountCreatedAt] = useState<string | null>(null);
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null);
  const [lastActiveAt, setLastActiveAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [aiKeyInput, setAiKeyInput] = useState('');
  const [aiKeyMasked, setAiKeyMasked] = useState<string | null>(null);
  const [aiKeySaving, setAiKeySaving] = useState(false);
  const [aiKeyDone, setAiKeyDone] = useState(false);

  const [draft, setDraft] = useState({
    calories: String(DEFAULT_TARGET.calories),
    protein: String(DEFAULT_TARGET.protein),
    carbs: String(DEFAULT_TARGET.carbs),
    fats: String(DEFAULT_TARGET.fats),
  });

  useEffect(() => {
    Promise.all([
      api.getProfile(),
      api.getDietTarget(),
      api.getHabits(),
      api.getWeightSettings(),
      api.getDietSettings(),
    ]).then(([profileData, targetData, habitsData, wsData, settingsData]) => {
      const ws = wsData as any;
      setWsRef(ws);
      if (ws.goalWeight) setGoalWeight(ws.goalWeight);
      if (ws.lossPerWeek) setLossPerWeek(ws.lossPerWeek);
      const s = settingsData as any;
      if (s.goal) setDietGoal(s.goal as 'cut' | 'maintain' | 'bulk');
      setLocks({ calories: !!s.calorieLock, protein: !!s.lockProtein, carbs: !!s.lockCarbs, fats: !!s.lockFats });
      const p = profileData as ProfileData & { name: string };
      setName(p.name ?? '');
      setProfile({
        dob: p.dob ?? '',
        heightCm: p.heightCm ?? '',
        weightKg: p.weightKg ?? '',
        sex: p.sex ?? 'male',
        activity: p.activity ?? '1.55',
        steps: p.steps ?? '',
        vestKg: p.vestKg ?? '',
      });
      const pa = p as any;
      if (pa.jobType) setJobType(pa.jobType);
      if (pa.gymFreq) setGymFreq(pa.gymFreq);
      if (pa.walkFreq) setWalkFreq(pa.walkFreq);
      if (pa.stepTarget) setStepTarget(String(pa.stepTarget));
      if (pa.gymSessionsPerWeek != null) setGymSessionsPerWeek(Number(pa.gymSessionsPerWeek));
      if (pa.gymIntensity) setGymIntensity(pa.gymIntensity as 'light' | 'moderate' | 'hard');
      if (pa.gymMinutes) setGymMinutes(Number(pa.gymMinutes));
      if (Array.isArray(pa.weeklyActivities)) setWeeklyActivities(pa.weeklyActivities);
      if (pa.accountCreatedAt) setAccountCreatedAt(pa.accountCreatedAt);
      if (pa.lastLoginAt) setLastLoginAt(pa.lastLoginAt);
      if (pa.lastActiveAt) setLastActiveAt(pa.lastActiveAt);
      const t = targetData as MacroSet;
      setTarget(t);
      setDraft({
        calories: String(t.calories),
        protein: String(t.protein),
        carbs: String(t.carbs),
        fats: String(t.fats),
      });
      const habitObjs = habitsData as { name: string }[];
      setHabits(habitObjs.length > 0 ? habitObjs.map(h => h.name) : DEFAULT_HABITS);
      setLoaded(true);
    }).catch(() => setLoaded(true));
    api.getAiKeyStatus().then((d: any) => { if (d.masked) setAiKeyMasked(d.masked); }).catch(() => {});
  }, []);

  // Refresh current weight when DailyCheckIn saves a new weight
  useEffect(() => {
    const handler = () => {
      api.getProfile().then((p: any) => {
        if (p.weightKg) setProfile(prev => ({ ...prev, weightKg: String(p.weightKg) }));
      }).catch(() => {});
    };
    window.addEventListener('superdub:tracker-updated', handler);
    return () => window.removeEventListener('superdub:tracker-updated', handler);
  }, []);

  // Debounced profile save
  const profileSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const profileRef = useRef(profile);
  const nameRef = useRef(name);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { nameRef.current = name; }, [name]);

  const scheduleProfileSave = () => {
    clearTimeout(profileSaveTimer.current);
    profileSaveTimer.current = setTimeout(() => {
      api.updateProfile({ ...profileRef.current, name: nameRef.current }).catch(() => {});
    }, 800);
  };

  // Debounced target save
  const targetSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const targetRef = useRef(target);
  useEffect(() => { targetRef.current = target; }, [target]);

  const scheduleTargetSave = () => {
    clearTimeout(targetSaveTimer.current);
    targetSaveTimer.current = setTimeout(() => {
      api.updateDietTarget(targetRef.current).catch(() => {});
    }, 800);
  };

  const title = 'Profile';

  const currentKg = parseFloat(profile.weightKg) || 0;
  const currentAge = ageFromDob(profile.dob);
  const actMult = parseFloat(profile.activity) || 1.55;
  const maintenance = (currentKg > 0 && parseFloat(profile.heightCm) > 0 && currentAge > 0)
    ? Math.round((profile.sex === 'female'
        ? 10 * currentKg + 6.25 * parseFloat(profile.heightCm) - 5 * currentAge - 161
        : 10 * currentKg + 6.25 * parseFloat(profile.heightCm) - 5 * currentAge + 5) * actMult)
    : 0;
  const autoGoal: 'cut' | 'maintain' | 'bulk' | null = (() => {
    const gw = parseFloat(goalWeight) || 0;
    if (currentKg <= 0 || gw <= 0) return null;
    if (gw > currentKg) return 'bulk';
    if (gw < currentKg) return 'cut';
    return 'maintain';
  })();

  const MIN_SAFE_CALORIES = 1200;
  const MAX_SAFE_CALORIES = 6000;

  const commitDraft = () => {
    let cal = parseInt(draft.calories) || target.calories;
    cal = Math.max(MIN_SAFE_CALORIES, Math.min(MAX_SAFE_CALORIES, cal));
    const p = Math.max(0, parseInt(draft.protein) || target.protein);
    const c = Math.max(0, parseInt(draft.carbs) || target.carbs);
    const f = Math.max(0, parseInt(draft.fats) || target.fats);
    const newTarget = { calories: cal, protein: p, carbs: c, fats: f };
    setTarget(newTarget);
    setDraft({ calories: String(cal), protein: String(p), carbs: String(c), fats: String(f) });
    scheduleTargetSave();
  };

  const advisableSplit = () => {
    const kg = parseFloat(profile.weightKg) || 70;
    const p = Math.round(kg * 2);
    const f = Math.round(kg * 0.8);
    const cal = parseInt(draft.calories) || target.calories;
    const carbCals = cal - p * 4 - f * 9;
    const c = Math.max(Math.round(carbCals / 4), 50);
    const newTarget = { calories: cal, protein: p, carbs: c, fats: f };
    setTarget(newTarget);
    setDraft({ calories: String(cal), protein: String(p), carbs: String(c), fats: String(f) });
    api.updateDietTarget(newTarget).catch(() => {});
  };

  const toggleLock = (key: 'calories' | 'protein' | 'carbs' | 'fats') => {
    setLocks(prev => {
      const next = { ...prev, [key]: !prev[key] };
      api.updateDietSettings({ calorieLock: next.calories, lockProtein: next.protein, lockCarbs: next.carbs, lockFats: next.fats, goal: dietGoal }).catch(() => {});
      return next;
    });
  };

  const applyGoalCalories = (g: 'cut' | 'maintain' | 'bulk', rateOverride?: number) => {
    if (maintenance <= 0) return;
    const rate = rateOverride ?? parseFloat(lossPerWeek) ?? 0;
    const dailyDelta = rate > 0 ? Math.round(rate * 7700 / 7) : 400;
    const targetCals = locks.calories ? target.calories
                     : g === 'cut' ? Math.max(MIN_SAFE_CALORIES, maintenance - dailyDelta)
                     : g === 'bulk' ? maintenance + dailyDelta
                     : maintenance;
    const kg = currentKg || 70;
    const finalProtein = locks.protein ? target.protein : Math.round(kg * (g === 'cut' ? 2.0 : g === 'bulk' ? 1.8 : 1.7));
    const finalFat     = locks.fats    ? target.fats    : Math.round(kg * (g === 'cut' ? 0.8 : g === 'bulk' ? 1.1 : 0.9));
    const carbCals     = Math.max(0, targetCals - finalProtein * 4 - finalFat * 9);
    const finalCarbs   = locks.carbs   ? target.carbs   : Math.round(carbCals / 4);
    const actualCals   = finalProtein * 4 + finalCarbs * 4 + finalFat * 9;
    const next = { calories: actualCals, protein: finalProtein, carbs: finalCarbs, fats: finalFat };
    setTarget(next);
    setDraft({ calories: String(actualCals), protein: String(finalProtein), carbs: String(finalCarbs), fats: String(finalFat) });
    api.updateDietTarget(next).catch(() => {});
  };

  const updateProfile = (field: keyof ProfileData, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    scheduleProfileSave();
  };

  const updateActivityPicker = (job: string, gym: string, walk: string) => {
    const computed = String(computeActivity(job, gym, walk));
    setProfile(prev => ({ ...prev, activity: computed }));
    clearTimeout(profileSaveTimer.current);
    profileSaveTimer.current = setTimeout(() => {
      api.updateProfile({ ...profileRef.current, activity: computed, name: nameRef.current, jobType: job, gymFreq: gym, walkFreq: walk }).catch(() => {});
    }, 600);
  };

  const saveTrainingSettings = (spw: number, intensity: string, minutes: number, activities: WeeklyActivity[]) => {
    api.updateProfile({
      gymSessionsPerWeek: spw,
      gymIntensity: intensity,
      gymMinutes: minutes,
      weeklyActivities: JSON.stringify(activities),
    }).catch(() => {});
  };

  const addActivity = () => {
    const name = newActivityName.trim();
    if (!name) return;
    const activity: WeeklyActivity = {
      id: Date.now().toString(),
      name,
      sessionsPerWeek: newActivitySessions,
      minutesPerSession: newActivityMinutes,
      intensity: newActivityIntensity,
    };
    const next = [...weeklyActivities, activity];
    setWeeklyActivities(next);
    saveTrainingSettings(gymSessionsPerWeek, gymIntensity, gymMinutes, next);
    setNewActivityName('');
    setNewActivitySessions(2);
    setNewActivityMinutes(45);
    setNewActivityIntensity('moderate');
    setShowAddActivity(false);
  };

  const removeActivity = (id: string) => {
    const next = weeklyActivities.filter(a => a.id !== id);
    setWeeklyActivities(next);
    saveTrainingSettings(gymSessionsPerWeek, gymIntensity, gymMinutes, next);
  };

  const addHabit = () => {
    const h = newHabit.trim();
    if (!h || habits.includes(h)) return;
    const newHabits = [...habits, h];
    setHabits(newHabits);
    setNewHabit('');
    api.updateHabits(newHabits).catch(() => {});
  };

  const removeHabit = (h: string) => {
    const newHabits = habits.filter(x => x !== h);
    setHabits(newHabits);
    api.updateHabits(newHabits).catch(() => {});
  };

  if (!loaded) {
    return (
      <div className="app" style={{ '--theme': '#ff9f0a', '--theme-dim': '#ff9f0a66', '--theme-glow': '#ff9f0a33' } as React.CSSProperties}>
        <header className="header">
          <div className="header-left"><Link to="/" className="back-link">← Back</Link></div>
          <h1 className="title">Profile</h1>
        </header>
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '4rem', color: '#ff9f0a' }}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="app" style={{ '--theme': '#ff9f0a', '--theme-dim': '#ff9f0a66', '--theme-glow': '#ff9f0a33' } as React.CSSProperties}>
      <header className="header">
        <div className="header-left">
          <Link to="/" className="back-link">← Back</Link>
        </div>
        <h1 className="title">{title}</h1>
        <div className="settings-menu-wrap" ref={settings.ref} style={{ marginLeft: 'auto' }}>
          <button
            className="settings-gear-btn"
            onClick={() => settings.setOpen(o => !o)}
            aria-label="Settings"
          >
            ⚙
          </button>
          {settings.open && (
            <div className="settings-dropdown">
              <button className="settings-dropdown-item" onClick={() => { settings.setOpen(false); navigate('/about'); }}>
                <span>📖</span> About
              </button>
              <button className="settings-dropdown-item" onClick={() => { settings.setOpen(false); navigate('/privacy'); }}>
                <span>🔏</span> Privacy Policy
              </button>
              <div className="settings-dropdown-divider" />
              {onLogout && (
                <button className="settings-dropdown-item" onClick={() => { settings.setOpen(false); onLogout(); }}>
                  <span>🚪</span> Log out
                </button>
              )}
              <button className="settings-dropdown-item settings-dropdown-danger" onClick={() => { settings.setOpen(false); }}>
                <a href="#danger-zone" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>⚠️</span> Delete account
                </a>
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="profile-content page-content">

        {/* Identity header */}
        <div className="profile-identity">
          <div className="profile-avatar">{name ? name.trim()[0].toUpperCase() : '?'}</div>
          <div className="profile-identity-info">
            <input
              className="profile-name-input"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              maxLength={40}
            />
            <div className="profile-name-hint">Tap to edit</div>
          </div>
        </div>

        {/* Account meta */}
        {(lastActiveAt || lastLoginAt || accountCreatedAt) && (
          <div className="profile-account-meta">
            {lastActiveAt && (
              <span className="pam-item">
                <span className="pam-icon">⏱</span>
                Last active: <strong>{formatRelativeTime(lastActiveAt)}</strong>
              </span>
            )}
            {lastLoginAt && (
              <span className="pam-item">
                <span className="pam-icon">🔐</span>
                Last login: <strong>{formatDate(lastLoginAt)}</strong>
              </span>
            )}
            {accountCreatedAt && (
              <span className="pam-item">
                <span className="pam-icon">📅</span>
                Member since <strong>{formatDate(accountCreatedAt)}</strong>
              </span>
            )}
          </div>
        )}

        {/* Biographics */}
        <div className="diet-section">
          <h2 className="diet-heading">Biographics</h2>

          <div className="bio-pair">
            <div className="bio-field">
              <label className="bio-label">Height</label>
              <div className="bio-input-unit">
                <input type="text" inputMode="decimal" value={profile.heightCm} onChange={e => updateProfile('heightCm', e.target.value)} placeholder="175" />
                <span className="bio-unit">cm</span>
              </div>
            </div>
            <div className="bio-field">
              <label className="bio-label">Date of Birth</label>
              <input type="date" value={profile.dob} onChange={e => updateProfile('dob', e.target.value)} />
            </div>
          </div>

          <div className="bio-field">
            <label className="bio-label">Sex</label>
            <div className="bio-pills">
              {(['male', 'female', 'other'] as const).map(s => (
                <button key={s} type="button"
                  className={`bio-pill${profile.sex === s ? ' active' : ''}`}
                  onClick={() => updateProfile('sex', s)}>
                  {s === 'male' ? 'Male' : s === 'female' ? 'Female' : 'Other'}
                </button>
              ))}
            </div>
          </div>

          <div className="bio-field">
            <label className="bio-label">Job type</label>
            <div className="activity-picker">
              {JOB_OPTS.map((o: any) => (
                <button key={o.id} type="button" className={`activity-pick-btn${jobType === o.id ? ' active' : ''}`}
                  onClick={() => { setJobType(o.id); updateActivityPicker(o.id, gymFreq, walkFreq); }}>
                  <span className="apb-label">{o.label}</span>
                  <span className="apb-desc">{o.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bio-field">
            <label className="bio-label">Gym / Training / Climbing</label>
            <div className="activity-picker activity-picker--row">
              {GYM_OPTS.map((o: any) => (
                <button key={o.id} type="button" className={`activity-pick-chip${gymFreq === o.id ? ' active' : ''}`}
                  onClick={() => { setGymFreq(o.id); updateActivityPicker(jobType, o.id, walkFreq); }}>{o.label}</button>
              ))}
            </div>
          </div>

          <div className="bio-field">
            <label className="bio-label">Walking / Steps</label>
            <div className="activity-picker">
              {WALK_OPTS.map((o: any) => (
                <button key={o.id} type="button" className={`activity-pick-btn${walkFreq === o.id ? ' active' : ''}`}
                  onClick={() => { setWalkFreq(o.id); updateActivityPicker(jobType, gymFreq, o.id); }}>
                  <span className="apb-label">{o.label}</span>
                  <span className="apb-desc">{o.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bio-pair">
            <div className="bio-field">
              <label className="bio-label">Daily Steps</label>
              <input type="text" inputMode="numeric" value={profile.steps} onChange={e => updateProfile('steps', e.target.value)} placeholder="e.g. 10000" />
            </div>
            <div className="bio-field">
              <label className="bio-label">Vest Weight</label>
              <div className="bio-input-unit">
                <input type="text" inputMode="decimal" value={profile.vestKg} onChange={e => updateProfile('vestKg', e.target.value)} placeholder="0" />
                <span className="bio-unit">kg</span>
              </div>
            </div>
          </div>
        </div>

        {/* Training Plan */}
        <div className="diet-section">
          <h2 className="diet-heading">Training Plan</h2>

          <div className="bio-field">
            <label className="bio-label">Gym sessions / week</label>
            <div className="training-sessions-row">
              <button className="training-step-btn" onClick={() => {
                const n = Math.max(0, gymSessionsPerWeek - 1);
                setGymSessionsPerWeek(n);
                saveTrainingSettings(n, gymIntensity, gymMinutes, weeklyActivities);
              }}>−</button>
              <span className="training-step-val">{gymSessionsPerWeek}</span>
              <button className="training-step-btn" onClick={() => {
                const n = Math.min(7, gymSessionsPerWeek + 1);
                setGymSessionsPerWeek(n);
                saveTrainingSettings(n, gymIntensity, gymMinutes, weeklyActivities);
              }}>+</button>
              <span className="training-step-unit">{gymSessionsPerWeek === 1 ? 'session' : 'sessions'}/week</span>
            </div>
          </div>

          {gymSessionsPerWeek > 0 && (
            <>
              <div className="bio-pair">
                <div className="bio-field">
                  <label className="bio-label">Duration per session</label>
                  <div className="bio-input-unit">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={gymMinutes}
                      onChange={e => setGymMinutes(parseInt(e.target.value) || 60)}
                      onBlur={() => saveTrainingSettings(gymSessionsPerWeek, gymIntensity, gymMinutes, weeklyActivities)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    />
                    <span className="bio-unit">min</span>
                  </div>
                </div>
                <div className="bio-field">
                  <label className="bio-label">Intensity</label>
                  <div className="bio-pills">
                    {(['light', 'moderate', 'hard'] as const).map(i => (
                      <button
                        key={i}
                        type="button"
                        className={`bio-pill${gymIntensity === i ? ' active' : ''}`}
                        onClick={() => {
                          setGymIntensity(i);
                          saveTrainingSettings(gymSessionsPerWeek, i, gymMinutes, weeklyActivities);
                        }}
                      >
                        {i.charAt(0).toUpperCase() + i.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {currentKg > 0 && (
                <div className="training-burn-est">
                  ~{Math.round(GYM_MET_P[gymIntensity] * currentKg * gymMinutes / 60).toLocaleString()} kcal/session
                  <span className="tbe-sep">·</span>
                  ~{Math.round(gymSessionsPerWeek * GYM_MET_P[gymIntensity] * currentKg * gymMinutes / 60 / 7).toLocaleString()} kcal/day avg
                </div>
              )}
            </>
          )}

          {/* Extra activities */}
          <div className="bio-field" style={{ marginTop: 18 }}>
            <label className="bio-label">Other weekly activities</label>
            {weeklyActivities.length === 0 && !showAddActivity && (
              <p className="diet-hint" style={{ marginBottom: 8 }}>Add swimming, cycling, football — anything you commit to weekly.</p>
            )}
            {weeklyActivities.map(a => {
              const aMet = GYM_MET_P[a.intensity] ?? 6;
              const bps = currentKg > 0 ? Math.round(aMet * currentKg * a.minutesPerSession / 60) : 0;
              return (
                <div key={a.id} className="activity-entry-row">
                  <div className="aer-info">
                    <span className="aer-name">{a.name}</span>
                    <span className="aer-detail">{a.sessionsPerWeek}×/week · {a.minutesPerSession} min · {a.intensity}{currentKg > 0 ? ` · ~${bps} kcal/session` : ''}</span>
                  </div>
                  <button className="aer-remove" onClick={() => removeActivity(a.id)} title="Remove">✕</button>
                </div>
              );
            })}

            {showAddActivity ? (
              <div className="add-activity-form">
                <input
                  className="aaf-name-input"
                  type="text"
                  placeholder="Activity name (e.g. Swimming, Cycling)"
                  value={newActivityName}
                  onChange={e => setNewActivityName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addActivity()}
                  autoFocus
                />
                <div className="aaf-row">
                  <div className="aaf-col">
                    <label className="aaf-label">Sessions/week</label>
                    <div className="training-sessions-row" style={{ gap: 6 }}>
                      <button className="training-step-btn" onClick={() => setNewActivitySessions(Math.max(1, newActivitySessions - 1))}>−</button>
                      <span className="training-step-val">{newActivitySessions}</span>
                      <button className="training-step-btn" onClick={() => setNewActivitySessions(Math.min(7, newActivitySessions + 1))}>+</button>
                    </div>
                  </div>
                  <div className="aaf-col">
                    <label className="aaf-label">Duration (min)</label>
                    <input
                      className="aaf-mins-input"
                      type="text"
                      inputMode="numeric"
                      value={newActivityMinutes}
                      onChange={e => setNewActivityMinutes(parseInt(e.target.value) || 45)}
                    />
                  </div>
                </div>
                <div className="bio-pills" style={{ marginBottom: 10 }}>
                  {(['light', 'moderate', 'hard'] as const).map(i => (
                    <button
                      key={i}
                      type="button"
                      className={`bio-pill${newActivityIntensity === i ? ' active' : ''}`}
                      onClick={() => setNewActivityIntensity(i)}
                    >
                      {i.charAt(0).toUpperCase() + i.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="aaf-actions">
                  <button className="aaf-cancel-btn" onClick={() => { setShowAddActivity(false); setNewActivityName(''); }}>Cancel</button>
                  <button className="aaf-save-btn" onClick={addActivity} disabled={!newActivityName.trim()}>Add Activity</button>
                </div>
              </div>
            ) : (
              <button className="add-activity-trigger" onClick={() => setShowAddActivity(true)}>+ Add activity</button>
            )}
          </div>
        </div>

        {/* Targets */}
        <div className="diet-section">
          <h2 className="diet-heading">Goal & Targets</h2>

          {/* Body goals — always shown so user can set goal weight */}
          {(() => {
            const cur = parseFloat(profile.weightKg) || 0;
            const goal = parseFloat(goalWeight) || 0;
            const pct = cur > 0 && goal > 0 && cur !== goal
              ? Math.max(0, Math.min(100, goal < cur
                  ? ((cur - goal) / cur) * 100
                  : ((cur / goal) * 100)))
              : 0;
            return (
              <div className="profile-body-goals">
                <div className="pbg-row">
                  <div className="pbg-col">
                    <span className="pbg-label">Current weight</span>
                    <span className="pbg-val">{cur > 0 ? `${cur} kg` : '—'}</span>
                  </div>
                  <div className="pbg-arrow">→</div>
                  <div className="pbg-col">
                    <span className="pbg-label">Goal weight (kg)</span>
                    <input
                      className="pbg-goal-input"
                      type="text"
                      inputMode="decimal"
                      value={goalWeight}
                      placeholder="e.g. 70"
                      onChange={e => setGoalWeight(e.target.value)}
                      onBlur={() => {
                        const gw = parseFloat(goalWeight);
                        if (!isNaN(gw) && gw > 0) {
                          api.updateWeightSettings({ ...wsRef, goalWeight: String(gw), currentWeight: profile.weightKg }).catch(() => {});
                          setWsRef((prev: any) => ({ ...prev, goalWeight: String(gw) }));
                        }
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    />
                  </div>
                </div>
                {cur > 0 && goal > 0 && (
                  <div className="pbg-bar-wrap">
                    <div className="pbg-bar">
                      <div className="pbg-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="pbg-diff">{cur > goal ? `${(cur - goal).toFixed(1)} kg to go` : cur < goal ? `${(goal - cur).toFixed(1)} kg to gain` : 'At goal!'}</span>
                  </div>
                )}
                <div className="bio-loss-row">
                  <span className="bio-loss-label">{autoGoal === 'bulk' ? 'Gain per week' : 'Lose per week'}</span>
                  <div className="bio-loss-right">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="bio-loss-input"
                      value={lossPerWeek}
                      placeholder="0.5"
                      onChange={e => setLossPerWeek(e.target.value)}
                      onBlur={() => {
                        const lpw = parseFloat(lossPerWeek);
                        const val = isNaN(lpw) || lpw < 0 ? '' : String(Math.min(2, lpw));
                        setLossPerWeek(val);
                        if (val) {
                          const updated = { ...wsRef, lossPerWeek: val };
                          api.updateWeightSettings(updated).catch(() => {});
                          setWsRef(updated);
                          // Re-derive calorie target from the new rate
                          if (dietGoal && !locks.calories) applyGoalCalories(dietGoal, parseFloat(val));
                        }
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    />
                    <span className="bio-loss-unit">kg / week</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Strategy + Maintenance */}
          {maintenance > 0 && (
            <div className="profile-maintenance-row">
              <span className="profile-maintenance-label">Maintenance</span>
              <span className="profile-maintenance-val">{maintenance.toLocaleString()} kcal/day</span>
            </div>
          )}
          {autoGoal && (
            <div className="profile-autostrategy">
              {autoGoal === 'cut' ? '🔥 Cut — goal is below current weight'
               : autoGoal === 'bulk' ? '💪 Bulk — goal is above current weight'
               : '⚖️ Maintain — at goal weight'}
            </div>
          )}
          <div className="profile-apply-row">
            {(['cut', 'maintain', 'bulk'] as const).map(g => {
              const meta = {
                cut:      { icon: '🔥', label: 'Cut',      delta: '−400 kcal' },
                maintain: { icon: '⚖️', label: 'Maintain', delta: '= maintenance' },
                bulk:     { icon: '💪', label: 'Bulk',     delta: '+300 kcal' },
              }[g];
              const disabled = maintenance <= 0 || (!!autoGoal && autoGoal !== g);
              return (
                <button
                  key={g}
                  className={`profile-apply-btn${dietGoal === g ? ' active' : ''}`}
                  disabled={disabled}
                  title={disabled && autoGoal && autoGoal !== g ? `Set goal weight to ${g === 'bulk' ? 'gain' : 'lose'} first` : undefined}
                  onClick={() => {
                    setDietGoal(g);
                    api.updateDietSettings({ goal: g, calorieLock: locks.calories, lockProtein: locks.protein, lockCarbs: locks.carbs, lockFats: locks.fats }).catch(() => {});
                    applyGoalCalories(g);
                  }}
                >
                  <span className="profile-apply-icon">{meta.icon}</span>
                  <span className="profile-apply-label">{meta.label}</span>
                  <span className="profile-apply-delta">{meta.delta}</span>
                </button>
              );
            })}
          </div>

          <div className="profile-macro-grid">
            {/* Calories */}
            <div className="profile-macro-field">
              <div className="profile-macro-label-row">
                <label className="profile-macro-label">Calories <span className="profile-macro-unit">kcal</span></label>
                <button className={`profile-lock-btn${locks.calories ? ' locked' : ''}`} onClick={() => toggleLock('calories')} title={locks.calories ? 'Unlock calories' : 'Lock calories'}>
                  {locks.calories ? '🔒' : '🔓'}
                </button>
              </div>
              <div className="profile-macro-input-row">
                <input
                  className="profile-macro-input"
                  type="text" inputMode="numeric"
                  value={draft.calories}
                  onChange={e => setDraft(d => ({ ...d, calories: e.target.value }))}
                  onBlur={commitDraft}
                  onKeyDown={e => e.key === 'Enter' && commitDraft()}
                />
              </div>
              {parseInt(draft.calories) > 0 && parseInt(draft.calories) < 1200 && (
                <span className="profile-cal-warn">⚠ Min 1,200 kcal</span>
              )}
              {maintenance > 0 && target.calories > 0 && (
                <span className="profile-cal-vs">
                  vs {maintenance.toLocaleString()} maint.&nbsp;
                  <span style={{ color: target.calories < maintenance ? '#30d158' : target.calories > maintenance ? '#ff453a' : '#888' }}>
                    ({target.calories > maintenance ? '+' : ''}{(target.calories - maintenance).toLocaleString()} kcal)
                  </span>
                </span>
              )}
              {!locks.calories && lossPerWeek && parseFloat(lossPerWeek) > 0 && maintenance > 0 && (
                <span className="profile-cal-vs" style={{ color: '#666' }}>
                  {parseFloat(lossPerWeek)} kg/wk = −{Math.round(parseFloat(lossPerWeek) * 7700 / 7).toLocaleString()} kcal/day
                </span>
              )}
            </div>

            {/* Protein */}
            <div className="profile-macro-field">
              <div className="profile-macro-label-row">
                <label className="profile-macro-label">Protein <span className="profile-macro-unit">g</span></label>
                {currentKg > 0 && target.protein > 0 && (
                  <span className="profile-per-kg">{(target.protein / currentKg).toFixed(1)} g/kg</span>
                )}
              </div>
              <div className="profile-macro-input-row">
                <input
                  className="profile-macro-input"
                  type="text" inputMode="numeric"
                  value={draft.protein}
                  onChange={e => setDraft(d => ({ ...d, protein: e.target.value }))}
                  onBlur={commitDraft}
                  onKeyDown={e => e.key === 'Enter' && commitDraft()}
                />
                <button className={`profile-lock-btn${locks.protein ? ' locked' : ''}`} onClick={() => toggleLock('protein')} title={locks.protein ? 'Unlock protein' : 'Lock protein'}>
                  {locks.protein ? '🔒' : '🔓'}
                </button>
              </div>
            </div>

            {/* Carbs */}
            <div className="profile-macro-field">
              <label className="profile-macro-label">Carbs <span className="profile-macro-unit">g</span></label>
              <div className="profile-macro-input-row">
                <input
                  className="profile-macro-input"
                  type="text" inputMode="numeric"
                  value={draft.carbs}
                  onChange={e => setDraft(d => ({ ...d, carbs: e.target.value }))}
                  onBlur={commitDraft}
                  onKeyDown={e => e.key === 'Enter' && commitDraft()}
                />
                <button className={`profile-lock-btn${locks.carbs ? ' locked' : ''}`} onClick={() => toggleLock('carbs')} title={locks.carbs ? 'Unlock carbs' : 'Lock carbs'}>
                  {locks.carbs ? '🔒' : '🔓'}
                </button>
              </div>
            </div>

            {/* Fats */}
            <div className="profile-macro-field">
              <label className="profile-macro-label">Fats <span className="profile-macro-unit">g</span></label>
              <div className="profile-macro-input-row">
                <input
                  className="profile-macro-input"
                  type="text" inputMode="numeric"
                  value={draft.fats}
                  onChange={e => setDraft(d => ({ ...d, fats: e.target.value }))}
                  onBlur={commitDraft}
                  onKeyDown={e => e.key === 'Enter' && commitDraft()}
                />
                <button className={`profile-lock-btn${locks.fats ? ' locked' : ''}`} onClick={() => toggleLock('fats')} title={locks.fats ? 'Unlock fats' : 'Lock fats'}>
                  {locks.fats ? '🔒' : '🔓'}
                </button>
              </div>
            </div>
          </div>
          <div className="target-actions">
            <button className="plan-apply" onClick={advisableSplit}>Advisable Split</button>
          </div>
          <div className="target-field" style={{ marginTop: 12 }}>
            <label>Daily step target</label>
            <input
              type="text" inputMode="numeric"
              value={stepTarget}
              onChange={e => setStepTarget(e.target.value)}
              onBlur={() => {
                const n = parseInt(stepTarget) || 10000;
                setStepTarget(String(n));
                api.updateProfile({ ...profileRef.current, name: nameRef.current, stepTarget: n }).catch(() => {});
              }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              placeholder="e.g. 10000"
            />
          </div>
        </div>

        {/* Habits */}
        <div className="diet-section">
          <h2 className="diet-heading">Habits</h2>
          <ul className="habit-list">
            {habits.map(h => (
              <li key={h} className="habit-item">
                <span>{h}</span>
                <button className="habit-remove" onClick={() => removeHabit(h)}>✕</button>
              </li>
            ))}
          </ul>
          <div className="habit-add">
            <input
              type="text"
              value={newHabit}
              onChange={e => setNewHabit(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addHabit()}
              placeholder="New habit name"
              className="habit-add-input"
            />
            <button className="habit-add-btn" onClick={addHabit}>+</button>
          </div>
        </div>

        {/* AI Key */}
        <div id="ai-key" className="diet-section">
          <h2 className="diet-heading">AI Key</h2>
          <p className="diet-hint">Your personal Anthropic API key is stored securely on our server and used only to power food logging. We never see the key in plaintext responses.</p>
          {aiKeyMasked && !aiKeyInput && (
            <div className="ai-key-connected">
              <span className="ai-key-badge">Connected: {aiKeyMasked}</span>
              <button className="ai-key-remove-btn" onClick={async () => {
                await api.saveAiKey('').catch(() => {});
                setAiKeyMasked(null);
              }}>Remove</button>
            </div>
          )}
          <div className="ai-key-row">
            <input
              className="ai-key-input"
              type="password"
              placeholder={aiKeyMasked ? 'Enter new key to replace…' : 'sk-ant-…'}
              value={aiKeyInput}
              onChange={e => { setAiKeyInput(e.target.value); setAiKeyDone(false); }}
              autoComplete="off"
            />
            <button
              className="ai-key-save-btn"
              disabled={!aiKeyInput.trim() || aiKeySaving}
              onClick={async () => {
                setAiKeySaving(true);
                try {
                  await api.saveAiKey(aiKeyInput.trim());
                  const d = await api.getAiKeyStatus() as any;
                  setAiKeyMasked(d.masked ?? null);
                  setAiKeyInput('');
                  setAiKeyDone(true);
                } catch { /* ignore */ } finally { setAiKeySaving(false); }
              }}
            >{aiKeySaving ? '…' : aiKeyDone ? '✓' : 'Save'}</button>
          </div>
          <p className="diet-hint" style={{ marginTop: 6 }}>Get your key at <span style={{ color: '#0a84ff' }}>console.anthropic.com</span></p>
        </div>

        {/* Delete account */}
        <div id="danger-zone" className="diet-section delete-account-section">
          <h2 className="diet-heading" style={{ color: '#ff453a' }}>Danger Zone</h2>
          {deleteAccount.step === 'idle' && (
            <>
              <p className="delete-account-desc">Permanently delete your account and all your data. This cannot be undone.</p>
              <button className="delete-account-btn" onClick={deleteAccount.request}>Delete my account</button>
            </>
          )}
          {(deleteAccount.step === 'confirm' || deleteAccount.step === 'deleting') && (
            <div className="delete-account-confirm">
              <p className="delete-account-desc">Are you sure? Every habit, log, meal plan, and task will be wiped forever.</p>
              {deleteAccount.error && <p className="delete-account-error">{deleteAccount.error}</p>}
              <div className="delete-account-actions">
                <button
                  className="delete-account-cancel"
                  onClick={deleteAccount.cancel}
                  disabled={deleteAccount.step === 'deleting'}
                >
                  Cancel
                </button>
                <button
                  className="delete-account-confirm-btn"
                  onClick={deleteAccount.confirm}
                  disabled={deleteAccount.step === 'deleting'}
                >
                  {deleteAccount.step === 'deleting' ? 'Deleting…' : 'Yes, delete everything'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
