/**
 * @file App.jsx
 * @description The central orchestrator and state-machine for LUMAFORGE.
 * Now powered by React Router for true SPA page navigation.
 */

import React, { useState, useEffect, useCallback, useRef, useDeferredValue } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate, useParams } from 'react-router-dom';

// Engine & Core Systems
import ImageStage from './components/Engine/ImageStage';
import { exportImage } from './components/Engine/ExportSystem';
import { generateLutFile, parseLutFile } from './components/Engine/LUTSystem';
import { readMetadata } from './components/Engine/MetadataSystem';

// UI Components
import EditorControls from './components/UI/EditorControls';
import { LeftSidebar } from './components/UI/LeftSidebar';
import { CloudMenu } from './components/UI/AuthSystem';
import { ManualScreen } from './components/UI/ManualScreen';
import { DiagnosticsScreen } from './components/UI/DiagnosticsScreen';
import { LoginScreen } from './components/UI/LoginScreen';
import { UplinkFeed } from './components/UI/UplinkFeed';

// Utilities, Hooks & Services
import { supabase } from './lib/supabaseClient'; 
import { getFreshState } from './utils/constants'; 
import { useSystemClock } from './hooks/useSystemClock'; 
import './styles/index.css';
import { Analytics } from "@vercel/analytics/next";

/* =========================================================================
   ROUTING WRAPPERS & PRESENTATIONAL VIEWS
   ========================================================================= */

// The Boot Screen now intercepts routing requests and forwards them
const BootScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // If a target is passed in the router state, go there. Otherwise, go home.
  const targetPath = location.state?.target || '/';

  useEffect(() => { 
      const timer = setTimeout(() => navigate(targetPath, { replace: true }), 2200); 
      return () => clearTimeout(timer);
  }, [navigate, targetPath]);

  return (
    <div className="home-layer" style={{background: '#050505'}}>
      <div className="hero-block" style={{animation: 'none', opacity: 0.9, marginBottom: '25px'}}>
          <img src="/lf_white.png" alt="LUMAFORGE" style={{ height: '70px', objectFit: 'contain' }} />
      </div>
      <div className="loading-bar"><div className="loading-fill"/></div>
    </div>
  );
};

