import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export const AuthModal = ({ onClose, onLogin }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setMessage(error.message);
    else setMessage('CHECK YOUR EMAIL FOR THE LOGIN LINK');
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, 
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: 300, background: '#0a0a0a', border: '1px solid #333', 
        padding: 30, textAlign: 'center', boxShadow: '0 20px 50px #000'
      }}>
        <div style={{fontSize: 20, fontWeight: 900, marginBottom: 20, color: '#fff'}}>SYSTEM_ACCESS</div>
        <input 
          type="email" placeholder="OPERATOR_EMAIL" value={email} onChange={e=>setEmail(e.target.value)}
          style={{
            width: '100%', padding: '12px', background: '#111', border: '1px solid #333', 
            color: '#fff', fontFamily: 'monospace', marginBottom: 15, outline: 'none'
          }}
        />
        <button 
          onClick={handleLogin} disabled={loading}
          style={{
            width: '100%', padding: '12px', background: 'var(--accent)', border: 'none', 
            fontWeight: 800, cursor: 'pointer', opacity: loading ? 0.5 : 1
          }}
        >
          {loading ? 'CONNECTING...' : 'SEND MAGIC LINK'}
        </button>
        {message && <div style={{marginTop: 15, fontSize: 10, color: 'var(--accent)', fontFamily: 'monospace'}}>{message}</div>}
        <button onClick={onClose} style={{marginTop: 15, background: 'none', border: 'none', color: '#666', fontSize: 10, cursor: 'pointer', textDecoration: 'underline'}}>CANCEL</button>
      </div>
    </div>
  );
};

export const CloudMenu = ({ session, settings, imageSrc, onLoadProject, onClose }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('LIST');
  useEffect(() => {
    if (session) fetchProjects();
  }, [session]);

  const fetchProjects = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (!error) setProjects(data);
    setLoading(false);
  };

  const handleSave = async () => {
    const name = prompt("NAME YOUR PRESET:");
    if (!name) return;
    setLoading(true);

    const { error } = await supabase.from('projects').insert([{
      user_id: session.user.id,
      name: name,
      settings: settings,
    }]);

    if (!error) {
        alert("UPLOAD COMPLETE");
        fetchProjects();
        setView('LIST');
    } else {
        alert("UPLOAD FAILED: " + error.message);
    }
    setLoading(false);
  };

  const handleLoad = (proj) => {
    if (window.confirm("Overwrite current workspace?")) {
        onLoadProject(proj.settings);
        onClose();
    }
  };

  return (
    <div style={{
        position: 'absolute', bottom: 60, right: 360, width: 300, 
        background: '#0a0a0a', border: '1px solid #333', zIndex: 100,
        boxShadow: '0 10px 40px #000'
    }}>
        <div style={{padding: 15, borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between'}}>
            <span style={{fontWeight: 'bold', fontSize: 12}}>CLOUD_SYNC</span>
            <span style={{fontSize: 10, color: '#666'}}>{session.user.email}</span>
        </div>
        
        <div style={{maxHeight: 300, overflowY: 'auto', padding: 10}}>
            {loading && <div style={{padding:10, textAlign:'center', color:'#666'}}>SYNCING...</div>}
            
            {!loading && projects.map(p => (
                <div key={p.id} onClick={() => handleLoad(p)} style={{
                    padding: 10, border: '1px solid #222', marginBottom: 5, 
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                    fontFamily: 'monospace', fontSize: 11
                }} className="project-item">
                    <span>{p.name}</span>
                    <span style={{color: '#666'}}>{new Date(p.created_at).toLocaleDateString()}</span>
                </div>
            ))}
        </div>

        <div style={{padding: 10, display: 'flex', gap: 10, borderTop: '1px solid #222'}}>
            <button onClick={handleSave} style={{flex:1, padding: 10, background: '#222', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight:'bold'}}>SAVE CURRENT</button>
            <button onClick={onClose} style={{padding: 10, background: 'none', color: '#666', border: '1px solid #333', cursor: 'pointer', fontSize: 10}}>CLOSE</button>
        </div>
    </div>
  );
};