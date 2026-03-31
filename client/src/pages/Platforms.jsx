import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const platformConfig = [
  {
    id: 'linkedin', name: 'LinkedIn', icon: '💼', color: '#0077b5',
    features: ['Auto Post', 'Auto-Apply Jobs', 'Reply Comments'],
    authUrl: `${API_URL}/api/platforms/linkedin`,
    permissions: [
      { key: 'linkedinAutoPost', label: '📤 Auto-Post', desc: 'AI posts content on your behalf' },
      { key: 'linkedinReplyComments', label: '💬 Auto-Reply Comments', desc: 'AI replies to your post comments' },
      { key: 'autoApplyJobs', label: '💼 Auto-Apply Jobs', desc: 'AI applies to jobs using your resume' },
    ]
  },
  {
    id: 'instagram', name: 'Instagram', icon: '📸', color: '#e1306c',
    features: ['Auto Post', 'Reel Upload', 'Reply Comments'],
    permissions: [
      { key: 'instagramAutoPost', label: '📤 Auto-Post', desc: 'AI posts images & reels' },
      { key: 'instagramReplyComments', label: '💬 Reply Comments', desc: 'AI replies to comments' },
    ]
  },
  {
    id: 'youtube', name: 'YouTube', icon: '🎥', color: '#ff0000',
    features: ['Upload Videos', 'Reply Comments', 'Auto Post'],
    authUrl: `${API_URL}/api/platforms/youtube/connect`,
    permissions: [
      { key: 'youtubeAutoPost', label: '🎥 Auto-Upload Videos', desc: 'AI uploads videos automatically' },
      { key: 'youtubeReplyComments', label: '💬 Auto-Reply Comments', desc: 'AI replies to comments automatically' },
    ]
  },
  {
    id: 'gmail', name: 'Gmail', icon: '📧', color: '#ea4335',
    features: ['Read Inbox', 'AI Reply', 'Send Email', 'Auto-Reply'],
    authUrl: `${API_URL}/api/gmail/connect`,
    permissions: [
      { key: 'gmailAutoReply', label: '🤖 Auto-Reply', desc: 'AI auto-replies to selected contacts' },
    ]
  },
];

