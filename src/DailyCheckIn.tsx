import React, { useState, useEffect } from 'react';
import './App.css';
import { api } from './api';
import PromptShell from './PromptShell';
import { HEALTH } from './theme';
import WeightInput from './WeightInput';
import { useWeightUnit, formatWeightKg } from './weightUnit';
import { promptEnabled } from './promptPrefs';
import { getLoggingDay } from './day';
import { WEIGHED_IN } from './systemHabits';
import WeightTrendStrip from './WeightTrendStrip';

const CHECKIN_KEY = 'superdub.weight.checkin';
const SNOOZE_KEY = 'superdub.weight.snooze';   // timestamp (ms) to re-ask after "Ask me later"
const SNOOZE_MS = 2 * 60 * 60 * 1000;           // 2 hours

function todayStr() {
  const n = new Date();
  return `${String(n.getDate()).padStart(2, '0')}/${String(n.getMonth() + 1).padStart(2, '0')}`;
}

// DD/MM → sortable number (this-year data) so we can find the most recent entry.
function ddmmNum(ddmm: string): number {
  const [d, m] = ddmm.split('/').map(Number);
  return (m || 0) * 100 + (d || 0);
}

// The "not now" reasons, and what we say back. Nobody is talked out of logging
// with guilt: each one names why the reading is still worth having, because a
// slightly-off point beats a hole in the line.
const REASONS = [
  { key: 'eaten', chip: "I've eaten already", line: "Food and drink read as a kilo or two. The trend sees through it, so log what the scale says." },
  { key: 'late',  chip: 'It is not the morning', line: 'An afternoon reading sits heavier than a morning one. Log it anyway, one honest point still moves the line.' },
  { key: 'shy',   chip: "I'd rather not see it", line: "Then don't look. Type it, tap log, and the number goes straight to your line. No chart, no score." },
] as const;
type ReasonKey = typeof REASONS[number]['key'];

