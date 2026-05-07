import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
// --- NEW: Import your LUT generator ---
import { generateLutFile } from '../Engine/LUTSystem';

export const UplinkFeed = ({ onBack, onFork, session }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pendingSettings, setPendingSettings] = useState(null);
    const fileInputRef = useRef(null);
    
    // Sorting State
    const [sortBy, setSortBy] = useState('latest'); // 'latest', 'popular', 'oldest'

    // Re-fetch whenever the sortBy state changes
    useEffect(() => {
        fetchFeed(sortBy);
    }, [sortBy]);

    // Dynamic Supabase Query Builder
    const fetchFeed = async (currentSort) => {
        setLoading(true);
        
        let query = supabase.from('uplink_posts').select('*');

        if (currentSort === 'popular') {
            query = query.order('upvotes_count', { ascending: false }).order('created_at', { ascending: false });
        } else if (currentSort === 'oldest') {
            query = query.order('created_at', { ascending: true });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        const { data, error } = await query.limit(50);
        
        if (!error && data) setPosts(data);
        setLoading(false);
    };

    const handleLike = async (post) => {
        if (!session) return alert("UPLINK ERROR: Login required to upvote.");
        
        const userId = session.user.id;
        const hasLiked = post.upvoted_by && post.upvoted_by.includes(userId);
        
        let newLikedBy = post.upvoted_by || [];
        let newLikesCount = post.upvotes_count || 0;

        if (hasLiked) {
            newLikedBy = newLikedBy.filter(id => id !== userId); 
            newLikesCount = Math.max(0, newLikesCount - 1);
        } else {
            newLikedBy = [...newLikedBy, userId]; 
            newLikesCount += 1;
        }

        setPosts(posts.map(p => p.id === post.id ? { ...p, upvotes_count: newLikesCount, upvoted_by: newLikedBy } : p));
        
        await supabase
            .from('uplink_posts')
            .update({ upvotes_count: newLikesCount, upvoted_by: newLikedBy })
            .eq('id', post.id);
    };

    const initiateFork = (settings) => {
        setPendingSettings(settings);
        fileInputRef.current.click();
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        onFork(pendingSettings, file);
        setPendingSettings(null);
        e.target.value = null; 
    };

    // --- NEW: DOWNLOAD AS .CUBE LUT ---
    const handleDownloadCube = (e, post) => {
        e.stopPropagation();
        try {
            // Parse settings safely
            const parsedSettings = typeof post.settings === 'string' 
                ? JSON.parse(post.settings) 
                : post.settings;

            // Generate LUT content using your engine math
            const content = generateLutFile(parsedSettings);
            
            // Trigger browser download
            const blob = new Blob([content], { type: 'text/plain' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            
            // Format a clean filename
            const cleanName = (post.preset_name || 'untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            link.download = `lumaforge_${cleanName}.cube`;
            link.click();
        } catch (err) {
            console.error("Failed to generate LUT:", err);
            alert("ERROR: Could not compile mathematical data into a .cube file.");
        }
    };

    // --- BULLETPROOF SHARE LINK GENERATOR ---
    const handleCopyLink = async (e, id) => {
        e.preventDefault();
        e.stopPropagation(); 
        
        const link = `${window.location.origin}/share/${id}`;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(link);
                alert("SHARE LINK COPIED TO CLIPBOARD!");
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = link;
                textArea.style.position = "fixed";
                textArea.style.top = "-9999px";
                textArea.style.left = "-9999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                
                if (successful) {
                    alert("SHARE LINK COPIED TO CLIPBOARD (FALLBACK)!");
                } else {
                    alert("Copy failed. Your browser blocked access.");
                }
            }
        } catch (err) {
            console.error("Clipboard Error:", err);
            alert(`MANUAL COPY REQUIRED: ${link}`);
        }
    };

    return (
        <div className="terminal-page amber-theme">
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept="image/*" 
                style={{ display: 'none' }} 
            />

            <div className="terminal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={onBack} className="terminal-back-btn">← TERMINATE UPLINK</button>
                <div className="terminal-title">THE_UPLINK_v1.1 (COMMUNITY_FEED)</div>
            </div>

            <div className="terminal-content" style={{ padding: '20px', paddingBottom: '100px', maxWidth: '1200px', margin: '0 auto' }}>
                
                {/* Filter UI Toolbar */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', borderBottom: '1px solid #333', paddingBottom: '15px', alignItems: 'center' }}>
                    <span style={{ color: '#666', fontSize: '12px', marginRight: '10px', fontFamily: 'var(--font-mono)' }}>SORT DATA STREAM:</span>
                    
                    {['latest', 'popular', 'oldest'].map(mode => (
                        <button
                            key={mode}
                            onClick={() => setSortBy(mode)}
                            style={{
                                background: sortBy === mode ? '#ffb800' : 'transparent',
                                color: sortBy === mode ? '#000' : '#ffb800',
                                border: `1px solid ${sortBy === mode ? 'var(--amber)' : '#ffb800'}`,
                                padding: '6px 14px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-mono)',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                transition: 'all 0.2s',
                                fontWeight: sortBy === mode ? 'bold' : 'normal'
                            }}
                        >
                            {mode}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="typewriter-text">SYNCING WITH GLOBAL MAINFRAME...</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                        {posts.map(post => {
                            const isLikedByMe = session && post.upvoted_by && post.upvoted_by.includes(session.user.id);
                            
                            return (
                                <div key={post.id} style={{ background: '#111', border: '1px solid #333', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                    
                                    <div style={{ height: '280px', width: '100%', overflow: 'hidden', position: 'relative', backgroundColor: '#000' }}>
                                        <img 
                                            src={post.image_url} 
                                            alt={post.preset_name} 
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                        />
                                        
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', opacity: 0, transition: 'opacity 0.2s', cursor: 'pointer' }}
                                             onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                             onMouseLeave={e => e.currentTarget.style.opacity = 0}
                                        >
                                            <button 
                                                onClick={() => initiateFork(post.settings)}
                                                style={{
                                                    padding: '12px 24px',
                                                    fontSize: '12px',
                                                    letterSpacing: '2px',
                                                    fontWeight: 'bold',
                                                    color: 'var(--amber)',
                                                    background: 'rgba(0, 0, 0, 0.75)',
                                                    border: '1px solid var(--amber)',
                                                    borderRadius: '4px',
                                                    backdropFilter: 'blur(4px)',
                                                    cursor: 'pointer',
                                                    fontFamily: 'var(--font-mono)'
                                                }}
                                            >
                                                FORK & REMIX
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ padding: '15px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ color: 'var(--amber)', fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                                                    {post.preset_name ? post.preset_name.toUpperCase() : 'UNTITLED_PRESET'}
                                                </div>
                                                <div style={{ color: '#666', fontSize: '11px', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                                                    BY: {post.author_name}
                                                </div>
                                            </div>
                                            
                                            {/* ACTION BUTTONS */}
                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                
                                                {/* DOWNLOAD LUT BUTTON */}
                                                <button 
                                                    onClick={(e) => handleDownloadCube(e, post)}
                                                    title="Download .cube LUT"
                                                    style={{
                                                        background: 'transparent',
                                                        border: '1px solid #444',
                                                        color: '#888',
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        transition: 'all 0.2s',
                                                        height: '26px',
                                                        width: '26px'
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#888'; }}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                        <polyline points="7 10 12 15 17 10"></polyline>
                                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                                    </svg>
                                                </button>

                                                {/* SHARE BUTTON */}
                                                <button 
                                                    onClick={(e) => handleCopyLink(e, post.id)}
                                                    title="Copy Share Link"
                                                    style={{
                                                        background: 'transparent',
                                                        border: '1px solid #444',
                                                        color: '#888',
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        transition: 'all 0.2s',
                                                        height: '26px',
                                                        width: '26px'
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#888'; }}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                                                    </svg>
                                                </button>

                                                {/* UPVOTE BUTTON */}
                                                <button 
                                                    onClick={() => handleLike(post)}
                                                    title="Upvote"
                                                    style={{ 
                                                        background: isLikedByMe ? 'rgba(255, 184, 0, 0.1)' : 'none', 
                                                        border: `1px solid ${isLikedByMe ? 'var(--amber)' : '#444'}`, 
                                                        color: isLikedByMe ? 'var(--amber)' : '#888', 
                                                        padding: '4px 8px', 
                                                        borderRadius: '4px', 
                                                        cursor: 'pointer', 
                                                        fontSize: '12px', 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        gap: '5px',
                                                        transition: 'all 0.2s',
                                                        height: '26px'
                                                    }}
                                                >
                                                    ▲ {post.upvotes_count || 0}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};