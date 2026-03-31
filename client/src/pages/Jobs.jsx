import { useState, useEffect } from 'react';
import axios from 'axios';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function Jobs() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const r = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);

  useEffect(() => { scanJobs(); }, []);

  const scanJobs = async () => {
    setLoading(true); setData(null); setError(null);
    try {
      const res = await axios.get(`${API_URL}/api/jobs/scan/${user.id}`);
      setData(res.data);
    } catch (err) {
      const msg = err.response?.data?.message;
      if (msg === 'AUTO_APPLY_OFF') setError({ type: 'toggle', text: err.response.data.hint });
      else if (msg === 'NO_RESUME') setError({ type: 'resume', text: err.response.data.hint });
      else setError({ type: 'generic', text: 'Job scan failed. Try again.' });
    }
    setLoading(false);
  };

  const goToPlatforms = () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'platforms' }));

  return (
    <div style={{ flex: 1, padding: isMobile ? '1rem' : '1.5rem', overflowY: 'auto', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 0.3rem', fontSize: isMobile ? '1.2rem' : '1.4rem' }}>💼 AI Job Scanner</h2>
          <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>
            {data?.resumeFound ? '✅ Scanning based on your uploaded resume' : loading ? '🧠 Analyzing resume + scanning job market...' : 'Find jobs matched to your resume using AI'}
          </p>
        </div>
        <button style={{ padding: '0.6rem 1.2rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
          onClick={scanJobs} disabled={loading}>{loading ? '⏳ Scanning...' : '🔄 Re-scan'}</button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '4rem', background: '#13131a', borderRadius: '16px', border: '1px solid #2a2a3a' }}>
          <p style={{ fontSize: '3rem', margin: '0 0 1rem' }}>🧠</p>
          <p style={{ color: '#7c3aed', fontSize: '1.1rem', margin: '0 0 0.5rem' }}>Reading your resume + scanning job market...</p>
          <p style={{ color: '#555', fontSize: '0.85rem', margin: 0 }}>This takes a few seconds...</p>
        </div>
      )}

      {error && !loading && (
        <div style={{ textAlign: 'center', padding: '4rem', background: '#13131a', borderRadius: '16px', border: '1px solid #2a2a3a' }}>
          <p style={{ fontSize: '3rem', margin: '0 0 1rem' }}>{error.type === 'toggle' ? '🔴' : error.type === 'resume' ? '📄' : '❌'}</p>
          <p style={{ color: '#aaa', fontSize: '1rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>{error.text}</p>
          <button style={{ padding: '0.7rem 1.5rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
            onClick={error.type === 'generic' ? scanJobs : goToPlatforms}>
            {error.type === 'generic' ? '🔄 Try Again' : '→ Go to Platforms'}
          </button>
        </div>
      )}

      {data && !loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            {[{ title: '🎯 Detected Skills', items: data.skills, color: '#7c3aed', bg: '#7c3aed22', border: '#7c3aed44', textColor: '#c4b5fd' },
              { title: '🔍 Searching For', items: data.jobTitles, color: '#0077b5', bg: '#0077b522', border: '#0077b544', textColor: '#60a5fa' }
            ].map(({ title, items, bg, border, textColor }) => (
              <div key={title} style={{ background: '#13131a', border: '1px solid #2a2a3a', borderRadius: '12px', padding: '1rem' }}>
                <h4 style={{ margin: '0 0 0.8rem', fontSize: '0.9rem', color: '#7c3aed' }}>{title}</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {items?.map((item, i) => (
                    <span key={i} style={{ padding: '0.3rem 0.7rem', background: bg, border: `1px solid ${border}`, borderRadius: '20px', fontSize: '0.78rem', color: textColor }}>{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#fff' }}>📋 Matching Jobs ({data.jobs?.length || 0} found)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {data.jobs?.map((job, i) => (
              <div key={i} style={{ background: '#13131a', border: '1px solid #2a2a3a', borderRadius: '14px', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ margin: '0 0 0.2rem', fontSize: '0.95rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</h4>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#888' }}>🏢 {job.company}</p>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#00ff88', background: '#00ff8811', padding: '0.2rem 0.5rem', borderRadius: '10px', whiteSpace: 'nowrap', flexShrink: 0 }}>{job.posted}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#888' }}>📍 {job.location}</p>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#aaa', lineHeight: 1.5, flex: 1 }}>{job.description}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#555' }}>via {job.via}</span>
                  <a href={job.applyLink} target="_blank" rel="noreferrer" style={{ padding: '0.5rem 1rem', background: '#0077b5', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700 }}>Apply Now →</a>
                </div>
              </div>
            ))}
          </div>

          {data.jobs?.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#888', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <p style={{ fontSize: '2rem' }}>🔍</p>
              <p>No jobs found. Try updating your resume with more skills.</p>
              <button style={{ padding: '0.7rem 1.5rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }} onClick={scanJobs}>🔄 Try Again</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}