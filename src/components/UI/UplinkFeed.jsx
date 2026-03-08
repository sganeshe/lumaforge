import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { PostCard } from './PostCard';

export const UplinkFeed = ({ onBack, onFork, onProfileClick, session }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState('latest'); 
    
    // Comments System State
    const [activePostForComments, setActivePostForComments] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [loadingComments, setLoadingComments] = useState(false);

    useEffect(() => {
        fetchFeed(sortBy);
    }, [sortBy]);

    // 1. THE RELATIONAL FETCH
    const fetchFeed = async (currentSort) => {
        setLoading(true);
        
        // Notice the syntax here: We are explicitly joining the profiles table!
        let query = supabase
            .from('uplink_posts')
            .select(`
                *,
                profiles:user_id ( username, avatar_url, full_name )
            `);

        if (currentSort === 'popular') {
            query = query.order('likes_count', { ascending: false }).order('created_at', { ascending: false });
        } else if (currentSort === 'oldest') {
            query = query.order('created_at', { ascending: true });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        const { data, error } = await query.limit(50);
        
        if (error) {
            console.error("UPLINK FETCH ERROR:", error);
        } else {
            setPosts(data);
        }
        setLoading(false);
    };

    // 2. LIKING LOGIC
    const handleLike = async (post) => {
        if (!session) return alert("UPLINK ERROR: Authentication required to execute command.");
        
        const userId = session.user.id;
        const hasLiked = post.liked_by && post.liked_by.includes(userId);
        
        let newLikedBy = post.liked_by || [];
        let newLikesCount = post.likes_count || 0;

        if (hasLiked) {
            newLikedBy = newLikedBy.filter(id => id !== userId); 
            newLikesCount = Math.max(0, newLikesCount - 1);
        } else {
            newLikedBy = [...newLikedBy, userId]; 
            newLikesCount += 1;
        }

        // Optimistic UI Update
        setPosts(posts.map(p => p.id === post.id ? { ...p, likes_count: newLikesCount, liked_by: newLikedBy } : p));
        
        // Database Update
        await supabase
            .from('uplink_posts')
            .update({ likes_count: newLikesCount, liked_by: newLikedBy })
            .eq('id', post.id);
    };

    // 3. COMMENTS ENGINE
    const openComments = async (post) => {
        setActivePostForComments(post);
        setLoadingComments(true);
        
        const { data, error } = await supabase
            .from('post_comments')
            .select('*, profiles:user_id (username, avatar_url)')
            .eq('post_id', post.id)
            .order('created_at', { ascending: true });
            
        if (!error && data) setComments(data);
        setLoadingComments(false);
    };

    const submitComment = async (e) => {
        e.preventDefault();
        if (!session || !newComment.trim() || !activePostForComments) return;
        
        const commentData = {
            post_id: activePostForComments.id,
            user_id: session.user.id,
            content: newComment.trim()
        };

        // Instantly show in UI
        const optimisticComment = { 
            ...commentData, 
            id: 'temp-id', 
            profiles: { username: 'YOU' } // Replace with actual session username if available
        };
        setComments([...comments, optimisticComment]);
        setNewComment("");

        // Push to Database
        await supabase.from('post_comments').insert([commentData]);
    };

    // 4. FORKING LOGIC
    const handleFork = async (settings, imageUrl) => {
        // Because the image URL is already in the cloud, we can pass it directly 
        // to your parent App component instead of forcing a file upload.
        onFork(settings, imageUrl);
    };

    return (
        <div className="terminal-page amber-theme" style={{ position: 'relative', height: '100vh', overflowY: 'auto' }}>
            
            <div className="terminal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10, background: '#000', borderBottom: '1px solid #333' }}>
                <button onClick={onBack} className="terminal-back-btn">← TERMINATE UPLINK</button>
                <div className="terminal-title">THE_UPLINK_v1.0</div>
            </div>

            <div className="terminal-content" style={{ padding: '20px', paddingBottom: '100px', maxWidth: '600px', margin: '0 auto' }}>
                
                {/* SORTING TOOLBAR */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', borderBottom: '1px solid #333', paddingBottom: '15px', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#666', fontSize: '12px', marginRight: '10px', fontFamily: 'var(--font-mono)' }}>DATA STREAM:</span>
                    {['latest', 'popular', 'oldest'].map(mode => (
                        <button
                            key={mode}
                            onClick={() => setSortBy(mode)}
                            style={{
                                background: sortBy === mode ? '#ffb800' : 'transparent',
                                color: sortBy === mode ? '#000' : '#ffb800',
                                border: `1px solid ${sortBy === mode ? 'transparent' : '#ffb800'}`,
                                padding: '6px 14px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer',
                                fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px',
                                transition: 'all 0.2s', fontWeight: sortBy === mode ? 'bold' : 'normal'
                            }}
                        >
                            {mode}
                        </button>
                    ))}
                </div>

                {/* POST FEED */}
                {loading ? (
                    <div className="typewriter-text" style={{ textAlign: 'center', marginTop: '50px' }}>SYNCING WITH MAINFRAME...</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                        {posts.map(post => (
                            <PostCard 
                                key={post.id} 
                                post={post} 
                                currentUserId={session?.user?.id}
                                onLike={handleLike}
                                onFork={handleFork}
                                onCommentClick={openComments}
                                onProfileClick={onProfileClick}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* COMMENTS MODAL OVERLAY */}
            {activePostForComments && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                }}>
                    <div style={{
                        width: '90%', maxWidth: '500px', background: '#0a0a0a', border: '1px solid var(--amber)',
                        borderRadius: '4px', display: 'flex', flexDirection: 'column', height: '70vh',
                        fontFamily: 'var(--font-mono)'
                    }}>
                        <div style={{ padding: '15px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', color: 'var(--amber)' }}>
                            <strong>[ DATA_STREAM: COMMENTS ]</strong>
                            <button onClick={() => setActivePostForComments(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>[X] CLOSE</button>
                        </div>
                        
                        <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {loadingComments ? <span style={{color: '#666'}}>&gt; FETCHING PACKETS...</span> : comments.length === 0 ? <span style={{color: '#666'}}>&gt; NO DATA FOUND.</span> : (
                                comments.map(c => (
                                    <div key={c.id} style={{ fontSize: '13px', lineHeight: '1.4' }}>
                                        <strong style={{ color: 'var(--amber)', cursor: 'pointer' }} onClick={() => { setActivePostForComments(null); onProfileClick(c.profiles?.username); }}>
                                            @{c.profiles?.username || 'UNKNOWN'}:
                                        </strong> <span style={{ color: '#ccc' }}>{c.content}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        <form onSubmit={submitComment} style={{ padding: '15px', borderTop: '1px solid #333', display: 'flex', gap: '10px' }}>
                            <input 
                                type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
                                placeholder="&gt; ENTER COMMAND..."
                                style={{
                                    flex: 1, background: '#000', border: '1px solid #333', color: 'var(--amber)',
                                    padding: '10px', fontFamily: 'var(--font-mono)', outline: 'none'
                                }}
                            />
                            <button type="submit" style={{
                                background: 'var(--amber)', color: '#000', border: 'none',
                                padding: '0 15px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'var(--font-mono)'
                            }}>
                                TRANSMIT
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};