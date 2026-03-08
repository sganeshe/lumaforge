import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export const UserProfile = ({ username, onBack, onFork, session }) => {
    const [profile, setProfile] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalPosts: 0, totalLikes: 0 });

    useEffect(() => {
        if (username) {
            fetchUserProfile(username);
        }
    }, [username]);

    const fetchUserProfile = async (targetUsername) => {
        setLoading(true);

        // 1. Fetch the Profile Data
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('username', targetUsername)
            .single();

        if (profileError || !profileData) {
            console.error("PROFILE NOT FOUND", profileError);
            setLoading(false);
            return;
        }

        setProfile(profileData);

        // 2. Fetch All Posts by this User
        const { data: postsData, error: postsError } = await supabase
            .from('uplink_posts')
            .select('*')
            .eq('user_id', profileData.id)
            .order('created_at', { ascending: false });

        if (!postsError && postsData) {
            setPosts(postsData);
            
            // Calculate Total Impact (Sum of all likes on their posts)
            const totalLikes = postsData.reduce((sum, post) => sum + (post.likes_count || 0), 0);
            setStats({
                totalPosts: postsData.length,
                totalLikes: totalLikes
            });
        }

        setLoading(false);
    };

    const getFallbackAvatar = (name) => {
        return name ? name.substring(0, 2).toUpperCase() : '??';
    };

    if (loading) {
        return (
            <div className="terminal-page amber-theme" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <div className="typewriter-text">QUERYING MAINFRAME FOR @{username.toUpperCase()}...</div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="terminal-page amber-theme" style={{ padding: '20px' }}>
                <button onClick={onBack} className="terminal-back-btn">← RETURN</button>
                <div style={{ textAlign: 'center', marginTop: '50px', color: 'red' }}>[ ERROR: PROFILE_NOT_FOUND ]</div>
            </div>
        );
    }

    return (
        <div className="terminal-page amber-theme" style={{ height: '100vh', overflowY: 'auto' }}>
            
            {/* NAVIGATION HEADER */}
            <div className="terminal-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#000', borderBottom: '1px solid #333' }}>
                <button onClick={onBack} className="terminal-back-btn">← BACK TO UPLINK</button>
                <div className="terminal-title">DATA_NODE: @{profile.username.toUpperCase()}</div>
            </div>

            <div className="terminal-content" style={{ padding: '0', maxWidth: '800px', margin: '0 auto', paddingBottom: '100px' }}>
                
                {/* BIO CARD */}
                <div style={{ padding: '30px 20px', borderBottom: '1px solid #333', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    
                    <div style={{
                        width: '90px', height: '90px', borderRadius: '50%', background: '#111',
                        border: '2px solid var(--amber)', display: 'flex', alignItems: 'center', 
                        justifyContent: 'center', overflow: 'hidden', marginBottom: '15px',
                        color: 'var(--amber)', fontSize: '24px', fontWeight: 'bold'
                    }}>
                        {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt={profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            getFallbackAvatar(profile.username)
                        )}
                    </div>

                    <h2 style={{ margin: '0 0 5px 0', fontSize: '20px', letterSpacing: '2px' }}>{profile.full_name || profile.username}</h2>
                    <div style={{ color: 'var(--amber)', fontSize: '14px', marginBottom: '15px', fontFamily: 'var(--font-mono)' }}>@{profile.username}</div>
                    
                    {profile.bio && (
                        <p style={{ color: '#aaa', fontSize: '13px', maxWidth: '400px', lineHeight: '1.5', margin: '0 0 20px 0' }}>
                            {profile.bio}
                        </p>
                    )}

                    {/* TERMINAL STATS BLOCK */}
                    <div style={{ display: 'flex', gap: '20px', background: '#0a0a0a', padding: '10px 20px', border: '1px solid #333', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ color: '#666', fontSize: '10px' }}>PAYLOADS</span>
                            <span style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>{stats.totalPosts}</span>
                        </div>
                        <div style={{ width: '1px', background: '#333' }}></div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ color: '#666', fontSize: '10px' }}>NETWORK_IMPACT</span>
                            <span style={{ color: 'var(--amber)', fontSize: '16px', fontWeight: 'bold' }}>▲ {stats.totalLikes}</span>
                        </div>
                    </div>
                </div>

                {/* THE 3-COLUMN PORTFOLIO GRID */}
                <div style={{ padding: '2px' }}>
                    <div style={{ color: '#666', fontSize: '12px', padding: '15px', fontFamily: 'var(--font-mono)', borderBottom: '1px solid #222', marginBottom: '2px' }}>
                        &gt; ARCHIVED_GRADES:
                    </div>

                    {posts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '50px 20px', color: '#666', fontFamily: 'var(--font-mono)' }}>
                            [ NO_DATA_TRANSMITTED_YET ]
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
                            {posts.map(post => (
                                <div 
                                    key={post.id} 
                                    style={{ aspectRatio: '1/1', background: '#111', position: 'relative', overflow: 'hidden', cursor: 'crosshair' }}
                                    className="profile-grid-item"
                                >
                                    <img 
                                        src={post.graded_image_url} 
                                        alt="Grade" 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                    />
                                    
                                    {/* Hover Overlay for Forking */}
                                    <div 
                                        style={{ 
                                            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', 
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', 
                                            justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' 
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                        onMouseLeave={e => e.currentTarget.style.opacity = 0}
                                    >
                                        <div style={{ color: 'var(--amber)', fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>
                                            ▲ {post.likes_count || 0}
                                        </div>
                                        <button 
                                            onClick={() => onFork(post.settings, post.original_image_url)}
                                            style={{
                                                background: 'transparent', border: '1px solid var(--amber)', color: 'var(--amber)',
                                                padding: '6px 12px', fontSize: '10px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-mono)'
                                            }}
                                        >
                                            FORK
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};