const HomeScreen = ({ onUpload }) => {
  const timeStr = useSystemClock();
  const navigate = useNavigate();

  const handleNavigate = (path) => {
      navigate('/boot', { state: { target: path } });
  };

  return (
    <div className="home-layer">
      <div className="home-grid" />
      <div className="hero-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
        
        <div className="system-status" style={{ marginBottom: '10px', background: 'rgba(255, 184, 0, 0.05)', border: '1px solid rgba(255, 184, 0, 0.2)', padding: '6px 12px', borderRadius: '4px' }}>
            <div className="status-dot"/>
            SYSTEM_READY 
            <span style={{ margin: '0 12px', opacity: 0.3, color: '#fff' }}>|</span> 
            <span style={{ color: 'var(--text-muted)' }}>{timeStr}</span>
        </div>

        <div className="hero-block" style={{ margin: '0', animation: 'lens-focus 1.5s cubic-bezier(0.19, 1, 0.22, 1) backwards' }}>
          <img src="/lf_orange.png" alt="LUMAFORGE" style={{ height: '140px', objectFit: 'contain', filter: 'drop-shadow(0 0 50px rgba(255, 184, 0, 0.15))' }} />
        </div>

        <div className="hero-tag" style={{ letterSpacing: '6px', color: '#888', margin: '0', animation: 'fade-up 1s ease-out 0.2s backwards' }}>
            PROFESSIONAL OPTICS ENGINE
        </div>

        <div className="start-btn-group" style={{ marginTop: '15px', animation: 'fade-up 1s ease-out 0.4s backwards' }}>
          <button className="btn-tech primary" onClick={() => document.getElementById('home-upload').click()} style={{ padding: '16px 40px', fontSize: '12px', letterSpacing: '1px' }}>
              OPEN SOURCE FILE
          </button>
        </div>
        <input id="home-upload" type="file" hidden onChange={onUpload} accept="image/*,.cube" />

        <div className="home-nav-links" style={{ display: 'flex', gap: '20px', marginTop: '30px', animation: 'fade-up 1s ease-out 0.6s backwards' }}>
          <button className="text-nav-btn" onClick={() => handleNavigate('/uplink')}>[ THE UPLINK FEED ]</button>
          <button className="text-nav-btn" onClick={() => handleNavigate('/diagnostics')}>[ SYSTEM DIAGNOSTICS ]</button>
          <button className="text-nav-btn" onClick={() => handleNavigate('/manual')}>[ OPTICS MANUAL ]</button>
        </div>

      </div>

      <div className="home-footer">
        <div className="footer-row"><span>© 2026 LUMAFORGE</span><span className="footer-divider">|</span><span>BUILD v1.4.0</span></div>
        <div className="footer-row links">
           <span style={{color: '#fff'}}>CREATOR: SAUMYA GANESHE</span>
           <a href="https://github.com/sganeshe" target="_blank" rel="noreferrer">[ GITHUB ]</a>
           <a href="https://www.linkedin.com/in/saumyaganeshe/" target="_blank" rel="noreferrer">[ LINKEDIN ]</a>
           <a href="https://sganeshe.live/" target="_blank" rel="noreferrer">[ PORTFOLIO ]</a>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   NEW: SHARED PRESET LANDING PAGE
   ========================================================================= */
const SharedPresetPage = ({ onFork, onCancel }) => {
  const { id } = useParams();
  const [preset, setPreset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
      const fetchPreset = async () => {
          try {
              const { data, error } = await supabase
                  .from('uplink_posts')
                  .select('preset_name, settings')
                  .eq('id', id)
                  .single();

              if (error) throw error;
              if (data) setPreset(data);
          } catch (err) {
              setError("PRESET NOT FOUND OR CORRUPTED.");
          } finally {
              setLoading(false);
          }
      };
      fetchPreset();
  }, [id]);

  const handleSharedUpload = (e) => {
      const file = e.target.files[0];
      if (!file || !preset) return;
      
      const parsedSettings = typeof preset.settings === 'string' 
          ? JSON.parse(preset.settings) 
          : preset.settings;

      onFork(parsedSettings, file);
  };

  if (loading) return <BootScreen />;

  return (
      <div className="home-layer">
          <div className="home-grid" />
          <div className="hero-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
              
              {error ? (
                  <>
                      <div className="status-label" style={{ color: '#ff3333' }}>[ {error} ]</div>
                      <button className="text-nav-btn" onClick={onCancel}>[ RETURN TO MAINFRAME ]</button>
                  </>
              ) : (
                  <>
                      <div className="system-status" style={{ background: 'rgba(0, 255, 150, 0.05)', border: '1px solid rgba(0, 255, 150, 0.2)' }}>
                          <div className="status-dot" style={{ background: '#00ff96', boxShadow: '0 0 8px #00ff96' }}/>
                          INCOMING TRANSMISSION
                      </div>

                      <h2 style={{ color: '#fff', fontSize: '24px', fontFamily: 'var(--font-ui)', letterSpacing: '2px', textAlign: 'center', margin: 0 }}>
                          APPLY <span style={{ color: 'var(--amber)' }}>{preset.preset_name?.toUpperCase() || 'UNTITLED'}</span>
                      </h2>
                      
                      <p style={{ color: '#888', fontSize: '12px', fontFamily: 'monospace', maxWidth: '400px', textAlign: 'center', lineHeight: '1.6' }}>
                          A creator has shared an optics preset with you. Upload an image to preview and apply this grade.
                      </p>

                      <div className="start-btn-group" style={{ marginTop: '20px' }}>
                          <button className="btn-tech primary" onClick={() => document.getElementById('shared-upload').click()} style={{ padding: '16px 40px' }}>
                              UPLOAD IMAGE
                          </button>
                      </div>
                      <input id="shared-upload" type="file" hidden onChange={handleSharedUpload} accept="image/*" />

                      <button className="text-nav-btn" onClick={onCancel} style={{ marginTop: '20px' }}>
                          [ DECLINE & GO TO HOME ]
                      </button>
                  </>
              )}
          </div>
      </div>
  );
};


/* =========================================================================
   INTERNAL APP STATE CONTROLLER
   ========================================================================= */

const LumaforgeCore = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Core State
  const [session, setSession] = useState(null);
  const [appPrefs, setAppPrefs] = useState({ animations: true });
  const [showCloud, setShowCloud] = useState(false);
  const [image, setImage] = useState(null);
  const [baseImageData, setBaseImageData] = useState(null); 
  const [activeTab, setActiveTab] = useState('EDIT');
  
  const [settings, setSettings] = useState({
      ...getFreshState(),
      watermark: false,
      watermarkUser: 'sganeshe', 
      watermarkAlign: 'right',  
  });
  
  const deferredSettings = useDeferredValue(settings);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [uiKey, setUiKey] = useState(0);
  const fileInputRef = useRef(null);
  
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  // Keyboard Shortcuts (Only active if in Editor)
  const undo = useCallback(() => {
    setHistory(curr => {
        if (curr.past.length === 0) return curr;
        const previous = curr.past[curr.past.length - 1];
        const newPast = curr.past.slice(0, -1);
        setSettings(previous);
        setUiKey(k => k + 1); 
        return { past: newPast, future: [settingsRef.current, ...curr.future] };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory(curr => {
        if (curr.future.length === 0) return curr;
        const next = curr.future[0];
        const newFuture = curr.future.slice(1);
        setSettings(next);
        setUiKey(k => k + 1);
        return { past: [...curr.past, settingsRef.current], future: newFuture };
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (location.pathname !== '/editor') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, location.pathname]);

  // File Processing
  const pushToHistory = useCallback(() => {
    const currentState = structuredClone(settingsRef.current); 
    setHistory(curr => {
        const lastState = curr.past[curr.past.length - 1];
        if (lastState && JSON.stringify(lastState) === JSON.stringify(currentState)) return curr;
        const newPast = [...curr.past, currentState];
        if (newPast.length > 30) newPast.shift();
        return { past: newPast, future: [] };
    });
  }, []);

  const processFile = useCallback(async (file) => {
      if (file.name.toLowerCase().endsWith('.cube')) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              pushToHistory(); 
              const result = parseLutFile(ev.target.result);
              if (result.type === 'LUT') setSettings(prev => ({ ...prev, activeLut: result.data }));
              else if (result.type === 'PROJECT') setSettings(prev => ({...prev, ...result.data, imageDimensions: prev.imageDimensions }));
              setUiKey(k => k + 1);
          };
          reader.readAsText(file);
          return; 
      }

      let visualUrl = URL.createObjectURL(file);
      let projectData = null;

      if (file.type === 'image/png') {
          try { 
              const rawMeta = await readMetadata(file); 
              projectData = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
          } catch (err) { 
              console.warn("[LUMAFORGE_META] No readable payload found."); 
          }
      }

      let nextImage = visualUrl;
      let savedSettings = null;

      if (projectData && window.confirm("LUMAFORGE Project Detected.\n[OK] Restore Edits\n[Cancel] Import Clean")) {
          savedSettings = projectData.settings || projectData;
          if (typeof savedSettings === 'string') {
              try { savedSettings = JSON.parse(savedSettings); } catch(e) {}
          }
          if (projectData.source) {
              nextImage = projectData.source;
          }
      }

      const img = new Image();
      img.crossOrigin = "anonymous"; 
      img.onload = () => {
          let nextSettings = { 
              ...getFreshState(), 
              imageDimensions: { w: img.naturalWidth, h: img.naturalHeight, ratio: img.naturalWidth / img.naturalHeight } 
          };

          if (savedSettings && typeof savedSettings === 'object') {
              nextSettings = { 
                  ...nextSettings, 
                  ...savedSettings, 
                  imageDimensions: nextSettings.imageDimensions 
              };
          }

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.naturalWidth;
          tempCanvas.height = img.naturalHeight;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(img, 0, 0);
          setBaseImageData(tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height));

          setSettings(nextSettings);
          setImage(nextImage);
          setHistory({ past: [], future: [] });
          setUiKey(prev => prev + 1); 
          
          navigate('/boot', { state: { target: '/editor' } });
      };
      
      img.src = nextImage;
  }, [pushToHistory, navigate]);

  const handleUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      processFile(file); 
  };

  const handleGoHome = () => {
    if (window.confirm("SYSTEM WARNING: Returning to home will discard all unsaved edits. Proceed?")) {
        setImage(null);
        setBaseImageData(null); 
        setSettings(getFreshState());
        setHistory({ past: [], future: [] });
        setShowCloud(false);
        navigate('/boot', { state: { target: '/' } });
    }
  };

  const handleCloudLoad = (cloudSettings) => {
      pushToHistory();
      setSettings({ ...getFreshState(), ...cloudSettings, imageDimensions: settings.imageDimensions });
      setUiKey(k => k + 1);
      setShowCloud(false);
  };
  
  const saveCube = () => {
    const content = generateLutFile(settings);
    const blob = new Blob([content], {type: 'text/plain'});
    const link = document.createElement('a'); 
    link.href = URL.createObjectURL(blob); 
    link.download = `lumaforge_grade_${Date.now()}.cube`; 
    link.click();
  };

  const handleSaveToCloud = async () => {
      if (!session) return alert("UPLINK OFFLINE. Please connect to the Uplink (Login) to save presets.");
      const { count } = await supabase.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id);
      if (count >= 50) {
          alert("CRITICAL: UPLINK CAPACITY REACHED (50/50). Please delete old presets to save new ones.");
          return;
      }
      const name = prompt("NAME YOUR PRESET:");
      if (!name) return;
      const { error } = await supabase.from('projects').insert([{ user_id: session.user.id, name: name, settings: settings }]);
      if (error) alert("UPLOAD FAILED: " + error.message);
      else alert("PRESET SAVED TO CLOUD");
  };

  const handleForkFromUplink = (forkedSettings, file) => {
      const visualUrl = URL.createObjectURL(file);
      const img = new Image();
      img.crossOrigin = "anonymous"; 
      img.onload = () => {
          setSettings({ 
              ...getFreshState(), 
              ...forkedSettings, 
              imageDimensions: { w: img.naturalWidth, h: img.naturalHeight, ratio: img.naturalWidth / img.naturalHeight } 
          });

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.naturalWidth;
          tempCanvas.height = img.naturalHeight;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(img, 0, 0);
          setBaseImageData(tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height));

          setImage(visualUrl); 
          setHistory({ past: [], future: [] }); 
          setUiKey(prev => prev + 1); 
          
          navigate('/boot', { state: { target: '/editor' } });
      };
      img.src = visualUrl;
  };

  return (
    <>
      {!appPrefs.animations && <style>{`* { animation: none !important; transition: none !important; }`}</style>}
      
      <Routes>
        {/* BOOT ROUTE - Intercepts and redirects */}
        <Route path="/boot" element={<BootScreen />} />

        {/* HOME ROUTE */}
        <Route path="/" element={<HomeScreen onUpload={handleUpload} />} />

        {/* ---> NEW: THE SHARED LINK ROUTE <--- */}
        <Route path="/share/:id" element={
            <SharedPresetPage 
                onFork={handleForkFromUplink} 
                onCancel={() => navigate('/')} 
            />
        } />

        {/* STATIC PAGES */}
        <Route path="/manual" element={<ManualScreen onBack={() => navigate('/')} />} />
        <Route path="/diagnostics" element={<DiagnosticsScreen onBack={() => navigate('/')} session={session} appPrefs={appPrefs} setAppPrefs={setAppPrefs} onSignIn={() => navigate('/boot', { state: { target: '/login' } })}/>} />
        <Route path="/login" element={<LoginScreen onBack={() => navigate('/')} />} />
        <Route path="/uplink" element={<UplinkFeed session={session} onBack={() => navigate('/')} onFork={handleForkFromUplink} />} />

        {/* MAIN EDITOR ROUTE */}
        <Route path="/editor" element={
          !image ? <Navigate to="/" replace /> : (
            <div className="app-shell">
              <LeftSidebar 
                onHome={handleGoHome} 
                onExportImage={async (format) => await exportImage(image, settings, format)} 
                onExportCube={saveCube} 
                onLoadPreset={handleCloudLoad}
                onImportFile={() => fileInputRef.current.click()} 
                onSaveToCloud={handleSaveToCloud} 
                session={session} 
                setShowAuth={() => navigate('/boot', { state: { target: '/login' } })}
                currentSettings={settings} 
                imageSrc={image}
              />

              <input ref={fileInputRef} type="file" hidden accept="image/*,.cube" onChange={handleUpload} onClick={(e) => e.target.value = null} />

              <div className="canvas-area" key={`stage-${uiKey}`}>
                <div style={{position:'absolute', inset:0, opacity:0.3, pointerEvents:'none', backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '80px 80px'}}/>
                <ImageStage imageSrc={image} settings={deferredSettings} setSettings={setSettings} activeTab={activeTab} />
                <div className="canvas-hud">
                  <div className="hud-group">
                    <button className="hud-btn" onClick={undo} disabled={history.past.length === 0} title="Undo (Ctrl+Z)">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>
                    </button>
                    <button className="hud-btn" onClick={redo} disabled={history.future.length === 0} title="Redo (Ctrl+Y)">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13"/></svg>
                    </button>
                  </div>
                  <div className="hud-group">
                    <button className="hud-btn" onClick={()=>setSettings(p=>({...p, zoom: Math.max(0, p.zoom-10)}))}>-</button>
                    <span style={{color: '#888', fontSize: 11, width: 40, textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold'}}>{100 + settings.zoom}%</span>
                    <button className="hud-btn" onClick={()=>setSettings(p=>({...p, zoom: Math.min(200, p.zoom+10)}))}>+</button>
                  </div>
                </div>
              </div>
              
              <EditorControls 
                key={`controls-${uiKey}`} activeTab={activeTab} setActiveTab={setActiveTab} settings={settings} setSettings={setSettings}
                onSnapshot={pushToHistory} onReset={() => { pushToHistory(); setSettings({...getFreshState(), imageDimensions: settings.imageDimensions}); setUiKey(k => k + 1); }} 
                image={image} session={session} 
                onRequireAuth={() => navigate('/boot', { state: { target: '/login' } })}
                baseImageData={baseImageData} 
              />

              {showCloud && <CloudMenu session={session} settings={settings} imageSrc={image} onLoadProject={handleCloudLoad} onClose={() => setShowCloud(false)} />}
            </div>
          )
        } />
        
        {/* Catch-All 404 Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

/* =========================================================================
   ROUTER WRAPPER
   ========================================================================= */
export default function App() {
  return (
    <Router>
      <LumaforgeCore />
    </Router>
  );
}