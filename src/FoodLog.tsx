import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './App.css';
import { api } from './api';

interface FoodItem {
  name: string;
  qty: number;
  unit: string;
  p: number;
  c: number;
  f: number;
  kcal: number;
}

interface LogEntry {
  id: string;
  items: FoodItem[];
  totals: { p: number; c: number; f: number; kcal: number };
  transcript: string;
  created_at: string;
}

interface ChatMsg {
  from: 'superdub' | 'user';
  text: string;
  items?: FoodItem[];
  logId?: string;
}

interface MacroTarget { protein: number; carbs: number; fats: number; calories: number; }

function macroBar(label: string, logged: number, target: number, color: string) {
  const pct = target > 0 ? Math.min(100, (logged / target) * 100) : 0;
  return (
    <div className="fl-macro-row" key={label}>
      <span className="fl-macro-label">{label}</span>
      <div className="fl-macro-bar-wrap">
        <div className="fl-macro-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="fl-macro-val">{Math.round(logged)}<span className="fl-macro-target">/{target}g</span></span>
    </div>
  );
}

const FoodLog: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { from: 'superdub', text: "What did you eat today? Speak or type — describe everything at once or meal by meal." },
  ]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [pendingItems, setPendingItems] = useState<FoodItem[] | null>(null);
  const [pendingTranscript, setPendingTranscript] = useState('');
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [target, setTarget] = useState<MacroTarget | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      api.getFoodLogsToday(),
      api.getAiKeyStatus(),
      api.getDietTarget(),
    ]).then(([logsData, keyData, targetData]) => {
      setLogs(logsData as LogEntry[]);
      setHasKey(!!(keyData as any).hasKey);
      setTarget(targetData as MacroTarget);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingItems]);

  const totals = logs.reduce(
    (a, l) => ({ p: a.p + l.totals.p, c: a.c + l.totals.c, f: a.f + l.totals.f, kcal: a.kcal + l.totals.kcal }),
    { p: 0, c: 0, f: 0, kcal: 0 }
  );

  const autoSubmitRef = useRef(false);
  const transcriptRef = useRef('');

  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not supported in this browser. Please type instead.'); return; }
    const r = new SR();
    r.lang = 'en-US';
    r.interimResults = true;
    r.continuous = true;
    recognitionRef.current = r;
    transcriptRef.current = '';
    autoSubmitRef.current = false;
    r.onresult = (e: any) => {
      const t = Array.from(e.results as any[]).map((res: any) => res[0].transcript).join('');
      transcriptRef.current = t;
      setInput(t);
    };
    r.onend = () => {
      setListening(false);
      if (autoSubmitRef.current && transcriptRef.current.trim()) {
        submit(transcriptRef.current);
        autoSubmitRef.current = false;
      }
    };
    r.onerror = () => { setListening(false); autoSubmitRef.current = false; };
    r.start();
    setListening(true);
  };

  const stopListening = (andSubmit = false) => {
    autoSubmitRef.current = andSubmit;
    recognitionRef.current?.stop();
  };

  const submit = async (text: string) => {
    const t = text.trim();
    if (!t || parsing) return;
    setMessages(prev => [...prev, { from: 'user', text: t }]);
    setInput('');
    setParsing(true);
    setPendingItems(null);
    try {
      const result = await api.parseFoodLog(t) as { items: FoodItem[] };
      const items = result.items ?? [];
      const tot = items.reduce((a, i) => ({ p: a.p + i.p, c: a.c + i.c, f: a.f + i.f, kcal: a.kcal + i.kcal }), { p: 0, c: 0, f: 0, kcal: 0 });
      setPendingTranscript(t);
      setPendingItems(items);
      setMessages(prev => [...prev, {
        from: 'superdub',
        text: items.length > 0
          ? `Found ${items.length} item${items.length !== 1 ? 's' : ''} — ${Math.round(tot.kcal)} kcal · P${Math.round(tot.p)}g · C${Math.round(tot.c)}g · F${Math.round(tot.f)}g. Save this?`
          : "I couldn't identify any foods from that. Can you try again with more detail?",
        items: items.length > 0 ? items : undefined,
      }]);
    } catch (e: any) {
      const isNoKey = e.message === 'NO_KEY' || String(e.message).includes('NO_KEY');
      setMessages(prev => [...prev, {
        from: 'superdub',
        text: isNoKey
          ? "You haven't added your Anthropic API key yet. Go to Profile → Settings ⚙ → AI Key to add it."
          : `Couldn't parse that: ${e.message}`,
      }]);
    } finally {
      setParsing(false);
    }
  };

  const saveLog = async () => {
    if (!pendingItems || pendingItems.length === 0) return;
    const tot = pendingItems.reduce(
      (a, i) => ({ p: a.p + i.p, c: a.c + i.c, f: a.f + i.f, kcal: a.kcal + i.kcal }),
      { p: 0, c: 0, f: 0, kcal: 0 }
    );
    const rounded = { p: Math.round(tot.p), c: Math.round(tot.c), f: Math.round(tot.f), kcal: Math.round(tot.kcal) };
    try {
      const result = await api.saveFoodLog({ items: pendingItems, totals: rounded, transcript: pendingTranscript }) as { id: string };
      setLogs(prev => [...prev, { id: result.id, items: pendingItems!, totals: rounded, transcript: pendingTranscript, created_at: new Date().toISOString() }]);
      setPendingItems(null);
      setPendingTranscript('');
      setMessages(prev => [...prev, { from: 'superdub', text: 'Logged! Anything else you ate today?' }]);
    } catch {
      setMessages(prev => [...prev, { from: 'superdub', text: 'Failed to save — please try again.' }]);
    }
  };

  const discardPending = () => {
    setPendingItems(null);
    setMessages(prev => [...prev, { from: 'superdub', text: "No worries — try describing it again and I'll have another go." }]);
  };

  const deleteLog = async (id: string) => {
    await api.deleteFoodLog(id).catch(() => {});
    setLogs(prev => prev.filter(l => l.id !== id));
  };

  const formatTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
  };

  return (
    <div className="app flush" style={{ '--theme': '#FF4D8D', '--theme-dim': '#FF4D8D66', '--theme-glow': '#FF4D8D22' } as React.CSSProperties}>
      <div className="fl-page page-content">
        <div className="page-intro-row">
          <Link to="/diet" className="page-back"><span className="page-back-arrow">‹</span> Diet</Link>
          <h1 className="page-intro-title">Food Log</h1>
        </div>

        {/* No key notice */}
        {hasKey === false && (
          <div className="fl-no-key">
            <span className="fl-no-key-icon">🔑</span>
            <h3 className="fl-no-key-title">Connect your Claude account</h3>
            <p className="fl-no-key-desc">Superdub uses your own Anthropic API key to parse food — your data stays yours and it costs fractions of a cent per meal.</p>
            <div className="fl-no-key-steps">
              <div className="fl-no-key-step">
                <span className="fl-nks-num">1</span>
                <div>
                  <strong>Get your free API key</strong>
                  <p>Sign up at Anthropic Console (free tier available)</p>
                  <a className="fl-console-btn" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">
                    Open Anthropic Console →
                  </a>
                </div>
              </div>
              <div className="fl-no-key-step">
                <span className="fl-nks-num">2</span>
                <div>
                  <strong>Paste it in Profile</strong>
                  <p>Copy your key (starts with <code>sk-ant-</code>) and save it in your profile settings</p>
                  <button className="fl-no-key-btn" onClick={() => navigate('/profile#ai-key')}>Add key in Profile →</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Macro progress — only shown when there are logs and a target */}
        {logs.length > 0 && target && (
          <div className="fl-progress-card">
            <div className="fl-progress-head">
              <span className="fl-progress-title">Today</span>
              <span className="fl-progress-kcal">{Math.round(totals.kcal)} / {target.calories} kcal</span>
            </div>
            {macroBar('Protein', totals.p, target.protein, '#ff6ec7')}
            {macroBar('Carbs', totals.c, target.carbs, '#7C3AED')}
            {macroBar('Fat', totals.f, target.fats, '#ffd60a')}
          </div>
        )}

        {/* Logged entries */}
        {logs.length > 0 && (
          <div className="fl-logs">
            {logs.map(log => (
              <div key={log.id} className="fl-log-card">
                <div className="fl-log-head" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                  <span className="fl-log-time">{formatTime(log.created_at)}</span>
                  <span className="fl-log-summary">{log.totals.kcal} kcal · P{log.totals.p}g · C{log.totals.c}g · F{log.totals.f}g</span>
                  <button className="food-remove" onClick={e => { e.stopPropagation(); deleteLog(log.id); }}>✕</button>
                </div>
                {expandedLog === log.id && (
                  <ul className="fl-log-items">
                    {log.items.map((item, i) => (
                      <li key={i} className="fl-log-item">
                        <span className="fl-log-item-name">{item.qty}{item.unit === 'unit' ? '' : item.unit} {item.name}</span>
                        <span className="fl-log-item-macros">P{Math.round(item.p)}·C{Math.round(item.c)}·F{Math.round(item.f)} · {Math.round(item.kcal)} kcal</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Chat */}
        <div className="fl-chat">
          {messages.map((msg, i) => (
            <div key={i} className={`fl-msg fl-msg--${msg.from}`}>
              <div className="fl-bubble">{msg.text}</div>
              {msg.items && msg.items.length > 0 && pendingItems && (
                <div className="fl-items-preview">
                  <ul className="fl-items-list">
                    {msg.items.map((item, j) => (
                      <li key={j} className="fl-item-row">
                        <span className="fl-item-name">{item.qty}{item.unit === 'unit' ? '' : item.unit} {item.name}</span>
                        <span className="fl-item-macros">P{Math.round(item.p)}·C{Math.round(item.c)}·F{Math.round(item.f)}</span>
                        <span className="fl-item-kcal">{Math.round(item.kcal)} kcal</span>
                      </li>
                    ))}
                  </ul>
                  <div className="fl-confirm-btns">
                    <button className="fl-btn-save" onClick={saveLog}>Save this</button>
                    <button className="fl-btn-discard" onClick={discardPending}>Try again</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {parsing && (
            <div className="fl-msg fl-msg--superdub">
              <div className="fl-bubble fl-bubble--parsing">Thinking…</div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input bar */}
        {hasKey !== false && (
          <div className="fl-input-bar">
            <input
              className="fl-text-input"
              type="text"
              placeholder="What did you eat?"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(input); }}
              disabled={parsing}
            />
            <button className="fl-send-btn" onClick={() => submit(input)} disabled={!input.trim() || parsing}>
              ↑
            </button>
            <button
              className={`fl-mic-btn${listening ? ' listening' : ''}`}
              onPointerDown={e => { e.preventDefault(); startListening(); }}
              onPointerUp={e => { e.preventDefault(); stopListening(true); }}
              onPointerCancel={() => stopListening(false)}
              title="Hold to speak"
              style={{ touchAction: 'none' }}
            >
              🎙
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FoodLog;
