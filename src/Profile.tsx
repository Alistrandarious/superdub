import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';
import { api, clearToken } from './api';
import { computeActivity, JOB_OPTS } from './Auth';
import SuperdubHeader from './SuperdubHeader';
import LevelCustomizer from './LevelCustomizer';
import { OCCUPATIONS, ETHNICITIES, GENDER_IDENTITIES, COUNTRIES, RELATIONSHIP_STATUSES, RELIGIONS } from './demographics';
import { pageTheme, GROWTH } from './theme';
import { setWeightUnit as persistWeightUnit } from './weightUnit';
import { setBrandNick, nickToWordmark } from './brand';

interface ProfileData {
  dob: string;
  heightCm: string;
  weightKg: string;
  sex: 'male' | 'female' | 'other';
  activity: string;
  steps: string;
}


const DEFAULT_PROFILE: ProfileData = {
  dob: '', heightCm: '', weightKg: '', sex: 'male', activity: '1.55', steps: '',
};
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


function cmToFtIn(cm: number) {
  const totalIn = Math.round(cm / 2.54);
  return { ft: Math.floor(totalIn / 12), inch: totalIn % 12 };
}
function ftInToCm(ft: number, inch: number) { return Math.round((ft * 12 + inch) * 2.54); }

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
  const [nickname, setNickname] = useState('');
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [jobType, setJobType] = useState('desk');
  // Optional demographic / job / religion fields
  const [occupation, setOccupation] = useState('');
  const [ethnicity, setEthnicity] = useState('');
  const [genderIdentity, setGenderIdentity] = useState('');
  const [country, setCountry] = useState('');
  const [relationshipStatus, setRelationshipStatus] = useState('');
  const [religion, setReligion] = useState('');
  const [gymFreq, setGymFreq] = useState('3-4');
  const [walkFreq, setWalkFreq] = useState('moderate');
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

  // Quick weight log

  // Avatar picker

  // Unit preferences — persisted in localStorage (no server column)
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ftin'>(
    () => (localStorage.getItem('superdub.heightUnit') as 'cm' | 'ftin') || 'cm'
  );
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs' | 'st'>(
    () => (localStorage.getItem('superdub.weightUnit') as 'kg' | 'lbs' | 'st') || 'kg'
  );
  const [heightFt, setHeightFt] = useState('5');
  const [heightIn, setHeightIn] = useState('9');

  useEffect(() => {
    api.getProfile().then((profileData: any) => {
      const p = profileData as ProfileData & { name: string; nickname?: string };
      setName(p.name ?? '');
      setNickname(p.nickname ?? '');
      setProfile({ dob: p.dob ?? '', heightCm: p.heightCm ?? '', weightKg: p.weightKg ?? '', sex: p.sex ?? 'male', activity: p.activity ?? '1.55', steps: p.steps ?? '' });
      const pa = p as any;
      if (pa.jobType) setJobType(pa.jobType);
      if (pa.gymFreq) setGymFreq(pa.gymFreq);
      if (pa.walkFreq) setWalkFreq(pa.walkFreq);
      if (pa.gymSessionsPerWeek != null) setGymSessionsPerWeek(Number(pa.gymSessionsPerWeek));
      if (pa.gymIntensity) setGymIntensity(pa.gymIntensity as 'light' | 'moderate' | 'hard');
      if (pa.gymMinutes) setGymMinutes(Number(pa.gymMinutes));
      if (Array.isArray(pa.weeklyActivities)) setWeeklyActivities(pa.weeklyActivities);
      setOccupation(pa.occupation ?? '');
      setEthnicity(pa.ethnicity ?? '');
      setGenderIdentity(pa.genderIdentity ?? '');
      setCountry(pa.country ?? '');
      setRelationshipStatus(pa.relationshipStatus ?? '');
      setReligion(pa.religion ?? '');
      if (pa.accountCreatedAt) setAccountCreatedAt(pa.accountCreatedAt);
      if (pa.lastLoginAt) setLastLoginAt(pa.lastLoginAt);
      if (pa.lastActiveAt) setLastActiveAt(pa.lastActiveAt);
      // Init ft/in display if user already has that unit pref in localStorage
      const storedHeightUnit = localStorage.getItem('superdub.heightUnit');
      if (storedHeightUnit === 'ftin' && p.heightCm) {
        const { ft, inch } = cmToFtIn(parseFloat(p.heightCm));
        setHeightFt(String(ft)); setHeightIn(String(inch));
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
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
  const nicknameRef = useRef(nickname);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { nameRef.current = name; }, [name]);
  useEffect(() => { nicknameRef.current = nickname; }, [nickname]);

  const scheduleProfileSave = () => {
    clearTimeout(profileSaveTimer.current);
    profileSaveTimer.current = setTimeout(() => {
      const nick = nicknameRef.current.trim();
      api.updateProfile({ ...profileRef.current, name: nameRef.current, nickname: nick }).catch(() => {});
      setBrandNick(nick); // live-update the wordmark on every header
    }, 800);
  };

  const currentKg = parseFloat(profile.weightKg) || 0;

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

  const changeHeightUnit = (unit: 'cm' | 'ftin') => {
    setHeightUnit(unit);
    localStorage.setItem('superdub.heightUnit', unit);
    if (unit === 'ftin') {
      const cm = parseFloat(profile.heightCm) || 175;
      const { ft, inch } = cmToFtIn(cm);
      setHeightFt(String(ft)); setHeightIn(String(inch));
    }
  };

  const changeWeightUnit = (unit: 'kg' | 'lbs' | 'st') => {
    setWeightUnit(unit);
    persistWeightUnit(unit); // writes localStorage + broadcasts to open screens
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

  // Persist a single demographic/job/religion field on change.
  const saveDemographic = (patch: Record<string, string>) => {
    api.updateProfile({ ...profileRef.current, name: nameRef.current, ...patch }).catch(() => {});
  };

  const DEMOGRAPHIC_FIELDS = [
    { label: 'Occupation', value: occupation, set: setOccupation, key: 'occupation', opts: OCCUPATIONS },
    { label: 'Country', value: country, set: setCountry, key: 'country', opts: COUNTRIES },
    { label: 'Ethnicity', value: ethnicity, set: setEthnicity, key: 'ethnicity', opts: ETHNICITIES },
    { label: 'Gender identity', value: genderIdentity, set: setGenderIdentity, key: 'genderIdentity', opts: GENDER_IDENTITIES },
    { label: 'Relationship status', value: relationshipStatus, set: setRelationshipStatus, key: 'relationshipStatus', opts: RELATIONSHIP_STATUSES },
    { label: 'Religion', value: religion, set: setReligion, key: 'religion', opts: RELIGIONS },
  ];

  if (!loaded) {
    return (
      <div className="app flush" style={pageTheme(GROWTH, '33')}>
        <div className="sd-loader-wrap"><div className="sd-loader"><img className="sd-loader-logo" src="/superdub-logo.png" alt="" /></div></div>
      </div>
    );
  }


  return (
    <div className="app flush" style={pageTheme(GROWTH, '33')}>
      <SuperdubHeader />
      <div className="profile-content page-content">

        <div className="page-intro">
          <p className="page-intro-sub">Profile, settings & quick actions</p>
        </div>

        {/* Level, customization & Dub — moved here from the Level page */}
        <LevelCustomizer />
        <div className="profile-level-links">
          <button className="profile-coach-btn" onClick={() => window.dispatchEvent(new CustomEvent('superdub:show-coach'))}>Coach, your read</button>
          <button className="profile-level-link" onClick={() => navigate('/level')}>View all levels &amp; badges →</button>
        </div>

        {/* Identity — just your name (avatar removed) */}
        <div className="profile-identity profile-identity--noavatar">
          <div className="profile-identity-info">
            <input id="profile-name-field" className="profile-name-input" type="text" value={name} onChange={e => setName(e.target.value)} onBlur={() => scheduleProfileSave()} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} placeholder="Your name" maxLength={40} />
            <label htmlFor="profile-name-field" className="profile-name-hint">Tap to edit</label>
            <input id="profile-nick-field" className="profile-nick-input" type="text" value={nickname} onChange={e => setNickname(e.target.value)} onBlur={() => scheduleProfileSave()} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} placeholder="Nickname" maxLength={15} />
            <label htmlFor="profile-nick-field" className="profile-name-hint">Your app is super<span className="hb-brand-dub">{nickToWordmark(nickname)}</span></label>
          </div>
        </div>

        {(lastActiveAt || lastLoginAt || accountCreatedAt) && (
          <div className="profile-account-meta">
            {lastActiveAt && <span className="pam-item"><span className="pam-icon">⏱</span>Last active: <strong>{formatRelativeTime(lastActiveAt)}</strong></span>}
            {lastLoginAt && <span className="pam-item"><span className="pam-icon">🔐</span>Last login: <strong>{formatDate(lastLoginAt)}</strong></span>}
            {accountCreatedAt && <span className="pam-item"><span className="pam-icon">📅</span>Member since <strong>{formatDate(accountCreatedAt)}</strong></span>}
          </div>
        )}

        {/* ── Background (optional demographics / job / religion) ── */}
        <div className="diet-section">
          <h2 className="diet-heading">Background</h2>
          <p className="diet-hint" style={{ marginTop: -6, marginBottom: 14 }}>All optional, helps us tailor superdub.</p>
          <div className="bg-fields">
            {DEMOGRAPHIC_FIELDS.map(f => (
              <div className="bio-field" key={f.key}>
                <label className="bio-label">{f.label}</label>
                <select
                  className="bg-select"
                  value={f.value}
                  onChange={e => { f.set(e.target.value); saveDemographic({ [f.key]: e.target.value }); }}
                >
                  <option value="">Select…</option>
                  {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

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
                    <button className="aer-remove" aria-label="Remove activity" onClick={() => removeActivity(a.id)} title="Remove">✕</button>
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
                        <button className="training-step-btn" aria-label="Fewer sessions per week" onClick={() => setNewActivitySessions(Math.max(1, newActivitySessions - 1))}>−</button>
                        <span className="training-step-val">{newActivitySessions}</span>
                        <button className="training-step-btn" aria-label="More sessions per week" onClick={() => setNewActivitySessions(Math.min(7, newActivitySessions + 1))}>+</button>
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
