import React, { useState } from 'react';

export const LeftSidebar = ({ 
    onHome, 
    onExportImage, 
    onExportCube, 
    onImportFile, 
    onSaveToCloud, 
    session, 
    setShowAuth 
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('LOCAL');
    const [exportFormat, setExportFormat] = useState('jpeg');

    return (
        <div className={`left-sidebar ${isMenuOpen ? 'menu-open' : ''}`}>
            {/* TOP BAR / HEADER */}
            <div className="sidebar-header">
                <button className="nav-btn shell-btn" onClick={onHome}>← SHELL</button>
                <div className="logo-container">
                    <img src="/lf_orange.png" alt="LUMAFORGE" />
                    <span className="version-tag">v1.2.0</span>
                </div>
                
                {/* HAMBURGER TOGGLE (Only visible on mobile) */}
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
                                    <button className="primary-btn" onClick={onSaveToCloud}>SAVE PRESET TO CLOUD</button>
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

                {/* NEW FOOTER: PINNED TO BOTTOM */}
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
                        setIsMenuOpen(false); // Auto-close menu on mobile
                    }}>
                        EXPORT IMAGE
                    </button>
                    <div className="status-label" style={{marginTop: 8}}>● LOCAL ONLY</div>
                </div>
            </div>
        </div>
    );
};