import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import Trends from './Trends';
import Platforms from './Platforms';
import Jobs from './Jobs';
import Settings from './Settings';
import Content from './Content';

// Mic button for voice input
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
    return <button onClick={toggle} title={active ? 'Stop' : 'Speak'} style={{ padding: '0.35rem 0.45rem', background: active ? '#ef444422' : 'transparent', color: active ? '#ef4444' : '#555', border: `1px solid ${active ? '#ef444444' : 'transparent'}`, borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', flexShrink: 0, transition: 'all 0.2s', animation: active ? 'micpulse 1s infinite' : 'none' }}>🎙️</button>;
}

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const platforms = ['General', 'LinkedIn', 'Instagram', 'YouTube'];

export default function Dashboard() {
    const [messages, setMessages] = useState([
        { role: 'ai', text: '👋 Hey! I\'m your SynapSocial AI Agent. Tell me what to post, upload a file, or pick a platform!' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [platform, setPlatform] = useState('General');
    const [activeNav, setActiveNav] = useState('chat');
    const [file, setFile] = useState(null);
    const [posting, setPosting] = useState(false);
    const [chats, setChats] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
    const [draftIdea, setDraftIdea] = useState(null);
    const mediaFilesRef = useRef({});
    const bottomRef = useRef(null);
    const fileRef = useRef(null);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 900);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const googleUser = params.get('googleUser');
        if (googleUser) {
            const userData = JSON.parse(decodeURIComponent(googleUser));
            localStorage.setItem('user', JSON.stringify(userData));
            window.history.replaceState({}, '', '/dashboard');
            fetchChats();
            return;
        }
        const storedUser = localStorage.getItem('user');
        if (!storedUser || storedUser === '{}') {
            axios.get(`${API_URL}/api/auth/me`, { withCredentials: true })
                .then(({ data }) => {
                    localStorage.setItem('user', JSON.stringify({
                        id: data.user._id, name: data.user.name, email: data.user.email
                    }));
                    window.history.replaceState({}, '', '/dashboard');
                    fetchChats();
                }).catch(() => { window.location.href = '/login'; });
        } else {
            fetchChats();
        }
    }, []);

    useEffect(() => {
        const handleNav = (e) => {
            setActiveNav(e.detail);
            if (isMobile) setSidebarOpen(false);
        };
        window.addEventListener('navigate', handleNav);
        return () => window.removeEventListener('navigate', handleNav);
    }, []);

    const fetchChats = async () => {
        try {
            const { data } = await axios.get(`${API_URL}/api/chats/${user.id}`);
            setChats(data.chats || []);
        } catch (err) { console.error(err); }
    };

    const startNewChat = () => {
        setActiveChatId(null);
        setMessages([{ role: 'ai', text: '👋 New chat started! What would you like to create today?' }]);
        setInput('');
        setFile(null);
        if (isMobile) setSidebarOpen(false);
    };

    const loadChat = async (chatId) => {
        try {
            const { data } = await axios.get(`${API_URL}/api/chats/messages/${chatId}`);
            setActiveChatId(chatId);
            setMessages(data.chat.messages.map(m => ({
                role: m.role, text: m.text, showActions: m.showActions,
                fileType: m.fileType, fileName: m.fileName
            })));
            if (isMobile) setSidebarOpen(false);
        } catch (err) { console.error(err); }
    };

    const deleteChat = async (e, chatId) => {
        e.stopPropagation();
        await axios.delete(`${API_URL}/api/chats/delete/${chatId}`);
        setChats(prev => prev.filter(c => c._id !== chatId));
        if (activeChatId === chatId) startNewChat();
    };

    const saveMessage = async (message, chatId, title) => {
        try {
            const { data } = await axios.post(`${API_URL}/api/chats/save`, {
                chatId, userId: user.id, message, title
            });
            if (!chatId) { setActiveChatId(data.chat._id); fetchChats(); }
            return data.chat._id;
        } catch (err) { console.error(err); }
    };

    const sendMessage = async () => {
        if (!input.trim() && !file) return;
        const userMsg = input.trim();
        const currentFile = file;
        setInput('');
        setFile(null);

        const fileExt = currentFile ? currentFile.name.split('.').pop().toLowerCase() : null;
        const fileType = fileExt
            ? ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt) ? 'image'
                : ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(fileExt) ? 'video'
                    : ['pdf'].includes(fileExt) ? 'pdf'
                        : ['doc', 'docx'].includes(fileExt) ? 'doc' : 'file' : null;

        const msgId = Date.now().toString();
        const previewUrl = currentFile && (fileType === 'image' || fileType === 'video')
            ? URL.createObjectURL(currentFile) : null;

        if (currentFile && (fileType === 'image' || fileType === 'video')) {
            const fileBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(currentFile);
            });
            mediaFilesRef.current[msgId] = { base64: fileBase64, mimeType: currentFile.type, name: currentFile.name };
        }

        const displayText = currentFile ? `${userMsg ? userMsg : `Analyze this ${fileType}`}` : userMsg;
        const userMessage = { role: 'user', text: displayText, fileName: currentFile?.name, previewUrl: fileType === 'image' || fileType === 'video' ? previewUrl : null, fileType };
        setMessages(prev => [...prev, userMessage]);

        const title = userMsg.slice(0, 40) || currentFile?.name || 'New Chat';
        let currentChatId = activeChatId;

        if (!currentChatId) {
            const newChat = await axios.post(`${API_URL}/api/chats/new`, { userId: user.id });
            currentChatId = newChat.data.chat._id;
            setActiveChatId(currentChatId);
            await axios.post(`${API_URL}/api/chats/save`, {
                chatId: currentChatId, userId: user.id,
                message: { role: 'user', text: displayText, fileName: currentFile?.name, timestamp: new Date() }, title
            });
            fetchChats();
        } else {
            await saveMessage({ role: 'user', text: displayText, fileName: currentFile?.name, timestamp: new Date() }, currentChatId);
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('message', userMsg || `Analyze this ${fileType} and generate ${platform} content`);
            formData.append('platform', platform);
            if (currentFile) formData.append('file', currentFile);

            const { data } = await axios.post(`${API_URL}/api/ai/chat`, formData,
                { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
            );

            const aiMsg = { role: 'ai', text: data.reply, showActions: true, content: data.reply, fileType, fileName: currentFile?.name, previewUrl, mediaId: msgId };
            setMessages(prev => [...prev, aiMsg]);

            if (fileType === 'image' || fileType === 'video') {
                setMessages(prev => [...prev, {
                    role: 'ai',
                    text: fileType === 'image' ? `📸 Would you like to post this image with the caption above?` : `🎥 Would you like to post this video with the description above?`,
                    showMediaActions: true, content: data.reply, fileType, fileName: currentFile?.name, mediaId: msgId
                }]);
            }

            await axios.post(`${API_URL}/api/chats/save`, {
                chatId: currentChatId, userId: user.id,
                message: { role: 'ai', text: data.reply, showActions: true, fileType, fileName: currentFile?.name, timestamp: new Date() }
            });
            fetchChats();
        } catch {
            setMessages(prev => [...prev, { role: 'ai', text: '❌ AI error. Please try again.' }]);
        }
        setLoading(false);
    };

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    const postToLinkedIn = async (content, mediaId = null) => {
        // ✅ FIX: Check linkedinAutoPost permission
        const perms = JSON.parse(localStorage.getItem('synapPermissions') || '{}');
        if (!perms.linkedinAutoPost) {
            const ok = window.confirm('⚠️ LinkedIn Auto-Post permission is OFF.\n\nEnable "Auto-Post" in LinkedIn Permissions to post from chat.\n\nWould you like to go to Platforms settings?');
            if (ok) window.dispatchEvent(new CustomEvent('navigate', { detail: 'platforms' }));
            return;
        }
        setPosting(true);
        try {
            const mediaData = mediaId ? mediaFilesRef.current[mediaId] : null;
            const isVideo = mediaData?.mimeType?.includes('video');
            if (mediaData && isVideo) {
                const formData = new FormData();
                formData.append('userId', user.id);
                formData.append('content', content);
                const base64Data = mediaData.base64.split(';base64,').pop();
                const byteArray = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                const blob = new Blob([byteArray], { type: mediaData.mimeType });
                formData.append('media', blob, mediaData.name);
                await axios.post(`${API_URL}/api/ai/post/linkedin/video`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            } else {
                const postData = { userId: user.id, content };
                if (mediaData) { postData.mediaBase64 = mediaData.base64; postData.mediaMimeType = mediaData.mimeType; postData.mediaName = mediaData.name; }
                await axios.post(`${API_URL}/api/ai/post/linkedin`, postData);
            }
            setMessages(prev => [...prev, { role: 'ai', text: `✅ Posted to LinkedIn! 🎉` }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'ai', text: `❌ ${err.response?.data?.message || 'LinkedIn post failed.'}` }]);
        }
        setPosting(false);
    };

    const postToYouTube = async (content, mediaId = null) => {
        // ✅ FIX: Check youtubeAutoPost permission
        const perms = JSON.parse(localStorage.getItem('synapPermissions') || '{}');
        if (!perms.youtubeAutoPost) {
            const ok = window.confirm('⚠️ YouTube Auto-Upload permission is OFF.\n\nEnable "Auto-Upload Videos" in YouTube Permissions to post from chat.\n\nWould you like to go to Platforms settings?');
            if (ok) window.dispatchEvent(new CustomEvent('navigate', { detail: 'platforms' }));
            return;
        }
        setPosting(true);
        try {
            const mediaData = mediaId ? mediaFilesRef.current[mediaId] : null;
            if (!mediaData) { setMessages(prev => [...prev, { role: 'ai', text: '❌ No video found.' }]); setPosting(false); return; }
            await axios.post(`${API_URL}/api/ai/post/youtube`, {
                userId: user.id, title: content.slice(0, 100), description: content,
                mediaBase64: mediaData.base64, mediaMimeType: mediaData.mimeType, mediaName: mediaData.name
            });
            setMessages(prev => [...prev, { role: 'ai', text: '✅ Video posted to YouTube! 🎉' }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'ai', text: `❌ ${err.response?.data?.message || 'YouTube post failed.'}` }]);
        }
        setPosting(false);
    };

    const enhanceContent = async (content) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const { data } = await axios.post(`${API_URL}/api/ai/chat`,
                { message: `Enhance and improve this content for ${platform}:\n\n${content}`, platform },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessages(prev => [...prev, { role: 'ai', text: data.reply, showActions: true, content: data.reply }]);
        } catch { setMessages(prev => [...prev, { role: 'ai', text: '❌ Error enhancing.' }]); }
        setLoading(false);
    };

    const formatTime = (date) => new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    const user_ = JSON.parse(localStorage.getItem('user') || '{}');

    const navTo = (id) => {
        setActiveNav(id);
        if (isMobile) setSidebarOpen(false);
    };

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0a0a0f', color: '#fff', fontFamily: 'sans-serif', position: 'relative' }}>

            {/* Mobile sidebar overlay */}
            {isMobile && sidebarOpen && (
                <div onClick={() => setSidebarOpen(false)}
                    style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 99 }} />
            )}

            {/* Sidebar — desktop always visible, mobile slides in */}
            <div style={{
                width: '220px', background: '#13131a', borderRight: '1px solid #2a2a3a',
                padding: '1rem 0.8rem', display: 'flex', flexDirection: 'column',
                height: '100vh', overflow: 'hidden', flexShrink: 0,
                ...(isMobile ? {
                    position: 'fixed', top: 0, left: 0, zIndex: 100, width: '260px',
                    transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
                    transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
                    boxShadow: sidebarOpen ? '4px 0 24px #0008' : 'none'
                } : {})
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ color: '#a855f7', margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>🧠 SynapSocial</h2>
                    {isMobile && (
                        <button onClick={() => setSidebarOpen(false)}
                            style={{ background: '#2a2a3a', border: 'none', color: '#fff', fontSize: '1rem', cursor: 'pointer', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem', padding: '0.7rem', background: '#1e1e2e', borderRadius: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', flexShrink: 0, color: '#fff' }}>
                        {user_.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                        <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{user_.name || 'User'}</p>
                        <p style={{ margin: 0, fontSize: '0.67rem', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{user_.email || ''}</p>
                    </div>
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    {[
                        { id: 'chat', icon: '💬', label: 'AI Chat' },
                        { id: 'trends', icon: '📈', label: 'Trends' },
                        { id: 'platforms', icon: '🔗', label: 'Platforms' },
                        { id: 'jobs', icon: '💼', label: 'Job Scanner' },
                        { id: 'schedule', icon: '📅', label: 'Schedule' },
                        { id: 'settings', icon: '⚙️', label: 'Settings' },
                        { id: 'content', icon: '🎨', label: 'Content Creator' }
                    ].map(item => (
                        <div key={item.id}
                            style={activeNav === item.id
                                ? { padding: '0.7rem 0.9rem', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '0.88rem', fontWeight: 600, background: '#7c3aed33', borderLeft: '3px solid #a855f7', display: 'flex', alignItems: 'center', gap: '0.6rem' }
                                : { padding: '0.7rem 0.9rem', borderRadius: '10px', cursor: 'pointer', color: '#666', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                            onClick={() => navTo(item.id)}>
                            <span style={{ fontSize: '1rem' }}>{item.icon}</span> {item.label}
                        </div>
                    ))}
                </nav>

                {activeNav === 'chat' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: '0.8rem', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.72rem', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recent Chats</span>
                            <button onClick={startNewChat}
                                style={{ padding: '0.25rem 0.7rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                                + New
                            </button>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {chats.length === 0 && <p style={{ color: '#444', fontSize: '0.75rem', textAlign: 'center', marginTop: '1rem' }}>No chats yet</p>}
                            {chats.map(chat => (
                                <div key={chat._id}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.6rem', borderRadius: '8px', cursor: 'pointer', marginBottom: '0.2rem', background: activeChatId === chat._id ? '#7c3aed22' : 'transparent' }}
                                    onClick={() => loadChat(chat._id)}>
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.title}</p>
                                        <p style={{ margin: 0, fontSize: '0.62rem', color: '#555' }}>{formatTime(chat.updatedAt)}</p>
                                    </div>
                                    <button style={{ background: '#ff444422', border: '1px solid #ff444444', cursor: 'pointer', fontSize: '0.75rem', color: '#ff6666', borderRadius: '6px', padding: '0.2rem 0.4rem', flexShrink: 0 }}
                                        onClick={(e) => deleteChat(e, chat._id)}>🗑</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
                    style={{ padding: '0.65rem', background: 'transparent', color: '#555', border: '1px solid #2a2a3a', borderRadius: '10px', cursor: 'pointer', fontSize: '0.82rem', marginTop: '0.5rem' }}>
                    🚪 Logout
                </button>
            </div>

            {/* Main content area */}
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                height: '100vh', overflow: 'hidden', minWidth: 0,
                paddingBottom: isMobile ? '64px' : '0',
                padding: isMobile ? '0' : '1rem 1.5rem',
            }}>

                {/* Mobile top header — ALWAYS SHOWN on mobile */}
                {isMobile && (
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.75rem 1rem', background: '#13131a',
                        borderBottom: '1px solid #2a2a3a', flexShrink: 0,
                        position: 'sticky', top: 0, zIndex: 10
                    }}>
                        <button onClick={() => setSidebarOpen(true)}
                            style={{
                                background: '#1e1e2e', border: '1px solid #2a2a3a',
                                color: '#fff', borderRadius: '10px',
                                width: '40px', height: '40px',
                                cursor: 'pointer', fontSize: '1.2rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0
                            }}>☰</button>
                        <h2 style={{ margin: 0, color: '#a855f7', fontSize: '1.1rem', fontWeight: 900 }}>🧠 SynapSocial</h2>
                        <div style={{
                            width: '38px', height: '38px', borderRadius: '50%',
                            background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: '1rem', color: '#fff', flexShrink: 0
                        }}>
                            {user_.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                    </div>
                )}

                {activeNav === 'chat' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: isMobile ? '0.8rem 0.8rem 0' : '0' }}>
                        <div style={{ marginBottom: '0.6rem' }}>
                            <h3 style={{ margin: '0 0 0.6rem', color: '#fff', fontSize: isMobile ? '1rem' : '1.05rem' }}>💬 AI Agent Console</h3>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                {platforms.map(p => (
                                    <button key={p}
                                        style={platform === p
                                            ? { padding: isMobile ? '0.4rem 1rem' : '0.3rem 0.8rem', background: '#7c3aed', color: '#fff', border: '1px solid #7c3aed', borderRadius: '20px', cursor: 'pointer', fontSize: isMobile ? '0.82rem' : '0.75rem', fontWeight: 600 }
                                            : { padding: isMobile ? '0.4rem 1rem' : '0.3rem 0.8rem', background: 'transparent', color: '#888', border: '1px solid #2a2a3a', borderRadius: '20px', cursor: 'pointer', fontSize: isMobile ? '0.82rem' : '0.75rem' }}
                                        onClick={() => setPlatform(p)}>{p}</button>
                                ))}
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingRight: '0.3rem', marginBottom: '0.8rem' }}>
                            {messages.map((msg, i) => (
                                <div key={i}>
                                    {msg.role === 'user' && (
                                        <div style={{ background: '#7c3aed22', border: '1px solid #7c3aed44', padding: '0.8rem 1rem', borderRadius: '12px', maxWidth: isMobile ? '90%' : '72%', alignSelf: 'flex-end', marginLeft: 'auto' }}>
                                            {msg.fileName && <p style={{ fontSize: '0.75rem', color: '#888', margin: '0 0 0.3rem', background: '#1e1e2e', padding: '0.2rem 0.6rem', borderRadius: '6px', display: 'inline-block' }}>📎 {msg.fileName}</p>}
                                            {msg.previewUrl && msg.fileType === 'image' && <img src={msg.previewUrl} alt="uploaded" style={{ width: '100%', maxWidth: '280px', borderRadius: '8px', marginBottom: '0.6rem', display: 'block' }} />}
                                            {msg.previewUrl && msg.fileType === 'video' && <video src={msg.previewUrl} controls style={{ width: '100%', maxWidth: '280px', borderRadius: '8px', marginBottom: '0.6rem', display: 'block' }} />}
                                            {msg.text && <p style={{ margin: 0, color: '#ccc', fontSize: '0.88rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.text}</p>}
                                        </div>
                                    )}

                                    {msg.role === 'ai' && (
                                        <div style={{ background: '#13131a', border: '1px solid #2a2a3a', padding: '0.8rem 1rem', borderRadius: '12px', maxWidth: isMobile ? '90%' : '72%' }}>
                                            <span style={{ fontSize: '0.7rem', color: '#a855f7', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>🧠 AI</span>
                                            {msg.previewUrl && msg.fileType === 'image' && <img src={msg.previewUrl} alt="uploaded" style={{ width: '100%', maxWidth: '280px', borderRadius: '8px', marginBottom: '0.6rem', display: 'block' }} />}
                                            {msg.previewUrl && msg.fileType === 'video' && <video src={msg.previewUrl} controls style={{ width: '100%', maxWidth: '280px', borderRadius: '8px', marginBottom: '0.6rem', display: 'block' }} />}
                                            <p style={{ margin: 0, color: '#ccc', fontSize: '0.88rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                                        </div>
                                    )}

                                    {msg.showActions && !msg.showMediaActions && (
                                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                                            {(platform === 'LinkedIn' || platform === 'General') && (
                                                <button style={{ padding: '0.3rem 0.7rem', background: '#0077b522', color: '#fff', border: '1px solid #0077b566', borderRadius: '20px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                                    onClick={() => postToLinkedIn(msg.content, msg.mediaId)} disabled={posting}>
                                                    💼 Post on LinkedIn
                                                </button>
                                            )}
                                            {(platform === 'Instagram' || platform === 'General') && (
                                                <button style={{ padding: '0.3rem 0.7rem', background: '#e1306c22', color: '#fff', border: '1px solid #e1306c66', borderRadius: '20px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, opacity: 0.5 }} disabled>
                                                    📸 Instagram <span style={{ fontSize: '0.6rem', background: '#ffffff22', padding: '0.1rem 0.3rem', borderRadius: '4px', marginLeft: '3px' }}>Soon</span>
                                                </button>
                                            )}
                                            {(platform === 'YouTube' || platform === 'General') && msg.fileType === 'video' && (
                                                <button style={{ padding: '0.3rem 0.7rem', background: '#ff000022', color: '#fff', border: '1px solid #ff000066', borderRadius: '20px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                                    onClick={() => postToYouTube(msg.content, msg.mediaId)} disabled={posting}>
                                                    🎥 Post to YouTube
                                                </button>
                                            )}
                                            {(platform === 'YouTube' || platform === 'General') && msg.fileType !== 'video' && (
                                                <button style={{ padding: '0.3rem 0.7rem', background: '#ff000022', color: '#fff', border: '1px solid #ff000066', borderRadius: '20px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, opacity: 0.5 }} disabled>
                                                    🎥 YouTube <span style={{ fontSize: '0.6rem', background: '#ffffff22', padding: '0.1rem 0.3rem', borderRadius: '4px', marginLeft: '3px' }}>Video only</span>
                                                </button>
                                            )}
                                            <button style={{ padding: '0.3rem 0.7rem', background: '#7c3aed22', color: '#fff', border: '1px solid #7c3aed66', borderRadius: '20px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                                onClick={() => enhanceContent(msg.content)}>✨ Enhance</button>
                                            <button style={{ padding: '0.3rem 0.7rem', background: 'transparent', color: '#666', border: '1px solid #2a2a3a', borderRadius: '20px', cursor: 'pointer', fontSize: '0.72rem' }}>⏭ Skip</button>
                                        </div>
                                    )}

                                    {msg.showMediaActions && (
                                        <div style={{ background: '#13131a', border: '1px solid #7c3aed44', borderRadius: '12px', padding: '1rem', marginTop: '0.4rem', maxWidth: isMobile ? '90%' : '72%' }}>
                                            <p style={{ margin: '0 0 0.2rem', fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>
                                                {msg.fileType === 'image' ? '📸 Post this image?' : '🎥 Post this video?'}
                                            </p>
                                            <p style={{ margin: '0 0 0.8rem', fontSize: '0.75rem', color: '#888' }}>{msg.fileName}</p>
                                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                <button style={{ padding: '0.4rem 0.8rem', background: '#0077b5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
                                                    onClick={() => postToLinkedIn(msg.content, msg.mediaId)} disabled={posting}>💼 LinkedIn</button>
                                                <button style={{ padding: '0.4rem 0.8rem', background: '#e1306c', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, opacity: 0.5 }} disabled>📸 Instagram</button>
                                                {msg.fileType === 'video'
                                                    ? <button style={{ padding: '0.4rem 0.8rem', background: '#ff0000', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
                                                        onClick={() => postToYouTube(msg.content, msg.mediaId)} disabled={posting}>🎥 YouTube</button>
                                                    : <button style={{ padding: '0.4rem 0.8rem', background: '#ff000066', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', opacity: 0.5 }} disabled>🎥 YouTube</button>
                                                }
                                                <button style={{ padding: '0.4rem 0.8rem', background: 'transparent', color: '#888', border: '1px solid #2a2a3a', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem' }}
                                                    onClick={() => setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, showMediaActions: false } : m))}>
                                                    Skip
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {loading && (
                                <div style={{ background: '#13131a', border: '1px solid #2a2a3a', padding: '0.8rem 1rem', borderRadius: '12px', maxWidth: '72%' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#a855f7', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>🧠 AI</span>
                                    <p style={{ margin: 0, color: '#ccc', fontSize: '0.88rem' }}>✍️ Thinking...</p>
                                </div>
                            )}
                            <div ref={bottomRef} />
                        </div>

                        {file && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.8rem', background: '#1e1e2e', borderRadius: '8px', marginBottom: '0.4rem', fontSize: '0.8rem', color: '#ccc' }}>
                                <span>📎 {file.name}</span>
                                <button style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' }} onClick={() => setFile(null)}>✕</button>
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#13131a', border: '1px solid #3a3a4a', borderRadius: '14px', padding: isMobile ? '0.6rem 0.8rem' : '0.4rem 0.8rem' }}>
                            <input ref={fileRef} type="file" style={{ display: 'none' }}
                                accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                                onChange={e => setFile(e.target.files[0])} />
                            <button style={{ padding: '0.4rem', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: isMobile ? '1.3rem' : '1rem', color: '#666', flexShrink: 0 }}
                                onClick={() => fileRef.current.click()}>📎</button>
                            <textarea style={{ flex: 1, padding: '0.3rem 0', background: 'transparent', border: 'none', color: '#fff', fontSize: isMobile ? '1rem' : '0.88rem', outline: 'none', resize: 'none', fontFamily: 'sans-serif', lineHeight: 1.5 }}
                                rows={isMobile ? 2 : 2} placeholder={`Ask AI to create ${platform} content...`}
                                value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} />
                            <MicBtn color="#7c3aed" onResult={txt => setInput(p => p ? p + ' ' + txt : txt)} />
                            <button style={{ width: isMobile ? '40px' : '32px', height: isMobile ? '40px' : '32px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 900, fontSize: '1.2rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                onClick={sendMessage} disabled={loading}>↑</button>
                        </div>
                        {!isMobile && <p style={{ color: '#333', fontSize: '0.7rem', margin: '0.3rem 0 0' }}>📎 attach · Enter to send · Shift+Enter new line</p>}
                    </div>
                )}

                {activeNav === 'trends' && <Trends onGenerate={(idea) => { setDraftIdea(idea); setActiveNav('content'); }} />}
                {activeNav === 'platforms' && <Platforms />}
                {activeNav === 'jobs' && <Jobs />}
                {activeNav === 'settings' && <Settings />}
                {activeNav === 'schedule' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <h2>📅 Scheduler</h2>
                        <p style={{ color: '#888' }}>Coming Soon!</p>
                    </div>
                )}
                {activeNav === 'content' && <Content draftIdea={draftIdea} setDraftIdea={setDraftIdea} />}
            </div>

            {/* Mobile Bottom Navigation Bar */}
            {isMobile && (
                <div style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
                    background: '#13131a', borderTop: '1px solid #2a2a3a',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-around',
                    padding: '0.4rem 0', height: '60px',
                    boxShadow: '0 -4px 20px #00000088'
                }}>
                    {[
                        { id: 'chat', icon: '💬', label: 'Chat' },
                        { id: 'trends', icon: '📈', label: 'Trends' },
                        { id: 'platforms', icon: '🔗', label: 'Platforms' },
                        { id: 'jobs', icon: '💼', label: 'Jobs' },
                        { id: 'settings', icon: '⚙️', label: 'Settings' },
                    ].map(item => (
                        <button key={item.id} onClick={() => setActiveNav(item.id)}
                            style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                gap: '0.15rem', background: 'none', border: 'none', cursor: 'pointer',
                                padding: '0.3rem 0.6rem', borderRadius: '10px',
                                color: activeNav === item.id ? '#a855f7' : '#555',
                                transition: 'color 0.2s',
                                minWidth: '52px'
                            }}>
                            <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{item.icon}</span>
                            <span style={{ fontSize: '0.62rem', fontWeight: activeNav === item.id ? 700 : 400 }}>{item.label}</span>
                            {activeNav === item.id && (
                                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#a855f7', marginTop: '1px' }} />
                            )}
                        </button>
                    ))}
                </div>
            )}
            <style>{`@keyframes micpulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        </div>
    );
}