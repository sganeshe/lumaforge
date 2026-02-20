import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export const DiagnosticsScreen = ({ onBack, session, appPrefs, setAppPrefs, onSignIn }) => {
    const [presetCount, setPresetCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const MAX_PRESETS = 50;

    useEffect(() => {
        if (session) {
            supabase.from('projects').select('*', { count: 'exact', head: true })
                .eq('user_id', session.user.id)
                .then(({ count }) => {
                    setPresetCount(count || 0);
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, [session]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        onBack();
    };

    return (
        <div className="terminal-page green-theme">
            <div className="terminal-header">
                <button onClick={onBack} className="terminal-back-btn">← TERMINATE DIAGNOSTICS</button>
                <div className="terminal-title">SYS_DIAGNOSTICS</div>
            </div>

            <div className="terminal-content">
                <div className="diag-grid">
                    
                    <div className="diag-panel">
                        <h3>NETWORK UPLINK</h3>
                        {session ? (
                            <>
                                <div className="diag-row"><span>USER ID:</span> <span>{session.user.id.slice(0, 8)}...</span></div>
                                <div className="diag-row"><span>EMAIL:</span> <span>{session.user.email}</span></div>
                                <div className="diag-row"><span>STATUS:</span> <span style={{color: '#0f0'}}>ONLINE</span></div>
                                
                                <div className="quota-box">
                                    <div className="quota-label">UPLINK CAPACITY: {presetCount} / {MAX_PRESETS}</div>
                                    <div className="quota-bar-bg">
                                        <div className="quota-bar-fill" style={{ width: `${(presetCount/MAX_PRESETS)*100}%`, background: presetCount >= MAX_PRESETS ? '#f00' : '#0f0' }} />
                                    </div>
                                    <p className="quota-subtext">Free-tier allocations limit local accounts to 50 synchronized presets.</p>
                                </div>

                                <button 
                                    className="diag-toggle" 
                                    style={{ marginTop: '25px', width: '100%', borderColor: '#f00', color: '#f00' }} 
                                    onClick={handleSignOut}
                                >
                                    TERMINATE UPLINK (SIGN OUT)
                                </button>
                            </>
                        ) : (
                            <div style={{ marginTop: '20px' }}>
                                <div style={{ color: '#888', marginBottom: '20px' }}>UPLINK OFFLINE. NO SESSION DETECTED.</div>
                                <button 
                                    className="diag-toggle" 
                                    style={{ width: '100%', borderColor: '#0f0', color: '#0f0' }} 
                                    onClick={onSignIn}
                                >
                                    INITIALIZE UPLINK (SIGN IN)
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="diag-panel">
                        <h3>HARDWARE CONFIGURATION</h3>
                        <p className="quota-subtext" style={{marginBottom: 20}}>Adjusting these parameters may improve performance on low-end silicon. Disabling animations instantly strips all transitions from the UI.</p>
                        
                        <div className="toggle-row">
                            <span>UI ANIMATIONS</span>
                            <button 
                                className={`diag-toggle ${appPrefs.animations ? 'active' : ''}`}
                                onClick={() => setAppPrefs(p => ({...p, animations: !p.animations}))}
                            >
                                {appPrefs.animations ? 'ENABLED' : 'DISABLED'}
                            </button>
                        </div>
                    </div>
                    
                </div>
            </div>
        </div>
    );
};