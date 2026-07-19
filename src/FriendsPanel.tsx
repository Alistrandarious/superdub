import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api';

// Friends on the Global tab: add by email, accept/decline requests, and see each
// friend's check-in streak + last-active when they share activity. Habits are never
// shown unless the friend opts a habit in (toggle on the habit card).
function relTime(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function memberSinceLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

type FriendsData = Awaited<ReturnType<typeof api.getFriends>>;
type FriendRow = FriendsData['friends'][number];
type FriendProfile = Awaited<ReturnType<typeof api.getFriendProfile>>;
type MyHabit = { name: string; sharedWithFriends?: boolean };
type NudgeState = 'idle' | 'busy' | 'sent' | 'error';

const FriendsPanel: React.FC = () => {
  const [data, setData] = useState<FriendsData | null>(null);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareActivity, setShareActivity] = useState(true);

  // Friend detail sheet: opened row's list data shows immediately, enriched by
  // getFriendProfile once it lands.
  const [openFriend, setOpenFriend] = useState<FriendRow | null>(null);
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [nudgeState, setNudgeState] = useState<NudgeState>('idle');
  const [nudgeDelivered, setNudgeDelivered] = useState(true);
  const [nudgeError, setNudgeError] = useState<string | null>(null);
  const [sharePicker, setSharePicker] = useState(false);
  const [myHabits, setMyHabits] = useState<MyHabit[] | null>(null);

  const load = useCallback(() => {
    api.getFriends().then(setData).catch(() => {});
    api.getFriendSettings().then(s => setShareActivity(s.shareActivity)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const e = email.trim();
    if (!e) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api.sendFriendRequest(e);
      setMsg(r.status === 'accepted' ? "You're now friends." : 'Request sent.');
      setEmail('');
      load();
    } catch (err: any) {
      setMsg(err?.message ?? 'Could not send that.');
    } finally { setBusy(false); }
  };
  const respond = async (id: number, action: 'accept' | 'decline') => { await api.respondFriend(id, action).catch(() => {}); load(); };
  const remove = async (id: number) => { await api.removeFriend(id).catch(() => {}); load(); };
  const toggleShare = async () => {
    const next = !shareActivity;
    setShareActivity(next);
    await api.setFriendSettings(next).catch(() => setShareActivity(!next));
  };

  const openSheet = (f: FriendRow) => {
    setOpenFriend(f);
    setProfile(null);
    setNudgeState('idle'); setNudgeError(null); setNudgeDelivered(true);
    setSharePicker(false); setMyHabits(null);
    api.getFriendProfile(f.id).then(setProfile).catch(() => {});
  };
  const closeSheet = () => setOpenFriend(null);

  const nudge = async () => {
    if (!openFriend || nudgeState !== 'idle') return;
    setNudgeState('busy');
    try {
      const r = await api.nudgeFriend(openFriend.id);
      setNudgeDelivered(r.delivered);
      setNudgeState('sent');
    } catch (err: any) {
      setNudgeError(err?.message ?? 'Could not nudge them.');
      setNudgeState('error');
    }
  };

  const openSharePicker = () => {
    const next = !sharePicker;
    setSharePicker(next);
    if (next && myHabits === null) {
      api.getHabits().then(hs => setMyHabits(hs.map(h => ({ name: h.name, sharedWithFriends: h.sharedWithFriends })))).catch(() => {});
    }
  };
  const toggleHabitShare = async (name: string, current: boolean) => {
    setMyHabits(hs => hs && hs.map(h => (h.name === name ? { ...h, sharedWithFriends: !current } : h)));
    await api.setHabitShare(name, !current).catch(() => {
      setMyHabits(hs => hs && hs.map(h => (h.name === name ? { ...h, sharedWithFriends: current } : h)));
    });
  };
  const removeFromSheet = async () => {
    if (!openFriend) return;
    await remove(openFriend.id);
    setOpenFriend(null);
  };

  return (
    <section className="friends">
      <span className="community-eyebrow">FRIENDS</span>

      <div className="friends-add">
        <input className="friends-add-input" type="email" inputMode="email" placeholder="Friend's email"
          value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <button className="friends-add-btn" onClick={add} disabled={busy}>Add</button>
      </div>
      {msg && <p className="friends-msg">{msg}</p>}

      {data && data.incoming.length > 0 && (
        <div className="friends-group">
          <span className="friends-sublabel">Requests</span>
          {data.incoming.map(f => (
            <div key={f.id} className="friend-row">
              <span className="friend-name">{f.name}</span>
              <div className="friend-actions">
                <button className="friend-accept" onClick={() => respond(f.id, 'accept')}>Accept</button>
                <button className="friend-decline" onClick={() => respond(f.id, 'decline')}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.friends.length > 0 ? (
        <div className="friends-group">
          {data.friends.map(f => {
            const initial = (f.name || '?').trim().charAt(0).toUpperCase() || '?';
            // Ring fills toward a 14-day streak — a visual pulse, not a hard cap.
            const ringPct = f.shares && f.streak ? Math.min(100, Math.round((f.streak / 14) * 100)) : 0;
            return (
            <button key={f.id} type="button" className="friend-row friend-row--card" onClick={() => openSheet(f)} aria-label={`View ${f.name}`}>
              <span className="friend-ring" aria-hidden="true"
                style={{ background: `conic-gradient(#FFB928 ${ringPct}%, rgba(255,255,255,0.08) 0)` }}>
                <i>{initial}</i>
              </span>
              <div className="friend-main">
                <span className="friend-name">{f.name}</span>
                <span className="friend-stats">
                  {f.shares
                    ? [f.streak != null ? `${f.streak}d check-in streak` : null, f.lastActive ? `active ${relTime(f.lastActive)}` : null].filter(Boolean).join(' · ') || 'no activity yet'
                    : 'sharing off'}
                </span>
                {f.sharedHabits.length > 0 && <span className="friend-habits">shares: {f.sharedHabits.join(', ')}</span>}
              </div>
            </button>
            );
          })}
        </div>
      ) : (
        <p className="friends-empty">No friends yet. Add one by email to cheer each other on.</p>
      )}

      {data && data.outgoing.length > 0 && (
        <div className="friends-group">
          <span className="friends-sublabel">Pending</span>
          {data.outgoing.map(f => (
            <div key={f.id} className="friend-row">
              <span className="friend-name">{f.name}</span>
              <button className="friend-remove" onClick={() => remove(f.id)}>Cancel</button>
            </div>
          ))}
        </div>
      )}

      <button className={`friends-share${shareActivity ? ' on' : ''}`} onClick={toggleShare} role="switch" aria-checked={shareActivity}>
        <span className="friends-share-label">Share my streaks and activity</span>
        <span className="friends-share-knob" />
      </button>
      <p className="friends-note">Friends never see a habit unless you share it. Turn sharing on from each habit's card.</p>

      {openFriend && (() => {
        const name = profile?.name ?? openFriend.name;
        const email = profile?.email ?? openFriend.email;
        const shares = profile?.shares ?? openFriend.shares;
        const streak = profile?.streak ?? openFriend.streak;
        const doneDays = profile?.doneDays ?? openFriend.doneDays;
        const lastActive = profile?.lastActive ?? openFriend.lastActive;
        const sharedHabits = profile?.sharedHabits ?? openFriend.sharedHabits;
        return (
          <div className="checkin-overlay" onClick={closeSheet}>
            <div className="checkin-modal fdetail" onClick={e => e.stopPropagation()}>
              <span className="fdetail-name">{name}</span>
              <span className="fdetail-email">{email}</span>
              {profile?.memberSince && <span className="fdetail-since">Superdubber since {memberSinceLabel(profile.memberSince)}</span>}

              {shares ? (
                <div className="fdetail-stats">
                  <div className="fdetail-stat"><span className="fdetail-stat-val">{streak ?? 0}d</span><span className="fdetail-stat-label">streak</span></div>
                  <div className="fdetail-stat"><span className="fdetail-stat-val">{doneDays ?? 0}</span><span className="fdetail-stat-label">days done</span></div>
                  <div className="fdetail-stat"><span className="fdetail-stat-val">{lastActive ? relTime(lastActive) : '–'}</span><span className="fdetail-stat-label">last active</span></div>
                </div>
              ) : (
                <p className="fdetail-private">They keep their activity private.</p>
              )}

              {sharedHabits.length > 0 && (
                <div className="fdetail-shares">
                  <span className="fdetail-shares-label">They share:</span>
                  <div className="fdetail-chips">
                    {sharedHabits.map(h => <span key={h} className="fdetail-chip">{h}</span>)}
                  </div>
                </div>
              )}

              <div className="fdetail-actions">
                <button className="fdetail-nudge-btn" onClick={nudge} disabled={nudgeState !== 'idle'}>
                  {nudgeState === 'sent' ? 'Nudge sent' : nudgeState === 'busy' ? 'Nudging…' : `Nudge ${name}`}
                </button>
                {nudgeState === 'sent' && !nudgeDelivered && (
                  <p className="fdetail-nudge-note">They'll see it when notifications are on</p>
                )}
                {nudgeState === 'error' && nudgeError && (
                  <p className="fdetail-nudge-note fdetail-nudge-error">{nudgeError}</p>
                )}

                <button className="fdetail-share-btn" onClick={openSharePicker}>Share a habit</button>
                {sharePicker && (
                  <div className="fdetail-picker">
                    {myHabits === null ? (
                      <p className="fdetail-picker-loading">Loading your habits…</p>
                    ) : myHabits.length === 0 ? (
                      <p className="fdetail-picker-loading">No habits yet.</p>
                    ) : (
                      myHabits.map(h => (
                        <button key={h.name} type="button" className={`fdetail-picker-row${h.sharedWithFriends ? ' on' : ''}`}
                          onClick={() => toggleHabitShare(h.name, !!h.sharedWithFriends)}>
                          <span>{h.name}</span>
                          <span className="fdetail-picker-knob" />
                        </button>
                      ))
                    )}
                    <p className="fdetail-caveat">Habits you share are visible to all your friends.</p>
                  </div>
                )}

                <button className="fdetail-remove-btn" onClick={removeFromSheet}>Remove friend</button>
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
};

export default FriendsPanel;
