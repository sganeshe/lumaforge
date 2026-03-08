import React, { useState } from 'react';

export const PostCard = ({ 
    post, 
    currentUserId, 
    onLike, 
    onFork, 
    onCommentClick, 
    onProfileClick 
}) => {
    // State for the "Hold to Decrypt" interaction
    const [isDecrypting, setIsDecrypting] = useState(false);

    // Safely extract profile data (handling cases where a user might be deleted)
    const authorName = post.profiles?.username || 'UNKNOWN_USER';
    const authorAvatar = post.profiles?.avatar_url || null;
    
    const isLikedByMe = post.liked_by && post.liked_by.includes(currentUserId);

    // Helper to generate the Brutalist "Metadata Receipt" from the JSON payload
    const generateReceipt = (settings) => {
        if (!settings) return 'PAYLOAD_CORRUPTED';
        const exp = settings.exposure > 0 ? `+${settings.exposure}` : settings.exposure;
        const con = settings.contrast > 0 ? `+${settings.contrast}` : settings.contrast;
        const temp = settings.temp > 0 ? `+${settings.temp}` : settings.temp;
        return `EXP:${exp} | CON:${con} | TMP:${temp} | SHD:${settings.shadows} | HLT:${settings.highlights}`;
    };

    // Helper to generate a fallback avatar if they don't have a profile picture
    const getFallbackAvatar = (name) => {
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <div style={{ 
            background: '#0a0a0a', 
            border: '1px solid #333', 
            borderRadius: '4px', 
            overflow: 'hidden', 
            display: 'flex', 
            flexDirection: 'column',
            fontFamily: 'var(--font-mono)'
        }}>
            {/* 1. PROFILE HEADER */}
            <div style={{ 
                padding: '12px 15px', 
                display: 'flex', 
                alignItems: 'center', 
                borderBottom: '1px solid #222',
                cursor: 'pointer'
            }} onClick={() => onProfileClick(authorName)}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', background: '#222',
                    border: '1px solid var(--amber)', display: 'flex', alignItems: 'center', 
                    justifyContent: 'center', overflow: 'hidden', marginRight: '12px',
                    color: 'var(--amber)', fontSize: '12px', fontWeight: 'bold'
                }}>
                    {authorAvatar ? (
                        <img src={authorAvatar} alt={authorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        getFallbackAvatar(authorName)
                    )}
                </div>
                <div style={{ color: 'var(--amber)', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>
                    @{authorName.toUpperCase()}
                </div>
            </div>

            {/* 2. THE CANVAS (Hold to Decrypt) */}
            <div 
                style={{ 
                    width: '100%', 
                    aspectRatio: '4/5', // Standard Instagram portrait ratio
                    backgroundColor: '#000', 
                    position: 'relative',
                    cursor: 'crosshair'
                }}
                onMouseDown={() => setIsDecrypting(true)}
                onMouseUp={() => setIsDecrypting(false)}
                onMouseLeave={() => setIsDecrypting(false)}
                onTouchStart={() => setIsDecrypting(true)}
                onTouchEnd={() => setIsDecrypting(false)}
            >
                {/* The Image */}
                <img 
                    src={isDecrypting ? post.original_image_url : post.graded_image_url} 
                    alt="Uplink Payload" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />

                {/* Decrypting Overlay Indicator */}
                {isDecrypting && (
                    <div style={{
                        position: 'absolute', top: '10px', left: '10px',
                        background: 'rgba(255, 0, 0, 0.8)', color: '#fff',
                        padding: '4px 8px', fontSize: '10px', fontWeight: 'bold',
                        letterSpacing: '2px', borderRadius: '2px'
                    }}>
                        [ DECRYPTING SOURCE NEGATIVE... ]
                    </div>
                )}
            </div>

            {/* 3. METADATA RECEIPT */}
            <div style={{ 
                padding: '8px 15px', 
                background: '#111', 
                borderBottom: '1px solid #222',
                fontSize: '10px', 
                color: '#666',
                letterSpacing: '1px'
            }}>
                <span style={{ color: '#888' }}>&gt; PAYLOAD_DATA: </span> 
                {generateReceipt(post.settings)}
            </div>

            {/* 4. ACTION BAR & CAPTION */}
            <div style={{ padding: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        {/* Like Button */}
                        <button onClick={() => onLike(post)} style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: isLikedByMe ? 'var(--amber)' : '#888',
                            fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', padding: 0
                        }}>
                            {isLikedByMe ? '▲' : '△'} {post.likes_count || 0}
                        </button>
                        
                        {/* Comment Button */}
                        <button onClick={() => onCommentClick(post)} style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#888', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', padding: 0
                        }}>
                            [💬 COMMENTS]
                        </button>
                    </div>

                    {/* Fork & Remix Button */}
                    <button onClick={() => onFork(post.settings, post.original_image_url)} style={{
                        background: 'rgba(255, 184, 0, 0.1)', border: '1px solid var(--amber)',
                        color: 'var(--amber)', fontSize: '10px', fontWeight: 'bold',
                        padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', letterSpacing: '1px'
                    }}>
                        FORK & REMIX
                    </button>
                </div>

                {/* Caption */}
                {post.caption && (
                    <div style={{ fontSize: '12px', color: '#ccc', lineHeight: '1.4' }}>
                        <strong style={{ color: 'var(--amber)', cursor: 'pointer' }} onClick={() => onProfileClick(authorName)}>
                            @{authorName}
                        </strong>{' '}
                        {post.caption}
                    </div>
                )}
            </div>
        </div>
    );
};