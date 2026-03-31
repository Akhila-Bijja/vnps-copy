import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const ASPECT_RATIOS = ['1:1', '3:4', '4:3', '16:9', '9:16'];
const TABS = [
  { id: 'video', icon: '🎬', label: 'Video Gen' },
  { id: 'image', icon: '🖼️', label: 'Image Gen' },
  { id: 'audio', icon: '🔊', label: 'Text to Speech' },
  { id: 'asr', icon: '🎙️', label: 'Speech to Text' },
  { id: 'chat', icon: '✍️', label: 'Content Chat' },
];

const TAB_COLORS = {
  video: '#f59e0b',
  image: '#a855f7',
  audio: '#00bcd4',
  asr: '#ef4444',
  chat: '#7c3aed',
};

const S = {
  inp: { width: '100%', padding: '0.75rem 0.9rem', background: '#0d0d14', border: '1px solid #2a2a3a', borderRadius: '10px', color: '#fff', fontSize: '0.87rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' },
  card: { background: '#13131a', border: '1px solid #2a2a3a', borderRadius: '14px', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' },
  btn: (color = '#7c3aed', disabled = false) => ({ padding: '0.7rem 1.2rem', background: disabled ? '#1e1e2e' : color, color: disabled ? '#444' : '#fff', border: `1px solid ${disabled ? '#2a2a3a' : color}`, borderRadius: '10px', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.87rem', opacity: disabled ? 0.6 : 1, transition: 'all 0.2s', fontFamily: 'inherit' }),
};

function RatioPicker({ value, onChange, color = '#7c3aed' }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
      {ASPECT_RATIOS.map(r => {
        const active = value === r;
        return <button key={r} onClick={() => onChange(r)} style={{ padding: '0.3rem 0.75rem', background: active ? `${color}22` : '#0d0d14', color: active ? color : '#555', border: `1px solid ${active ? color : '#2a2a3a'}`, borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: active ? 700 : 400 }}>{r}</button>;
      })}
    </div>
  );
}

function Banner({ text, type = 'info' }) {
  const map = { info: { bg: '#7c3aed11', border: '#7c3aed33', color: '#a855f7' }, success: { bg: '#00ff8811', border: '#00ff8833', color: '#00ff88' }, error: { bg: '#ff444411', border: '#ff444433', color: '#ff8888' }, loading: { bg: '#f59e0b11', border: '#f59e0b33', color: '#f59e0b' } };
  const c = map[type] || map.info;
  return <div style={{ padding: '0.65rem 0.9rem', background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px', fontSize: '0.82rem', color: c.color }}>{text}</div>;
}

function MicBtn({ onResult, color = '#7c3aed' }) {
  const [active, setActive] = useState(false);
  const recRef = useRef(null);
  const toggle = () => {
    if (active) { try { recRef.current?.abort(); } catch { } recRef.current = null; setActive(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Speech not supported. Use Chrome.'); return; }
    const r = new SR();
    r.lang = 'en-US'; r.continuous = false; r.interimResults = false;
    r.onresult = (e) => { onResult(e.results[0][0].transcript); };
    r.onend = () => setActive(false);
    r.onerror = () => setActive(false);
    r.start(); recRef.current = r; setActive(true);
  };
  return <button onClick={toggle} title={active ? 'Stop' : 'Speak'} style={{ padding: '0.45rem 0.55rem', background: active ? '#ef444422' : '#1e1e2e', color: active ? '#ef4444' : '#555', border: `1px solid ${active ? '#ef444444' : '#2a2a3a'}`, borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', flexShrink: 0, transition: 'all 0.2s', animation: active ? 'micpulse 1s infinite' : 'none' }}>🎙️</button>;
}

/* ── Generation History — shows previous results across all tabs ─── */
function GenerationHistory({ history, currentTab }) {
  if (!history.length) return null;
  // Filter out items from the current tab — show only cross-tab items
  const otherHistory = history.filter(h => h.tab !== currentTab);
  if (!otherHistory.length) return null;

  return (
    <div style={{ marginTop: '1.2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <div style={{ height: '1px', flex: 1, background: 'linear-gradient(90deg, transparent, #2a2a3a, transparent)' }} />
        <span style={{ fontSize: '0.72rem', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>📋 Previous Generations</span>
        <div style={{ height: '1px', flex: 1, background: 'linear-gradient(90deg, transparent, #2a2a3a, transparent)' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {otherHistory.slice().reverse().map((item, i) => {
          const tabColor = TAB_COLORS[item.tab] || '#7c3aed';
          const tabLabel = TABS.find(t => t.id === item.tab)?.label || item.tab;
          const tabIcon = TABS.find(t => t.id === item.tab)?.icon || '📄';
          return (
            <div key={i} style={{ background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'border-color 0.2s', borderLeft: `3px solid ${tabColor}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.85rem' }}>{tabIcon}</span>
                  <span style={{ fontSize: '0.68rem', color: tabColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{tabLabel}</span>
                </div>
                <span style={{ fontSize: '0.62rem', color: '#444' }}>{new Date(item.timestamp).toLocaleTimeString()}</span>
              </div>
              {/* Prompt / Input text */}
              {item.prompt && (
                <div style={{ fontSize: '0.8rem', color: '#888', lineHeight: 1.5 }}>
                  <span style={{ color: '#555', fontWeight: 600 }}>Prompt: </span>
                  {item.prompt.length > 120 ? item.prompt.slice(0, 120) + '…' : item.prompt}
                </div>
              )}
              {/* Media result */}
              {item.type === 'image' && item.imageUrl && (
                <img src={item.imageUrl} alt="Generated" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px' }} />
              )}
              {item.type === 'video' && item.videoUrl && (
                <video src={item.videoUrl} controls style={{ width: '100%', maxHeight: '180px', borderRadius: '8px' }} />
              )}
              {item.type === 'tts' && (
                <div style={{ fontSize: '0.75rem', color: '#00bcd4', fontStyle: 'italic' }}>🔊 Audio was played via browser</div>
              )}
              {item.type === 'stt' && item.transcript && (
                <div style={{ fontSize: '0.78rem', color: '#ccc', background: '#13131a', padding: '0.5rem 0.7rem', borderRadius: '8px', maxHeight: '80px', overflow: 'hidden' }}>
                  📝 {item.transcript.length > 150 ? item.transcript.slice(0, 150) + '…' : item.transcript}
                </div>
              )}
              {item.type === 'chat' && item.reply && (
                <div style={{ fontSize: '0.78rem', color: '#ccc', background: '#13131a', padding: '0.5rem 0.7rem', borderRadius: '8px', maxHeight: '80px', overflow: 'hidden', whiteSpace: 'pre-wrap' }}>
                  ✍️ {item.reply.length > 150 ? item.reply.slice(0, 150) + '…' : item.reply}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function Content({ draftIdea, setDraftIdea }) {
  const [tab, setTab] = useState('video');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [videoState, setVideoState] = useState({ prompt: '', ratio: '16:9', status: 'idle', msg: '', videoUrl: '', pageUrl: '', pollCount: 0 });
  const [imageState, setImageState] = useState({ prompt: '', ratio: '1:1', status: 'idle', msg: '', imageUrl: '', pageUrl: '', pollCount: 0 });

  // ── Shared generation history across all tabs ──
  const [genHistory, setGenHistory] = useState([]);
  const addHistory = useCallback((entry) => {
    setGenHistory(prev => [...prev, { ...entry, timestamp: Date.now() }]);
  }, []);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', h);
    if (draftIdea) {
      setTab('chat');
    }
    return () => window.removeEventListener('resize', h);
  }, [draftIdea]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', color: '#fff', padding: isMobile ? '0.8rem' : '1.2rem 1.5rem', fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ marginBottom: '1rem', flexShrink: 0 }}>
        <h2 style={{ margin: '0 0 0.15rem', fontSize: isMobile ? '1.2rem' : '1.35rem', fontWeight: 800 }}>🎨 Content Creator</h2>
        <p style={{ margin: 0, color: '#555', fontSize: '0.78rem' }}>Generate videos, images, audio & written content with AI</p>
      </div>
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '1rem', flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: isMobile ? '0.4rem 0.75rem' : '0.42rem 0.9rem', background: tab === t.id ? '#7c3aed' : '#13131a', color: tab === t.id ? '#fff' : '#555', border: `1px solid ${tab === t.id ? '#7c3aed' : '#2a2a3a'}`, borderRadius: '10px', cursor: 'pointer', fontSize: isMobile ? '0.72rem' : '0.78rem', fontWeight: tab === t.id ? 700 : 400, display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'all 0.2s', fontFamily: 'inherit' }}>
            <span style={{ fontSize: '0.9rem' }}>{t.icon}</span>
            {isMobile ? t.label.split(' ')[0] : t.label}
          </button>
        ))}
      </div>
      {/* display:none keeps component mounted — state never lost */}
      <div style={{ flex: 1, overflowY: tab === 'chat' ? 'hidden' : 'auto', paddingRight: '0.4rem', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: tab === 'video' ? 'flex' : 'none', flexDirection: 'column', gap: '1rem', flexShrink: 0 }}>
          <VideoGen userId={user.id} isMobile={isMobile} state={videoState} setState={setVideoState} onGenDone={addHistory} />
          <GenerationHistory history={genHistory} currentTab="video" />
        </div>
        <div style={{ display: tab === 'image' ? 'flex' : 'none', flexDirection: 'column', gap: '1rem', flexShrink: 0 }}>
          <ImageGen userId={user.id} isMobile={isMobile} state={imageState} setState={setImageState} onGenDone={addHistory} />
          <GenerationHistory history={genHistory} currentTab="image" />
        </div>
        <div style={{ display: tab === 'audio' ? 'flex' : 'none', flexDirection: 'column', gap: '1rem', flexShrink: 0 }}>
          <TextToSpeech onGenDone={addHistory} />
          <GenerationHistory history={genHistory} currentTab="audio" />
        </div>
        <div style={{ display: tab === 'asr' ? 'flex' : 'none', flexDirection: 'column', gap: '1rem', flexShrink: 0 }}>
          <SpeechToText onGenDone={addHistory} />
          <GenerationHistory history={genHistory} currentTab="asr" />
        </div>
        <div style={{ display: tab === 'chat' ? 'flex' : 'none', flexDirection: 'column', flex: 1, gap: '0.6rem', minHeight: 0, paddingBottom: isMobile ? '0' : '0.5rem' }}>
          <ContentChat userId={user.id} isMobile={isMobile} onGenDone={addHistory} draftIdea={draftIdea} setDraftIdea={setDraftIdea} />
        </div>
      </div>
      <style>{`
        @keyframes micpulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes ripple   { 0%{transform:scale(1);opacity:0.4} 100%{transform:scale(1.8);opacity:0} }
        @keyframes blink    { 0%,100%{opacity:1} 50%{opacity:0.2} }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #444; }
      `}</style>
    </div>
  );
}

// VIDEO GEN
function VideoGen({ userId, isMobile, state, setState, onGenDone }) {
  const { prompt, ratio, status, msg, videoUrl, pageUrl, pollCount } = state;
  const set = useCallback((patch) => setState(p => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) })), [setState]);
  const pollRef = useRef(null); const firstRef = useRef(null);
  const clearAll = () => { clearInterval(pollRef.current); clearTimeout(firstRef.current); pollRef.current = null; firstRef.current = null; };
  const hasLoggedRef = useRef(false);
  useEffect(() => () => clearAll(), []);

  // Log to history when video is done
  useEffect(() => {
    if (status === 'done' && videoUrl && !hasLoggedRef.current) {
      hasLoggedRef.current = true;
      onGenDone({ tab: 'video', type: 'video', prompt, videoUrl });
    }
    if (status === 'idle' || status === 'submitting') {
      hasLoggedRef.current = false;
    }
  }, [status, videoUrl, prompt, onGenDone]);

  const attemptFetch = useCallback(async (pUrl) => {
    try {
      set({ msg: '🔄 Checking if video is ready...' });
      const { data } = await axios.post(`${API_URL}/api/content/video/result`, { pageUrl: pUrl });
      if (data.status === 'completed' && data.videoUrl) { clearAll(); set({ videoUrl: data.videoUrl, status: 'done', msg: '', pollCount: 0 }); }
      else set(p => ({ status: 'polling', msg: `⏳ Still rendering... (attempt ${p.pollCount + 1})`, pollCount: p.pollCount + 1 }));
    } catch { set({ msg: '⚠️ Could not check. Retrying...' }); }
  }, [set]);

  const startPolling = useCallback((pUrl) => {
    clearAll();
    firstRef.current = setTimeout(async () => {
      await attemptFetch(pUrl);
      pollRef.current = setInterval(() => attemptFetch(pUrl), 60000);
    }, 120000);
  }, [attemptFetch]);

  const generate = async () => {
    if (!prompt.trim()) return;
    clearAll(); set({ status: 'submitting', msg: '', videoUrl: '', pollCount: 0 });
    try {
      const { data } = await axios.post(`${API_URL}/api/content/video`, { userId, prompt, aspectRatio: ratio });
      set({ pageUrl: data.pageUrl, status: 'pending', msg: '🎬 Submitted! Auto-checking in 2 min...' });
      startPolling(data.pageUrl);
    } catch (err) { set({ status: 'error', msg: err.response?.data?.message || 'Submission failed.' }); }
  };

  const isGenerating = ['submitting', 'pending', 'polling'].includes(status);
  return (
    <>
      <div style={S.card}>
        <div style={{ background: '#f59e0b11', border: '1px solid #f59e0b33', borderRadius: '8px', padding: '0.5rem 0.8rem', fontSize: '0.75rem', color: '#f59e0b' }}>🤖 TinyFish + Qwen AI · ~2 min render time</div>
        <div>
          <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', color: '#888' }}>Video Prompt</p>
          <div style={{ position: 'relative' }}>
            <textarea style={{ ...S.inp, minHeight: '80px', paddingRight: '2.8rem' }} placeholder="e.g. A cinematic drone shot over a misty mountain at golden hour..." value={prompt} onChange={e => set({ prompt: e.target.value })} />
            <div style={{ position: 'absolute', right: '0.5rem', bottom: '0.5rem' }}>
              <MicBtn color="#f59e0b" onResult={txt => set(p => ({ prompt: p.prompt ? p.prompt + ' ' + txt : txt }))} />
            </div>
          </div>
        </div>
        <div>
          <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', color: '#888' }}>Aspect Ratio</p>
          <RatioPicker value={ratio} onChange={r => set({ ratio: r })} color="#f59e0b" />
        </div>
        <button onClick={generate} disabled={isGenerating || !prompt.trim()} style={{ ...S.btn('#f59e0b', isGenerating || !prompt.trim()), width: '100%' }}>
          {status === 'submitting' ? '⏳ Submitting...' : isGenerating ? '⏳ Generating... (~2 min)' : '🎬 Generate Video'}
        </button>
        {msg && <Banner text={msg} type={status === 'error' ? 'error' : status === 'done' ? 'success' : 'loading'} />}
        {isGenerating && pageUrl && (
          <button onClick={() => attemptFetch(pageUrl)} style={{ width: '100%', padding: '0.5rem', background: '#1e1e2e', color: '#555', border: '1px solid #2a2a3a', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit' }}>
            🔄 Check Now · attempt {pollCount}
          </button>
        )}
      </div>
      {status === 'done' && videoUrl && (
        <div style={S.card}>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#00ff88', fontWeight: 700 }}>✅ Video Ready!</p>
          <video src={videoUrl} controls style={{ width: '100%', borderRadius: '10px', maxHeight: '380px' }} />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <a href={videoUrl} download target="_blank" rel="noreferrer" style={{ padding: '0.5rem 1rem', background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44', borderRadius: '8px', fontSize: '0.78rem', textDecoration: 'none', fontWeight: 600 }}>⬇️ Download</a>
            <button onClick={() => set({ status: 'idle', videoUrl: '', prompt: '', msg: '', pollCount: 0 })} style={{ padding: '0.5rem 1rem', background: '#1e1e2e', color: '#555', border: '1px solid #2a2a3a', borderRadius: '8px', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>✨ New Video</button>
          </div>
        </div>
      )}
    </>
  );
}

// IMAGE GEN (2-step: submit → poll, like video)
function ImageGen({ userId, isMobile, state, setState, onGenDone }) {
  const { prompt, ratio, status, msg, imageUrl, pageUrl, pollCount } = state;
  const set = useCallback((patch) => setState(p => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) })), [setState]);
  const pollRef = useRef(null); const firstRef = useRef(null);
  const clearAll = () => { clearInterval(pollRef.current); clearTimeout(firstRef.current); pollRef.current = null; firstRef.current = null; };
  const hasLoggedRef = useRef(false);
  useEffect(() => () => clearAll(), []);

  useEffect(() => {
    if (status === 'done' && imageUrl && !hasLoggedRef.current) {
      hasLoggedRef.current = true;
      onGenDone({ tab: 'image', type: 'image', prompt, imageUrl });
    }
    if (status === 'idle' || status === 'submitting') hasLoggedRef.current = false;
  }, [status, imageUrl, prompt, onGenDone]);

  const attemptFetch = useCallback(async (pUrl) => {
    try {
      set({ msg: '🔄 Checking if image is ready...' });
      const { data } = await axios.post(`${API_URL}/api/content/image/result`, { pageUrl: pUrl });
      if (data.status === 'completed' && data.imageUrl) { clearAll(); set({ imageUrl: data.imageUrl, status: 'done', msg: '', pollCount: 0 }); }
      else set(p => ({ status: 'polling', msg: `⏳ Still generating... (attempt ${p.pollCount + 1})`, pollCount: p.pollCount + 1 }));
    } catch { set({ msg: '⚠️ Could not check. Retrying...' }); }
  }, [set]);

  const startPolling = useCallback((pUrl) => {
    clearAll();
    firstRef.current = setTimeout(async () => {
      await attemptFetch(pUrl);
      pollRef.current = setInterval(() => attemptFetch(pUrl), 20000);
    }, 35000);
  }, [attemptFetch]);

  const generate = async () => {
    if (!prompt.trim()) return;
    clearAll(); set({ status: 'submitting', msg: '', imageUrl: '', pollCount: 0 });
    try {
      const { data } = await axios.post(`${API_URL}/api/content/image`, { userId, prompt, aspectRatio: ratio });
      set({ pageUrl: data.pageUrl, status: 'pending', msg: '🖼️ Submitted! Auto-checking in ~35 sec...' });
      startPolling(data.pageUrl);
    } catch (err) { set({ status: 'error', msg: err.response?.data?.message || 'Submission failed.' }); }
  };

  const isGenerating = ['submitting', 'pending', 'polling'].includes(status);
  return (
    <>
      <div style={S.card}>
        <div style={{ background: '#a855f711', border: '1px solid #a855f733', borderRadius: '8px', padding: '0.5rem 0.8rem', fontSize: '0.75rem', color: '#a855f7' }}>🤖 TinyFish + Qwen AI · ~30 second generation</div>
        <div>
          <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', color: '#888' }}>Image Prompt</p>
          <div style={{ position: 'relative' }}>
            <textarea style={{ ...S.inp, minHeight: '80px', paddingRight: '2.8rem' }} placeholder="e.g. A hyper-realistic portrait of a futuristic samurai in neon-lit Tokyo..." value={prompt} onChange={e => set({ prompt: e.target.value })} />
            <div style={{ position: 'absolute', right: '0.5rem', bottom: '0.5rem' }}>
              <MicBtn color="#a855f7" onResult={txt => set(p => ({ prompt: p.prompt ? p.prompt + ' ' + txt : txt }))} />
            </div>
          </div>
        </div>
        <div>
          <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', color: '#888' }}>Aspect Ratio</p>
          <RatioPicker value={ratio} onChange={r => set({ ratio: r })} color="#a855f7" />
        </div>
        <button onClick={generate} disabled={isGenerating || !prompt.trim()} style={{ ...S.btn('#a855f7', isGenerating || !prompt.trim()), width: '100%' }}>
          {status === 'submitting' ? '⏳ Submitting...' : isGenerating ? '⏳ Generating... (~30s)' : '🖼️ Generate Image'}
        </button>
        {status === 'error' && msg && <Banner text={`❌ ${msg}`} type="error" />}
        {isGenerating && <Banner text={msg || '⏳ TinyFish automating Qwen...'} type="loading" />}
      </div>
      {status === 'done' && imageUrl && (
        <div style={S.card}>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#00ff88', fontWeight: 700 }}>✅ Image Generated!</p>
          <img src={imageUrl} alt="Generated" style={{ width: '100%', borderRadius: '10px', display: 'block' }} />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <a href={imageUrl} download target="_blank" rel="noreferrer" style={{ padding: '0.5rem 1rem', background: '#a855f722', color: '#a855f7', border: '1px solid #a855f744', borderRadius: '8px', fontSize: '0.78rem', textDecoration: 'none', fontWeight: 600 }}>⬇️ Download</a>
            <button onClick={() => set({ status: 'idle', imageUrl: '', prompt: '', msg: '', pollCount: 0 })} style={{ padding: '0.5rem 1rem', background: '#1e1e2e', color: '#555', border: '1px solid #2a2a3a', borderRadius: '8px', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>✨ New Image</button>
          </div>
        </div>
      )}
    </>
  );
}

// TEXT TO SPEECH — browser Web Speech API
function TextToSpeech({ onGenDone }) {
  const [text, setText] = useState(''); const [rate, setRate] = useState(1); const [pitch, setPitch] = useState(1);
  const [speaking, setSpeaking] = useState(false); const [voices, setVoices] = useState([]); const [selVoice, setSelVoice] = useState(''); const [error, setError] = useState('');
  useEffect(() => { const load = () => { const v = window.speechSynthesis.getVoices(); if (v.length) { setVoices(v); setSelVoice(v[0]?.name || ''); } }; load(); window.speechSynthesis.onvoiceschanged = load; }, []);
  const speak = () => {
    if (!text.trim() || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = rate; utt.pitch = pitch;
    const v = voices.find(v => v.name === selVoice); if (v) utt.voice = v;
    utt.onstart = () => setSpeaking(true);
    utt.onend = () => {
      setSpeaking(false);
      // Log to history on successful speech
      onGenDone({ tab: 'audio', type: 'tts', prompt: text });
    };
    utt.onerror = () => { setSpeaking(false); setError('Speech error.'); };
    window.speechSynthesis.speak(utt);
  };
  return (
    <div style={S.card}>
      <div style={{ background: '#00bcd411', border: '1px solid #00bcd433', borderRadius: '8px', padding: '0.5rem 0.8rem', fontSize: '0.75rem', color: '#00bcd4' }}>🔊 Browser Speech Synthesis — 100% free, works offline</div>
      <div><p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', color: '#888' }}>Text ({text.length}/2000)</p>
        <textarea style={{ ...S.inp, minHeight: '120px' }} placeholder="Type or paste text to hear..." value={text} onChange={e => e.target.value.length <= 2000 && setText(e.target.value)} /></div>
      {voices.length > 0 && <div><p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', color: '#888' }}>Voice</p>
        <select value={selVoice} onChange={e => setSelVoice(e.target.value)} style={{ ...S.inp, cursor: 'pointer', background: '#0d0d14', resize: 'none' }}>
          {voices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}</select></div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
        <div><p style={{ margin: '0 0 0.3rem', fontSize: '0.75rem', color: '#888' }}>Speed: {rate}x</p><input type="range" min="0.5" max="2" step="0.1" value={rate} onChange={e => setRate(Number(e.target.value))} style={{ width: '100%', accentColor: '#00bcd4' }} /></div>
        <div><p style={{ margin: '0 0 0.3rem', fontSize: '0.75rem', color: '#888' }}>Pitch: {pitch}</p><input type="range" min="0.5" max="2" step="0.1" value={pitch} onChange={e => setPitch(Number(e.target.value))} style={{ width: '100%', accentColor: '#00bcd4' }} /></div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={speak} disabled={speaking || !text.trim()} style={{ ...S.btn('#00bcd4', speaking || !text.trim()), flex: 1 }}>{speaking ? '🔊 Speaking...' : '▶️ Speak'}</button>
        {speaking && <button onClick={() => { window.speechSynthesis.cancel(); setSpeaking(false); }} style={{ ...S.btn('#ef4444'), padding: '0.7rem 1rem' }}>⏹ Stop</button>}
      </div>
      {error && <Banner text={`❌ ${error}`} type="error" />}
    </div>
  );
}

// SPEECH TO TEXT
function SpeechToText({ onGenDone }) {
  const [recording, setRecording] = useState(false); const [transcript, setTranscript] = useState(''); const [interim, setInterim] = useState('');
  const [error, setError] = useState(''); const [seconds, setSeconds] = useState(0); const [lang, setLang] = useState('en-US');
  const recRef = useRef(null); const timerRef = useRef(null); const isRec = useRef(false);
  const silenceRef = useRef(null); // auto-stop after silence
  const lastLoggedRef = useRef('');
  const langs = [{ code: 'en-US', label: '🇺🇸 English (US)' }, { code: 'en-GB', label: '🇬🇧 English (UK)' }, { code: 'hi-IN', label: '🇮🇳 Hindi' }, { code: 'es-ES', label: '🇪🇸 Spanish' }, { code: 'fr-FR', label: '🇫🇷 French' }, { code: 'de-DE', label: '🇩🇪 German' }, { code: 'zh-CN', label: '🇨🇳 Chinese' }, { code: 'ja-JP', label: '🇯🇵 Japanese' }];

  const stop = useCallback(() => {
    // Kill the silence timer
    clearTimeout(silenceRef.current); silenceRef.current = null;
    // Mark stopped FIRST
    isRec.current = false;
    // Grab ref, null it immediately so onend can't restart
    const rec = recRef.current;
    recRef.current = null;
    // Clean up UI
    setRecording(false); setInterim(''); clearInterval(timerRef.current);
    // Now kill the recognition — onend will fire but recRef is already null
    if (rec) {
      try { rec.stop(); } catch { }
      try { rec.abort(); } catch { }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stop(), [stop]);

  // Log transcript to history when recording stops and there's content
  useEffect(() => {
    if (!recording && transcript.trim() && transcript !== lastLoggedRef.current) {
      lastLoggedRef.current = transcript;
      onGenDone({ tab: 'asr', type: 'stt', prompt: 'Speech to Text', transcript: transcript.trim() });
    }
  }, [recording, transcript, onGenDone]);

  // Reset silence timer — called every time speech is detected
  const resetSilenceTimer = useCallback(() => {
    clearTimeout(silenceRef.current);
    silenceRef.current = setTimeout(() => {
      // 5 seconds of no speech → auto-stop
      if (isRec.current) stop();
    }, 5000);
  }, [stop]);

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError('Not supported. Use Chrome or Edge.'); return; }
    const r = new SR(); r.lang = lang; r.continuous = true; r.interimResults = true;
    r.onresult = (e) => {
      if (!isRec.current) return;
      let fin = '', inter = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript;
        else inter += e.results[i][0].transcript;
      }
      if (fin) setTranscript(p => p + fin + ' ');
      setInterim(inter);
      // Reset the silence auto-stop timer on every result
      resetSilenceTimer();
    };
    r.onend = () => {
      // Only restart if we're still supposed to be recording AND ref still points to this instance
      if (isRec.current && recRef.current === r) {
        try { r.start(); } catch { stop(); }
      }
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech') {
        // no-speech after silence → auto-stop
        if (isRec.current) stop();
        return;
      }
      if (e.error === 'aborted') return; // we triggered this ourselves
      setError('Mic error: ' + e.error); stop();
    };
    recRef.current = r; isRec.current = true; r.start();
    setRecording(true); setError(''); setSeconds(0);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    // Start silence timer (auto-stop if no speech for 5s)
    resetSilenceTimer();
  };
  const toggle = () => isRec.current ? stop() : start();
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={S.card}>
        <div style={{ background: '#ef444411', border: '1px solid #ef444433', borderRadius: '8px', padding: '0.5rem 0.8rem', fontSize: '0.75rem', color: '#ef4444' }}>🎙️ Browser Speech Recognition — free, best in Chrome/Edge</div>
        <div><p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', color: '#888' }}>Language</p>
          <select value={lang} onChange={e => { if (!recording) setLang(e.target.value); }} style={{ ...S.inp, cursor: 'pointer', background: '#0d0d14', resize: 'none' }}>{langs.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}</select></div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem', padding: '1rem 0' }}>
          <div style={{ position: 'relative' }}>
            {recording && <><div style={{ position: 'absolute', inset: '-12px', borderRadius: '50%', border: '2px solid #ef4444', opacity: 0.4, animation: 'ripple 1.5s ease-out infinite' }} /><div style={{ position: 'absolute', inset: '-6px', borderRadius: '50%', border: '2px solid #ef4444', opacity: 0.2, animation: 'ripple 1.5s ease-out 0.5s infinite' }} /></>}
            <button onClick={toggle} style={{ width: '80px', height: '80px', borderRadius: '50%', background: recording ? '#ef4444' : '#7c3aed', border: 'none', cursor: 'pointer', fontSize: '2.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: recording ? '0 0 24px #ef444466' : '0 0 16px #7c3aed44', transition: 'all 0.3s' }}>{recording ? '⏹' : '🎙️'}</button>
          </div>
          {recording && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%', animation: 'blink 1s infinite' }} /><span style={{ color: '#ef4444', fontFamily: 'monospace', fontWeight: 700, fontSize: '1.1rem' }}>{fmt(seconds)}</span></div>}
          <p style={{ color: '#555', fontSize: '0.8rem', margin: 0, textAlign: 'center' }}>{recording ? '🔴 Recording — tap ⏹ to stop instantly' : 'Tap 🎙️ to start'}</p>
        </div>
        {error && <Banner text={`❌ ${error}`} type="error" />}
      </div>
      {(transcript || interim) && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#00ff88', fontWeight: 600 }}>📝 Transcript</p>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={() => navigator.clipboard.writeText(transcript)} style={{ padding: '0.25rem 0.6rem', background: '#1e1e2e', color: '#666', border: '1px solid #2a2a3a', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'inherit' }}>📋 Copy</button>
              <button onClick={() => { setTranscript(''); setInterim(''); }} style={{ padding: '0.25rem 0.6rem', background: '#1e1e2e', color: '#666', border: '1px solid #2a2a3a', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'inherit' }}>🗑 Clear</button>
            </div>
          </div>
          <div style={{ background: '#0d0d14', borderRadius: '8px', padding: '0.9rem', fontSize: '0.88rem', lineHeight: 1.7, maxHeight: '200px', overflowY: 'auto', wordBreak: 'break-word' }}>
            <span style={{ color: '#ccc' }}>{transcript}</span>{interim && <span style={{ color: '#555', fontStyle: 'italic' }}>{interim}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// CONTENT CHAT
function ContentChat({ userId, isMobile, onGenDone, draftIdea, setDraftIdea }) {
  const [msgs, setMsgs] = useState([{ role: 'ai', text: "✍️ Hey! Ask me to write captions, scripts, blog posts, LinkedIn posts, tweets, or YouTube descriptions!" }]);
  const [input, setInput] = useState(''); const [loading, setLoading] = useState(false); const [cType, setCType] = useState('caption'); const [history, setHistory] = useState([]);
  const bottomRef = useRef();
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);
  const types = [{ id: 'caption', label: '📸 Caption' }, { id: 'script', label: '🎬 Script' }, { id: 'blog', label: '📝 Blog' }, { id: 'linkedin', label: '💼 LinkedIn' }, { id: 'tweet', label: '🐦 Tweet' }, { id: 'youtube', label: '🎥 YouTube' }];
  const quickPrompts = { caption: 'Write an engaging Instagram caption for a product launch with emojis and hashtags', script: 'Write a 60-second YouTube Shorts script about 3 productivity hacks', blog: 'Write a compelling intro for a blog post about AI in 2025', linkedin: 'Write a LinkedIn post about a career milestone with a storytelling hook', tweet: 'Write 5 viral tweet ideas about the future of remote work', youtube: 'Write a YouTube description for a React tutorial with SEO keywords' };

  useEffect(() => {
    if (draftIdea) {
      const p = draftIdea.platform.toLowerCase();
      let newType = 'caption';
      if (p.includes('linkedin')) newType = 'linkedin';
      else if (p.includes('youtube')) newType = 'script';
      else if (p.includes('twitter') || p.includes('x')) newType = 'tweet';
      else if (p.includes('blog')) newType = 'blog';
      
      setCType(newType);
      setInput(`Write a ${draftIdea.platform} post about: ${draftIdea.topic}. Focus on this angle: ${draftIdea.angle}. Hook: "${draftIdea.hook}"`);
      setDraftIdea(null);
    }
  }, [draftIdea, setDraftIdea]);
  const send = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim(); setInput('');
    setMsgs(p => [...p, { role: 'user', text: userMsg }]); setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/content/chat`, { userId, message: userMsg, contentType: cType, conversationHistory: history });
      setHistory(p => [...p, { role: 'user', content: userMsg }, { role: 'assistant', content: data.reply }]);
      setMsgs(p => [...p, { role: 'ai', text: data.reply, copyable: true }]);
      // Log to history
      onGenDone({ tab: 'chat', type: 'chat', prompt: userMsg, reply: data.reply });
    } catch (err) { setMsgs(p => [...p, { role: 'ai', text: '❌ ' + (err.response?.data?.message || 'Error. Try again.') }]); }
    setLoading(false);
  };
  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
        {types.map(t => <button key={t.id} onClick={() => setCType(t.id)} style={{ padding: '0.3rem 0.75rem', background: cType === t.id ? '#7c3aed33' : '#13131a', color: cType === t.id ? '#a855f7' : '#444', border: `1px solid ${cType === t.id ? '#7c3aed66' : '#2a2a3a'}`, borderRadius: '20px', cursor: 'pointer', fontSize: '0.73rem', fontWeight: cType === t.id ? 700 : 400, fontFamily: 'inherit' }}>{t.label}</button>)}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '200px' }}>
        {msgs.map((m, i) => (
          <div key={i}>
            {m.role === 'user' && <div style={{ background: '#7c3aed1a', border: '1px solid #7c3aed33', padding: '0.75rem 0.9rem', borderRadius: '12px', maxWidth: '82%', marginLeft: 'auto', fontSize: '0.87rem', color: '#ccc', lineHeight: 1.6 }}>{m.text}</div>}
            {m.role === 'ai' && <div style={{ background: '#13131a', border: '1px solid #2a2a3a', padding: '0.75rem 0.9rem', borderRadius: '12px', maxWidth: '88%' }}>
              <span style={{ fontSize: '0.68rem', color: '#a855f7', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>✍️ Content AI</span>
              <p style={{ margin: 0, color: '#ccc', fontSize: '0.87rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{m.text}</p>
              {m.copyable && <button onClick={() => navigator.clipboard.writeText(m.text)} style={{ marginTop: '0.5rem', padding: '0.2rem 0.6rem', background: '#1e1e2e', color: '#555', border: '1px solid #2a2a3a', borderRadius: '6px', cursor: 'pointer', fontSize: '0.68rem', fontFamily: 'inherit' }}>📋 Copy</button>}
            </div>}
          </div>
        ))}
        {loading && <div style={{ background: '#13131a', border: '1px solid #2a2a3a', padding: '0.75rem 0.9rem', borderRadius: '12px', maxWidth: '72%' }}><span style={{ fontSize: '0.68rem', color: '#a855f7', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>✍️ Content AI</span><p style={{ margin: 0, color: '#444', fontSize: '0.87rem' }}>✍️ Writing...</p></div>}
        <div ref={bottomRef} />
      </div>
      <button onClick={() => setInput(quickPrompts[cType])} style={{ padding: '0.3rem 0.7rem', background: '#13131a', color: '#444', border: '1px solid #1e1e2e', borderRadius: '8px', cursor: 'pointer', fontSize: '0.7rem', textAlign: 'left', fontFamily: 'inherit' }}>💡 {quickPrompts[cType].slice(0, 55)}...</button>
      <div style={{ display: 'flex', gap: '0.4rem', background: '#13131a', border: '1px solid #2a2a3a', borderRadius: '12px', padding: '0.5rem 0.75rem', alignItems: 'flex-end' }}>
        <textarea style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: '0.87rem', outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }} rows={2} placeholder={`Ask AI to write a ${cType}...`} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} />
        <MicBtn color="#7c3aed" onResult={txt => setInput(p => p ? p + ' ' + txt : txt)} />
        <button onClick={send} disabled={loading || !input.trim()} style={{ width: '38px', height: '38px', background: loading || !input.trim() ? '#1e1e2e' : '#7c3aed', color: loading || !input.trim() ? '#444' : '#fff', border: 'none', borderRadius: '10px', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>↑</button>
      </div>
    </>
  );
}