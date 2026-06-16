import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './App.css';
import { api, clearToken } from './api';
import { computeActivity, JOB_OPTS, GYM_OPTS, WALK_OPTS } from './Auth';

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
  { value: '1.2',   label: 'Sedentary — desk job, car commute, barely move outside work' },
  { value: '1.375', label: 'Lightly active — walking most days, gym 1–2×/week or light sport' },
  { value: '1.55',  label: 'Moderately active — gym or sport 3–4×/week, on your feet during the day' },
  { value: '1.725', label: 'Very active — hard training 5–6×/week, manual labour, or two-a-days' },
  { value: '1.9',   label: 'Extremely active — elite athlete, construction worker, training twice daily' },
];

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
  const [stepTarget, setStepTarget] = useState('10000');
  const [dietGoal, setDietGoal] = useState<'cut' | 'maintain' | 'bulk'>('cut');
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
      if (ws.goalWeight) setGoalWeight(ws.goalWeight);
      const s = settingsData as any;
      if (s.goal) setDietGoal(s.goal as 'cut' | 'maintain' | 'bulk');
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
            <div className="target-field" style={{ gridColumn: '1 / -1' }}>
              <label>Job type</label>
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
            <div className="target-field" style={{ gridColumn: '1 / -1' }}>
              <label>Gym / training</label>
              <div className="activity-picker activity-picker--row">
                {GYM_OPTS.map((o: any) => (
                  <button key={o.id} type="button" className={`activity-pick-chip${gymFreq === o.id ? ' active' : ''}`}
                    onClick={() => { setGymFreq(o.id); updateActivityPicker(jobType, o.id, walkFreq); }}>{o.label}</button>
                ))}
              </div>
            </div>
            <div className="target-field" style={{ gridColumn: '1 / -1' }}>
              <label>Walking / steps</label>
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
          <h2 className="diet-heading">Goal & Targets</h2>

          {/* Goal selector */}
          <div className="diet-goal-card" style={{ marginBottom: 20 }}>
            {(['cut', 'maintain', 'bulk'] as const).map(g => {
              const meta = {
                cut:      { icon: '🔥', label: 'Cut',      desc: 'Calorie deficit' },
                maintain: { icon: '⚖️', label: 'Maintain', desc: 'Match maintenance' },
                bulk:     { icon: '💪', label: 'Bulk',     desc: 'Calorie surplus' },
              }[g];
              return (
                <button
                  key={g}
                  className={`diet-goal-btn${dietGoal === g ? ' active' : ''}`}
                  onClick={() => {
                    setDietGoal(g);
                    api.updateDietSettings({ goal: g }).catch(() => {});
                  }}
                >
                  <span className="diet-goal-icon">{meta.icon}</span>
                  <span className="diet-goal-label">{meta.label}</span>
                  <span className="diet-goal-delta">{meta.desc}</span>
                </button>
              );
            })}
          </div>

          {/* Body goals */}
          {(profile.weightKg || goalWeight) && (() => {
            const cur = parseFloat(profile.weightKg) || 0;
            const goal = parseFloat(goalWeight) || 0;
            const pct = cur > 0 && goal > 0 && cur !== goal
              ? Math.max(0, Math.min(100, goal < cur
                  ? ((cur - goal) / cur) * 100 // cutting: how much already lost (inverted)
                  : ((cur / goal) * 100)))       // bulking: how close to goal
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
                    <span className="pbg-label">Goal weight</span>
                    <span className="pbg-val">{goal > 0 ? `${goal} kg` : '—'}</span>
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
              </div>
            );
          })()}

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
              {parseInt(draft.calories) > 0 && parseInt(draft.calories) < 1200 && (
                <span className="profile-cal-warn">⚠ Min 1,200 kcal for safety</span>
              )}
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
        <div className="diet-section">
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
