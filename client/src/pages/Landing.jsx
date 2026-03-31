import { useNavigate } from 'react-router-dom';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ textAlign: 'center', padding: '2rem', width: '100%', maxWidth: '600px' }}>
        <h1 style={{ fontSize: 'clamp(2.5rem, 10vw, 4rem)', color: '#fff', margin: 0 }}>🧠 SynapSocial</h1>
        <p style={{ fontSize: 'clamp(1rem, 4vw, 1.5rem)', color: '#7c3aed', marginTop: '1rem' }}>Your Autonomous AI Social Media Agent</p>
        <p style={{ fontSize: 'clamp(0.9rem, 3vw, 1.1rem)', color: '#888', marginTop: '1rem' }}>Connect all your platforms. Let AI do the work.</p>
        <button style={{ marginTop: '2rem', padding: '1rem 2.5rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', fontSize: 'clamp(0.95rem, 3vw, 1.1rem)', cursor: 'pointer', width: 'min(100%, 280px)' }}
          onClick={() => navigate('/login')}>
          Get Started Free →
        </button>
      </div>
    </div>
  );
}