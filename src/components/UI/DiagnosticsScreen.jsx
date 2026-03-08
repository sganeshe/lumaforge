import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export const DiagnosticsScreen = ({ onBack, session, appPrefs, setAppPrefs, onSignIn }) => {
    const [presetCount, setPresetCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const MAX_PRESETS = 50;

    // --- NEW: Profile State ---
    const [profile, setProfile] = useState({ username: '', full_name: '', bio: '', avatar_url: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');

    useEffect(() => {
        const loadSystemData = async () => {
            if (session) {
                // 1. Fetch Quota
                const { count } = await supabase.from('projects')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', session.user.id);
                setPresetCount(count || 0);

                // 2. Fetch Profile Data
                const { data: profileData } = await supabase.from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                
                if (profileData) {
                    setProfile({
                        username: profileData.username || '',
                        full_name: profileData.full_name || '',
                        bio: profileData.bio || '',
                        avatar_url: profileData.avatar_url || ''
                    });
                }
            }
            setLoading(false);
        };

        loadSystemData();
    }, [session]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        onBack();
    };

    // --- NEW: Save Profile Logic ---
    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setStatusMsg('TRANSMITTING DATA...');

        // Clean up the username (remove @ and make lowercase for consistency)
        const cleanUsername = profile.username.replace('@', '').toLowerCase().trim();

        const { error } = await supabase.from('profiles').upsert({
            id: session.user.id,
            username: cleanUsername,
            full_name: profile.full_name,
            bio: profile.bio,
            avatar_url: profile.avatar_url,
            updated_at: new Date()
        });

        if (error) {
            // Postgres error code 23505 means unique violation (username taken)
            if (error.code === '23505') {
                setStatusMsg('[ ERROR: USERNAME ALREADY IN USE ]');
            } else {
                setStatusMsg(`[ ERROR: ${error.message} ]`);
            }
        } else {
            setProfile(prev => ({ ...prev, username: cleanUsername }));
            setStatusMsg('[ PROFILE UPDATED SUCCESSFULLY ]');
            // Clear success message after 3 seconds
            setTimeout(() => setStatusMsg(''), 3000);
        }
        setIsSaving(false);
    };

    return (
        <div className="terminal-page green-theme" style={{ overflowY: 'auto', height: '100vh' }}>
            <div className="terminal-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#000', borderBottom: '1px solid #0f0' }}>
                <button onClick={onBack} className="terminal-back-btn">← TERMINATE DIAGNOSTICS</button>
                <div className="terminal-title">SYS_DIAGNOSTICS</div>
            </div>

            <div className="terminal-content" style={{ paddingBottom: '100px', maxWidth: '800px', margin: '0 auto' }}>
                {loading ? (
                    <div className="typewriter-text" style={{ marginTop: '50px', textAlign: 'center' }}>GATHERING SYSTEM TELEMETRY...</div>
                ) : (
                    <div className="diag-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px', marginTop: '20px' }}>
                        
                        {/* 1. NEW OPERATIVE PROFILE SECTION */}
                        <div className="diag-panel" style={{ border: '1px solid #0f0', padding: '20px', background: 'rgba(0, 255, 0, 0.05)' }}>
                            <h3>[ OPERATIVE_PROFILE ]</h3>
                            {session ? (
                                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <label style={{ fontSize: '10px', color: '#0f0', letterSpacing: '1px' }}>NETWORK ALIAS (USERNAME)</label>
                                        <input 
                                            type="text" required maxLength={20}
                                            value={profile.username}
                                            onChange={(e) => setProfile({...profile, username: e.target.value})}
                                            placeholder="Enter alias without @"
                                            style={{ background: '#000', border: '1px solid #0f0', color: '#fff', padding: '10px', fontFamily: 'var(--font-mono)' }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', gap: '15px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                                            <label style={{ fontSize: '10px', color: '#0f0', letterSpacing: '1px' }}>DESIGNATION (FULL NAME)</label>
                                            <input 
                                                type="text" maxLength={50}
                                                value={profile.full_name}
                                                onChange={(e) => setProfile({...profile, full_name: e.target.value})}
                                                placeholder="Your display name"
                                                style={{ background: '#000', border: '1px solid #0f0', color: '#fff', padding: '10px', fontFamily: 'var(--font-mono)' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                                            <label style={{ fontSize: '10px', color: '#0f0', letterSpacing: '1px' }}>AVATAR URL</label>
                                            <input 
                                                type="url"
                                                value={profile.avatar_url}
                                                onChange={(e) => setProfile({...profile, avatar_url: e.target.value})}
                                                placeholder="https://..."
                                                style={{ background: '#000', border: '1px solid #0f0', color: '#fff', padding: '10px', fontFamily: 'var(--font-mono)' }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <label style={{ fontSize: '10px', color: '#0f0', letterSpacing: '1px' }}>BIOMETRIC DATA (BIO)</label>
                                        <textarea 
                                            maxLength={150} rows={3}
                                            value={profile.bio}
                                            onChange={(e) => setProfile({...profile, bio: e.target.value})}
                                            placeholder="System operations and creative focus..."
                                            style={{ background: '#000', border: '1px solid #0f0', color: '#fff', padding: '10px', fontFamily: 'var(--font-mono)', resize: 'vertical' }}
                                        />
                                        <div style={{ textAlign: 'right', fontSize: '10px', color: '#555' }}>
                                            {profile.bio.length} / 150
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: statusMsg.includes('ERROR') ? '#f00' : '#0f0' }}>
                                            {statusMsg}
                                        </span>
                                        <button type="submit" disabled={isSaving} style={{
                                            background: '#0f0', color: '#000', border: 'none', padding: '10px 20px', 
                                            fontWeight: 'bold', cursor: isSaving ? 'wait' : 'pointer', fontFamily: 'var(--font-mono)',
                                            letterSpacing: '1px'
                                        }}>
                                            {isSaving ? 'OVERWRITING...' : 'SAVE CONFIGURATION'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div style={{ color: '#888', marginTop: '15px' }}>AUTHENTICATION REQUIRED TO EDIT PROFILE.</div>
                            )}
                        </div>

                        {/* 2. NETWORK UPLINK & QUOTA */}
                        <div className="diag-panel" style={{ border: '1px solid #0f0', padding: '20px' }}>
                            <h3>[ NETWORK_UPLINK ]</h3>
                            {session ? (
                                <>
                                    <div className="diag-row" style={{ marginTop: '15px' }}><span>USER ID:</span> <span>{session.user.id}</span></div>
                                    <div className="diag-row"><span>EMAIL:</span> <span>{session.user.email}</span></div>
                                    <div className="diag-row"><span>STATUS:</span> <span style={{color: '#0f0', fontWeight: 'bold'}}>ONLINE</span></div>
                                    
                                    <div className="quota-box" style={{ marginTop: '20px', padding: '15px', background: '#000', border: '1px solid #333' }}>
                                        <div className="quota-label" style={{ marginBottom: '8px', fontSize: '12px' }}>
                                            UPLINK CAPACITY: {presetCount} / {MAX_PRESETS}
                                        </div>
                                        <div className="quota-bar-bg" style={{ height: '8px', background: '#111', border: '1px solid #222' }}>
                                            <div className="quota-bar-fill" style={{ height: '100%', width: `${(presetCount/MAX_PRESETS)*100}%`, background: presetCount >= MAX_PRESETS ? '#f00' : '#0f0', transition: 'width 0.5s' }} />
                                        </div>
                                        <p className="quota-subtext" style={{ fontSize: '10px', color: '#666', marginTop: '8px' }}>
                                            Free-tier allocations limit local accounts to 50 synchronized presets.
                                        </p>
                                    </div>

                                    <button 
                                        className="diag-toggle" 
                                        style={{ marginTop: '20px', width: '100%', border: '1px solid #f00', color: '#f00', background: 'transparent', padding: '10px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }} 
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
                                        style={{ width: '100%', border: '1px solid #0f0', color: '#0f0', background: 'transparent', padding: '10px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }} 
                                        onClick={onSignIn}
                                    >
                                        INITIALIZE UPLINK (SIGN IN)
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 3. HARDWARE CONFIGURATION */}
                        <div className="diag-panel" style={{ border: '1px solid #0f0', padding: '20px' }}>
                            <h3>[ HARDWARE_CONFIG ]</h3>
                            <p className="quota-subtext" style={{marginBottom: '20px', color: '#888', fontSize: '11px', lineHeight: '1.4' }}>
                                Adjusting these parameters may improve performance on low-end silicon. Disabling animations instantly strips all transitions from the UI.
                            </p>
                            
                            <div className="toggle-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', letterSpacing: '1px' }}>UI ANIMATIONS</span>
                                <button 
                                    className={`diag-toggle ${appPrefs.animations ? 'active' : ''}`}
                                    style={{
                                        background: appPrefs.animations ? 'rgba(0, 255, 0, 0.2)' : 'transparent',
                                        color: appPrefs.animations ? '#0f0' : '#555',
                                        border: `1px solid ${appPrefs.animations ? '#0f0' : '#333'}`,
                                        padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 'bold'
                                    }}
                                    onClick={() => setAppPrefs(p => ({...p, animations: !p.animations}))}
                                >
                                    {appPrefs.animations ? 'ENABLED' : 'DISABLED'}
                                </button>
                            </div>
                        </div>
                        
                    </div>
                )}
            </div>
        </div>
    );
};