const DailyCheckIn: React.FC = () => {
  const [show, setShow] = useState(false);
  // 'ask' = the "Did you weigh yourself?" Yes/No gate (auto-prompt only);
  // 'later' = the "log it anyway" nudge behind "Ask me later";
  // 'input' = the weight field. Manual triggers jump straight to 'input'.
  const [gate, setGate] = useState<'ask' | 'later' | 'input'>('ask');
  const [reason, setReason] = useState<ReasonKey | null>(null);
  const [weight, setWeight] = useState('');   // the typed value
  const [days, setDays] = useState<any[]>([]); // tracker rows, for the trend strip
  const [goalKg, setGoalKg] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [done, setDone]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const unit = useWeightUnit();

  // Prefill with the most recent weight the user has logged (yesterday's carries
  // over to today), falling back to their profile weight.
  const prefillWeight = async () => {
    try {
      const data: any = await api.getTracker();
      setDays(data?.days ?? []);
      const today = ddmmNum(todayStr());
      const weighed = (data?.days ?? [])
        .filter((d: any) => d.weight && ddmmNum(d.day) <= today)
        .sort((a: any, b: any) => ddmmNum(b.day) - ddmmNum(a.day));
      if (weighed.length > 0) {
        setWeight(String(Math.round(parseFloat(weighed[0].weight) * 100) / 100));
        return;
      }
    } catch {}
    try {
      const p: any = await api.getProfile();
      const w = parseFloat(p.weightKg);
      if (w > 0) setWeight(String(Math.round(w * 100) / 100));
    } catch {}
  };

  // Goal weight only decides which direction the trend dots call progress.
  useEffect(() => {
    let live = true;
    api.getWeightSettings().then(ws => {
      const g = parseFloat(ws?.goalWeight ?? '');
      if (live && g > 0) setGoalKg(g);
    }).catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (localStorage.getItem(CHECKIN_KEY) === todayStr()) return;
    // Off for people who don't want a daily weigh-in (default: on only while a weight
    // plan is active). The manual "Log Weight" trigger below still works regardless.
    if (!promptEnabled('weight')) return;
    let cancelled = false;
    let tid: ReturnType<typeof setTimeout>;
    api.getTracker().then((data: any) => {
      if (cancelled) return;
      setDays(data?.days ?? []);
      const today = todayStr();
      const todayEntry = data?.days?.find((d: any) => d.day === today);
      if (todayEntry?.weight) {
        localStorage.setItem(CHECKIN_KEY, today);
        return;
      }
      // Prefill from the latest prior weight in the same payload.
      const todayN = ddmmNum(today);
      const weighed = (data?.days ?? [])
        .filter((d: any) => d.weight && ddmmNum(d.day) <= todayN)
        .sort((a: any, b: any) => ddmmNum(b.day) - ddmmNum(a.day));
      if (weighed.length > 0) setWeight(String(Math.round(parseFloat(weighed[0].weight) * 100) / 100));
      else prefillWeight();
      const snooze = parseInt(localStorage.getItem(SNOOZE_KEY) || '0', 10);
      const delay = snooze > Date.now() ? (snooze - Date.now()) : 800;
      tid = setTimeout(() => { setGate('ask'); setShow(true); }, delay);
    }).catch(() => {
      if (!cancelled) { prefillWeight(); tid = setTimeout(() => { setGate('ask'); setShow(true); }, 800); }
    });
    return () => { cancelled = true; clearTimeout(tid); };
  }, []);

  useEffect(() => {
    const handler = () => {
      setDone(false);
      setError(null);
      setReason(null);
      setGate('input');   // explicit "Log Weight", skip the Yes/No gate
      prefillWeight();
      setShow(true);
    };
    window.addEventListener('superdub:show-checkin', handler);
    return () => window.removeEventListener('superdub:show-checkin', handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(CHECKIN_KEY, todayStr());
    localStorage.removeItem(SNOOZE_KEY);
    setShow(false);
  };

  // Snooze: hide now, re-ask in ~2h. Does NOT mark the day done.
  const askLater = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    setShow(false);
    setTimeout(() => {
      if (localStorage.getItem(CHECKIN_KEY) !== todayStr()) { setGate('ask'); setShow(true); }
    }, SNOOZE_MS);
  };

  const save = async () => {
    const parsed = Math.round(parseFloat(weight) * 100) / 100;
    if (!parsed || parsed < 20 || parsed > 400) {
      setError(`Enter a weight between ${formatWeightKg(20, unit)} and ${formatWeightKg(400, unit)}.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.updateTrackerDay(todayStr(), { weight: parsed });
      await api.updateProfile({ weightKg: parsed }).catch(() => {});
      // Logging your weight earns XP via the "Weighed in" system habit.
      api.toggleTrackerHabit(getLoggingDay(), WEIGHED_IN, 'done')
        .then(() => window.dispatchEvent(new CustomEvent('superdub:tracker-updated')))
        .catch(() => {});
      window.dispatchEvent(new CustomEvent('superdub:tracker-updated'));
      window.dispatchEvent(new CustomEvent('superdub:checkin-done'));
      setDone(true);
      setTimeout(dismiss, 900);
    } catch (err: any) {
      console.error('[DailyCheckIn] save failed:', err?.message ?? err);
      setError(err?.message ?? 'Could not save. Tap to retry.');
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  // Gate step — the design's "Did you weigh yourself this morning?" Yes/No.
  // "No" reassures and stops nagging for the day (dismiss marks it done).
  if (gate === 'ask') {
    return (
      <PromptShell
        accent={HEALTH}
        eyebrow="Morning Check-in"
        title="Weigh in today?"
        subtitle="Did you weigh yourself this morning? Before breakfast, after using the bathroom. That's the most consistent reading."
        cta={{ label: 'Yes, weigh in', onClick: () => setGate('input') }}
        onDismiss={dismiss}
        dismissLabel="No, try tomorrow"
      >
        <WeightTrendStrip days={days} goalKg={goalKg} />
        <button className="checkin-later-btn" onClick={() => setGate('later')}>Ask me later</button>
      </PromptShell>
    );
  }

  // "Later" doesn't mean "never": one more ask, because a gap in the line costs
  // more than a slightly-off reading. Pick what's true and we take it from there.
  if (gate === 'later') {
    return (
      <PromptShell
        accent={HEALTH}
        eyebrow="Morning Check-in"
        title="Log it anyway?"
        subtitle="A missing day is a hole in your trend. An imperfect number is not. Tell us what's up and log it as it is."
        onDismiss={dismiss}
        dismissLabel="Not today"
      >
        <div className="checkin-reasons">
          {REASONS.map(r => (
            <button key={r.key} className="checkin-reason" onClick={() => { setReason(r.key); setGate('input'); }}>
              {r.chip}
            </button>
          ))}
        </div>
        <button className="checkin-later-btn" onClick={askLater}>Remind me in 2 hours</button>
      </PromptShell>
    );
  }

  const reasonLine = REASONS.find(r => r.key === reason)?.line;

  return (
    <PromptShell
      accent={HEALTH}
      eyebrow="Weigh-in · Morning"
      title="Log your weight"
      subtitle={reasonLine ?? 'No judgment, just data.'}
      cta={done ? undefined : { label: saving ? 'Saving…' : error ? 'Retry' : 'Log it', onClick: save, disabled: saving }}
      onDismiss={dismiss}
      dismissLabel="Skip today"
    >
      {/* "I'd rather not see it" means exactly that — the trend is hidden, the
          number still lands. Every other path gets the map it's adding to. */}
      {reason !== 'shy' && <WeightTrendStrip days={days} goalKg={goalKg} />}

      {/* Tap-to-type weight, entered in the user's unit, stored as kg */}
      <div className="checkin-weight-input-wrap">
        <WeightInput
          valueKg={weight}
          onChangeKg={setWeight}
          unit={unit}
          inputClassName="checkin-weight-input"
          autoFocus
          onEnter={save}
          ariaLabel="Weight"
        />
      </div>

      {done ? (
        <div className="checkin-done">{reason ? '✓ Logged anyway. That is the habit.' : '✓ Logged!'}</div>
      ) : (
        <>
          {error && <p className="checkin-error">{error}</p>}
          <button className="checkin-later-btn" onClick={askLater} disabled={saving}>
            Ask me later
          </button>
        </>
      )}
    </PromptShell>
  );
};

export default DailyCheckIn;
