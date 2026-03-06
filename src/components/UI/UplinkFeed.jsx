import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export const UplinkFeed = ({ onBack, onFork, session }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

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

    const handleLike = async (id, currentLikes) => {
        if (!session) return alert("UPLINK ERROR: Login required to upvote.");
        
        // Optimistic UI update
        setPosts(posts.map(p => p.id === id ? { ...p, likes: currentLikes + 1 } : p));
        
        await supabase
            .from('uplink_posts')
            .update({ likes: currentLikes + 1 })
            .eq('id', id);
    };

    return (
        <div className="terminal-page amber-theme">
            <div className="terminal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={onBack} className="terminal-back-btn">← TERMINATE UPLINK</button>
                <div className="terminal-title">THE_UPLINK_v1.0 (COMMUNITY_FEED)</div>
            </div>

            <div className="terminal-content" style={{ padding: '20px', paddingBottom: '100px', maxWidth: '1200px', margin: '0 auto' }}>
                {loading ? (
                    <div className="typewriter-text">SYNCING WITH GLOBAL MAINFRAME...</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                        {posts.map(post => (
                            <div key={post.id} style={{ background: '#111', border: '1px solid #333', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                
                                {/* Image Preview */}
                                <div style={{ height: '280px', width: '100%', overflow: 'hidden', position: 'relative', backgroundColor: '#000' }}>
                                    <img 
                                        src={post.image_url} 
                                        alt={post.preset_name} 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                    />
                                    {/* Fork Overlay Button */}
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', opacity: 0, transition: 'opacity 0.2s', cursor: 'pointer' }}
                                         onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                         onMouseLeave={e => e.currentTarget.style.opacity = 0}
                                         onClick={() => onFork(post.settings, post.image_url)}
                                    >
                                        <button className="primary-btn">FORK & REMIX</button>
                                    </div>
                                </div>

                                {/* Meta Data */}
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
                                            onClick={() => handleLike(post.id, post.likes)}
                                            style={{ background: 'none', border: '1px solid #444', color: '#888', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                                        >
                                            ▲ {post.likes}
                                        </button>
                                    </div>
                                </div>

                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};