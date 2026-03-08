import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';

export const UplinkFeed = ({ onBack, onFork, session }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pendingSettings, setPendingSettings] = useState(null);
    const fileInputRef = useRef(null);
    
    // NEW: Sorting State
    const [sortBy, setSortBy] = useState('latest'); // 'latest', 'popular', 'oldest'

    // Re-fetch whenever the sortBy state changes
    useEffect(() => {
        fetchFeed(sortBy);
    }, [sortBy]);

    // NEW: Dynamic Supabase Query Builder
    const fetchFeed = async (currentSort) => {
        setLoading(true);
        
        // Start building the query
        let query = supabase.from('uplink_posts').select('*');

        // Apply sorting math based on user selection
        if (currentSort === 'popular') {
            // Sort by likes first, then by date (so ties show newest first)
            query = query.order('likes', { ascending: false }).order('created_at', { ascending: false });
        } else if (currentSort === 'oldest') {
            // Sort by date created (oldest first)
            query = query.order('created_at', { ascending: true });
        } else {
            // Default: Sort by date created (newest first)
            query = query.order('created_at', { ascending: false });
        }

        // Execute the query
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

        setPosts(posts.map(p => p.id === post.id ? { ...p, likes: newLikesCount, liked_by: newLikedBy } : p));
        
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
                <div className="terminal-title">THE_UPLINK_v1.0 (COMMUNITY_FEED)</div>
            </div>

            <div className="terminal-content" style={{ padding: '20px', paddingBottom: '100px', maxWidth: '1200px', margin: '0 auto' }}>
                
                {/* NEW: Filter UI Toolbar */}
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
                            const isLikedByMe = session && post.liked_by && post.liked_by.includes(session.user.id);
                            
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