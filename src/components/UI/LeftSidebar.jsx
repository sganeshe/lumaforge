import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { generateExportBlob } from '../Engine/ExportSystem';

export const LeftSidebar = ({ 
    onHome, 
    onExportImage, 
    onExportCube, 
    onLoadPreset, 
    onImportFile, 
    session, 
    setShowAuth, 
    currentSettings,
    onSaveToCloud,
    imageSrc
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

    // --- COMPRESSION ENGINE ---
const compressImageForWeb = (imageSource, maxWidth = 1920, quality = 0.8) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        img.onload = () => {
            // Calculate new dimensions while maintaining aspect ratio
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            // Draw to a temporary canvas
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            // Draw the image onto the canvas at the new size
            ctx.drawImage(img, 0, 0, width, height);
            
            // Export as a highly compressed WebP blob
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Canvas compression failed."));
            }, 'image/webp', quality);
        };
        
        img.onerror = () => reject(new Error("Failed to load image for compression."));
        img.src = imageSource;
    });
};

    // <-- UPLINK ADDITION: Publish logic
    const publishToUplink = async (session, rawImageSrc, finalGradedBlob, settings, caption = "") => {
    if (!session) return alert("UPLINK OFFLINE: Authentication required.");

    try {
        setStatusMsg("COMPRESSING PAYLOADS...");

        // ---------------------------------------------------------
        // STEP 1: COMPRESS BOTH IMAGES IN THE BROWSER (Fast!)
        // ---------------------------------------------------------
        // We compress the raw original down to 1080p WebP (good enough for the background swap)
        const compressedRawBlob = await compressImageForWeb(rawImageSrc, 1080, 0.7);
        
        // We compress the final grade slightly higher quality (1440p WebP) because it's the main feed image
        const finalImageURL = URL.createObjectURL(finalGradedBlob); 
        const compressedGradedBlob = await compressImageForWeb(finalImageURL, 1440, 0.85);

        setStatusMsg("TRANSMITTING TO CLOUD...");

        // ---------------------------------------------------------
        // STEP 2: UPLOAD TO STORAGE (Now 10x faster)
        // ---------------------------------------------------------
        const rawFileName = `${session.user.id}/raw_${Date.now()}.webp`;
        const gradedFileName = `${session.user.id}/graded_${Date.now()}.webp`;

        // Upload Raw
        const { error: rawUploadErr } = await supabase.storage
            .from('uplink_images')
            .upload(rawFileName, compressedRawBlob, { contentType: 'image/webp' });
        if (rawUploadErr) throw rawUploadErr;

        // Upload Graded
        const { error: gradedUploadErr } = await supabase.storage
            .from('uplink_images')
            .upload(gradedFileName, compressedGradedBlob, { contentType: 'image/webp' });
        if (gradedUploadErr) throw gradedUploadErr;

        // Get Public URLs
        const rawImageUrl = supabase.storage.from('uplink_images').getPublicUrl(rawFileName).data.publicUrl;
        const finalImageUrl = supabase.storage.from('uplink_images').getPublicUrl(gradedFileName).data.publicUrl;

        // ---------------------------------------------------------
        // STEP 3: WRITE TO RELATIONAL DATABASE
        // ---------------------------------------------------------
        const { error: dbError } = await supabase.from('uplink_posts').insert([{
            user_id: session.user.id,
            original_image_url: rawImageUrl, 
            graded_image_url: finalImageUrl, 
            settings: settings, // The DB holds the math, so we don't need PNG metadata in the cloud!
            caption: caption
        }]);

        if (dbError) throw dbError;

        alert("PAYLOAD PUBLISHED TO THE UPLINK.");

    } catch (error) {
        console.error("TRANSMISSION FAILED:", error);
        alert(`UPLOAD FAILED: ${error.message}`);
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