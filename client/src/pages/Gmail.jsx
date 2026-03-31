
import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function Gmail() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [emailBody, setEmailBody] = useState(null);
  const [loadingBody, setLoadingBody] = useState(false);
  const [aiReply, setAiReply] = useState('');
  const [loadingReply, setLoadingReply] = useState(false);
  const [sending, setSending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({ to: '', subject: '', body: '' });
  const [gmailConnected, setGmailConnected] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const r = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);

  useEffect(() => {
    checkAndLoad();
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'gmail') {
      window.history.replaceState({}, '', '/dashboard');
      fetchEmails();
    }
  }, []);

  const checkAndLoad = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/platforms/status/${user.id}`);
      if (data.platforms?.gmail) {
        setGmailConnected(true);
        fetchEmails();
      } else {
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
    }
  };

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/gmail/inbox/${user.id}`);
      setEmails(data.emails || []);
      setGmailConnected(true);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const connectGmail = () => {
    window.location.href = `${API_URL}/api/gmail/connect?userId=${user.id}`;
  };

  const openEmail = async (email) => {
    setSelectedEmail(email);
    setAiReply('');
    setLoadingBody(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/gmail/email/${user.id}/${email.id}`);
      setEmailBody(data);
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isUnread: false } : e));
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
      setAiReply(data.reply);
    } catch (err) { alert('AI error'); }
    setLoadingReply(false);
  };

  const sendReply = async () => {
    if (!aiReply.trim()) return;
    setSending(true);
    try {
      const fromEmail = emailBody.from.match(/<(.+)>/)?.[1] || emailBody.from;
      await axios.post(`${API_URL}/api/gmail/send`, {
        userId: user.id,
        to: fromEmail,
        subject: `Re: ${emailBody.subject}`,
        body: aiReply,
        replyToMessageId: selectedEmail.id
      });
      alert('✅ Reply sent!');
      setAiReply('');
      setSelectedEmail(null);
      setEmailBody(null);
    } catch (err) { alert('❌ Send failed'); }
    setSending(false);
  };

  const sendCompose = async () => {
    if (!compose.to || !compose.subject || !compose.body) return alert('Fill all fields!');
    setSending(true);
    try {
      await axios.post(`${API_URL}/api/gmail/send`, {
        userId: user.id, to: compose.to, subject: compose.subject, body: compose.body
      });
      alert('✅ Email sent!');
      setComposeOpen(false);
      setCompose({ to: '', subject: '', body: '' });
    } catch (err) { alert('❌ Send failed'); }
    setSending(false);
  };

  const formatDate = (dateStr) => {
    try { return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return dateStr; }
  };

  const extractName = (from) => {
    const match = from.match(/^(.+?)\s*</);
    return match ? match[1].replace(/"/g, '') : from.split('@')[0];
  };

  if (!gmailConnected && !loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', color: '#fff' }}>
        <div style={{ background: '#13131a', border: '1px solid #2a2a3a', borderRadius: '20px', padding: '3rem 2rem', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📧</div>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem' }}>Connect Gmail</h2>
          <p style={{ color: '#888', margin: '0 0 2rem', fontSize: '0.9rem' }}>Read emails, get AI replies, and send emails directly from SynapSocial</p>
          <button onClick={connectGmail}
            style={{ padding: '0.9rem 2rem', background: '#ea4335', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', width: '100%' }}>
            📧 Connect Gmail
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: isMobile ? '0.8rem' : '1.5rem', overflowY: 'auto', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? '1.1rem' : '1.4rem' }}>📧 Gmail Inbox</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={fetchEmails} style={{ padding: '0.5rem 1rem', background: '#1e1e2e', color: '#888', border: '1px solid #2a2a3a', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem' }}>
            🔄 Refresh
          </button>
          <button onClick={() => setComposeOpen(true)} style={{ padding: '0.5rem 1rem', background: '#ea4335', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
            ✏️ Compose
          </button>
        </div>
      </div>

      {loading && <p style={{ color: '#888', textAlign: 'center', padding: '3rem' }}>⏳ Loading emails...</p>}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedEmail && !isMobile ? '1fr 1.2fr' : '1fr', gap: '1rem' }}>
          {/* Email list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {emails.length === 0 && <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>No emails found</p>}
            {emails.map(email => (
              <div key={email.id}
                onClick={() => openEmail(email)}
                style={{ background: selectedEmail?.id === email.id ? '#1e1e2e' : '#13131a', border: `1px solid ${selectedEmail?.id === email.id ? '#7c3aed44' : '#2a2a3a'}`, borderRadius: '10px', padding: '0.8rem 1rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem', gap: '0.5rem' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: email.isUnread ? 700 : 400, color: email.isUnread ? '#fff' : '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {email.isUnread && <span style={{ width: '6px', height: '6px', background: '#7c3aed', borderRadius: '50%', display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }} />}
                    {extractName(email.from)}
                  </p>
                  <span style={{ fontSize: '0.68rem', color: '#555', flexShrink: 0 }}>{formatDate(email.date)}</span>
                </div>
                <p style={{ margin: '0 0 0.2rem', fontSize: '0.82rem', color: email.isUnread ? '#ddd' : '#888', fontWeight: email.isUnread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.subject}</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.snippet}</p>
              </div>
            ))}
          </div>

          {/* Email detail */}
          {selectedEmail && (
            <div style={{ background: '#13131a', border: '1px solid #2a2a3a', borderRadius: '12px', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 0.4rem', fontSize: '1rem', color: '#fff' }}>{emailBody?.subject || selectedEmail.subject}</h3>
                  <p style={{ margin: '0 0 0.2rem', fontSize: '0.78rem', color: '#888' }}>From: {emailBody?.from || selectedEmail.from}</p>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#555' }}>{emailBody ? formatDate(emailBody.date) : ''}</p>
                </div>
                <button onClick={() => { setSelectedEmail(null); setEmailBody(null); setAiReply(''); }}
                  style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.2rem', flexShrink: 0 }}>✕</button>
              </div>

              {loadingBody && <p style={{ color: '#888', fontSize: '0.85rem' }}>⏳ Loading...</p>}

              {emailBody && !loadingBody && (
                <div style={{ background: '#0d0d14', borderRadius: '8px', padding: '1rem', fontSize: '0.85rem', color: '#ccc', lineHeight: 1.7, maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {emailBody.body || selectedEmail.snippet}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={generateAiReply} disabled={loadingReply || !emailBody}
                  style={{ padding: '0.5rem 1rem', background: '#7c3aed22', color: '#a855f7', border: '1px solid #7c3aed44', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                  {loadingReply ? '⏳ Generating...' : '🧠 AI Reply'}
                </button>
              </div>

              {aiReply && (
                <div>
                  <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', color: '#888', fontWeight: 600 }}>AI Generated Reply:</p>
                  <textarea
                    style={{ width: '100%', padding: '0.8rem', background: '#1e1e2e', border: '1px solid #7c3aed44', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', outline: 'none', resize: 'vertical', minHeight: '100px', boxSizing: 'border-box', fontFamily: 'sans-serif', lineHeight: 1.6 }}
                    value={aiReply}
                    onChange={e => setAiReply(e.target.value)}
                  />
                  <button onClick={sendReply} disabled={sending}
                    style={{ width: '100%', padding: '0.7rem', background: sending ? '#333' : '#ea4335', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, marginTop: '0.5rem' }}>
                    {sending ? '⏳ Sending...' : '📤 Send Reply'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Compose modal */}
      {composeOpen && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000aa', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#13131a', border: '1px solid #2a2a3a', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '520px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>✏️ New Email</h3>
              <button onClick={() => setComposeOpen(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {['to', 'subject'].map(field => (
                <input key={field}
                  style={{ padding: '0.8rem', background: '#1e1e2e', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#fff', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  placeholder={field === 'to' ? 'To (email address)' : 'Subject'}
                  value={compose[field]}
                  onChange={e => setCompose(p => ({ ...p, [field]: e.target.value }))}
                />
              ))}
              <textarea
                style={{ padding: '0.8rem', background: '#1e1e2e', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#fff', fontSize: '0.9rem', outline: 'none', resize: 'vertical', minHeight: '150px', boxSizing: 'border-box', fontFamily: 'sans-serif', width: '100%' }}
                placeholder="Email body..."
                value={compose.body}
                onChange={e => setCompose(p => ({ ...p, body: e.target.value }))}
              />
              <button onClick={sendCompose} disabled={sending}
                style={{ padding: '0.8rem', background: sending ? '#333' : '#ea4335', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                {sending ? '⏳ Sending...' : '📤 Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}