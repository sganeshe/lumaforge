import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export const LoginScreen = ({ onBack }) => {
    const [authMode, setAuthMode] = useState('SIGN_IN');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ text: 'TRANSMITTING CREDENTIALS...', type: 'info' });

        let error = null;

        try {
            if (authMode === 'SIGN_UP') {
                const res = await supabase.auth.signUp({ email, password });
                error = res.error;
                if (!error) setMessage({ text: 'REGISTRATION LOGGED. CHECK EMAIL FOR VERIFICATION.', type: 'success' });
            } else if (authMode === 'SIGN_IN') {
                const res = await supabase.auth.signInWithPassword({ email, password });
                error = res.error;
                if (!error) onBack();
            } else if (authMode === 'OTP') {
                const res = await supabase.auth.signInWithOtp({ email });
                error = res.error;
                if (!error) setMessage({ text: 'MAGIC LINK DEPLOYED. CHECK YOUR INBOX.', type: 'success' });
            }
        } catch (err) {
            error = err;
        }

        if (error) {
            setMessage({ text: `AUTH FAULT: ${error.message.toUpperCase()}`, type: 'error' });
        }
        setLoading(false);
    };

    const handleGoogleAuth = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
        if (error) {
            setMessage({ text: `OAUTH FAULT: ${error.message.toUpperCase()}`, type: 'error' });
            setLoading(false);
        }
    };

    return (
        <div className="terminal-page" style={{ alignItems: 'center', justifyContent: 'center' }}>
            
            <div className="login-container">
                <div className="login-header">
                    <img src="/lf_orange.png" alt="LUMAFORGE" style={{ height: '35px', objectFit: 'contain', marginBottom: '20px' }} />
                    <div className="terminal-title" style={{ fontSize: '16px' }}>UPLINK AUTHORIZATION</div>
                </div>

                <div className="login-tabs">
                    <button className={authMode === 'SIGN_IN' ? 'active' : ''} onClick={() => {setAuthMode('SIGN_IN'); setMessage({text:'', type:''});}}>SIGN IN</button>
                    <button className={authMode === 'SIGN_UP' ? 'active' : ''} onClick={() => {setAuthMode('SIGN_UP'); setMessage({text:'', type:''});}}>REGISTER</button>
                    <button className={authMode === 'OTP' ? 'active' : ''} onClick={() => {setAuthMode('OTP'); setMessage({text:'', type:''});}}>MAGIC LINK</button>
                </div>

                <form className="login-form" onSubmit={handleAuth}>
                    <div className="input-group">
                        <label>USER EMAIL</label>
                        <input 
                            type="email" 
                            required 
                            autoComplete="email"
                            placeholder="operator@domain.com"
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                        />
                    </div>

                    {authMode !== 'OTP' && (
                        <div className="input-group">
                            <label>ENCRYPTION KEY (PASSWORD)</label>
                            <input 
                                type="password" 
                                required 
                                autoComplete={authMode === 'SIGN_UP' ? "new-password" : "current-password"}
                                placeholder="••••••••"
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                            />
                        </div>
                    )}

                    <button type="submit" className="login-submit-btn" disabled={loading}>
                        {loading ? 'PROCESSING...' : 'INITIALIZE HANDSHAKE'}
                    </button>
                </form>

                {message.text && (
                    <div className={`login-message ${message.type}`}>
                        {message.text}
                    </div>
                )}

                <div className="login-divider"><span>OR</span></div>

                <button type="button" className="google-auth-btn" onClick={handleGoogleAuth} disabled={loading}>
                    <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    AUTHORIZE VIA GOOGLE
                </button>

                <button className="terminal-back-btn danger" style={{ width: '100%', marginTop: '30px' }} onClick={onBack}>
                    ← ABORT LOGIN SEQUENCE
                </button>
            </div>
        </div>
    );
};