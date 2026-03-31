import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function Login() {
  const [mode, setMode] = useState('home');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleLogin = () => {
  const apiUrl = API_URL || 'http://localhost:5000';
  window.location.href = `${apiUrl}/api/auth/google`;
};
  const handleChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); setError(''); };

  const handleSignup = async () => {
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/auth/signup`, { name: form.name, email: form.email, password: form.password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch (err) { setError(err.response?.data?.message || 'Signup failed'); }
    setLoading(false);
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/auth/login`, { email: form.email, password: form.password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch (err) { setError(err.response?.data?.message || 'Login failed'); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#13131a', padding: 'clamp(1.5rem, 5vw, 2.5rem)', borderRadius: '16px', border: '1px solid #2a2a3a', width: '100%', maxWidth: '400px', boxSizing: 'border-box' }}>
        <h2 style={{ color: '#fff', fontSize: 'clamp(1.4rem, 5vw, 1.8rem)', margin: '0 0 0.3rem', textAlign: 'center' }}>🧠 SynapSocial</h2>
        <p style={{ color: '#7c3aed', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1.8rem' }}>Your Autonomous AI Social Media Agent</p>

        <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '0.85rem', background: '#fff', color: '#000', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 600, boxSizing: 'border-box' }}
          onClick={handleGoogleLogin}>
          <img src="https://www.google.com/favicon.ico" width="18" alt="g" style={{ marginRight: '10px' }} />
          Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '1.2rem 0', position: 'relative' }}>
          <div style={{ flex: 1, height: '1px', background: '#2a2a3a' }} />
          <span style={{ padding: '0 0.8rem', color: '#555', fontSize: '0.85rem' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: '#2a2a3a' }} />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem' }}>
          <button style={{ flex: 1, padding: '0.6rem', background: mode === 'login' ? '#7c3aed' : 'transparent', color: mode === 'login' ? '#fff' : '#888', border: '1px solid #2a2a3a', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: mode === 'login' ? 600 : 400 }}
            onClick={() => setMode('login')}>Login</button>
          <button style={{ flex: 1, padding: '0.6rem', background: mode === 'signup' ? '#7c3aed' : 'transparent', color: mode === 'signup' ? '#fff' : '#888', border: '1px solid #2a2a3a', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: mode === 'signup' ? 600 : 400 }}
            onClick={() => setMode('signup')}>Sign Up</button>
        </div>

        {error && <p style={{ color: '#ff4444', fontSize: '0.85rem', textAlign: 'center', margin: '0 0 0.5rem' }}>{error}</p>}

        {mode === 'login' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <input style={{ padding: '0.85rem', background: '#1e1e2e', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#fff', fontSize: '0.95rem', outline: 'none', width: '100%', boxSizing: 'border-box' }}
              name="email" type="email" placeholder="Email" onChange={handleChange} />
            <input style={{ padding: '0.85rem', background: '#1e1e2e', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#fff', fontSize: '0.95rem', outline: 'none', width: '100%', boxSizing: 'border-box' }}
              name="password" type="password" placeholder="Password" onChange={handleChange} />
            <button style={{ padding: '0.85rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 600 }}
              onClick={handleLogin} disabled={loading}>{loading ? 'Logging in...' : 'Login →'}</button>
            <p style={{ color: '#888', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
              No account? <span style={{ color: '#7c3aed', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setMode('signup')}>Sign up</span>
            </p>
          </div>
        )}

        {mode === 'signup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {['name', 'email', 'password', 'confirm'].map((field, i) => (
              <input key={field} style={{ padding: '0.85rem', background: '#1e1e2e', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#fff', fontSize: '0.95rem', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                name={field} type={field === 'name' ? 'text' : field === 'email' ? 'email' : 'password'}
                placeholder={['Full Name', 'Email', 'Password', 'Confirm Password'][i]} onChange={handleChange} />
            ))}
            <button style={{ padding: '0.85rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 600 }}
              onClick={handleSignup} disabled={loading}>{loading ? 'Creating...' : 'Create Account →'}</button>
            <p style={{ color: '#888', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
              Have an account? <span style={{ color: '#7c3aed', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setMode('login')}>Login</span>
            </p>
          </div>
        )}

        {mode === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <button style={{ padding: '0.85rem', background: 'transparent', color: '#fff', border: '1px solid #2a2a3a', borderRadius: '8px', fontSize: '0.95rem', cursor: 'pointer' }} onClick={() => setMode('login')}>Login with Email</button>
            <button style={{ padding: '0.85rem', background: 'transparent', color: '#fff', border: '1px solid #2a2a3a', borderRadius: '8px', fontSize: '0.95rem', cursor: 'pointer' }} onClick={() => setMode('signup')}>Sign Up with Email</button>
          </div>
        )}
      </div>
    </div>
  );
}