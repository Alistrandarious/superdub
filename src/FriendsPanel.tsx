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

type FriendsData = Awaited<ReturnType<typeof api.getFriends>>;

const FriendsPanel: React.FC = () => {
  const [data, setData] = useState<FriendsData | null>(null);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareActivity, setShareActivity] = useState(true);

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
          {data.friends.map(f => (
            <div key={f.id} className="friend-row friend-row--card">
              <div className="friend-main">
                <span className="friend-name">{f.name}</span>
                <span className="friend-stats">
                  {f.shares
                    ? [f.streak != null ? `${f.streak}d check-in streak` : null, f.lastActive ? `active ${relTime(f.lastActive)}` : null].filter(Boolean).join(' · ') || 'no activity yet'
                    : 'sharing off'}
                </span>
                {f.sharedHabits.length > 0 && <span className="friend-habits">shares: {f.sharedHabits.join(', ')}</span>}
              </div>
              <button className="friend-remove" onClick={() => remove(f.id)} aria-label="Remove friend">✕</button>
            </div>
          ))}
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
    </section>
  );
};

export default FriendsPanel;
