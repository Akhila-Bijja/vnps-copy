import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Apply theme globally
const applyTheme = (theme) => {
  const root = document.documentElement;
  if (theme === 'light') {
    root.style.setProperty('--bg-primary', '#f0f2f5');
    root.style.setProperty('--bg-secondary', '#ffffff');
    root.style.setProperty('--bg-tertiary', '#e8e8e8');
    root.style.setProperty('--border-color', '#d0d0d0');
    root.style.setProperty('--text-primary', '#111111');
    root.style.setProperty('--text-secondary', '#555555');
    document.body.style.background = '#f0f2f5';
    document.body.style.color = '#111';
  } else {
    root.style.setProperty('--bg-primary', '#0a0a0f');
    root.style.setProperty('--bg-secondary', '#13131a');
    root.style.setProperty('--bg-tertiary', '#1e1e2e');
    root.style.setProperty('--border-color', '#2a2a3a');
    root.style.setProperty('--text-primary', '#ffffff');
    root.style.setProperty('--text-secondary', '#888888');
    document.body.style.background = '#0a0a0f';
    document.body.style.color = '#fff';
  }
  localStorage.setItem('theme', theme);
};

export default function Settings() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveMsgColor, setSaveMsgColor] = useState('#00ff88');
  const [activeTab, setActiveTab] = useState('profile');

  // Profile
  const [profileName, setProfileName] = useState(user.name || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [savingPass, setSavingPass] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });

  // AI Tone
  const [aiTone, setAiTone] = useState(localStorage.getItem('aiTone') || 'professional');

  // Theme
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  // Notifications
  const [notifs, setNotifs] = useState({
    emailNotifs: localStorage.getItem('notif_email') !== 'false',
    postSuccess: localStorage.getItem('notif_post') !== 'false',
    commentAlerts: localStorage.getItem('notif_comment') !== 'false',
  });

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const r = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', r);
    // Apply saved theme on mount
    applyTheme(localStorage.getItem('theme') || 'dark');
    return () => window.removeEventListener('resize', r);
  }, []);

  const showSave = (msg, isError = false) => {
    setSaveMsg(msg);
    setSaveMsgColor(isError ? '#ff6666' : '#00ff88');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const saveProfile = async () => {
    if (!profileName.trim()) return showSave('❌ Name cannot be empty', true);
    setSavingProfile(true);
    try {
      await axios.post(`${API_URL}/api/auth/update-profile`, { userId: user.id, name: profileName.trim() });
      const updated = { ...user, name: profileName.trim() };
      localStorage.setItem('user', JSON.stringify(updated));
      showSave('✅ Profile saved!');
    } catch (err) {
      showSave('❌ ' + (err.response?.data?.message || 'Failed'), true);
    }
    setSavingProfile(false);
  };

  const savePassword = async () => {
    if (!passwords.new || !passwords.confirm) return showSave('❌ Fill all fields', true);
    if (passwords.new !== passwords.confirm) return showSave('❌ Passwords don\'t match', true);
    if (passwords.new.length < 6) return showSave('❌ Min 6 characters', true);
    setSavingPass(true);
    try {
      await axios.post(`${API_URL}/api/auth/change-password`, {
        userId: user.id,
        currentPassword: passwords.current,
        newPassword: passwords.new
      });
      setPasswords({ current: '', new: '', confirm: '' });
      showSave('✅ Password changed!');
    } catch (err) {
      showSave('❌ ' + (err.response?.data?.message || 'Failed'), true);
    }
    setSavingPass(false);
  };

  const changeTheme = (t) => {
    setTheme(t);
    applyTheme(t);
    showSave(`✅ ${t === 'dark' ? 'Dark' : 'Light'} mode activated!`);
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== user.email) return showSave('❌ Email doesn\'t match', true);
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/api/auth/delete-account`, { data: { userId: user.id } });
      localStorage.clear();
      window.location.href = '/login';
    } catch (err) {
      showSave('❌ ' + (err.response?.data?.message || 'Delete failed'), true);
      setDeleting(false);
    }
  };

  const isDark = theme === 'dark';
  const bg = isDark ? '#13131a' : '#ffffff';
  const bg2 = isDark ? '#1e1e2e' : '#f0f2f5';
  const border = isDark ? '#2a2a3a' : '#d0d0d0';
  const text = isDark ? '#ffffff' : '#111111';
  const subtext = isDark ? '#888888' : '#555555';

  const tabs = [
    { id: 'profile', icon: '👤', label: 'Profile' },
    { id: 'ai', icon: '🤖', label: 'AI Settings' },
    { id: 'appearance', icon: '🎨', label: 'Appearance' },
    { id: 'notifications', icon: '🔔', label: 'Notifications' },
    { id: 'security', icon: '🔐', label: 'Security' },
    { id: 'danger', icon: '🗑️', label: 'Danger Zone' },
  ];

  const inp = {
    padding: '0.8rem', background: bg2, border: `1px solid ${border}`,
    borderRadius: '8px', color: text, fontSize: '0.9rem', outline: 'none',
    width: '100%', boxSizing: 'border-box'
  };

  return (
    <div style={{ flex: 1, padding: isMobile ? '1rem' : '1.5rem', overflowY: 'auto', color: text, background: isDark ? '#0a0a0f' : '#f0f2f5' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.2rem', fontSize: isMobile ? '1.2rem' : '1.4rem', color: text }}>⚙️ Settings</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: subtext }}>Manage your account and preferences</p>
        </div>
        {saveMsg && (
          <span style={{ fontSize: '0.85rem', color: saveMsgColor, background: `${saveMsgColor}11`, padding: '0.4rem 1rem', borderRadius: '20px', border: `1px solid ${saveMsgColor}33` }}>
            {saveMsg}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexDirection: isMobile ? 'column' : 'row' }}>
        {/* Tab list */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '0.3rem', minWidth: isMobile ? '100%' : '160px', flexWrap: 'wrap' }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ padding: '0.6rem 0.8rem', background: activeTab === tab.id ? '#7c3aed22' : 'transparent', color: activeTab === tab.id ? '#a855f7' : subtext, border: activeTab === tab.id ? '1px solid #7c3aed44' : '1px solid transparent', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: activeTab === tab.id ? 600 : 400, textAlign: 'left', whiteSpace: 'nowrap' }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: '16px', padding: '1.5rem' }}>

          {/* ── Profile ── */}
          {activeTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: 0, color: text }}>👤 Profile</h3>
              <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 700, color: '#fff' }}>
                {profileName?.[0]?.toUpperCase() || 'U'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.82rem', color: subtext, fontWeight: 600 }}>Full Name</label>
                <input style={inp} value={profileName} onChange={e => setProfileName(e.target.value)}
                  placeholder="Your name" onKeyDown={e => e.key === 'Enter' && saveProfile()} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.82rem', color: subtext, fontWeight: 600 }}>Email</label>
                <input style={{ ...inp, opacity: 0.5, cursor: 'not-allowed' }} value={user.email || ''} disabled />
                <p style={{ margin: 0, fontSize: '0.72rem', color: subtext }}>Email cannot be changed</p>
              </div>
              <button onClick={saveProfile} disabled={savingProfile}
                style={{ padding: '0.8rem 1.5rem', background: savingProfile ? '#333' : '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', cursor: savingProfile ? 'not-allowed' : 'pointer', fontWeight: 700, alignSelf: 'flex-start', minWidth: '140px' }}>
                {savingProfile ? '⏳ Saving...' : '💾 Save Profile'}
              </button>
            </div>
          )}

          {/* ── AI Settings ── */}
          {activeTab === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: 0, color: text }}>🤖 AI Tone Settings</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: subtext }}>Choose how the AI writes your content</p>
              {[
                { id: 'professional', label: '💼 Professional', desc: 'Formal, expert tone. Great for LinkedIn & B2B' },
                { id: 'casual', label: '😊 Casual', desc: 'Friendly, conversational. Perfect for Instagram' },
                { id: 'funny', label: '😂 Funny & Witty', desc: 'Humorous, engaging. Great for viral content' },
                { id: 'motivational', label: '🔥 Motivational', desc: 'Inspiring, energetic. Boosts engagement' },
                { id: 'educational', label: '📚 Educational', desc: 'Informative, clear. Best for tutorials & tips' },
              ].map(tone => (
                <div key={tone.id} onClick={() => { setAiTone(tone.id); localStorage.setItem('aiTone', tone.id); showSave('✅ AI tone updated!'); }}
                  style={{ padding: '1rem', background: aiTone === tone.id ? '#7c3aed22' : bg2, border: `2px solid ${aiTone === tone.id ? '#7c3aed' : border}`, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: '0 0 0.2rem', fontWeight: 600, color: text, fontSize: '0.9rem' }}>{tone.label}</p>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: subtext }}>{tone.desc}</p>
                    </div>
                    {aiTone === tone.id && <span style={{ color: '#a855f7', fontSize: '1.3rem' }}>✓</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Appearance ── */}
          {activeTab === 'appearance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <h3 style={{ margin: 0, color: text }}>🎨 Appearance</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: subtext }}>Choose your preferred theme — applies to the entire app</p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'dark', icon: '🌙', label: 'Dark Mode', desc: 'Easy on the eyes at night' },
                  { id: 'light', icon: '☀️', label: 'Light Mode', desc: 'Clean and bright' },
                ].map(t => (
                  <div key={t.id} onClick={() => changeTheme(t.id)}
                    style={{ flex: 1, minWidth: '140px', padding: '1.5rem 1.2rem', background: theme === t.id ? '#7c3aed22' : bg2, border: `2px solid ${theme === t.id ? '#7c3aed' : border}`, borderRadius: '12px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '2rem' }}>{t.icon}</p>
                    <p style={{ margin: '0 0 0.3rem', fontWeight: 700, color: text, fontSize: '0.95rem' }}>{t.label}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: subtext }}>{t.desc}</p>
                    {theme === t.id && <p style={{ margin: '0.6rem 0 0', color: '#a855f7', fontWeight: 700, fontSize: '0.82rem' }}>✓ Active</p>}
                  </div>
                ))}
              </div>
              <div style={{ padding: '1rem', background: bg2, border: `1px solid ${border}`, borderRadius: '10px', fontSize: '0.82rem', color: subtext }}>
                💡 Theme is applied globally to the entire app and saved for next session.
              </div>
            </div>
          )}

          {/* ── Notifications ── */}
          {activeTab === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: 0, color: text }}>🔔 Notifications</h3>
              {[
                { key: 'emailNotifs', lsKey: 'notif_email', label: '📧 Email Notifications', desc: 'Get updates via email' },
                { key: 'postSuccess', lsKey: 'notif_post', label: '✅ Post Success Alerts', desc: 'Notify when AI posts successfully' },
                { key: 'commentAlerts', lsKey: 'notif_comment', label: '💬 Comment Alerts', desc: 'Notify when new comments arrive' },
              ].map(n => (
                <div key={n.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: bg2, border: `1px solid ${border}`, borderRadius: '10px' }}>
                  <div>
                    <p style={{ margin: '0 0 0.2rem', fontWeight: 600, color: text, fontSize: '0.88rem' }}>{n.label}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: subtext }}>{n.desc}</p>
                  </div>
                  <div style={{ width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer', position: 'relative', transition: 'background 0.3s', flexShrink: 0, background: notifs[n.key] ? '#7c3aed' : '#2a2a3a' }}
                    onClick={() => {
                      const val = !notifs[n.key];
                      setNotifs(p => ({ ...p, [n.key]: val }));
                      localStorage.setItem(n.lsKey, val);
                      showSave('✅ Saved!');
                    }}>
                    <div style={{ width: '20px', height: '20px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', transition: 'transform 0.3s', transform: notifs[n.key] ? 'translateX(20px)' : 'translateX(2px)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Security ── */}
          {activeTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: 0, color: text }}>🔐 Change Password</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: subtext }}>
                {user.googleId ? '⚠️ You signed in with Google. You can set a password to also login with email.' : 'Update your account password'}
              </p>
              {[
                { key: 'current', label: 'Current Password', placeholder: 'Enter current password' },
                { key: 'new', label: 'New Password', placeholder: 'Min 6 characters' },
                { key: 'confirm', label: 'Confirm New Password', placeholder: 'Repeat new password' },
              ].map(f => (
                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.82rem', color: subtext, fontWeight: 600 }}>{f.label}</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPasswords[f.key] ? 'text' : 'password'} style={{ ...inp, paddingRight: '2.5rem' }}
                      placeholder={f.placeholder} value={passwords[f.key]}
                      onChange={e => setPasswords(p => ({ ...p, [f.key]: e.target.value }))} />
                    <button onClick={() => setShowPasswords(p => ({ ...p, [f.key]: !p[f.key] }))}
                      style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: subtext, fontSize: '0.9rem' }}>
                      {showPasswords[f.key] ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={savePassword} disabled={savingPass}
                style={{ padding: '0.8rem', background: savingPass ? '#333' : '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', cursor: savingPass ? 'not-allowed' : 'pointer', fontWeight: 700, alignSelf: 'flex-start', minWidth: '180px' }}>
                {savingPass ? '⏳ Changing...' : '🔐 Change Password'}
              </button>
            </div>
          )}

          {/* ── Danger Zone ── */}
          {activeTab === 'danger' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem', color: '#ff4444' }}>🗑️ Danger Zone</h3>
              <div style={{ padding: '1.5rem', background: '#ff444411', border: '1px solid #ff444433', borderRadius: '12px' }}>
                <p style={{ margin: '0 0 0.4rem', fontWeight: 700, color: '#ff6666', fontSize: '0.95rem' }}>⚠️ Delete Account</p>
                <p style={{ margin: '0 0 1rem', fontSize: '0.83rem', color: subtext, lineHeight: 1.6 }}>
                  This will permanently delete your account, all chats, and disconnect all platforms. <strong style={{ color: '#ff6666' }}>This cannot be undone!</strong>
                </p>
                {!showDelete ? (
                  <button onClick={() => setShowDelete(true)}
                    style={{ padding: '0.7rem 1.5rem', background: 'transparent', color: '#ff4444', border: '2px solid #ff4444', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                    🗑️ Delete My Account
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#ff6666', fontWeight: 600 }}>
                      Type your email to confirm: <span style={{ fontFamily: 'monospace' }}>{user.email}</span>
                    </p>
                    <input style={{ ...inp, border: '2px solid #ff444466' }}
                      placeholder={user.email} value={deleteConfirm}
                      onChange={e => setDeleteConfirm(e.target.value)} />
                    <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                      <button onClick={deleteAccount} disabled={deleting || deleteConfirm !== user.email}
                        style={{ padding: '0.7rem 1.5rem', background: deleting || deleteConfirm !== user.email ? '#333' : '#ff4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: deleting || deleteConfirm !== user.email ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
                        {deleting ? '⏳ Deleting...' : '✅ Yes, Delete Forever'}
                      </button>
                      <button onClick={() => { setShowDelete(false); setDeleteConfirm(''); }}
                        style={{ padding: '0.7rem 1.5rem', background: 'transparent', color: subtext, border: `1px solid ${border}`, borderRadius: '8px', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}