import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';
import { api, clearToken } from './api';
import { computeActivity, JOB_OPTS } from './Auth';

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

interface MacroSet { calories: number; protein: number; carbs: number; fats: number; }

const DEFAULT_PROFILE: ProfileData = {
  dob: '', heightCm: '', weightKg: '', sex: 'male', activity: '1.55', steps: '', vestKg: '',
};
const DEFAULT_TARGET: MacroSet = { calories: 2003, protein: 150, carbs: 200, fats: 67 };
const DEFAULT_HABITS = ['Walking', 'Praying', 'Duolingo'];
const GYM_MET_P: Record<string, number> = { light: 4, moderate: 6, hard: 8 };

interface WeeklyActivity {
  id: string; name: string; sessionsPerWeek: number; minutesPerSession: number;
  intensity: 'light' | 'moderate' | 'hard';
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso); const now = new Date();
  const diffMins = Math.floor((now.getTime() - then.getTime()) / 60000);
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

function stepsToWalkFreq(steps: number): string {
  if (steps < 3000) return 'barely';
  if (steps < 5000) return 'little';
  if (steps < 10000) return 'moderate';
  return 'alot';
}

function cmToFtIn(cm: number) {
  const totalIn = Math.round(cm / 2.54);
  return { ft: Math.floor(totalIn / 12), inch: totalIn % 12 };
}
function ftInToCm(ft: number, inch: number) { return Math.round((ft * 12 + inch) * 2.54); }
function kgToLbs(kg: number) { return Math.round(kg * 2.20462 * 10) / 10; }
function lbsToKg(lbs: number) { return Math.round(lbs / 2.20462 * 10) / 10; }
function kgToStLb(kg: number) {
  const totalLbs = kg * 2.20462;
  const st = Math.floor(totalLbs / 14);
  const lb = Math.round((totalLbs % 14) * 10) / 10;
  return { st, lb };
}
function stLbToKg(st: number, lb: number) { return Math.round((st * 14 + lb) / 2.20462 * 10) / 10; }
function fmtWeight(kg: number, unit: 'kg' | 'lbs' | 'st'): string {
  if (!kg) return '—';
  if (unit === 'lbs') return `${kgToLbs(kg)} lbs`;
  if (unit === 'st') { const { st, lb } = kgToStLb(kg); return `${st} st ${lb} lb`; }
  return `${kg} kg`;
}

interface ProfileProps { onLogout?: () => void; }

function useDeleteAccount(onLogout?: () => void) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'deleting'>('idle');
  const [error, setError] = useState('');
  const request = () => setStep('confirm');
  const cancel = () => { setStep('idle'); setError(''); };
  const confirm = async () => {
    setStep('deleting');
    try { await api.deleteAccount(); clearToken(); if (onLogout) onLogout(); else window.location.href = '/'; }
    catch { setError('Something went wrong. Please try again.'); setStep('confirm'); }
  };
  return { step, error, request, cancel, confirm };
}

