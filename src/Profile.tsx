import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './App.css';
import { api, clearToken } from './api';

interface ProfileData {
  dob: string;
  heightCm: string;
  weightKg: string;
  sex: 'male' | 'female';
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

const ACTIVITY_LEVELS = [
  { value: '1.2', label: 'Sedentary' },
  { value: '1.375', label: 'Light' },
  { value: '1.55', label: 'Moderate' },
  { value: '1.725', label: 'Very active' },
  { value: '1.9', label: 'Extra active' },
];

interface ProfileProps { onLogout?: () => void; }

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
  const deleteAccount = useDeleteAccount(onLogout);
  const [name, setName] = useState('');
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [target, setTarget] = useState<MacroSet>(DEFAULT_TARGET);
  const [habits, setHabits] = useState<string[]>(DEFAULT_HABITS);
  const [newHabit, setNewHabit] = useState('');
  const [loaded, setLoaded] = useState(false);

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
    ]).then(([profileData, targetData, habitsData]) => {
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
      const t = targetData as MacroSet;
      setTarget(t);
      setDraft({
        calories: String(t.calories),
        protein: String(t.protein),
        carbs: String(t.carbs),
        fats: String(t.fats),
      });
      setHabits((habitsData as string[]).length > 0 ? habitsData as string[] : DEFAULT_HABITS);
      setLoaded(true);
    }).catch(() => setLoaded(true));
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

  const title = name.trim() ? `Hello ${name.trim()}` : 'Profile';

  const commitDraft = () => {
    const cal = parseInt(draft.calories) || target.calories;
    const p = parseInt(draft.protein) || target.protein;
    const c = parseInt(draft.carbs) || target.carbs;
    const f = parseInt(draft.fats) || target.fats;
    const newTarget = { calories: cal, protein: p, carbs: c, fats: f };
    setTarget(newTarget);
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

  const updateProfile = (field: keyof ProfileData, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    scheduleProfileSave();
  };

  const updateName = (value: string) => {
    setName(value);
    scheduleProfileSave();
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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="#danger-zone" className="profile-danger-link">Delete account</a>
          {onLogout && <button className="header-btn" onClick={onLogout} style={{ fontSize: '0.75rem' }}>Log out</button>}
        </div>
      </header>

      <div className="profile-content page-content">
        {/* Name */}
        <div className="diet-section">
          <h2 className="diet-heading">Name</h2>
          <div className="target-grid">
            <div className="target-field">
              <label>Display Name</label>
              <input
                type="text"
                value={name}
                onChange={e => updateName(e.target.value)}
                placeholder="Your name"
              />
            </div>
          </div>
        </div>

        {/* Biographics */}
        <div className="diet-section">
          <h2 className="diet-heading">Biographics</h2>
          <div className="target-grid">
            <div className="target-field">
              <label>Height (cm)</label>
              <input type="text" inputMode="decimal" value={profile.heightCm} onChange={e => updateProfile('heightCm', e.target.value)} placeholder="e.g. 175" />
            </div>
            <div className="target-field">
              <label>Weight (kg)</label>
              <input type="text" inputMode="decimal" value={profile.weightKg} onChange={e => updateProfile('weightKg', e.target.value)} placeholder="e.g. 80" />
            </div>
            <div className="target-field">
              <label>Date of Birth</label>
              <input type="date" value={profile.dob} onChange={e => updateProfile('dob', e.target.value)} />
            </div>
            <div className="target-field">
              <label>Sex</label>
              <select value={profile.sex} onChange={e => updateProfile('sex', e.target.value as 'male' | 'female')}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className="target-field activity-field">
              <label>Activity Level</label>
              <select value={profile.activity} onChange={e => updateProfile('activity', e.target.value)}>
                {ACTIVITY_LEVELS.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
            <div className="target-field">
              <label>Daily Steps</label>
              <input type="text" inputMode="numeric" value={profile.steps} onChange={e => updateProfile('steps', e.target.value)} placeholder="e.g. 10000" />
            </div>
            <div className="target-field">
              <label>Vest Weight (kg)</label>
              <input type="text" inputMode="decimal" value={profile.vestKg} onChange={e => updateProfile('vestKg', e.target.value)} placeholder="0" />
            </div>
          </div>
        </div>

        {/* Targets */}
        <div className="diet-section">
          <h2 className="diet-heading">Targets</h2>
          <div className="target-grid">
            <div className="target-field">
              <label>Calories (kcal)</label>
              <input
                type="text" inputMode="numeric"
                value={draft.calories}
                onChange={e => setDraft(d => ({ ...d, calories: e.target.value }))}
                onBlur={commitDraft}
                onKeyDown={e => e.key === 'Enter' && commitDraft()}
              />
            </div>
            <div className="target-field">
              <label>Protein (g)</label>
              <input
                type="text" inputMode="numeric"
                value={draft.protein}
                onChange={e => setDraft(d => ({ ...d, protein: e.target.value }))}
                onBlur={commitDraft}
                onKeyDown={e => e.key === 'Enter' && commitDraft()}
              />
            </div>
            <div className="target-field">
              <label>Carbs (g)</label>
              <input
                type="text" inputMode="numeric"
                value={draft.carbs}
                onChange={e => setDraft(d => ({ ...d, carbs: e.target.value }))}
                onBlur={commitDraft}
                onKeyDown={e => e.key === 'Enter' && commitDraft()}
              />
            </div>
            <div className="target-field">
              <label>Fats (g)</label>
              <input
                type="text" inputMode="numeric"
                value={draft.fats}
                onChange={e => setDraft(d => ({ ...d, fats: e.target.value }))}
                onBlur={commitDraft}
                onKeyDown={e => e.key === 'Enter' && commitDraft()}
              />
            </div>
          </div>
          <div className="target-actions">
            <button className="plan-apply" onClick={advisableSplit}>Advisable Split</button>
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
