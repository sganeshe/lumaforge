import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export const LeftSidebar = ({ 
    onHome, 
    onExportImage, 
    onExportCube, 
    onLoadPreset, 
    onImportFile, 
    session, 
    setShowAuth, 
    currentSettings,
    onSaveToCloud
}) => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('CLOUD'); 

    useEffect(() => {
        if (session && activeTab === 'CLOUD') {
            setLoading(true);
            supabase.from('projects').select('*').order('created_at', { ascending: false })
                .then(({ data }) => {
                    setProjects(data || []);
                    setLoading(false);
                });
        }
    }, [session, activeTab]);

    const handleDeletePreset = async (e, id) => {
        e.stopPropagation();
        
        if (!window.confirm("SYSTEM WARNING: Delete this preset permanently?")) return;

        const { error } = await supabase.from('projects').delete().eq('id', id);
        
        if (error) {
            alert("DELETE FAILED: " + error.message);
        } else {
            setProjects(prevProjects => prevProjects.filter(p => p.id !== id));
        }
    };

    // <-- UPLINK ADDITION: Publish logic
    const handlePublishToUplink = async () => {
        if (!session) {
            setShowAuth();
            return;
        }
        
        const presetName = prompt("NAME YOUR PRESET FOR THE UPLINK:");
        if (!presetName) return;

        alert("INITIATING UPLINK UPLOAD. PLEASE WAIT...");

        try {
            // NOTE: We need to get the canvas image as a Blob.
            // This assumes your canvas has an ID of 'luma-stage-canvas'. 
            // If your canvas ID is different, update the document.getElementById query below!
            const canvas = document.getElementById('luma-stage-canvas'); 
            
            if (!canvas) {
                alert("SYSTEM ERROR: Cannot locate active canvas for export.");
                return;
            }

            canvas.toBlob(async (blob) => {
                if (!blob) throw new Error("Failed to generate image buffer.");

                const fileName = `uplink_${session.user.id}_${Date.now()}.png`;

                // Upload to Supabase Storage
                const { error: uploadError } = await supabase.storage
                    .from('uplink_images')
                    .upload(fileName, blob, { contentType: 'image/png' });

                if (uploadError) throw uploadError;

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('uplink_images')
                    .getPublicUrl(fileName);

                // Save to database
                const { error: dbError } = await supabase
                    .from('uplink_posts')
                    .insert([{
                        user_id: session.user.id,
                        author_name: session.user.email.split('@')[0], 
                        preset_name: presetName,
                        image_url: publicUrl,
                        settings: currentSettings 
                    }]);

                if (dbError) throw dbError;
                alert("UPLOAD COMPLETE. PRESET IS LIVE ON THE UPLINK.");
            }, 'image/png');

        } catch (err) {
            alert("UPLOAD FAILED: " + err.message);
        }
    };

    return (
        <div className="left-sidebar">
            
            <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px' }}>
                <button 
                    onClick={onHome} 
                    className="nav-btn warning" 
                    style={{ width: 'auto', padding: '8px 12px', margin: 0, textAlign: 'center' }}
                    title="Exit to Home Screen"
                >
                    ← SHELL
                </button>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <img src="/lf_orange.png" alt="LUMAFORGE" style={{ height: '22px', objectFit: 'contain' }} />
                    <div className="version" style={{ marginTop: '4px', fontSize: '8px' }}>v1.0.0</div>
                </div>
            </div>

            <div className="library-tabs">
                <button className={activeTab === 'CLOUD' ? 'active' : ''} onClick={() => setActiveTab('CLOUD')}>CLOUD</button>
                <button className={activeTab === 'LOCAL' ? 'active' : ''} onClick={() => setActiveTab('LOCAL')}>LOCAL</button>
            </div>

            <div className="preset-list">
                {activeTab === 'CLOUD' && (
                    <>
                        {!session ? (
                            <div className="empty-state">
                                <p>OFFLINE MODE</p>
                                <button onClick={setShowAuth} className="accent-btn">CONNECT UPLINK</button>
                            </div>
                        ) : (
                            <>
                                <button onClick={onSaveToCloud} className="new-preset-btn">+ SAVE LOOK (PRIVATE)</button>
                                
                                <button onClick={handlePublishToUplink} className="new-preset-btn">
                                    ↑ PUBLISH TO UPLINK
                                </button>
                                
                                <div style={{height: '20px'}}></div>

                                {loading ? <div className="loading-text">SYNCING...</div> : 
                                    projects.map(p => (
                                        <div key={p.id} className="preset-item" onClick={() => onLoadPreset(p.settings)}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div className="preset-name">{p.name}</div>
                                                    <div className="preset-date">{new Date(p.created_at).toLocaleDateString()}</div>
                                                </div>
                                                <button 
                                                    onClick={(e) => handleDeletePreset(e, p.id)}
                                                    style={{ 
                                                        background: 'transparent', 
                                                        border: 'none', 
                                                        color: '#666', 
                                                        cursor: 'pointer', 
                                                        padding: '4px 8px', 
                                                        fontSize: '12px',
                                                        fontFamily: 'var(--font-mono)',
                                                        transition: 'color 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.target.style.color = '#ff4444'}
                                                    onMouseLeave={(e) => e.target.style.color = '#666'}
                                                    title="Delete Preset"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                }
                            </>
                        )}
                    </>
                )}
                
                {activeTab === 'LOCAL' && (
                     <div className="empty-state">
                        <button onClick={onImportFile} className="nav-btn">IMPORT FILE</button>
                        <div style={{height: 10}} />
                        <button onClick={onExportCube} className="nav-btn">EXPORT .CUBE</button>
                     </div>
                )}
            </div>

            <div className="sidebar-footer">
                <button onClick={onExportImage} className="export-btn-large">
                    EXPORT IMAGE
                </button>
                <div className="status-bar">
                    <div className={`status-dot ${session ? 'online' : 'offline'}`} />
                    {session ? 'SYSTEM ONLINE' : 'LOCAL ONLY'}
                </div>
            </div>
        </div>
    );
};