const Profile: React.FC<ProfileProps> = ({ onLogout }) => {
  const navigate = useNavigate();
  const deleteAccount = useDeleteAccount(onLogout);

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
  const [stepTarget, setStepTarget] = useState('5000');
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

  // Quick weight log
  const [weightInput, setWeightInput] = useState('');
  const [weightSaved, setWeightSaved] = useState(false);

  // Avatar picker
  const [avatarSeed, setAvatarSeed] = useState<string | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  // Unit preferences
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ftin'>('cm');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs' | 'st'>('kg');
  const [heightFt, setHeightFt] = useState('5');
  const [heightIn, setHeightIn] = useState('9');
  // Goal weight drafts for non-kg modes
  const [goalWeightLbs, setGoalWeightLbs] = useState('');
  const [goalWeightSt, setGoalWeightSt] = useState('');
  const [goalWeightStLb, setGoalWeightStLb] = useState('');

  const [draft, setDraft] = useState({
    calories: String(DEFAULT_TARGET.calories),
    protein: String(DEFAULT_TARGET.protein),
    carbs: String(DEFAULT_TARGET.carbs),
    fats: String(DEFAULT_TARGET.fats),
  });

  // Sync goal weight drafts when goalWeight or weightUnit changes
  useEffect(() => {
    const kg = parseFloat(goalWeight);
    if (!kg) { setGoalWeightLbs(''); setGoalWeightSt(''); setGoalWeightStLb(''); return; }
    setGoalWeightLbs(String(kgToLbs(kg)));
    const { st, lb } = kgToStLb(kg);
    setGoalWeightSt(String(st));
    setGoalWeightStLb(String(lb));
  }, [goalWeight, weightUnit]);

  useEffect(() => {
    Promise.all([
      api.getProfile(), api.getDietTarget(), api.getHabits(),
      api.getWeightSettings(), api.getDietSettings(),
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
      setProfile({ dob: p.dob ?? '', heightCm: p.heightCm ?? '', weightKg: p.weightKg ?? '', sex: p.sex ?? 'male', activity: p.activity ?? '1.55', steps: p.steps ?? '', vestKg: p.vestKg ?? '' });
      const pa = p as any;
      if (pa.jobType) setJobType(pa.jobType);
      if (pa.gymFreq) setGymFreq(pa.gymFreq);
      if (pa.stepTarget) {
        const steps = parseInt(pa.stepTarget) || 5000;
        setStepTarget(String(steps));
        setWalkFreq(stepsToWalkFreq(steps));
      } else if (pa.walkFreq) {
        setWalkFreq(pa.walkFreq);
      }
      if (pa.gymSessionsPerWeek != null) setGymSessionsPerWeek(Number(pa.gymSessionsPerWeek));
      if (pa.gymIntensity) setGymIntensity(pa.gymIntensity as 'light' | 'moderate' | 'hard');
      if (pa.gymMinutes) setGymMinutes(Number(pa.gymMinutes));
      if (Array.isArray(pa.weeklyActivities)) setWeeklyActivities(pa.weeklyActivities);
      if (pa.avatarSeed) setAvatarSeed(pa.avatarSeed);
      if (pa.accountCreatedAt) setAccountCreatedAt(pa.accountCreatedAt);
      if (pa.lastLoginAt) setLastLoginAt(pa.lastLoginAt);
      if (pa.lastActiveAt) setLastActiveAt(pa.lastActiveAt);
      // Unit prefs
      if (pa.heightUnit) setHeightUnit(pa.heightUnit as 'cm' | 'ftin');
      if (pa.weightUnit) setWeightUnit(pa.weightUnit as 'kg' | 'lbs' | 'st');
      if (pa.heightUnit === 'ftin' && p.heightCm) {
        const { ft, inch } = cmToFtIn(parseFloat(p.heightCm));
        setHeightFt(String(ft)); setHeightIn(String(inch));
      }
      const t = targetData as MacroSet;
      setTarget(t);
      setDraft({ calories: String(t.calories), protein: String(t.protein), carbs: String(t.carbs), fats: String(t.fats) });
      const habitObjs = habitsData as { name: string }[];
      setHabits(habitObjs.length > 0 ? habitObjs.map(h => h.name) : DEFAULT_HABITS);
      setLoaded(true);
    }).catch(() => setLoaded(true));
    api.getAiKeyStatus().then((d: any) => { if (d.masked) setAiKeyMasked(d.masked); }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => {
      api.getProfile().then((p: any) => {
        if (p.weightKg) setProfile(prev => ({ ...prev, weightKg: String(p.weightKg) }));
      }).catch(() => {});
    };
    window.addEventListener('superdub:tracker-updated', handler);
    return () => window.removeEventListener('superdub:tracker-updated', handler);
  }, []);

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

  const targetSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const targetRef = useRef(target);
  useEffect(() => { targetRef.current = target; }, [target]);
  const scheduleTargetSave = () => {
    clearTimeout(targetSaveTimer.current);
    targetSaveTimer.current = setTimeout(() => { api.updateDietTarget(targetRef.current).catch(() => {}); }, 800);
  };

  const currentKg = parseFloat(profile.weightKg) || 0;
  const currentAge = ageFromDob(profile.dob);
  const actMult = parseFloat(profile.activity) || 1.55;
  const maintenance = (currentKg > 0 && parseFloat(profile.heightCm) > 0 && currentAge > 0)
    ? Math.round((profile.sex === 'female'
        ? 10 * currentKg + 6.25 * parseFloat(profile.heightCm) - 5 * currentAge - 161
        : 10 * currentKg + 6.25 * parseFloat(profile.heightCm) - 5 * currentAge + 5) * actMult)
    : 0;

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

  const gymCountToFreq = (n: number): string => {
    if (n === 0) return 'never';
    if (n <= 2) return '1-2';
    if (n <= 4) return '3-4';
    if (n <= 6) return '5-6';
    return 'daily';
  };

  const adjustSteps = (delta: number) => {
    const current = parseInt(stepTarget) || 5000;
    const next = Math.max(0, Math.min(50000, current + delta));
    const newWalk = stepsToWalkFreq(next);
    setStepTarget(String(next));
    setWalkFreq(newWalk);
    updateActivityPicker(jobType, gymFreq, newWalk);
    api.updateProfile({ ...profileRef.current, name: nameRef.current, stepTarget: next }).catch(() => {});
  };

  const updateActivityPicker = (job: string, gym: string, walk: string) => {
    const computed = String(computeActivity(job, gym, walk));
    setProfile(prev => ({ ...prev, activity: computed }));
    clearTimeout(profileSaveTimer.current);
    profileSaveTimer.current = setTimeout(() => {
      api.updateProfile({ ...profileRef.current, activity: computed, name: nameRef.current, jobType: job, gymFreq: gym, walkFreq: walk }).catch(() => {});
    }, 600);
  };

  const changeHeightUnit = (unit: 'cm' | 'ftin') => {
    setHeightUnit(unit);
    if (unit === 'ftin') {
      const cm = parseFloat(profile.heightCm) || 175;
      const { ft, inch } = cmToFtIn(cm);
      setHeightFt(String(ft)); setHeightIn(String(inch));
    }
    api.updateProfile({ ...profileRef.current, name: nameRef.current, heightUnit: unit }).catch(() => {});
  };

  const changeWeightUnit = (unit: 'kg' | 'lbs' | 'st') => {
    setWeightUnit(unit);
    api.updateProfile({ ...profileRef.current, name: nameRef.current, weightUnit: unit }).catch(() => {});
  };

  const saveGoalWeightKg = (kg: number) => {
    if (isNaN(kg) || kg <= 0) return;
    const cur = currentKg;
    setGoalWeight(String(kg));
    api.updateWeightSettings({ ...wsRef, goalWeight: String(kg), currentWeight: profile.weightKg }).catch(() => {});
    setWsRef((prev: any) => ({ ...prev, goalWeight: String(kg) }));
    const derived: 'cut' | 'maintain' | 'bulk' = kg < cur ? 'cut' : kg > cur ? 'bulk' : 'maintain';
    setDietGoal(derived);
    api.updateDietSettings({ goal: derived, calorieLock: locks.calories, lockProtein: locks.protein, lockCarbs: locks.carbs, lockFats: locks.fats }).catch(() => {});
    if (!locks.calories) applyGoalCalories(derived);
  };

  const saveTrainingSettings = (spw: number, intensity: string, minutes: number, activities: WeeklyActivity[]) => {
    api.updateProfile({ gymSessionsPerWeek: spw, gymIntensity: intensity, gymMinutes: minutes, weeklyActivities: JSON.stringify(activities) }).catch(() => {});
  };

  const addActivity = () => {
    const n = newActivityName.trim();
    if (!n) return;
    const activity: WeeklyActivity = { id: Date.now().toString(), name: n, sessionsPerWeek: newActivitySessions, minutesPerSession: newActivityMinutes, intensity: newActivityIntensity };
    const next = [...weeklyActivities, activity];
    setWeeklyActivities(next);
    saveTrainingSettings(gymSessionsPerWeek, gymIntensity, gymMinutes, next);
    setNewActivityName(''); setNewActivitySessions(2); setNewActivityMinutes(45); setNewActivityIntensity('moderate'); setShowAddActivity(false);
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
    setHabits(newHabits); setNewHabit('');
    api.updateHabits(newHabits).catch(() => {});
  };
  const removeHabit = (h: string) => {
    const newHabits = habits.filter(x => x !== h);
    setHabits(newHabits);
    api.updateHabits(newHabits).catch(() => {});
  };

  // Quick weight log → saves to today's tracker entry
  const weightLogUnit: 'kg' | 'lbs' = weightUnit === 'lbs' ? 'lbs' : 'kg';
  const logWeight = () => {
    const val = parseFloat(weightInput);
    if (!val || val <= 0) return;
    const kg = weightLogUnit === 'lbs' ? lbsToKg(val) : val;
    const now = new Date();
    const todayKey = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    api.updateTrackerDay(todayKey, { weight: String(kg) }).catch(() => {});
    setProfile(p => ({ ...p, weightKg: String(kg) }));
    window.dispatchEvent(new CustomEvent('superdub:tracker-updated'));
    setWeightSaved(true);
    setWeightInput('');
    setTimeout(() => setWeightSaved(false), 2200);
  };

  if (!loaded) {
    return (
      <div className="app flush" style={{ '--theme': '#2E8BFF', '--theme-dim': '#2E8BFF66', '--theme-glow': '#2E8BFF33' } as React.CSSProperties}>
        <div className="sd-loader-wrap"><div className="sd-loader"><img className="sd-loader-logo" src="/superdub-logo.png" alt="" /></div></div>
      </div>
    );
  }

  const goalKg = parseFloat(goalWeight) || 0;
  const isGain = goalKg > 0 && currentKg > 0 && goalKg > currentKg;
  const rateLabel = isGain ? 'Gain per week' : 'Lose per week';

  return (
    <div className="app flush" style={{ '--theme': '#2E8BFF', '--theme-dim': '#2E8BFF66', '--theme-glow': '#2E8BFF33' } as React.CSSProperties}>
      <div className="profile-content page-content">

        <div className="page-intro">
          <p className="page-intro-sub">Profile, settings & quick actions</p>
        </div>

        {/* Quick: Log Weight */}
        <div className="log-weight-card">
          <div className="log-weight-head">
            <span className="log-weight-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></span>
            <div>
              <div className="log-weight-title">Log Weight</div>
              <div className="log-weight-sub">Save today's weigh-in</div>
            </div>
          </div>
          <div className="log-weight-row">
            <div className="log-weight-input-unit">
              <input
                type="text"
                inputMode="decimal"
                value={weightInput}
                onChange={e => setWeightInput(e.target.value.replace(/[^0-9.]/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') logWeight(); }}
                placeholder={profile.weightKg ? (weightLogUnit === 'lbs' ? String(kgToLbs(parseFloat(profile.weightKg))) : profile.weightKg) : '0'}
              />
              <span className="log-weight-unit">{weightLogUnit}</span>
            </div>
            <button className="log-weight-btn" onClick={logWeight} disabled={!weightInput}>
              {weightSaved ? '✓ Saved' : 'Save'}
            </button>
          </div>
        </div>

        {/* Identity */}
        <div className="profile-identity">
          <button
            className="profile-avatar avatar-btn"
            onClick={() => setAvatarPickerOpen(true)}
            aria-label="Change avatar"
            title="Change avatar"
          >
            {avatarSeed ? (
              <img
                src={`https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(avatarSeed)}&size=80`}
                alt="avatar"
                className="profile-avatar-img"
              />
            ) : (
              <span className="profile-avatar-initial">{name ? name.trim()[0].toUpperCase() : '?'}</span>
            )}
            <span className="profile-avatar-edit-badge">✎</span>
          </button>
          <div className="profile-identity-info">
            <input id="profile-name-field" className="profile-name-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" maxLength={40} />
            <label htmlFor="profile-name-field" className="profile-name-hint">Tap to edit</label>
          </div>
        </div>

        {/* Avatar picker sheet */}
        {avatarPickerOpen && (() => {
          const AVATAR_SEEDS = [
            'Felix', 'Midnight', 'Pixel', 'Nova', 'Orbit', 'Cipher', 'Blaze', 'Echo',
            'Zara', 'Neon', 'Ghost', 'Storm',
          ];
          return (
            <div className="hb-sheet-overlay" onClick={() => setAvatarPickerOpen(false)}>
              <div className="hb-sheet avatar-picker-sheet" onClick={e => e.stopPropagation()}>
                <div className="hb-sheet-grip" />
                <div className="hb-sheet-head">
                  <h3 className="hb-sheet-title">Choose Avatar</h3>
                  <button className="hb-sheet-close" onClick={() => setAvatarPickerOpen(false)} aria-label="Close">✕</button>
                </div>
                <p className="hb-sheet-sub">Pick a pixel-art avatar for your profile.</p>
                <div className="avatar-grid">
                  {AVATAR_SEEDS.map(seed => (
                    <button
                      key={seed}
                      className={`avatar-option ${avatarSeed === seed ? 'selected' : ''}`}
                      onClick={() => {
                        setAvatarSeed(seed);
                        api.updateProfile({ avatarSeed: seed }).catch(() => {});
                        setAvatarPickerOpen(false);
                      }}
                    >
                      <img
                        src={`https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(seed)}&size=64`}
                        alt={seed}
                        className="avatar-option-img"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {(lastActiveAt || lastLoginAt || accountCreatedAt) && (
          <div className="profile-account-meta">
            {lastActiveAt && <span className="pam-item"><span className="pam-icon">⏱</span>Last active: <strong>{formatRelativeTime(lastActiveAt)}</strong></span>}
            {lastLoginAt && <span className="pam-item"><span className="pam-icon">🔐</span>Last login: <strong>{formatDate(lastLoginAt)}</strong></span>}
            {accountCreatedAt && <span className="pam-item"><span className="pam-icon">📅</span>Member since <strong>{formatDate(accountCreatedAt)}</strong></span>}
          </div>
        )}

        {/* ── About You ── */}
        <div className="diet-section">
          <h2 className="diet-heading">About You</h2>

          {/* Unit preferences */}
          <div className="bio-field">
            <label className="bio-label">Units</label>
            <div className="unit-pref-row">
              <div className="unit-pref-group">
                <div className="unit-pref-title">Height</div>
                <div className="unit-seg">
                  <button type="button" className={`unit-seg-btn${heightUnit === 'cm' ? ' active' : ''}`} onClick={() => changeHeightUnit('cm')}>cm</button>
                  <button type="button" className={`unit-seg-btn${heightUnit === 'ftin' ? ' active' : ''}`} onClick={() => changeHeightUnit('ftin')}>ft · in</button>
                </div>
              </div>
              <div className="unit-pref-group">
                <div className="unit-pref-title">Weight</div>
                <div className="unit-seg">
                  <button type="button" className={`unit-seg-btn${weightUnit === 'kg' ? ' active' : ''}`} onClick={() => changeWeightUnit('kg')}>kg</button>
                  <button type="button" className={`unit-seg-btn${weightUnit === 'lbs' ? ' active' : ''}`} onClick={() => changeWeightUnit('lbs')}>lbs</button>
                  <button type="button" className={`unit-seg-btn${weightUnit === 'st' ? ' active' : ''}`} onClick={() => changeWeightUnit('st')}>st</button>
                </div>
              </div>
            </div>
          </div>

          <div className="bio-pair">
            <div className="bio-field">
              <label className="bio-label">Height</label>
              {heightUnit === 'cm' ? (
                <div className="bio-input-unit">
                  <input type="text" inputMode="decimal" value={profile.heightCm} onChange={e => updateProfile('heightCm', e.target.value)} placeholder="175" />
                  <span className="bio-unit">cm</span>
                </div>
              ) : (
                <div className="bio-ftin-row">
                  <div className="bio-input-unit">
                    <input type="text" inputMode="numeric" value={heightFt} placeholder="5"
                      onChange={e => setHeightFt(e.target.value)}
                      onBlur={() => updateProfile('heightCm', String(ftInToCm(parseInt(heightFt) || 0, parseInt(heightIn) || 0)))}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                    <span className="bio-unit">ft</span>
                  </div>
                  <div className="bio-input-unit">
                    <input type="text" inputMode="numeric" value={heightIn} placeholder="9"
                      onChange={e => setHeightIn(e.target.value)}
                      onBlur={() => updateProfile('heightCm', String(ftInToCm(parseInt(heightFt) || 0, parseInt(heightIn) || 0)))}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                    <span className="bio-unit">in</span>
                  </div>
                </div>
              )}
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
                <button key={s} type="button" className={`bio-pill${profile.sex === s ? ' active' : ''}`} onClick={() => updateProfile('sex', s)}>
                  {s === 'male' ? 'Male' : s === 'female' ? 'Female' : 'Other'}
                </button>
              ))}
            </div>
          </div>

          <div className="bio-field">
            <label className="bio-label">Vest weight</label>
            <div className="bio-input-unit" style={{ maxWidth: 120 }}>
              <input type="text" inputMode="decimal" value={profile.vestKg} onChange={e => updateProfile('vestKg', e.target.value)} placeholder="0" />
              <span className="bio-unit">kg</span>
            </div>
          </div>
        </div>

        {/* ── Activity ── */}
        <div className="diet-section">
          <h2 className="diet-heading">Activity</h2>
          <p className="diet-hint" style={{ marginBottom: 14 }}>These three factors feed your maintenance calorie calculation.</p>

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

          {weeklyActivities.length > 0 || showAddActivity ? (
            <div className="bio-field" style={{ marginTop: 16 }}>
              <label className="bio-label">Other activities</label>
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
                  <input className="aaf-name-input" type="text" placeholder="Activity name (e.g. Swimming, Cycling)" value={newActivityName}
                    onChange={e => setNewActivityName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addActivity()} autoFocus />
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
                      <input className="aaf-mins-input" type="text" inputMode="numeric" value={newActivityMinutes} onChange={e => setNewActivityMinutes(parseInt(e.target.value) || 45)} />
                    </div>
                  </div>
                  <div className="bio-pills" style={{ marginBottom: 10 }}>
                    {(['light', 'moderate', 'hard'] as const).map(i => (
                      <button key={i} type="button" className={`bio-pill${newActivityIntensity === i ? ' active' : ''}`} onClick={() => setNewActivityIntensity(i)}>
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
          ) : (
            <button className="add-activity-trigger" style={{ marginTop: 16 }} onClick={() => setShowAddActivity(true)}>+ Add other activity (swimming, cycling…)</button>
          )}
        </div>

        {/* ── Plan ── */}
        <div className="diet-section">
          <h2 className="diet-heading">Plan</h2>

          {/* Goal weight */}
          <div className="pbg-row">
            <div className="pbg-col">
              <span className="pbg-label">Current</span>
              <span className="pbg-val">{fmtWeight(currentKg, weightUnit)}</span>
            </div>
            <div className="pbg-arrow">→</div>
            <div className="pbg-col">
              <span className="pbg-label">Goal ({weightUnit === 'st' ? 'st + lb' : weightUnit})</span>
              {weightUnit === 'st' ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="bio-input-unit" style={{ flex: 1 }}>
                    <input className="pbg-goal-input" type="text" inputMode="numeric" value={goalWeightSt} placeholder="12"
                      onChange={e => setGoalWeightSt(e.target.value)}
                      onBlur={() => saveGoalWeightKg(stLbToKg(parseInt(goalWeightSt) || 0, parseFloat(goalWeightStLb) || 0))}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                    <span className="bio-unit">st</span>
                  </div>
                  <div className="bio-input-unit" style={{ flex: 1 }}>
                    <input className="pbg-goal-input" type="text" inputMode="decimal" value={goalWeightStLb} placeholder="0"
                      onChange={e => setGoalWeightStLb(e.target.value)}
                      onBlur={() => saveGoalWeightKg(stLbToKg(parseInt(goalWeightSt) || 0, parseFloat(goalWeightStLb) || 0))}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                    <span className="bio-unit">lb</span>
                  </div>
                </div>
              ) : (
                <input className="pbg-goal-input" type="text" inputMode="decimal"
                  value={weightUnit === 'lbs' ? goalWeightLbs : goalWeight}
                  placeholder={weightUnit === 'lbs' ? 'e.g. 154' : 'e.g. 70'}
                  onChange={e => { if (weightUnit === 'lbs') setGoalWeightLbs(e.target.value); else setGoalWeight(e.target.value); }}
                  onBlur={() => { const kg = weightUnit === 'lbs' ? lbsToKg(parseFloat(goalWeightLbs)) : parseFloat(goalWeight); saveGoalWeightKg(kg); }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                />
              )}
            </div>
          </div>
          {currentKg > 0 && goalKg > 0 && (
            <div className="pbg-bar-wrap">
              <div className="pbg-bar">
                <div className="pbg-fill" style={{ width: `${Math.max(0, Math.min(100, isGain ? (currentKg / goalKg) * 100 : ((currentKg - goalKg) / currentKg) * 100))}%` }} />
              </div>
              <span className="pbg-diff">
                {currentKg > goalKg ? `${fmtWeight(currentKg - goalKg, weightUnit)} to lose` : currentKg < goalKg ? `${fmtWeight(goalKg - currentKg, weightUnit)} to gain` : 'At goal!'}
              </span>
            </div>
          )}

          {/* Rate */}
          <div className="bio-loss-row" style={{ marginTop: 16 }}>
            <span className="bio-loss-label">{rateLabel}</span>
            <div className="bio-loss-right">
              <input type="text" inputMode="decimal" className="bio-loss-input" value={lossPerWeek} placeholder="0.5"
                onChange={e => setLossPerWeek(e.target.value)}
                onBlur={() => {
                  const lpw = parseFloat(lossPerWeek);
                  const val = isNaN(lpw) || lpw < 0 ? '' : String(Math.min(2, lpw));
                  setLossPerWeek(val);
                  if (val) {
                    const updated = { ...wsRef, lossPerWeek: val };
                    api.updateWeightSettings(updated).catch(() => {}); setWsRef(updated);
                    if (!locks.calories) applyGoalCalories(dietGoal, parseFloat(val));
                  }
                }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
              <span className="bio-loss-unit">kg / week</span>
            </div>
          </div>

          {/* Calorie cascade */}
          {(() => {
            const rate = parseFloat(lossPerWeek) || 0;
            const dailyDelta = rate > 0 ? Math.round(rate * 7700 / 7) : 0;
            const rawTarget = maintenance > 0
              ? (isGain ? maintenance + dailyDelta : maintenance - dailyDelta)
              : target.calories;
            const floorHit = !isGain && rawTarget < 1200 && maintenance > 0 && rate > 0;
            const planTarget = floorHit ? 1200 : rawTarget;
            const actualRate = floorHit ? Math.round((maintenance - 1200) / 7700 * 7 * 10) / 10 : rate;
            return (
              <div className="cal-cascade">
                <div className="cal-cascade-row">
                  <span className="cal-cascade-label">Maintenance</span>
                  <span className="cal-cascade-val">{maintenance > 0 ? `${maintenance.toLocaleString()} kcal` : '—'}</span>
                </div>
                {rate > 0 && maintenance > 0 && (
                  <div className="cal-cascade-row cal-cascade-delta">
                    <span className="cal-cascade-label">{isGain ? '+' : '−'} {dailyDelta.toLocaleString()} kcal/day <span className="cal-cascade-sub">({rate} kg/wk {isGain ? 'surplus' : 'deficit'})</span></span>
                  </div>
                )}
                <div className="cal-cascade-divider" />
                <div className="cal-cascade-row cal-cascade-target-row">
                  <span className="cal-cascade-label">Target</span>
                  <span className="cal-cascade-target-val">
                    {planTarget > 0 ? `${planTarget.toLocaleString()} kcal` : '—'}
                    {floorHit && <span className="cal-floor-badge">floor</span>}
                  </span>
                </div>
                {floorHit && (
                  <div className="cal-floor-msg">
                    ⚠ At 1,200 kcal you'll lose ~{actualRate} kg/wk, not {rate}. Raise gym or steps below to get more room.
                  </div>
                )}
              </div>
            );
          })()}

          {/* Activity levers */}
          <div className="plan-levers">
            <div className="plan-lever-row">
              <span className="plan-lever-label">Gym sessions / week</span>
              <div className="training-sessions-row">
                <button className="training-step-btn" onClick={() => {
                  const n = Math.max(0, gymSessionsPerWeek - 1);
                  const freq = gymCountToFreq(n);
                  setGymSessionsPerWeek(n); setGymFreq(freq);
                  updateActivityPicker(jobType, freq, walkFreq);
                  saveTrainingSettings(n, gymIntensity, gymMinutes, weeklyActivities);
                }}>−</button>
                <span className="training-step-val">{gymSessionsPerWeek}</span>
                <button className="training-step-btn" onClick={() => {
                  const n = Math.min(7, gymSessionsPerWeek + 1);
                  const freq = gymCountToFreq(n);
                  setGymSessionsPerWeek(n); setGymFreq(freq);
                  updateActivityPicker(jobType, freq, walkFreq);
                  saveTrainingSettings(n, gymIntensity, gymMinutes, weeklyActivities);
                }}>+</button>
              </div>
            </div>
            <div className="plan-lever-row">
              <span className="plan-lever-label">Daily steps</span>
              <div className="step-counter-row">
                <button className="step-counter-btn step-counter-btn--big" onClick={() => adjustSteps(-1000)}>−−</button>
                <button className="step-counter-btn" onClick={() => adjustSteps(-100)}>−</button>
                <span className="step-counter-val">{parseInt(stepTarget || '5000').toLocaleString()}</span>
                <button className="step-counter-btn" onClick={() => adjustSteps(100)}>+</button>
                <button className="step-counter-btn step-counter-btn--big" onClick={() => adjustSteps(1000)}>++</button>
              </div>
            </div>
            {gymSessionsPerWeek > 0 && (
              <div className="plan-lever-row plan-lever-row--sub">
                <span className="plan-lever-label" style={{ color: '#444' }}>Session details</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div className="bio-input-unit" style={{ width: 72 }}>
                    <input type="text" inputMode="numeric" value={gymMinutes}
                      onChange={e => setGymMinutes(parseInt(e.target.value) || 60)}
                      onBlur={() => saveTrainingSettings(gymSessionsPerWeek, gymIntensity, gymMinutes, weeklyActivities)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                    <span className="bio-unit">min</span>
                  </div>
                  <div className="bio-pills" style={{ gap: 4 }}>
                    {(['light', 'moderate', 'hard'] as const).map(i => (
                      <button key={i} type="button" className={`bio-pill${gymIntensity === i ? ' active' : ''}`}
                        onClick={() => { setGymIntensity(i); saveTrainingSettings(gymSessionsPerWeek, i, gymMinutes, weeklyActivities); }}>
                        {i.charAt(0).toUpperCase() + i.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Macros */}
          <div className="plan-macros-section">
            <div className="plan-macros-header">
              <span className="plan-macros-title">Macros</span>
              <button className={`profile-lock-btn${locks.calories ? ' locked' : ''}`} onClick={() => toggleLock('calories')} title={locks.calories ? 'Unlock calorie target' : 'Lock calorie target'} style={{ fontSize: '0.85rem' }}>
                {locks.calories ? '🔒' : '🔓'} kcal
              </button>
            </div>
            {locks.calories && (
              <div className="profile-macro-input-row" style={{ marginBottom: 12 }}>
                <input className="profile-macro-input" type="text" inputMode="numeric" value={draft.calories}
                  onChange={e => setDraft(d => ({ ...d, calories: e.target.value }))}
                  onBlur={commitDraft} onKeyDown={e => e.key === 'Enter' && commitDraft()} />
                <span style={{ fontSize: '0.75rem', color: '#555', whiteSpace: 'nowrap' }}>kcal override</span>
              </div>
            )}
            <div className="profile-macro-grid">
              <div className="profile-macro-field">
                <div className="profile-macro-label-row">
                  <label className="profile-macro-label">Protein <span className="profile-macro-unit">g</span></label>
                  {currentKg > 0 && target.protein > 0 && <span className="profile-per-kg">{(target.protein / currentKg).toFixed(1)} g/kg</span>}
                </div>
                <div className="profile-macro-input-row">
                  <input className="profile-macro-input" type="text" inputMode="numeric" value={draft.protein}
                    onChange={e => setDraft(d => ({ ...d, protein: e.target.value }))}
                    onBlur={commitDraft} onKeyDown={e => e.key === 'Enter' && commitDraft()} />
                  <button className={`profile-lock-btn${locks.protein ? ' locked' : ''}`} onClick={() => toggleLock('protein')}>{locks.protein ? '🔒' : '🔓'}</button>
                </div>
              </div>

              <div className="profile-macro-field">
                <label className="profile-macro-label">Carbs <span className="profile-macro-unit">g</span></label>
                <div className="profile-macro-input-row">
                  <input className="profile-macro-input" type="text" inputMode="numeric" value={draft.carbs}
                    onChange={e => setDraft(d => ({ ...d, carbs: e.target.value }))}
                    onBlur={commitDraft} onKeyDown={e => e.key === 'Enter' && commitDraft()} />
                  <button className={`profile-lock-btn${locks.carbs ? ' locked' : ''}`} onClick={() => toggleLock('carbs')}>{locks.carbs ? '🔒' : '🔓'}</button>
                </div>
              </div>

              <div className="profile-macro-field">
                <label className="profile-macro-label">Fats <span className="profile-macro-unit">g</span></label>
                <div className="profile-macro-input-row">
                  <input className="profile-macro-input" type="text" inputMode="numeric" value={draft.fats}
                    onChange={e => setDraft(d => ({ ...d, fats: e.target.value }))}
                    onBlur={commitDraft} onKeyDown={e => e.key === 'Enter' && commitDraft()} />
                  <button className={`profile-lock-btn${locks.fats ? ' locked' : ''}`} onClick={() => toggleLock('fats')}>{locks.fats ? '🔒' : '🔓'}</button>
                </div>
              </div>
            </div>

            {(() => {
              const totalFromMacros = target.protein * 4 + target.carbs * 4 + target.fats * 9;
              const diff = Math.abs(totalFromMacros - target.calories);
              if (diff < 50 || target.calories <= 0) return null;
              return (
                <div className="profile-macro-mismatch">
                  <span>Macros add up to {totalFromMacros.toLocaleString()} kcal, not {target.calories.toLocaleString()}</span>
                  <button className="profile-macro-rebalance-btn" onClick={advisableSplit}>Fix</button>
                </div>
              );
            })()}
          </div>{/* end plan-macros-section */}
        </div>{/* end Plan diet-section */}

        {/* ── Habits ── */}
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
            <input type="text" value={newHabit} onChange={e => setNewHabit(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addHabit()} placeholder="New habit name" className="habit-add-input" />
            <button className="habit-add-btn" onClick={addHabit}>+</button>
          </div>
        </div>

        {/* ── Settings ── */}
        <div id="ai-key" className="diet-section">
          <h2 className="diet-heading">Settings</h2>
          <p className="diet-hint" style={{ marginBottom: 12 }}>Your Anthropic API key powers AI food logging. Stored encrypted — never logged in plaintext.</p>
          {aiKeyMasked && !aiKeyInput && (
            <div className="ai-key-connected">
              <span className="ai-key-badge">Connected: {aiKeyMasked}</span>
              <button className="ai-key-remove-btn" onClick={async () => { await api.saveAiKey('').catch(() => {}); setAiKeyMasked(null); }}>Remove</button>
            </div>
          )}
          <div className="ai-key-row">
            <input className="ai-key-input" type="password" placeholder={aiKeyMasked ? 'Enter new key to replace…' : 'sk-ant-…'}
              value={aiKeyInput} onChange={e => { setAiKeyInput(e.target.value); setAiKeyDone(false); }} autoComplete="off" />
            <button className="ai-key-save-btn" disabled={!aiKeyInput.trim() || aiKeySaving}
              onClick={async () => {
                setAiKeySaving(true);
                try { await api.saveAiKey(aiKeyInput.trim()); const d = await api.getAiKeyStatus() as any; setAiKeyMasked(d.masked ?? null); setAiKeyInput(''); setAiKeyDone(true); }
                catch { } finally { setAiKeySaving(false); }
              }}>{aiKeySaving ? '…' : aiKeyDone ? '✓' : 'Save'}</button>
          </div>
          <p className="diet-hint" style={{ marginTop: 6 }}>Get your key at <span style={{ color: '#2E8BFF' }}>console.anthropic.com</span></p>
        </div>

        {/* ── More menu ── */}
        <div className="more-menu">
          <button className="more-menu-item" onClick={() => navigate('/about')}>
            <span className="more-menu-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span>
            <span className="more-menu-label">About Superdub</span>
            <span className="more-menu-arrow">›</span>
          </button>
          <button className="more-menu-item" onClick={() => navigate('/privacy')}>
            <span className="more-menu-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
            <span className="more-menu-label">Privacy Policy</span>
            <span className="more-menu-arrow">›</span>
          </button>
          {onLogout && (
            <button className="more-menu-item" onClick={onLogout}>
              <span className="more-menu-icon">🚪</span>
              <span className="more-menu-label">Log out</span>
              <span className="more-menu-arrow">›</span>
            </button>
          )}
        </div>

        {/* ── Danger Zone ── */}
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
                <button className="delete-account-cancel" onClick={deleteAccount.cancel} disabled={deleteAccount.step === 'deleting'}>Cancel</button>
                <button className="delete-account-confirm-btn" onClick={deleteAccount.confirm} disabled={deleteAccount.step === 'deleting'}>
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
