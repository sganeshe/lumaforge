import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export const LeftSidebar = ({ 
    onHome, 
    onExportImage, 
    onExportCube, 
    onImportFile, 
    onSaveToCloud, 
    onLoadPreset,
    session, 
    setShowAuth 
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('LOCAL');
    const [exportFormat, setExportFormat] = useState('jpeg');
    
    // Cloud State
    const [presets, setPresets] = useState([]);
    const [isLoadingPresets, setIsLoadingPresets] = useState(false);

    // Fetch presets when CLOUD tab is clicked and user is logged in
    useEffect(() => {
        if (activeTab === 'CLOUD' && session) {
            fetchPresets();
        }
    }, [activeTab, session]);

    const fetchPresets = async () => {
        setIsLoadingPresets(true);
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('id, name, created_at, settings')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            setPresets(data || []);
        } catch (error) {
            console.error("[LUMAFORGE_UPLINK] Failed to sync presets:", error.message);
        } finally {
            setIsLoadingPresets(false);
        }
    };

    const handleLoad = (preset) => {
        if (window.confirm(`Initialize preset "${preset.name}"? Unsaved local changes will be lost.`)) {
            onLoadPreset(preset.settings);
            setIsMenuOpen(false); // Auto-close drawer on mobile
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation(); // Prevent the preset from loading when clicking delete
        if (window.confirm("Permanently delete this preset from the Uplink?")) {
            await supabase.from('projects').delete().eq('id', id);
            fetchPresets(); // Refresh the list
        }
    };

    return (
        <div className={`left-sidebar ${isMenuOpen ? 'menu-open' : ''}`}>
            {/* TOP BAR / HEADER */}
            <div className="sidebar-header">
                <button className="nav-btn shell-btn" onClick={onHome}>← SHELL</button>
                <div className="logo-container">
                    <img src="/lf_orange.png" alt="LUMAFORGE" />
                    <span className="version-tag">v1.3.0</span>
                </div>
                
                {/* HAMBURGER TOGGLE */}
                <button className="mobile-menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                    {isMenuOpen ? '✕ CLOSE' : '☰ MENU'}
                </button>
            </div>

            {/* DRAWER CONTENT */}
            <div className="sidebar-content">
                <div className="sidebar-tabs">
                    <button className={activeTab === 'CLOUD' ? 'active' : ''} onClick={() => setActiveTab('CLOUD')}>CLOUD</button>
                    <button className={activeTab === 'LOCAL' ? 'active' : ''} onClick={() => setActiveTab('LOCAL')}>LOCAL</button>
                </div>

                <div className="sidebar-scroll-area">
                    {activeTab === 'CLOUD' && (
                        <div className="sidebar-section">
                            {!session ? (
                                <>
                                    <div className="status-label">OFFLINE MODE</div>
                                    <button className="primary-btn" onClick={setShowAuth}>CONNECT UPLINK</button>
                                </>
                            ) : (
                                <>
                                    <div className="status-label" style={{color: '#00ff00'}}>UPLINK ACTIVE</div>
                                    <button className="primary-btn" onClick={() => { 
                                        onSaveToCloud(); 
                                        setTimeout(fetchPresets, 2000); // Auto-refresh list after saving
                                    }}>
                                        SAVE PRESET TO CLOUD
                                    </button>

                                    <div className="sidebar-divider" style={{margin: '15px 0'}} />
                                    <div className="status-label" style={{textAlign: 'left', color: '#888'}}>SAVED PRESETS</div>
                                    
                                    <div className="preset-list">
                                        {isLoadingPresets ? (
                                            <div className="status-label" style={{marginTop: 20}}>SYNCING DATA...</div>
                                        ) : presets.length === 0 ? (
                                            <div className="status-label" style={{marginTop: 20, color: '#444'}}>NO PRESETS FOUND</div>
                                        ) : (
                                            presets.map(p => (
                                                <div key={p.id} className="preset-item" onClick={() => handleLoad(p)}>
                                                    <div className="preset-info">
                                                        <span className="preset-name">{p.name}</span>
                                                        <span className="preset-date">{new Date(p.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <button className="preset-delete" onClick={(e) => handleDelete(e, p.id)} title="Delete">✕</button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'LOCAL' && (
                        <div className="sidebar-section">
                            <button className="secondary-btn" onClick={onImportFile}>IMPORT IMAGE</button>
                            <button className="secondary-btn" onClick={onExportCube} style={{marginTop: 10}}>EXPORT .CUBE (LUT)</button>
                        </div>
                    )}
                </div>

                {/* FOOTER: EXPORT CONTROLS */}
                <div className="sidebar-footer">
                    <div className="format-toggles">
                        <button className={exportFormat === 'jpeg' ? 'active' : ''} onClick={() => setExportFormat('jpeg')}>.JPEG</button>
                        <button className={exportFormat === 'png' ? 'active' : ''} onClick={() => setExportFormat('png')}>.PNG</button>
                    </div>
                    <div className="status-label" style={{marginBottom: 15}}>
                        {exportFormat === 'png' ? '[ METADATA ENABLED ]' : '[ COMPRESSION ENABLED ]'}
                    </div>
                    
                    <button className="primary-btn" onClick={() => {
                        onExportImage(exportFormat);
                        setIsMenuOpen(false);
                    }}>
                        EXPORT IMAGE
                    </button>
                    <div className="status-label" style={{marginTop: 8}}>● LOCAL ONLY</div>
                </div>
            </div>
        </div>
    );
};