export default function Platforms() {
  const [connected, setConnected] = useState({ linkedin: false, instagram: false, youtube: false, gmail: false });
  const [permissions, setPermissions] = useState({
    linkedinAutoPost: false, linkedinReplyComments: false, linkedinSendDMs: false, autoApplyJobs: false,
    instagramAutoPost: false, instagramReplyComments: false,
    youtubeAutoPost: false, youtubeReplyComments: false,
    gmailAutoReply: false,
  });
  const [expandedSettings, setExpandedSettings] = useState({});
  const [resume, setResume] = useState(null);
  const [resumeName, setResumeName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveMsg, setSaveMsg] = useState('');
  const [ytModal, setYtModal] = useState(null);
  const [igModal, setIgModal] = useState(null);
  const [gmailModal, setGmailModal] = useState(null);
  const [igTokenInput, setIgTokenInput] = useState('');
  const [linkedinBotModal, setLinkedinBotModal] = useState(false);
  const [igBotModal, setIgBotModal] = useState(false);
  const [igBotConnected, setIgBotConnected] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const fileRef = useRef();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const r = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);

  useEffect(() => {
    fetchStatus();
    // ✅ Check Instagram Bot credentials status on load
    axios.get(`${API_URL}/api/instagram-bot/credentials-status/${user.id}`)
      .then(({ data }) => { if (data.hasCredentials) setConnected(prev => ({ ...prev, instagram: true })); })
      .catch(console.error);
    const params = new URLSearchParams(window.location.search);
    const conn = params.get('connected');
    const igUser = params.get('ig_user');
    if (conn) {
      setConnected(prev => ({ ...prev, [conn]: true }));
      window.history.replaceState({}, '', '/dashboard');
      if (conn === 'gmail') { setSaveMsg('✅ Gmail connected!'); setTimeout(() => setSaveMsg(''), 3000); }
      if (conn === 'instagram' && igUser) {
        setSaveMsg(`✅ Instagram @${decodeURIComponent(igUser)} connected!`);
        setTimeout(() => setSaveMsg(''), 4000);
      }
    }
    const errParam = params.get('error');
    if (errParam === 'instagram_no_business_account') {
      alert('⚠️ No Instagram Business Account found!\n\nMake sure your Instagram is:\n1. Switched to Business/Creator account\n2. Linked to a Facebook Page');
    }
  }, []);

  const fetchStatus = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/platforms/status/${user.id}`);
      // ✅ Also check igBotUsername for Instagram connected status
      const platforms = data.platforms || {};
      if (data.igBotUsername) platforms.instagram = true;
      setConnected(platforms);
      const perms = {
        linkedinAutoPost: data.permissions?.linkedinAutoPost || false,
        linkedinReplyComments: data.permissions?.linkedinReplyComments || false,
        linkedinSendDMs: data.permissions?.linkedinSendDMs || false,
        autoApplyJobs: data.permissions?.autoApplyJobs || false,
        instagramAutoPost: data.permissions?.instagramAutoPost || false,
        instagramReplyComments: data.permissions?.instagramReplyComments || false,
        youtubeAutoPost: data.permissions?.youtubeAutoPost || false,
        youtubeReplyComments: data.permissions?.youtubeReplyComments || false,
        gmailAutoReply: data.permissions?.gmailAutoReply || false,
      };
      setPermissions(perms);
      localStorage.setItem('synapPermissions', JSON.stringify(perms));
      if (data.resumeName) setResumeName(data.resumeName);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const connectInstagram = async () => {
    if (!igTokenInput.trim()) return alert('Paste your Instagram access token!');
    try {
      await axios.post(`${API_URL}/api/instagram/connect`, { userId: user.id, accessToken: igTokenInput.trim() });
      setConnected(prev => ({ ...prev, instagram: true }));
      setIgModal(null); setIgTokenInput('');
      setSaveMsg('✅ Instagram Connected!'); setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) { alert('❌ ' + (err.response?.data?.message || err.message)); }
  };

  const connectPlatform = (platform) => {
    if (platform.id === 'instagram') { setIgBotModal(true); return; } // ✅ Use new bot system
    if (!platform.authUrl) { alert(`${platform.name} OAuth coming soon!`); return; }
    window.location.href = `${platform.authUrl}?userId=${user.id}`;
  };

  const disconnectPlatform = async (platformId) => {
    if (!window.confirm(`Disconnect ${platformId}?`)) return;
    try {
      if (platformId === 'instagram') {
        // ✅ Clear both old token AND new bot credentials
        try { await axios.post(`${API_URL}/api/instagram/disconnect`, { userId: user.id }); } catch {}
        await axios.post(`${API_URL}/api/instagram-bot/save-credentials`, { userId: user.id, username: '', password: '' });
      } else if (platformId === 'gmail') {
        await axios.post(`${API_URL}/api/gmail/disconnect`, { userId: user.id });
      } else {
        await axios.post(`${API_URL}/api/platforms/disconnect`, { userId: user.id, platform: platformId });
      }
      setConnected(prev => ({ ...prev, [platformId]: false }));
      setSaveMsg(`✅ ${platformId} disconnected`); setTimeout(() => setSaveMsg(''), 2000);
    } catch (err) { alert('❌ Failed to disconnect'); }
  };

  const togglePermission = async (key) => {
    const updated = { ...permissions, [key]: !permissions[key] };
    setPermissions(updated);
    localStorage.setItem('synapPermissions', JSON.stringify(updated));
    try {
      await axios.post(`${API_URL}/api/platforms/permissions`, { userId: user.id, permissions: updated });
      setSaveMsg('✅ Saved!'); setTimeout(() => setSaveMsg(''), 2000);
    } catch { setSaveMsg('❌ Failed'); setTimeout(() => setSaveMsg(''), 2000); }
  };

  const toggleSettings = (platformId) => {
    setExpandedSettings(prev => ({ ...Object.keys(prev).reduce((a, k) => ({ ...a, [k]: false }), {}), [platformId]: !prev[platformId] }));
  };

  const handleResumeUpload = async () => {
    if (!resume) return;
    setUploading(true);
    const form = new FormData();
    form.append('resume', resume);
    try {
      const { data } = await axios.post(`${API_URL}/api/platforms/resume?userId=${user.id}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResumeName(data.filename); setResume(null);
      setSaveMsg('✅ Resume uploaded!'); setTimeout(() => setSaveMsg(''), 2000);
    } catch { alert('Upload failed'); }
    setUploading(false);
  };

  if (loading) return <div style={{ color: '#888', padding: '2rem' }}>Loading platforms...</div>;

  return (
    <div style={{ flex: 1, padding: isMobile ? '1rem' : '1.5rem', overflowY: 'auto', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? '1.2rem' : '1.4rem' }}>🔗 Platform Connections</h2>
        {saveMsg && <span style={{ fontSize: '0.85rem', color: '#00ff88', background: '#00ff8811', padding: '0.3rem 0.8rem', borderRadius: '20px' }}>{saveMsg}</span>}
      </div>
      <p style={{ color: '#888', margin: '0 0 1.5rem', fontSize: '0.9rem' }}>Connect your accounts and configure AI permissions</p>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', alignItems: 'start' }}>
        {platformConfig.map(platform => (
          <div key={platform.id} style={{ background: '#13131a', border: `2px solid ${connected[platform.id] ? platform.color : '#2a2a3a'}`, borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'border-color 0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                <span style={{ fontSize: '2rem' }}>{platform.icon}</span>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>{platform.name}</h3>
              </div>
              <div style={{ padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', background: connected[platform.id] ? '#00ff8822' : '#ffffff11', color: connected[platform.id] ? '#00ff88' : '#888', border: `1px solid ${connected[platform.id] ? '#00ff8844' : '#2a2a3a'}` }}>
                {connected[platform.id] ? '✅ Connected' : '⚪ Not Connected'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {platform.features.map(f => <span key={f} style={{ padding: '0.25rem 0.6rem', background: '#1e1e2e', border: '1px solid #2a2a3a', borderRadius: '20px', fontSize: '0.72rem', color: '#888' }}>{f}</span>)}
            </div>

            {connected[platform.id] ? (
              <>
                <button style={{ width: '100%', padding: '0.6rem', background: '#1e1e2e', color: '#888', border: '1px solid #2a2a3a', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', textAlign: 'left' }}
                  onClick={() => toggleSettings(platform.id)}>⚙️ Permissions {expandedSettings[platform.id] ? '▲' : '▼'}</button>

                {expandedSettings[platform.id] && (
                  <div style={{ background: '#0d0d14', border: '1px solid #2a2a3a', borderRadius: '10px', padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {platform.permissions?.map(p => (
                      <div key={p.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.3rem' }}>
                        <div>
                          <p style={{ margin: '0 0 0.1rem', fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>{p.label}</p>
                          <p style={{ margin: 0, fontSize: '0.7rem', color: '#666' }}>{p.desc}</p>
                        </div>
                        <div style={{ width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer', position: 'relative', transition: 'background 0.3s', flexShrink: 0, background: permissions[p.key] ? platform.color : '#2a2a3a' }}
                          onClick={() => togglePermission(p.key)}>
                          <div style={{ width: '20px', height: '20px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', transition: 'transform 0.3s', transform: permissions[p.key] ? 'translateX(20px)' : 'translateX(2px)' }} />
                        </div>
                      </div>
                    ))}

                    {/* LinkedIn Bot Button */}
                    {platform.id === 'linkedin' && (
                      <button style={{ width: '100%', padding: '0.5rem', background: '#0077b522', color: '#4a9fd4', border: '1px solid #0077b544', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, marginTop: '0.3rem' }}
                        onClick={() => setLinkedinBotModal(true)}>🤖 Bot Settings (Auto-Apply + Comment Reply)</button>
                    )}

                    {/* LinkedIn resume upload - visible when autoApplyJobs is ON */}
                    {platform.id === 'linkedin' && permissions.autoApplyJobs && (
                      <div style={{ background: '#1e1e2e', borderRadius: '8px', padding: '0.8rem', border: '1px dashed #0077b555', marginTop: '0.3rem' }}>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#4a9fd4', fontWeight: 600 }}>📄 Resume for Job Scanning</p>
                        {resumeName && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.8rem', background: '#13131a', borderRadius: '6px', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#ccc' }}><span>📎 {resumeName}</span><span style={{ color: '#00ff88' }}>✅</span></div>}
                        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) setResume(e.target.files[0]); }} />
                        {resume && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.8rem', background: '#13131a', borderRadius: '6px', marginBottom: '0.4rem', fontSize: '0.8rem', color: '#ccc' }}><span>📎 {resume.name}</span><button style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' }} onClick={() => setResume(null)}>✕</button></div>}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <button style={{ padding: '0.5rem 0.8rem', background: '#2a2a3a', color: '#fff', border: '1px solid #3a3a4a', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }} onClick={() => fileRef.current.click()}>📂 Choose</button>
                          {resume && <button style={{ padding: '0.5rem 0.8rem', background: '#0077b5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }} onClick={handleResumeUpload} disabled={uploading}>{uploading ? '⏳' : '✅ Upload Resume'}</button>}
                        </div>
                      </div>
                    )}

                    {/* Instagram actions */}
                    {platform.id === 'instagram' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.3rem' }}>
                        <button style={{ width: '100%', padding: '0.5rem', background: '#e1306c22', color: '#e1306c', border: '1px solid #e1306c44', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
                          onClick={() => setIgBotModal(true)}>🤖 Instagram Bot (Post · Story · Auto-Reply)</button>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button style={{ flex: 1, padding: '0.4rem', background: '#e1306c22', color: '#e1306c', border: '1px solid #e1306c44', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }} onClick={() => setIgModal('comments')}>💬 Old Comments</button>
                          <button style={{ flex: 1, padding: '0.4rem', background: '#e1306c22', color: '#e1306c', border: '1px solid #e1306c44', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }} onClick={() => setIgModal('post')}>📸 Post (URL)</button>
                        </div>
                      </div>
                    )}

                    {/* YouTube actions */}
                    {platform.id === 'youtube' && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                        <button style={{ flex: 1, padding: '0.5rem', background: '#ff000022', color: '#ff6666', border: '1px solid #ff444444', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }} onClick={() => setYtModal('comments')}>💬 Comments</button>
                        <button style={{ flex: 1, padding: '0.5rem', background: '#ff000022', color: '#ff6666', border: '1px solid #ff444444', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }} onClick={() => setYtModal('upload')}>⬆️ Upload</button>
                      </div>
                    )}

                    {/* Gmail actions */}
                    {platform.id === 'gmail' && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                        <button style={{ flex: 1, padding: '0.5rem', background: '#ea433522', color: '#ea4335', border: '1px solid #ea433544', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }} onClick={() => setGmailModal('inbox')}>📧 Inbox</button>
                        <button style={{ flex: 1, padding: '0.5rem', background: '#ea433522', color: '#ea4335', border: '1px solid #ea433544', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }} onClick={() => setGmailModal('compose')}>✏️ Compose</button>
                      </div>
                    )}
                  </div>
                )}
                <button style={{ width: '100%', padding: '0.6rem', background: 'transparent', color: '#ff4444', border: '1px solid #ff4444', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}
                  onClick={() => disconnectPlatform(platform.id)}>Disconnect {platform.name}</button>
              </>
            ) : (
              <button style={{ width: '100%', padding: '0.75rem', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', marginTop: '0.3rem', background: platform.color }}
                onClick={() => connectPlatform(platform)}>Connect {platform.name} →</button>
            )}
          </div>
        ))}
      </div>

      {/* Instagram modals */}
      {igBotModal && (
        <Modal onClose={() => setIgBotModal(false)} title="🤖 Instagram Bot" wide>
          <InstagramBot userId={user.id} />
        </Modal>
      )}

      {linkedinBotModal && (
        <Modal onClose={() => setLinkedinBotModal(false)} title="🤖 LinkedIn Bot Settings" wide>
          <LinkedInBot userId={user.id} />
        </Modal>
      )}

      {igModal === 'connect' && (
        <Modal onClose={() => setIgModal(null)} title="📸 Connect Instagram">
          <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 1rem' }}>Paste your Instagram Business Access Token from Meta Business Suite</p>
          <textarea style={modalInp} placeholder="Paste access token here..." value={igTokenInput} onChange={e => setIgTokenInput(e.target.value)} />
          <button onClick={connectInstagram} style={primaryBtn('#e1306c')}>🔗 Connect</button>
        </Modal>
      )}
      {igModal === 'post' && <Modal onClose={() => setIgModal(null)} title="📸 Post to Instagram"><IGPost userId={user.id} /></Modal>}
      {igModal === 'comments' && <Modal onClose={() => setIgModal(null)} title="💬 Instagram Comments"><IGComments userId={user.id} /></Modal>}

      {/* YouTube modals */}
      {ytModal && (
        <Modal onClose={() => setYtModal(null)} title={ytModal === 'comments' ? '💬 YouTube Comments' : '⬆️ Upload Video'}>
          {ytModal === 'comments' && <YTComments userId={user.id} autoReplyEnabled={permissions.youtubeReplyComments} />}
          {ytModal === 'upload' && <YTUpload userId={user.id} />}
        </Modal>
      )}

      {/* Gmail modals */}
      {gmailModal === 'inbox' && <Modal onClose={() => setGmailModal(null)} title="📧 Gmail Inbox" wide><GmailInbox userId={user.id} onCompose={() => setGmailModal('compose')} /></Modal>}
      {gmailModal === 'compose' && <Modal onClose={() => setGmailModal(null)} title="✏️ Compose Email"><GmailCompose userId={user.id} onClose={() => setGmailModal(null)} /></Modal>}
    </div>
  );
}

// ─── Shared Modal ─────────────────────────────────────────────
function Modal({ onClose, title, children, wide }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000aa', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={onClose}>
      <div style={{ background: '#13131a', border: '1px solid #2a2a3a', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: wide ? '820px' : '520px', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: '#fff' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.3rem', lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const modalInp = { padding: '0.8rem', background: '#1e1e2e', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#fff', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', marginBottom: '0.8rem', minHeight: '80px', resize: 'vertical', fontFamily: 'sans-serif' };
const primaryBtn = (color) => ({ width: '100%', padding: '0.8rem', background: color, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 });
const inpStyle = { padding: '0.8rem', background: '#1e1e2e', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#fff', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box' };

// ─── Gmail Inbox ──────────────────────────────────────────────
function GmailInbox({ userId, onCompose }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [emailBody, setEmailBody] = useState(null);
  const [loadingBody, setLoadingBody] = useState(false);
  // AI Reply popup state
  const [aiReplyPopup, setAiReplyPopup] = useState(null); // { reply, from, fromEmail, subject, threadId, emailId }
  const [loadingReply, setLoadingReply] = useState(false);
  const [autoReplyChecked, setAutoReplyChecked] = useState(false);
  const [sending, setSending] = useState(false);
  const [autoContacts, setAutoContacts] = useState([]);

  useEffect(() => {
    loadEmails();
    loadAutoContacts();
  }, []);

  const loadEmails = () => {
    setLoading(true);
    axios.get(`${API_URL}/api/gmail/inbox/${userId}`)
      .then(({ data }) => setEmails(data.emails || []))
      .catch(console.error).finally(() => setLoading(false));
  };

  const loadAutoContacts = () => {
    axios.get(`${API_URL}/api/gmail/auto-reply-contacts/${userId}`)
      .then(({ data }) => setAutoContacts(data.contacts || []))
      .catch(console.error);
  };

  const openEmail = async (email) => {
    setSelected(email); setEmailBody(null); setLoadingBody(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/gmail/email/${userId}/${email.id}`);
      setEmailBody(data);
      setEmails(p => p.map(e => e.id === email.id ? { ...e, isUnread: false } : e));
    } catch (err) { console.error(err); }
    setLoadingBody(false);
  };

  const generateAiReply = async () => {
    if (!emailBody) return;
    setLoadingReply(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/gmail/ai-reply`, {
        subject: emailBody.subject, body: emailBody.body, from: emailBody.from
      });
      const fromEmail = emailBody.from.match(/<(.+)>/)?.[1] || emailBody.from;
      const isAutoContact = autoContacts.some(c => fromEmail.includes(c) || c.includes(fromEmail));
      setAiReplyPopup({
        reply: data.reply,
        from: emailBody.from,
        fromEmail,
        subject: emailBody.subject,
        threadId: emailBody.threadId,
        emailId: selected.id,
        editedReply: data.reply,
      });
      setAutoReplyChecked(isAutoContact);
    } catch { alert('❌ AI error'); }
    setLoadingReply(false);
  };

  const sendAiReply = async () => {
    if (!aiReplyPopup) return;
    setSending(true);
    try {
      // If checkbox checked, save to auto-reply contacts
      if (autoReplyChecked) {
        await axios.post(`${API_URL}/api/gmail/auto-reply/add`, { userId, fromEmail: aiReplyPopup.fromEmail });
        setAutoContacts(p => [...new Set([...p, aiReplyPopup.fromEmail])]);
      } else {
        // Remove from auto-reply if unchecked
        await axios.post(`${API_URL}/api/gmail/auto-reply/remove`, { userId, fromEmail: aiReplyPopup.fromEmail });
        setAutoContacts(p => p.filter(c => c !== aiReplyPopup.fromEmail));
      }

      await axios.post(`${API_URL}/api/gmail/send`, {
        userId,
        to: aiReplyPopup.fromEmail,
        subject: `Re: ${aiReplyPopup.subject}`,
        body: aiReplyPopup.editedReply,
        threadId: aiReplyPopup.threadId
      });

      setEmails(p => p.map(e => e.id === aiReplyPopup.emailId ? { ...e, replied: true } : e));
      setAiReplyPopup(null); setSelected(null); setEmailBody(null);
      alert('✅ Reply sent!');
    } catch { alert('❌ Send failed'); }
    setSending(false);
  };

  const fmt = (d) => { try { return new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; } };
  const name = (from) => { const m = from?.match(/^(.+?)\s*</); return m ? m[1].replace(/"/g, '') : from?.split('@')[0] || from; };

  if (loading) return <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>⏳ Loading inbox...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#888' }}>{emails.length} emails · {autoContacts.length} auto-reply contacts</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={loadEmails} style={{ padding: '0.4rem 0.8rem', background: '#1e1e2e', color: '#888', border: '1px solid #2a2a3a', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>🔄</button>
          {onCompose && <button onClick={onCompose} style={{ padding: '0.4rem 0.8rem', background: '#ea4335', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>✏️ Compose</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected && window.innerWidth > 600 ? '1fr 1.2fr' : '1fr', gap: '0.8rem' }}>
        {/* Email list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '55vh', overflowY: 'auto' }}>
          {emails.length === 0 && <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>No emails found</p>}
          {emails.map(email => (
            <div key={email.id} onClick={() => openEmail(email)}
              style={{ background: selected?.id === email.id ? '#1e1e2e' : '#0d0d14', border: `1px solid ${selected?.id === email.id ? '#ea433544' : '#2a2a3a'}`, borderRadius: '8px', padding: '0.7rem', cursor: 'pointer', transition: 'all 0.15s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: email.isUnread ? 700 : 400, color: email.isUnread ? '#fff' : '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {email.isUnread && <span style={{ width: '6px', height: '6px', background: '#ea4335', borderRadius: '50%', display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }} />}
                  {name(email.from)}
                </p>
                <span style={{ fontSize: '0.62rem', color: '#555', flexShrink: 0, marginLeft: '0.4rem' }}>{fmt(email.date)}</span>
              </div>
              <p style={{ margin: '0 0 0.1rem', fontSize: '0.78rem', color: email.isUnread ? '#ddd' : '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.subject}</p>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.snippet}</p>
            </div>
          ))}
        </div>

        {/* Email detail */}
        {selected && (
          <div style={{ background: '#0d0d14', border: '1px solid #2a2a3a', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '55vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 0.2rem', fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>{emailBody?.subject || selected.subject}</p>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#888' }}>{emailBody?.from || selected.from}</p>
              </div>
              <button onClick={() => { setSelected(null); setEmailBody(null); }} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>
            {loadingBody && <p style={{ color: '#888', fontSize: '0.82rem' }}>⏳ Loading...</p>}
            {emailBody && !loadingBody && (
              <div style={{ background: '#13131a', borderRadius: '8px', padding: '0.8rem', fontSize: '0.82rem', color: '#ccc', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {emailBody.body || selected.snippet}
              </div>
            )}
            <button onClick={generateAiReply} disabled={loadingReply || !emailBody}
              style={{ padding: '0.5rem 1rem', background: '#7c3aed22', color: '#a855f7', border: '1px solid #7c3aed44', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', alignSelf: 'flex-start' }}>
              {loadingReply ? '⏳ Generating...' : '🧠 AI Reply'}
            </button>
          </div>
        )}
      </div>

      {/* ── AI Reply Popup ── */}
      {aiReplyPopup && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#13131a', border: '1px solid #7c3aed44', borderRadius: '20px', padding: '1.5rem', maxWidth: '500px', width: '100%', boxSizing: 'border-box', boxShadow: '0 0 40px #7c3aed22' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>🧠 AI Reply</h3>
              <button onClick={() => setAiReplyPopup(null)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
            <p style={{ margin: '0 0 0.8rem', fontSize: '0.78rem', color: '#888' }}>Replying to: <span style={{ color: '#ccc' }}>{aiReplyPopup.from}</span></p>

            {/* Editable reply */}
            <textarea
              style={{ width: '100%', padding: '0.9rem', background: '#1e1e2e', border: '1px solid #7c3aed44', borderRadius: '10px', color: '#fff', fontSize: '0.85rem', outline: 'none', resize: 'vertical', minHeight: '120px', boxSizing: 'border-box', fontFamily: 'sans-serif', lineHeight: 1.6, marginBottom: '1rem' }}
              value={aiReplyPopup.editedReply}
              onChange={e => setAiReplyPopup(p => ({ ...p, editedReply: e.target.value }))}
            />

            {/* Auto-reply checkbox */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem', padding: '0.8rem', background: '#1e1e2e', border: '1px solid #2a2a3a', borderRadius: '10px', marginBottom: '1rem', cursor: 'pointer' }}
              onClick={() => setAutoReplyChecked(p => !p)}>
              <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${autoReplyChecked ? '#7c3aed' : '#444'}`, background: autoReplyChecked ? '#7c3aed' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px' }}>
                {autoReplyChecked && <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 900 }}>✓</span>}
              </div>
              <div>
                <p style={{ margin: '0 0 0.2rem', fontSize: '0.83rem', fontWeight: 600, color: '#fff' }}>🤖 Automate this conversation</p>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#888', lineHeight: 1.5 }}>
                  Future emails from <span style={{ color: '#a855f7' }}>{aiReplyPopup.fromEmail}</span> will be automatically replied to by AI without asking you.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button onClick={sendAiReply} disabled={sending}
                style={{ flex: 1, padding: '0.8rem', background: sending ? '#333' : '#ea4335', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem' }}>
                {sending ? '⏳ Sending...' : '📤 Send Reply'}
              </button>
              <button onClick={() => setAiReplyPopup(null)}
                style={{ padding: '0.8rem 1.2rem', background: 'transparent', color: '#888', border: '1px solid #2a2a3a', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}>
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Gmail Compose ────────────────────────────────────────────
function GmailCompose({ userId, onClose }) {
  const [form, setForm] = useState({ to: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);
  const send = async () => {
    if (!form.to || !form.subject || !form.body) return alert('Fill all fields!');
    setSending(true);
    try {
      await axios.post(`${API_URL}/api/gmail/send`, { userId, ...form });
      alert('✅ Email sent!'); onClose();
    } catch { alert('❌ Send failed'); }
    setSending(false);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      <input style={inpStyle} placeholder="To (email address)" value={form.to} onChange={e => setForm(p => ({ ...p, to: e.target.value }))} />
      <input style={inpStyle} placeholder="Subject" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} />
      <textarea style={{ ...inpStyle, minHeight: '150px', resize: 'vertical', fontFamily: 'sans-serif' }} placeholder="Email body..." value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} />
      <button onClick={send} disabled={sending} style={primaryBtn(sending ? '#333' : '#ea4335')}>
        {sending ? '⏳ Sending...' : '📤 Send Email'}
      </button>
    </div>
  );
}

// ─── Instagram Post ───────────────────────────────────────────
function IGPost({ userId }) {
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [posting, setPosting] = useState(false);
  const post = async () => {
    if (!imageUrl) return alert('Image URL required!');
    setPosting(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/instagram/post/image`, { userId, caption, imageUrl });
      alert('✅ ' + data.message); setCaption(''); setImageUrl('');
    } catch (err) { alert('❌ ' + (err.response?.data?.message || 'Post failed')); }
    setPosting(false);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      <p style={{ margin: 0, fontSize: '0.8rem', color: '#888' }}>⚠️ Requires a public image URL</p>
      <input style={inpStyle} placeholder="Public Image URL (https://...)" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
      <textarea style={{ ...inpStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'sans-serif' }} placeholder="Caption + hashtags" value={caption} onChange={e => setCaption(e.target.value)} />
      <button onClick={post} disabled={posting || !imageUrl} style={primaryBtn(posting || !imageUrl ? '#333' : '#e1306c')}>
        {posting ? '⏳ Posting...' : '📸 Post to Instagram'}
      </button>
    </div>
  );
}

// ─── Instagram Comments ───────────────────────────────────────
function IGComments({ userId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyLoading, setReplyLoading] = useState({});
  const [confirmPopup, setConfirmPopup] = useState(null);
  useEffect(() => {
    axios.get(`${API_URL}/api/instagram/comments/${userId}`).then(({ data }) => setComments(data.comments || [])).catch(console.error).finally(() => setLoading(false));
  }, []);
  const getAiReply = async (c) => {
    setReplyLoading(p => ({ ...p, [c.id]: true }));
    try {
      const { data } = await axios.post(`${API_URL}/api/instagram/comment/ai-reply`, { comment: c.text, mediaCaption: c.mediaCaption });
      setConfirmPopup({ commentId: c.id, reply: data.reply });
    } catch { alert('❌ AI reply failed'); }
    setReplyLoading(p => ({ ...p, [c.id]: false }));
  };
  const doReply = async (commentId, reply) => {
    try {
      await axios.post(`${API_URL}/api/instagram/comment/reply`, { userId, commentId, reply });
      setComments(p => p.map(c => c.id === commentId ? { ...c, replied: true } : c));
      setConfirmPopup(null);
    } catch (err) { alert('❌ ' + (err.response?.data?.message || 'Failed')); }
  };
  if (loading) return <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>⏳ Loading...</p>;
  if (!comments.length) return <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>No comments found.</p>;
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '55vh', overflowY: 'auto' }}>
        {comments.map(c => (
          <div key={c.id} style={{ background: '#1e1e2e', borderRadius: '10px', padding: '1rem', border: '1px solid #2a2a3a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: '#fff' }}>👤 @{c.author}</p>
              {c.replied && <span style={{ fontSize: '0.7rem', background: '#00ff8822', color: '#00ff88', padding: '0.2rem 0.5rem', borderRadius: '10px' }}>✅ Replied</span>}
            </div>
            <p style={{ margin: '0 0 0.8rem', color: '#ccc', fontSize: '0.88rem', fontStyle: 'italic' }}>"{c.text}"</p>
            {!c.replied && <button disabled={replyLoading[c.id]} onClick={() => getAiReply(c)} style={{ padding: '0.35rem 0.9rem', background: '#e1306c22', color: '#e1306c', border: '1px solid #e1306c44', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>{replyLoading[c.id] ? '⏳' : '🧠 AI Reply'}</button>}
          </div>
        ))}
      </div>
      {confirmPopup && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000bb', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#13131a', border: '1px solid #2a2a3a', borderRadius: '16px', padding: '1.5rem', maxWidth: '420px', width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 0.8rem', color: '#fff' }}>🧠 AI Reply</h3>
            <div style={{ background: '#1e1e2e', borderRadius: '8px', padding: '0.8rem', marginBottom: '1rem', fontSize: '0.88rem', color: '#ccc', fontStyle: 'italic' }}>"{confirmPopup.reply}"</div>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button onClick={() => doReply(confirmPopup.commentId, confirmPopup.reply)} style={{ flex: 1, padding: '0.7rem', background: '#00ff88', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>✅ Post</button>
              <button onClick={() => setConfirmPopup(null)} style={{ flex: 1, padding: '0.7rem', background: 'transparent', color: '#888', border: '1px solid #2a2a3a', borderRadius: '8px', cursor: 'pointer' }}>❌ Skip</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── YouTube Comments ─────────────────────────────────────────
function YTComments({ userId, autoReplyEnabled }) {
  const [comments, setComments] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedVideo, setExpandedVideo] = useState(null);
  const [replyLoading, setReplyLoading] = useState({});
  const [confirmPopup, setConfirmPopup] = useState(null);
  const [automatedVideos, setAutomatedVideos] = useState([]);
  const [contextPopup, setContextPopup] = useState(null);
  const [contextText, setContextText] = useState('');
  const [videoContexts, setVideoContexts] = useState({});

  useEffect(() => {
    axios.get(`${API_URL}/api/platforms/youtube/automated-videos/${userId}`)
      .then(({ data }) => {
        setAutomatedVideos(data.automatedVideos || []);
        setVideoContexts(data.videoContexts || {});
      }).catch(console.error);

    axios.get(`${API_URL}/api/platforms/youtube/comments/${userId}`).then(({ data }) => {
      const now = Date.now();
      const filtered = (data.comments || []).filter(c => now - new Date(c.published).getTime() < 24 * 60 * 60 * 1000);
      setComments(filtered);
      const videoMap = {};
      filtered.forEach(c => {
        if (!videoMap[c.videoId]) videoMap[c.videoId] = { videoId: c.videoId, videoTitle: c.videoTitle, comments: [] };
        videoMap[c.videoId].comments.push(c);
      });
      const vids = Object.values(videoMap);
      setVideos(vids);
      if (vids.length > 0) setExpandedVideo(vids[0].videoId);
    }).catch(console.error).finally(() => setLoading(false));
  }, [userId]);

  const toggleVideoAutoReply = (videoId, videoTitle) => {
    if (!autoReplyEnabled) return alert('Enable Auto-Reply Comments permission first!');
    const isOn = automatedVideos.includes(videoId);
    if (isOn) {
      axios.post(`${API_URL}/api/platforms/youtube/automate-video/remove`, { userId, videoId })
        .then(() => setAutomatedVideos(prev => prev.filter(v => v !== videoId)))
        .catch(err => alert('❌ ' + err.message));
    } else {
      setContextText(videoContexts[videoId] || '');
      setContextPopup({ videoId, videoTitle });
    }
  };

  const saveAutomation = async () => {
    if (!contextText.trim()) return alert('Please describe how AI should reply!');
    try {
      await axios.post(`${API_URL}/api/platforms/youtube/automate-video`, {
        userId, videoId: contextPopup.videoId, context: contextText.trim(),
      });
      setAutomatedVideos(prev => [...new Set([...prev, contextPopup.videoId])]);
      setVideoContexts(prev => ({ ...prev, [contextPopup.videoId]: contextText.trim() }));
      setContextPopup(null); setContextText('');
    } catch (err) { alert('❌ ' + (err.response?.data?.message || err.message)); }
  };

  const getAiReply = async (c) => {
    setReplyLoading(p => ({ ...p, [c.id]: true }));
    try {
      const context = videoContexts[c.videoId] || '';
      const { data } = await axios.post(`${API_URL}/api/platforms/youtube/comment/ai-reply`, {
        comment: c.text, videoTitle: c.videoTitle, context,
      });
      setConfirmPopup({ commentId: c.id, reply: data.reply, videoId: c.videoId, videoTitle: c.videoTitle });
    } catch { alert('❌ AI reply failed'); }
    setReplyLoading(p => ({ ...p, [c.id]: false }));
  };

  const sendReply = async () => {
    if (!confirmPopup) return;
    if (!autoReplyEnabled) {
      const ok = window.confirm('⚠️ Auto-Reply is OFF. Send manually?');
      if (!ok) return;
    }
    try {
      await axios.post(`${API_URL}/api/platforms/youtube/comment/reply`, { userId, commentId: confirmPopup.commentId, reply: confirmPopup.reply });
      setVideos(prev => prev.map(v => ({ ...v, comments: v.comments.map(c => c.id === confirmPopup.commentId ? { ...c, replied: true } : c) })));
      setConfirmPopup(null);
    } catch (err) { alert('❌ ' + (err.response?.data?.message || 'Failed')); }
  };

  if (loading) return <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>⏳ Loading...</p>;
  if (!videos.length) return <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>No comments in last 24 hours.</p>;

  return (
    <div>
      {!autoReplyEnabled && <div style={{ background: '#ff440011', border: '1px solid #ff444433', borderRadius: '8px', padding: '0.6rem 1rem', marginBottom: '0.8rem', fontSize: '0.78rem', color: '#ff8888' }}>⚠️ <strong>Auto-Reply OFF.</strong> Enable in YouTube Permissions.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '60vh', overflowY: 'auto' }}>
        {videos.map(video => {
          const isAutomated = automatedVideos.includes(video.videoId);
          const isExpanded = expandedVideo === video.videoId;
          return (
            <div key={video.videoId} style={{ background: '#1e1e2e', borderRadius: '12px', border: `1px solid ${isAutomated ? '#ff000044' : '#2a2a3a'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', cursor: 'pointer' }}
                onClick={() => setExpandedVideo(isExpanded ? null : video.videoId)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                  <span style={{ flexShrink: 0 }}>🎥</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.videoTitle}</p>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#666' }}>{video.comments.length} comment{video.comments.length !== 1 ? 's' : ''} · last 24h</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <span style={{ fontSize: '0.7rem', color: isAutomated ? '#ff6666' : '#555' }}>{isAutomated ? '🤖 Auto' : 'Manual'}</span>
                  <div onClick={() => toggleVideoAutoReply(video.videoId, video.videoTitle)}
                    style={{ width: '38px', height: '20px', borderRadius: '10px', background: isAutomated ? '#ff0000' : '#2a2a3a', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                    <div style={{ width: '16px', height: '16px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', transition: 'transform 0.3s', transform: isAutomated ? 'translateX(20px)' : 'translateX(2px)' }} />
                  </div>
                  {isAutomated && (
                    <button onClick={() => { setContextText(videoContexts[video.videoId] || ''); setContextPopup({ videoId: video.videoId, videoTitle: video.videoTitle }); }}
                      style={{ padding: '0.2rem 0.5rem', background: '#ff000022', color: '#ff8888', border: '1px solid #ff444433', borderRadius: '6px', cursor: 'pointer', fontSize: '0.68rem' }}>
                      ✏️ Context
                    </button>
                  )}
                  <span style={{ color: '#555' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {isAutomated && videoContexts[video.videoId] && (
                <p style={{ margin: '0 1rem 0.5rem', fontSize: '0.7rem', color: '#ff8888', fontStyle: 'italic' }}>🧠 "{videoContexts[video.videoId].slice(0, 80)}"</p>
              )}

              {isExpanded && (
                <div style={{ borderTop: '1px solid #2a2a3a', padding: '0.6rem' }}>
                  {video.comments.map(c => (
                    <div key={c.id} style={{ background: '#13131a', borderRadius: '8px', padding: '0.7rem', marginBottom: '0.4rem', border: '1px solid #2a2a3a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: '0 0 0.1rem', fontWeight: 600, fontSize: '0.78rem', color: '#ccc' }}>👤 {c.author}</p>
                        <p style={{ margin: 0, color: '#aaa', fontSize: '0.82rem', fontStyle: 'italic', wordBreak: 'break-word' }}>"{c.text}"</p>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {c.replied
                          ? <span style={{ fontSize: '0.7rem', background: '#00ff8822', color: '#00ff88', padding: '0.2rem 0.5rem', borderRadius: '10px' }}>✅ Replied</span>
                          : <button disabled={replyLoading[c.id]} onClick={() => getAiReply(c)}
                              style={{ padding: '0.3rem 0.7rem', background: '#7c3aed22', color: '#a855f7', border: '1px solid #7c3aed44', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                              {replyLoading[c.id] ? '⏳' : '🧠 AI Reply'}
                            </button>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {confirmPopup && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000bb', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#13131a', border: '1px solid #2a2a3a', borderRadius: '16px', padding: '1.5rem', maxWidth: '420px', width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 0.5rem', color: '#fff' }}>🧠 AI Reply</h3>
            <p style={{ margin: '0 0 0.8rem', fontSize: '0.75rem', color: '#666' }}>📹 {confirmPopup.videoTitle}</p>
            {!autoReplyEnabled && <div style={{ background: '#ff440011', border: '1px solid #ff444433', borderRadius: '8px', padding: '0.5rem', marginBottom: '0.8rem', fontSize: '0.75rem', color: '#ff8888' }}>⚠️ Auto-Reply is OFF. Sends manually only.</div>}
            <div style={{ background: '#1e1e2e', borderRadius: '8px', padding: '0.8rem', marginBottom: '1rem', fontSize: '0.88rem', color: '#ccc', fontStyle: 'italic' }}>"{confirmPopup.reply}"</div>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button onClick={sendReply} style={{ flex: 1, padding: '0.7rem', background: '#ff0000', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>📤 Send</button>
              <button onClick={() => setConfirmPopup(null)} style={{ flex: 1, padding: '0.7rem', background: 'transparent', color: '#888', border: '1px solid #2a2a3a', borderRadius: '8px', cursor: 'pointer' }}>Skip</button>
            </div>
          </div>
        </div>
      )}

      {contextPopup && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#13131a', border: '1px solid #ff000044', borderRadius: '20px', padding: '1.5rem', maxWidth: '480px', width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 0.3rem', color: '#fff' }}>🤖 Set Auto-Reply Context</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: '#888' }}>📹 {contextPopup.videoTitle}</p>
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', color: '#ccc' }}>How should AI reply to comments on this video?</p>
            <textarea
              style={{ width: '100%', padding: '0.9rem', background: '#1e1e2e', border: '1px solid #ff000033', borderRadius: '10px', color: '#fff', fontSize: '0.85rem', outline: 'none', resize: 'vertical', minHeight: '100px', boxSizing: 'border-box', fontFamily: 'sans-serif', lineHeight: 1.6, marginBottom: '0.8rem' }}
              placeholder={'Example: "This is a coding tutorial. Reply helpfully to questions, be friendly and concise. Thank people who say nice things."'}
              value={contextText}
              onChange={e => setContextText(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button onClick={saveAutomation} style={{ flex: 1, padding: '0.8rem', background: '#ff0000', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}>✅ Enable Auto-Reply</button>
              <button onClick={() => { setContextPopup(null); setContextText(''); }} style={{ padding: '0.8rem 1rem', background: 'transparent', color: '#888', border: '1px solid #2a2a3a', borderRadius: '10px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function YTUpload({ userId }) {
  const [form, setForm] = useState({ title: '', description: '', tags: '' });
  const [videoFile, setVideoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const upload = async () => {
    if (!videoFile || !form.title) return alert('Title and video required!');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('video', videoFile); fd.append('userId', userId);
      fd.append('title', form.title); fd.append('description', form.description); fd.append('tags', form.tags);
      const { data } = await axios.post(`${API_URL}/api/platforms/youtube/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      alert(`✅ ${data.message}`); setVideoFile(null); setForm({ title: '', description: '', tags: '' });
    } catch (err) { alert('❌ ' + (err.response?.data?.message || 'Upload failed')); }
    setUploading(false);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      <input style={inpStyle} placeholder="Video Title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
      <textarea style={{ ...inpStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'sans-serif' }} placeholder="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
      <input style={inpStyle} placeholder="Tags (comma separated)" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
      <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={e => setVideoFile(e.target.files[0])} />
      {videoFile
        ? <div style={{ padding: '0.7rem 1rem', background: '#1e1e2e', border: '1px solid #ff444433', borderRadius: '8px', fontSize: '0.85rem', color: '#ccc', display: 'flex', justifyContent: 'space-between' }}>
          <span>🎥 {videoFile.name}</span><button onClick={() => setVideoFile(null)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' }}>✕</button>
        </div>
        : <button onClick={() => fileRef.current.click()} style={{ padding: '0.8rem', background: '#1e1e2e', color: '#888', border: '2px dashed #2a2a3a', borderRadius: '8px', cursor: 'pointer' }}>📂 Choose Video</button>
      }
      <button onClick={upload} disabled={uploading || !videoFile || !form.title} style={primaryBtn(uploading || !videoFile || !form.title ? '#333' : '#ff0000')}>
        {uploading ? '⏳ Uploading...' : '🚀 Upload to YouTube'}
      </button>
    </div>
  );
}

function LinkedInBot({ userId }) {
  const [creds, setCreds] = useState({ email: '', password: '' });
  const [hasCredentials, setHasCredentials] = useState(false);
  const [jobKeywords, setJobKeywords] = useState('');
  const [jobLocation, setJobLocation] = useState('India');
  const [maxJobs, setMaxJobs] = useState(5);
  const [resume, setResume] = useState(null);
  const [resumeName, setResumeName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [tab, setTab] = useState('setup');
  // Comments tab state
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [postComments, setPostComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [replyLoading, setReplyLoading] = useState({});
  const [aiReplies, setAiReplies] = useState({});
  const fileRef = useRef();

  useEffect(() => {
    // Load credentials status + resume name + applied jobs
    axios.get(`${API_URL}/api/linkedin-bot/credentials-status/${userId}`)
      .then(({ data }) => {
        setHasCredentials(data.hasCredentials);
        if (data.resumeName) setResumeName(data.resumeName);
      }).catch(console.error);
    axios.get(`${API_URL}/api/linkedin-bot/applied-jobs/${userId}`)
      .then(({ data }) => setAppliedJobs(data.jobs || [])).catch(console.error);
  }, [userId]);

  const saveCredentials = async () => {
    if (!creds.email || !creds.password) return alert('Fill both fields!');
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/linkedin-bot/save-credentials`, { userId, ...creds });
      setHasCredentials(true); setCreds({ email: '', password: '' });
      setResult('✅ Credentials saved securely (AES-256 encrypted)!');
    } catch (err) { setResult('❌ ' + (err.response?.data?.message || err.message)); }
    setLoading(false);
  };

  const testLogin = async () => {
    setLoading(true); setResult('⏳ Connecting to LinkedIn via Cloud Chrome...');
    try {
      const { data } = await axios.post(`${API_URL}/api/linkedin-bot/test-login`, { userId });
      setResult('✅ ' + data.message);
    } catch (err) { setResult('❌ ' + (err.response?.data?.message || err.message)); }
    setLoading(false);
  };

  const uploadResume = async () => {
    if (!resume) return;
    const form = new FormData();
    form.append('resume', resume); form.append('userId', userId);
    try {
      const { data } = await axios.post(`${API_URL}/api/linkedin-bot/upload-resume`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResumeName(data.filename); setResume(null);
      setResult('✅ Resume uploaded!');
    } catch { setResult('❌ Resume upload failed'); }
  };

  const autoApplyJobs = async () => {
    if (!jobKeywords.trim()) return alert('Enter job keywords!');
    if (!resumeName) return alert('Upload your resume first!');
    setLoading(true); setResult('⏳ Opening LinkedIn, searching jobs...');
    try {
      const { data } = await axios.post(`${API_URL}/api/linkedin-bot/auto-apply-jobs`, { userId, keywords: jobKeywords, location: jobLocation, maxJobs });
      setResult('✅ ' + data.message);
      setAppliedJobs(prev => [...(data.applied || []).map(j => ({ ...j, appliedAt: new Date() })), ...prev]);
    } catch (err) { setResult('❌ ' + (err.response?.data?.message || err.message)); }
    setLoading(false);
  };

  const loadMyPosts = async () => {
    setPostsLoading(true); setPosts([]); setSelectedPost(null); setPostComments([]);
    try {
      const { data } = await axios.get(`${API_URL}/api/linkedin-bot/my-posts/${userId}`);
      setPosts(data.posts || []);
      if (!data.posts?.length) setResult('No posts found. Make sure you have LinkedIn posts.');
    } catch (err) { setResult('❌ ' + (err.response?.data?.message || err.message)); }
    setPostsLoading(false);
  };

  const loadPostComments = async (post) => {
    setSelectedPost(post); setPostComments([]); setAiReplies({});
    setCommentsLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/linkedin-bot/post-comments`, { userId, postUrl: post.postUrl });
      setPostComments(data.comments || []);
    } catch (err) { setResult('❌ ' + (err.response?.data?.message || err.message)); }
    setCommentsLoading(false);
  };

  const getAiReply = async (comment) => {
    setReplyLoading(p => ({ ...p, [comment.id]: true }));
    try {
      const { data } = await axios.post(`${API_URL}/api/linkedin-bot/ai-reply`, { comment: comment.text });
      setAiReplies(p => ({ ...p, [comment.id]: data.reply }));
    } catch { setResult('❌ AI reply failed'); }
    setReplyLoading(p => ({ ...p, [comment.id]: false }));
  };

  const sendReply = async (comment) => {
    const reply = aiReplies[comment.id];
    if (!reply) return;
    try {
      await axios.post(`${API_URL}/api/linkedin-bot/reply-comment`, { userId, postUrl: selectedPost.postUrl, commentIndex: comment.index, reply });
      setPostComments(p => p.map(c => c.id === comment.id ? { ...c, replied: true } : c));
      setAiReplies(p => { const n = { ...p }; delete n[comment.id]; return n; });
    } catch (err) { setResult('❌ ' + (err.response?.data?.message || err.message)); }
  };

  const tabs = [{ id: 'setup', label: '⚙️ Setup' }, { id: 'jobs', label: '💼 Auto-Apply' }, { id: 'comments', label: '💬 Comments' }];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid #2a2a3a', paddingBottom: '0.5rem' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setResult(null); }}
            style={{ padding: '0.4rem 0.9rem', background: tab === t.id ? '#0077b5' : 'transparent', color: tab === t.id ? '#fff' : '#888', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: tab === t.id ? 700 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Setup Tab ── */}
      {tab === 'setup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div style={{ background: '#1e1e2e', border: '1px solid #0077b533', borderRadius: '10px', padding: '0.8rem', fontSize: '0.78rem', color: '#888', lineHeight: 1.6 }}>
            🔒 Credentials are <strong style={{ color: '#4a9fd4' }}>AES-256 encrypted</strong> before saving. Never stored in plain text.
            <br />🌐 Automation runs via <strong style={{ color: '#4a9fd4' }}>Browserless.io</strong> cloud Chrome — works even on Render.
          </div>

          {hasCredentials
            ? <div style={{ background: '#00ff8811', border: '1px solid #00ff8833', borderRadius: '8px', padding: '0.7rem', fontSize: '0.82rem', color: '#00ff88' }}>✅ Credentials saved! Bot is ready to use.</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <input style={inpStyle} type="email" placeholder="LinkedIn Email" value={creds.email} onChange={e => setCreds(p => ({ ...p, email: e.target.value }))} />
                <input style={inpStyle} type="password" placeholder="LinkedIn Password" value={creds.password} onChange={e => setCreds(p => ({ ...p, password: e.target.value }))} />
                <button onClick={saveCredentials} disabled={loading} style={{ padding: '0.7rem', background: '#0077b5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                  {loading ? '⏳ Saving...' : '🔒 Save Credentials Securely'}
                </button>
              </div>
          }

          {hasCredentials && (
            <button onClick={testLogin} disabled={loading}
              style={{ padding: '0.6rem', background: '#1e1e2e', color: '#4a9fd4', border: '1px solid #0077b544', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem' }}>
              {loading ? '⏳ Connecting...' : '🧪 Test Login'}
            </button>
          )}
        </div>
      )}

      {/* ── Auto-Apply Tab ── */}
      {tab === 'jobs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {!hasCredentials && <div style={{ background: '#ff440011', border: '1px solid #ff444433', borderRadius: '8px', padding: '0.6rem', fontSize: '0.78rem', color: '#ff8888' }}>⚠️ Set up credentials in Setup tab first!</div>}

          {/* Resume section */}
          <div style={{ background: '#1e1e2e', border: '1px dashed #7c3aed55', borderRadius: '10px', padding: '0.8rem' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: '#a855f7', fontWeight: 600 }}>📄 Resume <span style={{ color: '#ff8888', fontSize: '0.72rem' }}>(required)</span></p>
            {resumeName
              ? <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: '#00ff88' }}>✅ {resumeName}</p>
              : <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#888' }}>No resume uploaded yet</p>
            }
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => setResume(e.target.files[0])} />
            {resume && <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', color: '#ccc' }}>📎 {resume.name}</p>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => fileRef.current.click()} style={{ padding: '0.4rem 0.8rem', background: '#2a2a3a', color: '#fff', border: '1px solid #3a3a4a', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>📂 Choose</button>
              {resume && <button onClick={uploadResume} style={{ padding: '0.4rem 0.8rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>✅ Upload</button>}
            </div>
          </div>

          <input style={inpStyle} placeholder="Job keywords (e.g. React Developer, Full Stack Intern)" value={jobKeywords} onChange={e => setJobKeywords(e.target.value)} />
          <input style={inpStyle} placeholder="Location (e.g. India, Mumbai, Remote)" value={jobLocation} onChange={e => setJobLocation(e.target.value)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <label style={{ fontSize: '0.82rem', color: '#888' }}>Max jobs to apply:</label>
            <input type="number" min={1} max={20} value={maxJobs} onChange={e => setMaxJobs(Number(e.target.value))} style={{ ...inpStyle, width: '80px' }} />
          </div>
          <button onClick={autoApplyJobs} disabled={loading || !hasCredentials}
            style={{ padding: '0.8rem', background: loading || !hasCredentials ? '#333' : '#0077b5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
            {loading ? '⏳ Applying to jobs...' : '🚀 Auto-Apply Now'}
          </button>

          {appliedJobs.length > 0 && (
            <div>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: '#888', fontWeight: 600 }}>📋 Applied History ({appliedJobs.length})</p>
              <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {appliedJobs.slice(0, 20).map((job, i) => (
                  <div key={i} style={{ background: '#1e1e2e', borderRadius: '6px', padding: '0.5rem 0.8rem', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{job.title}</span>
                    <span style={{ color: '#555' }}>@ {job.company}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Comments Tab ── */}
      {tab === 'comments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {!hasCredentials && <div style={{ background: '#ff440011', border: '1px solid #ff444433', borderRadius: '8px', padding: '0.6rem', fontSize: '0.78rem', color: '#ff8888' }}>⚠️ Set up credentials in Setup tab first!</div>}

          {!selectedPost ? (
            <>
              <button onClick={loadMyPosts} disabled={postsLoading || !hasCredentials}
                style={{ padding: '0.8rem', background: postsLoading || !hasCredentials ? '#333' : '#0077b5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                {postsLoading ? '⏳ Loading posts...' : '📋 Load My LinkedIn Posts'}
              </button>

              {posts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '55vh', overflowY: 'auto' }}>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#888' }}>Click a post to see its comments:</p>
                  {posts.map(post => (
                    <div key={post.id} onClick={() => loadPostComments(post)}
                      style={{ background: '#1e1e2e', border: '1px solid #2a2a3a', borderRadius: '10px', padding: '0.8rem 1rem', cursor: 'pointer', transition: 'border-color 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#0077b5'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2a3a'}>
                      <p style={{ margin: '0 0 0.3rem', fontSize: '0.85rem', color: '#fff', fontWeight: 500 }}>{post.text.slice(0, 120)}{post.text.length > 120 ? '...' : ''}</p>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', color: '#666' }}>
                        <span>💬 {post.commentsCount} comments</span>
                        <span>🕐 {post.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button onClick={() => { setSelectedPost(null); setPostComments([]); }}
                  style={{ padding: '0.3rem 0.7rem', background: '#2a2a3a', color: '#888', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>← Back</button>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#ccc', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedPost.text.slice(0, 60)}...</p>
              </div>

              {commentsLoading && <p style={{ color: '#888', textAlign: 'center', padding: '1rem' }}>⏳ Loading comments...</p>}

              {!commentsLoading && postComments.length === 0 && (
                <p style={{ color: '#888', textAlign: 'center', padding: '1rem' }}>No comments found on this post.</p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '50vh', overflowY: 'auto' }}>
                {postComments.map(comment => (
                  <div key={comment.id} style={{ background: '#1e1e2e', borderRadius: '10px', padding: '0.8rem', border: '1px solid #2a2a3a' }}>
                    <p style={{ margin: '0 0 0.2rem', fontWeight: 600, fontSize: '0.82rem', color: '#ccc' }}>👤 {comment.author} <span style={{ color: '#555', fontWeight: 400, fontSize: '0.7rem' }}>· {comment.time}</span></p>
                    <p style={{ margin: '0 0 0.6rem', color: '#aaa', fontSize: '0.85rem', fontStyle: 'italic' }}>"{comment.text}"</p>

                    {comment.replied
                      ? <span style={{ fontSize: '0.72rem', background: '#00ff8822', color: '#00ff88', padding: '0.2rem 0.6rem', borderRadius: '10px' }}>✅ Replied</span>
                      : aiReplies[comment.id]
                        ? <div>
                            <div style={{ background: '#13131a', borderRadius: '8px', padding: '0.6rem 0.8rem', marginBottom: '0.5rem', fontSize: '0.82rem', color: '#ccc', fontStyle: 'italic' }}>"{aiReplies[comment.id]}"</div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button onClick={() => sendReply(comment)} style={{ padding: '0.4rem 0.9rem', background: '#0077b5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>📤 Send</button>
                              <button onClick={() => setAiReplies(p => { const n = { ...p }; delete n[comment.id]; return n; })} style={{ padding: '0.4rem 0.7rem', background: 'transparent', color: '#888', border: '1px solid #2a2a3a', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>↩ Redo</button>
                            </div>
                          </div>
                        : <button disabled={replyLoading[comment.id]} onClick={() => getAiReply(comment)}
                            style={{ padding: '0.35rem 0.9rem', background: '#0077b522', color: '#4a9fd4', border: '1px solid #0077b544', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                            {replyLoading[comment.id] ? '⏳' : '🧠 AI Reply'}
                          </button>
                    }
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {result && (
        <div style={{ padding: '0.7rem 1rem', background: result.startsWith('✅') ? '#00ff8811' : result.startsWith('⏳') ? '#7c3aed11' : '#ff440011', border: `1px solid ${result.startsWith('✅') ? '#00ff8833' : result.startsWith('⏳') ? '#7c3aed33' : '#ff444433'}`, borderRadius: '8px', fontSize: '0.82rem', color: result.startsWith('✅') ? '#00ff88' : result.startsWith('⏳') ? '#a855f7' : '#ff8888', wordBreak: 'break-word' }}>
          {result}
        </div>
      )}
    </div>
  );
}

// ─── Instagram Bot Component ──────────────────────────────────────────
function InstagramBot({ userId }) {
  const [creds, setCreds] = useState({ username: '', password: '' });
  const [hasCredentials, setHasCredentials] = useState(false);
  const [igUsername, setIgUsername] = useState('');
  const [tab, setTab] = useState('setup');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  // Media + comments
  const [media, setMedia] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [automatedPosts, setAutomatedPosts] = useState([]);
  const [postContexts, setPostContexts] = useState({});
  const [contextPopup, setContextPopup] = useState(null);
  const [contextText, setContextText] = useState('');
  const [expandedPost, setExpandedPost] = useState(null);
  const [replyLoading, setReplyLoading] = useState({});
  const [aiReplies, setAiReplies] = useState({});
  // Post / Story
  const [postFile, setPostFile] = useState(null);
  const [postCaption, setPostCaption] = useState('');
  const [postType, setPostType] = useState('image'); // image | video | story
  const videoRef = useRef(); const imageRef = useRef(); const storyRef = useRef();

  useEffect(() => {
    axios.get(`${API_URL}/api/instagram-bot/credentials-status/${userId}`)
      .then(({ data }) => { setHasCredentials(data.hasCredentials); if (data.username) setIgUsername(data.username); })
      .catch(console.error);
    axios.get(`${API_URL}/api/instagram-bot/automated-posts/${userId}`)
      .then(({ data }) => { setAutomatedPosts(data.automatedPosts || []); setPostContexts(data.postContexts || {}); })
      .catch(console.error);
  }, [userId]);

  const saveCredentials = async () => {
    if (!creds.username || !creds.password) return alert('Fill both fields!');
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/instagram-bot/save-credentials`, { userId, ...creds });
      setHasCredentials(true); setIgUsername(creds.username.replace('@', '')); setCreds({ username: '', password: '' });
      setResult('✅ Credentials saved! Click Test Login to verify.');
    } catch (err) { setResult('❌ ' + (err.response?.data?.message || err.message)); }
    setLoading(false);
  };

  const testLogin = async () => {
    setLoading(true); setResult('⏳ Connecting to Instagram...');
    try {
      const { data } = await axios.post(`${API_URL}/api/instagram-bot/test-login`, { userId });
      setResult(`✅ ${data.message}`);
    } catch (err) { setResult('❌ ' + (err.response?.data?.message || err.message)); }
    setLoading(false);
  };

  const loadMedia = async () => {
    setMediaLoading(true); setMedia([]);
    try {
      const { data } = await axios.get(`${API_URL}/api/instagram-bot/my-media/${userId}`);
      setMedia(data.media || []);
      if (data.media?.length > 0) setExpandedPost(data.media[0].id);
    } catch (err) { setResult('❌ ' + (err.response?.data?.message || err.message)); }
    setMediaLoading(false);
  };

  const toggleAutoReply = (mediaId, caption) => {
    const isOn = automatedPosts.includes(mediaId);
    if (isOn) {
      axios.post(`${API_URL}/api/instagram-bot/automate-post/remove`, { userId, mediaId })
        .then(() => setAutomatedPosts(p => p.filter(v => v !== mediaId)))
        .catch(err => alert('❌ ' + err.message));
    } else {
      setContextText(postContexts[mediaId] || '');
      setContextPopup({ mediaId, caption });
    }
  };

  const saveAutomation = async () => {
    if (!contextText.trim()) return alert('Please describe how AI should reply!');
    try {
      await axios.post(`${API_URL}/api/instagram-bot/automate-post`, { userId, mediaId: contextPopup.mediaId, context: contextText.trim() });
      setAutomatedPosts(p => [...new Set([...p, contextPopup.mediaId])]);
      setPostContexts(p => ({ ...p, [contextPopup.mediaId]: contextText.trim() }));
      setContextPopup(null); setContextText('');
    } catch (err) { alert('❌ ' + (err.response?.data?.message || err.message)); }
  };

  const getAiReply = async (mediaId, comment) => {
    const key = `${mediaId}_${comment.id}`;
    setReplyLoading(p => ({ ...p, [key]: true }));
    try {
      const { data } = await axios.post(`${API_URL}/api/instagram-bot/ai-reply`, { comment: comment.text, caption: postContexts[mediaId] || '' });
      setAiReplies(p => ({ ...p, [key]: data.reply }));
    } catch { setResult('❌ AI reply failed'); }
    setReplyLoading(p => ({ ...p, [key]: false }));
  };

  const sendReply = async (mediaId, comment) => {
    const key = `${mediaId}_${comment.id}`;
    const reply = aiReplies[key];
    if (!reply) return;
    try {
      await axios.post(`${API_URL}/api/instagram-bot/reply-comment`, { userId, mediaId, commentId: comment.id, reply });
      setMedia(p => p.map(m => m.id === mediaId ? { ...m, comments: m.comments.map(c => c.id === comment.id ? { ...c, replied: true } : c) } : m));
      setAiReplies(p => { const n = { ...p }; delete n[key]; return n; });
    } catch (err) { setResult('❌ ' + (err.response?.data?.message || err.message)); }
  };

  const postContent = async () => {
    if (!postFile) return alert('Choose a file first!');
    setLoading(true); setResult(`⏳ Posting ${postType} to Instagram...`);
    try {
      const form = new FormData();
      form.append(postType === 'story' ? 'image' : postType === 'video' ? 'video' : 'image', postFile);
      form.append('userId', userId);
      if (postCaption) form.append('caption', postCaption);
      const endpoint = postType === 'story' ? 'post-story' : postType === 'video' ? 'post-video' : 'post-image';
      const { data } = await axios.post(`${API_URL}/api/instagram-bot/${endpoint}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult('✅ ' + data.message); setPostFile(null); setPostCaption('');
    } catch (err) { setResult('❌ ' + (err.response?.data?.message || err.message)); }
    setLoading(false);
  };

  const tabs = [{ id: 'setup', label: '⚙️ Setup' }, { id: 'post', label: '📸 Post' }, { id: 'comments', label: '💬 Comments' }];
  const mediaTypeIcon = (t) => t === 2 ? '🎥' : t === 8 ? '🖼️' : '📸';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid #2a2a3a', paddingBottom: '0.5rem' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setResult(null); }}
            style={{ padding: '0.4rem 0.9rem', background: tab === t.id ? '#e1306c' : 'transparent', color: tab === t.id ? '#fff' : '#888', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: tab === t.id ? 700 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Setup ── */}
      {tab === 'setup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div style={{ background: '#1e1e2e', border: '1px solid #e1306c33', borderRadius: '10px', padding: '0.8rem', fontSize: '0.78rem', color: '#888', lineHeight: 1.6 }}>
            🔒 Password <strong style={{ color: '#e1306c' }}>AES-256 encrypted</strong> in MongoDB.<br />
            🚀 Uses <strong style={{ color: '#e1306c' }}>Instagram Private API</strong> — same calls as the official app.<br />
            ⚠️ Use a secondary Instagram account first to test safely.
          </div>

          {hasCredentials
            ? <div style={{ background: '#00ff8811', border: '1px solid #00ff8833', borderRadius: '8px', padding: '0.7rem', fontSize: '0.82rem', color: '#00ff88' }}>
                ✅ @{igUsername} credentials saved!
              </div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <input style={inpStyle} placeholder="Instagram Username (without @)" value={creds.username} onChange={e => setCreds(p => ({ ...p, username: e.target.value }))} />
                <input style={inpStyle} type="password" placeholder="Instagram Password" value={creds.password} onChange={e => setCreds(p => ({ ...p, password: e.target.value }))} />
                <button onClick={saveCredentials} disabled={loading} style={{ padding: '0.7rem', background: '#e1306c', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                  {loading ? '⏳ Saving...' : '🔒 Save Credentials'}
                </button>
              </div>
          }
          {hasCredentials && (
            <button onClick={testLogin} disabled={loading} style={{ padding: '0.6rem', background: '#1e1e2e', color: '#e1306c', border: '1px solid #e1306c44', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem' }}>
              {loading ? '⏳ Connecting...' : '🧪 Test Login'}
            </button>
          )}
          {hasCredentials && (
            <button onClick={() => { if (window.confirm('Remove saved Instagram credentials?')) { axios.post(`${API_URL}/api/instagram-bot/save-credentials`, { userId, username: '', password: '' }).then(() => { setHasCredentials(false); setIgUsername(''); }); } }}
              style={{ padding: '0.5rem', background: 'transparent', color: '#ff4444', border: '1px solid #ff444433', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem' }}>
              🗑 Remove Credentials
            </button>
          )}
        </div>
      )}

      {/* ── Post ── */}
      {tab === 'post' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {!hasCredentials && <div style={{ background: '#ff440011', border: '1px solid #ff444433', borderRadius: '8px', padding: '0.6rem', fontSize: '0.78rem', color: '#ff8888' }}>⚠️ Set up credentials in Setup tab first!</div>}

          {/* Type selector */}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {[['image', '📸 Photo'], ['video', '🎥 Video'], ['story', '📖 Story']].map(([type, label]) => (
              <button key={type} onClick={() => { setPostType(type); setPostFile(null); }}
                style={{ flex: 1, padding: '0.5rem', background: postType === type ? '#e1306c' : '#1e1e2e', color: postType === type ? '#fff' : '#888', border: '1px solid #e1306c44', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: postType === type ? 700 : 400 }}>
                {label}
              </button>
            ))}
          </div>

          {/* File picker */}
          <input ref={imageRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setPostFile(e.target.files[0])} />
          <input ref={videoRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={e => setPostFile(e.target.files[0])} />
          <input ref={storyRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setPostFile(e.target.files[0])} />

          {postFile
            ? <div style={{ padding: '0.7rem', background: '#1e1e2e', border: '1px solid #e1306c44', borderRadius: '8px', fontSize: '0.82rem', color: '#ccc', display: 'flex', justifyContent: 'space-between' }}>
                <span>{postType === 'video' ? '🎥' : '📸'} {postFile.name}</span>
                <button onClick={() => setPostFile(null)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' }}>✕</button>
              </div>
            : <button onClick={() => { if (postType === 'video') videoRef.current.click(); else if (postType === 'story') storyRef.current.click(); else imageRef.current.click(); }}
                style={{ padding: '0.8rem', background: '#1e1e2e', color: '#888', border: '2px dashed #e1306c44', borderRadius: '8px', cursor: 'pointer' }}>
                📂 Choose {postType === 'video' ? 'Video' : postType === 'story' ? 'Story Image' : 'Photo'}
              </button>
          }

          {postType !== 'story' && (
            <textarea style={{ ...inpStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'sans-serif' }}
              placeholder="Caption + hashtags (optional)" value={postCaption} onChange={e => setPostCaption(e.target.value)} />
          )}

          <button onClick={postContent} disabled={loading || !hasCredentials || !postFile}
            style={{ padding: '0.8rem', background: loading || !hasCredentials || !postFile ? '#333' : 'linear-gradient(135deg, #e1306c, #f77737)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
            {loading ? '⏳ Posting...' : `🚀 Post ${postType === 'story' ? 'Story' : postType === 'video' ? 'Video' : 'Photo'} to Instagram`}
          </button>
        </div>
      )}

      {/* ── Comments ── */}
      {tab === 'comments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {!hasCredentials && <div style={{ background: '#ff440011', border: '1px solid #ff444433', borderRadius: '8px', padding: '0.6rem', fontSize: '0.78rem', color: '#ff8888' }}>⚠️ Set up credentials in Setup tab first!</div>}

          <button onClick={loadMedia} disabled={mediaLoading || !hasCredentials}
            style={{ padding: '0.8rem', background: mediaLoading || !hasCredentials ? '#333' : '#e1306c', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
            {mediaLoading ? '⏳ Loading posts...' : '📋 Load My Instagram Posts'}
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '60vh', overflowY: 'auto' }}>
            {media.map(post => {
              const isAutomated = automatedPosts.includes(post.id);
              const isExpanded = expandedPost === post.id;
              return (
                <div key={post.id} style={{ background: '#1e1e2e', borderRadius: '12px', border: `1px solid ${isAutomated ? '#e1306c55' : '#2a2a3a'}` }}>
                  {/* Post header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', cursor: 'pointer' }}
                    onClick={() => setExpandedPost(isExpanded ? null : post.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                      {post.thumbnail && <img src={post.thumbnail} alt="" style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />}
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {mediaTypeIcon(post.mediaType)} {post.caption || '(no caption)'}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#666' }}>❤️ {post.likeCount} · 💬 {post.commentCount} comments</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <span style={{ fontSize: '0.7rem', color: isAutomated ? '#e1306c' : '#555' }}>{isAutomated ? '🤖 Auto' : 'Manual'}</span>
                      <div onClick={() => toggleAutoReply(post.id, post.caption)}
                        style={{ width: '38px', height: '20px', borderRadius: '10px', background: isAutomated ? '#e1306c' : '#2a2a3a', position: 'relative', cursor: 'pointer' }}>
                        <div style={{ width: '16px', height: '16px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', transition: 'transform 0.3s', transform: isAutomated ? 'translateX(20px)' : 'translateX(2px)' }} />
                      </div>
                      {isAutomated && (
                        <button onClick={() => { setContextText(postContexts[post.id] || ''); setContextPopup({ mediaId: post.id, caption: post.caption }); }}
                          style={{ padding: '0.2rem 0.5rem', background: '#e1306c22', color: '#e1306c', border: '1px solid #e1306c44', borderRadius: '6px', cursor: 'pointer', fontSize: '0.68rem' }}>
                          ✏️ Context
                        </button>
                      )}
                      <span style={{ color: '#555' }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isAutomated && postContexts[post.id] && (
                    <p style={{ margin: '0 1rem 0.5rem', fontSize: '0.7rem', color: '#e1306c', fontStyle: 'italic' }}>🧠 "{postContexts[post.id].slice(0, 80)}"</p>
                  )}

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #2a2a3a', padding: '0.6rem' }}>
                      {post.comments.length === 0
                        ? <p style={{ color: '#555', fontSize: '0.78rem', textAlign: 'center', padding: '0.5rem' }}>No recent comments</p>
                        : post.comments.map(c => {
                            const key = `${post.id}_${c.id}`;
                            return (
                              <div key={c.id} style={{ background: '#13131a', borderRadius: '8px', padding: '0.7rem', marginBottom: '0.4rem', border: '1px solid #2a2a3a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ margin: '0 0 0.1rem', fontWeight: 600, fontSize: '0.78rem', color: '#ccc' }}>👤 @{c.author}</p>
                                  <p style={{ margin: 0, color: '#aaa', fontSize: '0.82rem', fontStyle: 'italic', wordBreak: 'break-word' }}>"{c.text}"</p>
                                  {aiReplies[key] && (
                                    <div style={{ marginTop: '0.4rem', padding: '0.5rem', background: '#1e1e2e', borderRadius: '6px', fontSize: '0.78rem', color: '#ccc', fontStyle: 'italic' }}>
                                      💬 "{aiReplies[key]}"
                                    </div>
                                  )}
                                </div>
                                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                  {c.replied
                                    ? <span style={{ fontSize: '0.7rem', background: '#00ff8822', color: '#00ff88', padding: '0.2rem 0.5rem', borderRadius: '10px' }}>✅</span>
                                    : aiReplies[key]
                                      ? <div style={{ display: 'flex', gap: '0.3rem' }}>
                                          <button onClick={() => sendReply(post.id, c)} style={{ padding: '0.3rem 0.6rem', background: '#e1306c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>📤 Send</button>
                                          <button onClick={() => setAiReplies(p => { const n = { ...p }; delete n[key]; return n; })} style={{ padding: '0.3rem 0.5rem', background: 'transparent', color: '#888', border: '1px solid #2a2a3a', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem' }}>↩</button>
                                        </div>
                                      : <button disabled={replyLoading[key]} onClick={() => getAiReply(post.id, c)}
                                          style={{ padding: '0.3rem 0.6rem', background: '#e1306c22', color: '#e1306c', border: '1px solid #e1306c44', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                                          {replyLoading[key] ? '⏳' : '🧠 AI'}
                                        </button>
                                  }
                                </div>
                              </div>
                            );
                          })
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Context popup */}
      {contextPopup && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#13131a', border: '1px solid #e1306c44', borderRadius: '20px', padding: '1.5rem', maxWidth: '480px', width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 0.5rem', color: '#fff' }}>🤖 Auto-Reply Context</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: '#888' }}>📸 {contextPopup.caption?.slice(0, 60) || 'Instagram post'}</p>
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', color: '#ccc' }}>How should AI reply to comments on this post?</p>
            <textarea
              style={{ width: '100%', padding: '0.9rem', background: '#1e1e2e', border: '1px solid #e1306c33', borderRadius: '10px', color: '#fff', fontSize: '0.85rem', outline: 'none', resize: 'vertical', minHeight: '100px', boxSizing: 'border-box', fontFamily: 'sans-serif', lineHeight: 1.6, marginBottom: '0.8rem' }}
              placeholder={'Example: "This is a fitness post. Reply motivationally to comments, use relevant emojis, keep it short."'}
              value={contextText} onChange={e => setContextText(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button onClick={saveAutomation} style={{ flex: 1, padding: '0.8rem', background: '#e1306c', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}>✅ Enable Auto-Reply</button>
              <button onClick={() => { setContextPopup(null); setContextText(''); }} style={{ padding: '0.8rem 1rem', background: 'transparent', color: '#888', border: '1px solid #2a2a3a', borderRadius: '10px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div style={{ padding: '0.7rem 1rem', background: result.startsWith('✅') ? '#00ff8811' : result.startsWith('⏳') ? '#7c3aed11' : '#ff440011', border: `1px solid ${result.startsWith('✅') ? '#00ff8833' : result.startsWith('⏳') ? '#7c3aed33' : '#ff444433'}`, borderRadius: '8px', fontSize: '0.82rem', color: result.startsWith('✅') ? '#00ff88' : result.startsWith('⏳') ? '#a855f7' : '#ff8888', wordBreak: 'break-word' }}>
          {result}
        </div>
      )}
    </div>
  );
}