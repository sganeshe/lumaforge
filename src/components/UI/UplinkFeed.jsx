import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';

export const UplinkFeed = ({ onBack, onFork, session }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pendingSettings, setPendingSettings] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchFeed();
    }, []);

    const fetchFeed = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('uplink_posts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (!error && data) setPosts(data);
        setLoading(false);
    };

    // 1. NEW LIKE LOGIC: Tracks User IDs to prevent spamming
    const handleLike = async (post) => {
        if (!session) return alert("UPLINK ERROR: Login required to upvote.");
        
        const userId = session.user.id;
        const hasLiked = post.liked_by && post.liked_by.includes(userId);
        
        let newLikedBy = post.liked_by || [];
        let newLikesCount = post.likes || 0;

        if (hasLiked) {
            newLikedBy = newLikedBy.filter(id => id !== userId); // Remove like
            newLikesCount = Math.max(0, newLikesCount - 1);
        } else {
            newLikedBy = [...newLikedBy, userId]; // Add like
            newLikesCount += 1;
        }

        // Instant UI update
        setPosts(posts.map(p => p.id === post.id ? { ...p, likes: newLikesCount, liked_by: newLikedBy } : p));
        
        // Push to database
        await supabase
            .from('uplink_posts')
            .update({ likes: newLikesCount, liked_by: newLikedBy })
            .eq('id', post.id);
    };

    // 2. FORK LOGIC: Save the settings and open the file picker
    const initiateFork = (settings) => {
        setPendingSettings(settings);
        fileInputRef.current.click();
    };

    // 3. FORK LOGIC: Send the user's chosen file AND the settings back to App.jsx
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        onFork(pendingSettings, file);
        setPendingSettings(null);
        e.target.value = null; // Reset input
    };

    return (
        <div className="terminal-page amber-theme">
            {/* Hidden file input for Forking */}
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept="image/*" 
                style={{ display: 'none' }} 
            />

            <div className="terminal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={onBack} className="terminal-back-btn">← TERMINATE UPLINK</button>
                <div className="terminal-title">THE_UPLINK_v1.0 (COMMUNITY_FEED)</div>
            </div>

            <div className="terminal-content" style={{ padding: '20px', paddingBottom: '100px', maxWidth: '1200px', margin: '0 auto' }}>
                {loading ? (
                    <div className="typewriter-text">SYNCING WITH GLOBAL MAINFRAME...</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                        {posts.map(post => {
                            const isLikedByMe = session && post.liked_by && post.liked_by.includes(session.user.id);
                            
                            return (
                                <div key={post.id} style={{ background: '#111', border: '1px solid #333', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                    
                                    <div style={{ height: '280px', width: '100%', overflow: 'hidden', position: 'relative', backgroundColor: '#000' }}>
                                        <img 
                                            src={post.image_url} 
                                            alt={post.preset_name} 
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                        />
                                        
                                        {/* FIXED FORK BUTTON UI */}
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
                                                <div style={{ color: 'var(--amber)', fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                                                    {post.preset_name.toUpperCase()}
                                                </div>
                                                <div style={{ color: '#666', fontSize: '11px', marginTop: '4px' }}>
                                                    BY: {post.author_name}
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleLike(post)}
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
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                ▲ {post.likes}
                                            </button>
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