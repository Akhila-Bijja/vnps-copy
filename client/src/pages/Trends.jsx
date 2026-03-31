import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const niches = ['social media', 'tech', 'finance', 'fitness', 'startup', 'AI', 'crypto', 'marketing'];

export default function Trends({ onGenerate }) {
  const [trends, setTrends] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [niche, setNiche] = useState('social media');
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [source, setSource] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const r = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);

  const fetchTrends = async (selectedNiche = niche) => {
    setLoading(true); setTrends([]); setIdeas([]);
    try {
      const { data } = await axios.get(`${API_URL}/api/trends?niche=${encodeURIComponent(selectedNiche)}`);
      setTrends(data.trending || []);
      setIdeas(data.ideas || []);
      setFetchedAt(data.fetchedAt);
      setSource(data.source);
    } catch {
      alert('Error fetching trends. Please try again.');
    }
    setLoading(false);
  };

  useEffect(() => { fetchTrends(niche); }, [niche]);

  const platformColor = (p) => {
    if (p === 'LinkedIn') return '#0077b5';
    if (p === 'Instagram') return '#e1306c';
    if (p === 'YouTube') return '#ff0000';
    return '#7c3aed';
  };

  const formatTime = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) +
      ' · ' + d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div style={{ flex: 1, padding: isMobile ? '1rem' : '1.5rem', overflowY: 'auto', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.3rem' }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? '1.2rem' : '1.4rem' }}>📈 Trend Intelligence</h2>
          {fetchedAt && (
            <span style={{ fontSize: '0.72rem', color: source === 'live' ? '#00ff88' : '#888', background: source === 'live' ? '#00ff8811' : '#ffffff11', padding: '0.25rem 0.7rem', borderRadius: '20px', border: `1px solid ${source === 'live' ? '#00ff8833' : '#2a2a3a'}` }}>
              {source === 'live' ? '🟢 Live' : '🟡 Cached'} · {formatTime(fetchedAt)}
            </span>
          )}
        </div>
        <p style={{ color: '#888', margin: '0 0 1rem', fontSize: '0.88rem' }}>Real-time Google Trends + AI content ideas</p>

        {/* Niche pills */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {niches.map(n => (
            <button key={n}
              style={{ padding: '0.35rem 0.9rem', background: niche === n ? '#7c3aed' : 'transparent', color: niche === n ? '#fff' : '#888', border: '1px solid #2a2a3a', borderRadius: '20px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: niche === n ? 600 : 400, transition: 'all 0.2s' }}
              onClick={() => setNiche(n)}>{n}</button>
          ))}
        </div>

        <button
          style={{ padding: '0.6rem 1.4rem', background: loading ? '#2a2a3a' : '#7c3aed', color: '#fff', border: 'none', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          onClick={() => fetchTrends()} disabled={loading}>
          {loading ? '⏳ Fetching live trends...' : '🔄 Refresh Trends'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📡</div>
          <p style={{ color: '#a855f7', fontSize: '1rem', fontWeight: 600 }}>Fetching live trends from Google...</p>
          <p style={{ color: '#555', fontSize: '0.82rem' }}>Generating AI content ideas too...</p>
        </div>
      )}

      {/* Results */}
      {!loading && trends.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.5rem' }}>

          {/* Trending Topics */}
          <div style={{ background: '#13131a', border: '1px solid #2a2a3a', borderRadius: '16px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>🔥 Trending Now — India</h3>
              <span style={{ fontSize: '0.7rem', color: '#555' }}>Google Trends</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {trends.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', padding: '0.7rem 0.8rem', background: '#1e1e2e', borderRadius: '10px', border: '1px solid #2a2a3a' }}>
                  <span style={{ color: i < 3 ? '#a855f7' : '#555', fontWeight: 800, fontSize: '0.88rem', minWidth: '22px', paddingTop: '1px' }}>#{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 0.15rem', fontSize: '0.88rem', color: '#fff', fontWeight: 500 }}>{t.title}</p>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#666' }}>{t.traffic}</p>
                    {t.relatedQueries?.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                        {t.relatedQueries.map((q, j) => (
                          <span key={j} style={{ fontSize: '0.65rem', background: '#7c3aed22', color: '#a855f7', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>{q}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Content Ideas */}
          <div style={{ background: '#13131a', border: '1px solid #2a2a3a', borderRadius: '16px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>💡 AI Ideas for <span style={{ color: '#a855f7' }}>{niche}</span></h3>
              <span style={{ fontSize: '0.7rem', color: '#555' }}>AI Generated</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {ideas.map((idea, i) => (
                <div key={i} style={{ padding: '0.9rem', background: '#1e1e2e', borderRadius: '12px', border: '1px solid #2a2a3a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fff', background: platformColor(idea.platform), padding: '0.2rem 0.6rem', borderRadius: '20px' }}>{idea.platform}</span>
                    <span style={{ fontSize: '0.7rem', color: '#666', fontStyle: 'italic' }}>{idea.angle}</span>
                  </div>
                  <p style={{ margin: '0 0 0.3rem', fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{idea.topic}</p>
                  <p style={{ margin: '0 0 0.8rem', fontSize: '0.8rem', color: '#a855f7', fontStyle: 'italic' }}>"{idea.hook}"</p>
                  {onGenerate && (
                    <button 
                      onClick={() => onGenerate(idea)}
                      style={{ width: '100%', padding: '0.4rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', fontFamily: 'inherit' }}>
                      ✍️ Generate with AI
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && trends.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#555' }}>
          <p style={{ fontSize: '2rem' }}>📡</p>
          <p>Click Refresh to fetch live trends</p>
        </div>
      )}
    </div>
  );
}