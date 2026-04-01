/**
 * @file App.jsx
 * @description The central orchestrator and state-machine for LUMAFORGE.
 * Handles routing, session auth, undo/redo stacks, and local file imports.
 */

import React, { useState, useEffect, useCallback, useRef, useDeferredValue } from 'react';

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
import MaskingEditor from './components/UI/MaskingEditor';

// Utilities, Hooks & Services
import { supabase } from './lib/supabaseClient'; 
import { getFreshState } from './utils/constants'; 
import { useSystemClock } from './hooks/useSystemClock'; 
import './styles/index.css';
import { Analytics } from "@vercel/analytics/next";

/* =========================================================================
   PRESENTATIONAL COMPONENTS (ROUTING VIEWS)
   ========================================================================= */

const BootScreen = ({ onComplete }) => {
  useEffect(() => { setTimeout(onComplete, 2200); }, [onComplete]);
  return (
    <div className="home-layer" style={{background: '#050505'}}>
      <div className="hero-block" style={{animation: 'none', opacity: 0.9, marginBottom: '25px'}}>
          <img src="/lf_white.png" alt="LUMAFORGE" style={{ height: '70px', objectFit: 'contain' }} />
      </div>
      <div className="loading-bar"><div className="loading-fill"/></div>
    </div>
  );
};

const HomeScreen = ({ onUpload, onNavigate }) => {
  const timeStr = useSystemClock();
  return (
    <div className="win2k-desktop">
      {/* Desktop Icons */}
      <div className="win2k-desktop-icons">
        <button className="win2k-icon" onClick={() => document.getElementById('home-upload').click()}>
          <div className="win2k-icon-img">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="3" y="5" width="22" height="26" rx="1" fill="#fff" stroke="#999" strokeWidth="1"/><rect x="3" y="5" width="22" height="6" rx="1" fill="#1550a0"/><rect x="6" y="14" width="16" height="2" rx="1" fill="#ccc"/><rect x="6" y="18" width="12" height="2" rx="1" fill="#ccc"/><rect x="6" y="22" width="14" height="2" rx="1" fill="#ccc"/><circle cx="25" cy="25" r="7" fill="#ffd700" stroke="#b8860b" strokeWidth="1.5"/><path d="M25 22v6M22 25h6" stroke="#b8860b" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <span>Open Image</span>
        </button>
        <button className="win2k-icon" onClick={() => onNavigate('BOOT_TO_UPLINK')}>
          <div className="win2k-icon-img">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="12" fill="#1550a0" stroke="#0a2b70" strokeWidth="1.5"/><ellipse cx="16" cy="16" rx="5" ry="12" stroke="#6ab0ff" strokeWidth="1" fill="none"/><line x1="4" y1="16" x2="28" y2="16" stroke="#6ab0ff" strokeWidth="1"/><line x1="6" y1="10" x2="26" y2="10" stroke="#6ab0ff" strokeWidth="1"/><line x1="6" y1="22" x2="26" y2="22" stroke="#6ab0ff" strokeWidth="1"/></svg>
          </div>
          <span>Uplink Feed</span>
        </button>
        <button className="win2k-icon" onClick={() => onNavigate('BOOT_TO_DIAGNOSTICS')}>
          <div className="win2k-icon-img">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="4" y="6" width="24" height="18" rx="2" fill="#c0c0c0" stroke="#808080" strokeWidth="1.5"/><rect x="6" y="8" width="20" height="14" fill="#000080"/><polyline points="8,18 12,12 16,15 20,10 24,14" stroke="#00ff00" strokeWidth="1.5" fill="none"/><rect x="10" y="24" width="12" height="3" fill="#808080"/><rect x="8" y="27" width="16" height="2" fill="#a0a0a0"/></svg>
          </div>
          <span>Diagnostics</span>
        </button>
        <button className="win2k-icon" onClick={() => onNavigate('BOOT_TO_MANUAL')}>
          <div className="win2k-icon-img">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="6" y="3" width="18" height="24" rx="1" fill="#fff9e0" stroke="#a08000" strokeWidth="1.5"/><rect x="6" y="3" width="18" height="5" fill="#ffd700" rx="1"/><rect x="9" y="11" width="12" height="1.5" rx="1" fill="#888"/><rect x="9" y="14.5" width="10" height="1.5" rx="1" fill="#888"/><rect x="9" y="18" width="12" height="1.5" rx="1" fill="#888"/><rect x="9" y="21.5" width="8" height="1.5" rx="1" fill="#888"/></svg>
          </div>
          <span>Optics Manual</span>
        </button>
      </div>

      {/* Central Window */}
      <div className="win2k-window win2k-main-window">
        {/* Title Bar */}
        <div className="win2k-titlebar">
          <div className="win2k-titlebar-left">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="14" rx="1" fill="#ffd700"/><path d="M4 8 L8 4 L12 8 L8 12 Z" fill="#b8860b"/></svg>
            <span>LumaForge - Professional Optics Engine</span>
          </div>
          <div className="win2k-titlebar-btns">
            <button className="win2k-tb-btn win2k-min">_</button>
            <button className="win2k-tb-btn win2k-max">□</button>
            <button className="win2k-tb-btn win2k-close">✕</button>
          </div>
        </div>

        {/* Menu Bar */}
        <div className="win2k-menubar">
          <span className="win2k-menu-item"><u>F</u>ile</span>
          <span className="win2k-menu-item"><u>E</u>dit</span>
          <span className="win2k-menu-item"><u>V</u>iew</span>
          <span className="win2k-menu-item"><u>T</u>ools</span>
          <span className="win2k-menu-item"><u>H</u>elp</span>
        </div>

        {/* Toolbar */}
        <div className="win2k-toolbar">
          <button className="win2k-toolbar-btn" onClick={() => document.getElementById('home-upload').click()}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="10" height="12" rx="1" fill="#fff" stroke="#666" strokeWidth="1"/><rect x="1" y="3" width="10" height="4" fill="#1550a0"/><path d="M8 1 L15 1 L15 8 L11 12 L8 12 Z" fill="#fffbe0" stroke="#666" strokeWidth="1"/><path d="M11 1 L11 8 L15 8" stroke="#666" strokeWidth="1" fill="none"/></svg>
            Open
          </button>
          <div className="win2k-toolbar-sep"/>
          <button className="win2k-toolbar-btn" onClick={() => onNavigate('BOOT_TO_UPLINK')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" fill="#1550a0" stroke="#0a2b70"/><ellipse cx="8" cy="8" rx="2.5" ry="6" stroke="#6ab0ff" strokeWidth="0.8" fill="none"/><line x1="2" y1="8" x2="14" y2="8" stroke="#6ab0ff" strokeWidth="0.8"/></svg>
            Uplink
          </button>
          <button className="win2k-toolbar-btn" onClick={() => onNavigate('BOOT_TO_DIAGNOSTICS')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="9" rx="1" fill="#000080" stroke="#666"/><polyline points="4,10 6,7 8,8.5 10,5.5 12,7.5" stroke="#00ff00" strokeWidth="1" fill="none"/></svg>
            Diagnostics
          </button>
          <button className="win2k-toolbar-btn" onClick={() => onNavigate('BOOT_TO_MANUAL')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="1" width="10" height="14" rx="1" fill="#fffbe0" stroke="#a08000"/><rect x="3" y="1" width="10" height="3" fill="#ffd700"/><rect x="5" y="7" width="6" height="1" rx="0.5" fill="#888"/><rect x="5" y="9" width="5" height="1" rx="0.5" fill="#888"/><rect x="5" y="11" width="6" height="1" rx="0.5" fill="#888"/></svg>
            Manual
          </button>
        </div>

        {/* Content Area */}
        <div className="win2k-content">
          {/* Left Panel */}
          <div className="win2k-side-panel">
            <div className="win2k-panel-header">Quick Launch</div>
            <div className="win2k-panel-items">
              <button className="win2k-panel-item" onClick={() => document.getElementById('home-upload').click()}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="10" height="12" rx="1" fill="#fff" stroke="#666"/><rect x="1" y="2" width="10" height="4" fill="#1550a0"/><circle cx="12" cy="12" r="4" fill="#ffd700" stroke="#b8860b"/><path d="M12 10v4M10 12h4" stroke="#b8860b" strokeWidth="1.2" strokeLinecap="round"/></svg>
                Open Image File
              </button>
              <button className="win2k-panel-item" onClick={() => onNavigate('BOOT_TO_UPLINK')}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" fill="#1550a0" stroke="#0a2b70"/><ellipse cx="8" cy="8" rx="2.5" ry="6" stroke="#6ab0ff" strokeWidth="0.8" fill="none"/></svg>
                The Uplink Feed
              </button>
              <button className="win2k-panel-item" onClick={() => onNavigate('BOOT_TO_DIAGNOSTICS')}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="9" rx="1" fill="#000080" stroke="#666"/><polyline points="4,10 6,7 8,8.5 10,5.5 12,7.5" stroke="#00ff00" strokeWidth="1"/></svg>
                System Diagnostics
              </button>
              <button className="win2k-panel-item" onClick={() => onNavigate('BOOT_TO_MANUAL')}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="1" width="10" height="14" rx="1" fill="#fffbe0" stroke="#a08000"/><rect x="3" y="1" width="10" height="3" fill="#ffd700"/><rect x="5" y="7" width="6" height="1" rx="0.5" fill="#888"/></svg>
                Optics Manual
              </button>
            </div>
            <div className="win2k-panel-header" style={{marginTop: '16px'}}>About</div>
            <div className="win2k-panel-about">
              <p>LumaForge v1.3.0</p>
              <p>Professional photo editing and color grading engine.</p>
              <p style={{marginTop:'8px', color:'#000080'}}>© 2026 LumaForge</p>
              <p>Creator: Saumya Ganeshe</p>
            </div>
          </div>

          {/* Divider */}
          <div className="win2k-panel-divider"/>

          {/* Main Content */}
          <div className="win2k-main-content">
            <div className="win2k-logo-area">
              <img src="/lf_orange.png" alt="LUMAFORGE" style={{ height: '90px', objectFit: 'contain' }} />
              <div className="win2k-app-title">LUMAFORGE</div>
              <div className="win2k-app-subtitle">Professional Optics Engine — Build v1.3.0</div>
            </div>

            <div className="win2k-status-bar-inner">
              <div className="win2k-led"/>
              <span>System Ready</span>
              <span className="win2k-status-sep">|</span>
              <span>{timeStr}</span>
            </div>

            <div className="win2k-action-area">
              <button className="win2k-btn win2k-btn-primary" onClick={() => document.getElementById('home-upload').click()}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 11 L8 5 L14 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><rect x="5" y="10" width="6" height="4" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
                Open Source File...
              </button>
              <input id="home-upload" type="file" hidden onChange={onUpload} accept="image/*,.cube" />
              <button className="win2k-btn" onClick={() => onNavigate('BOOT_TO_UPLINK')}>Browse Uplink Feed</button>
            </div>

            <div className="win2k-feature-grid">
              <div className="win2k-feature-item">
                <div className="win2k-feature-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="#e0ecff" stroke="#1550a0" strokeWidth="1.5"/><path d="M8 12 L11 15 L16 9" stroke="#1550a0" strokeWidth="2" strokeLinecap="round"/></svg>
                </div>
                <div className="win2k-feature-text">
                  <strong>Color Grading</strong>
                  <span>Professional LUT support</span>
                </div>
              </div>
              <div className="win2k-feature-item">
                <div className="win2k-feature-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" fill="#fff9e0" stroke="#a08000" strokeWidth="1.5"/><polyline points="5,17 9,11 12,14 15,8 19,12" stroke="#a08000" strokeWidth="1.5" fill="none"/></svg>
                </div>
                <div className="win2k-feature-text">
                  <strong>Curves Editor</strong>
                  <span>Advanced tone mapping</span>
                </div>
              </div>
              <div className="win2k-feature-item">
                <div className="win2k-feature-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="#e8ffe8" stroke="#2a7a2a" strokeWidth="1.5"/><circle cx="12" cy="12" r="4" fill="none" stroke="#2a7a2a" strokeWidth="1.5"/><line x1="12" y1="3" x2="12" y2="7" stroke="#2a7a2a" strokeWidth="1.5"/><line x1="12" y1="17" x2="12" y2="21" stroke="#2a7a2a" strokeWidth="1.5"/><line x1="3" y1="12" x2="7" y2="12" stroke="#2a7a2a" strokeWidth="1.5"/><line x1="17" y1="12" x2="21" y2="12" stroke="#2a7a2a" strokeWidth="1.5"/></svg>
                </div>
                <div className="win2k-feature-text">
                  <strong>AI Masking</strong>
                  <span>Intelligent selection tools</span>
                </div>
              </div>
              <div className="win2k-feature-item">
                <div className="win2k-feature-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" fill="#f0e8ff" stroke="#6020a0" strokeWidth="1.5"/><path d="M7 17 L10 10 L13 14 L15 11 L17 17" stroke="#6020a0" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>
                </div>
                <div className="win2k-feature-text">
                  <strong>Cloud Presets</strong>
                  <span>Save and sync your grades</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="win2k-statusbar">
          <div className="win2k-statusbar-section">Ready</div>
          <div className="win2k-statusbar-section">v1.3.0</div>
          <div className="win2k-statusbar-section">
            <a href="https://github.com/sganeshe" target="_blank" rel="noreferrer" className="win2k-link">GitHub</a>
            {' | '}
            <a href="https://www.linkedin.com/in/saumyaganeshe/" target="_blank" rel="noreferrer" className="win2k-link">LinkedIn</a>
            {' | '}
            <a href="https://sganeshe.live/" target="_blank" rel="noreferrer" className="win2k-link">Portfolio</a>
          </div>
        </div>
      </div>

      {/* Taskbar */}
      <div className="win2k-taskbar">
        <button className="win2k-start-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" fill="#1550a0"/><rect x="1" y="1" width="6" height="6" fill="#f00"/><rect x="9" y="1" width="6" height="6" fill="#0f0"/><rect x="1" y="9" width="6" height="6" fill="#00f"/><rect x="9" y="9" width="6" height="6" fill="#ff0"/></svg>
          <strong>Start</strong>
        </button>
        <div className="win2k-taskbar-sep"/>
        <div className="win2k-active-window">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="1" fill="#ffd700"/><path d="M3 6 L6 3 L9 6 L6 9 Z" fill="#b8860b"/></svg>
          LumaForge - Professional Optics Engine
        </div>
        <div style={{flex: 1}}/>
        <div className="win2k-tray">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="5" width="12" height="8" rx="1" fill="#c0c0c0" stroke="#808080"/><path d="M5 5 V3 Q8 1 11 3 V5" fill="#c0c0c0" stroke="#808080"/></svg>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="6" width="6" height="6" rx="0.5" fill="#1550a0"/><rect x="10" y="8" width="4" height="2" rx="0.5" fill="#aaa"/><rect x="10" y="4" width="4" height="2" rx="0.5" fill="#aaa"/><rect x="10" y="12" width="4" height="2" rx="0.5" fill="#aaa"/></svg>
          <span className="win2k-clock">{timeStr}</span>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   MAIN APPLICATION ORCHESTRATOR
   ========================================================================= */

export default function App() {
  const [view, setView] = useState('BOOT'); 
  const [session, setSession] = useState(null);
  const [appPrefs, setAppPrefs] = useState({ animations: true });
  const [showCloud, setShowCloud] = useState(false);
  const [image, setImage] = useState(null);
  const [baseImageData, setBaseImageData] = useState(null); // <-- NEW AI RAW PIXEL DATA
  const [activeTab, setActiveTab] = useState('EDIT');
  
  // Appended new watermark parameters (alignable stacked) to fresh state
  const [settings, setSettings] = useState({
      ...getFreshState(),
      watermark: false,
      watermarkUser: 'sganeshe', // The creator ident
      watermarkAlign: 'right',   // Default bottom-right stack alignment
  });
  
  const deferredSettings = useDeferredValue(settings);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [uiKey, setUiKey] = useState(0);
  const fileInputRef = useRef(null);
  
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Auth Listener (Auth0 or Supabase as seen in original code)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const handleGoHome = () => {
    if (window.confirm("SYSTEM WARNING: Returning to home will discard all unsaved edits. Proceed?")) {
        setView('BOOT_TO_HOME');
        setImage(null);
        setBaseImageData(null); // Clear AI memory
        setSettings(getFreshState());
        setHistory({ past: [], future: [] });
        setShowCloud(false);
    }
  };

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
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

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
      img.crossOrigin = "anonymous"; // CRITICAL FOR CORS / AI EXTRACTION
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

          // ---> RAW PIXEL EXTRACTION FOR WEB WORKER (AI MASKING) <---
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
          setView('BOOT_TO_EDITOR');
      };
      
      img.src = nextImage;
  }, [pushToHistory]);

  const handleUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      processFile(file); 
  };

  const handleAbortLogin = () => setView('BOOT_TO_HOME');

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

  const handleDiagnosticsSignIn = () => setView('BOOT_TO_LOGIN');

  const handleForkFromUplink = (forkedSettings, file) => {
      const visualUrl = URL.createObjectURL(file);
      const img = new Image();
      img.crossOrigin = "anonymous"; // CRITICAL FOR CORS / AI EXTRACTION
      img.onload = () => {
          setSettings({ 
              ...getFreshState(), 
              ...forkedSettings, 
              imageDimensions: { w: img.naturalWidth, h: img.naturalHeight, ratio: img.naturalWidth / img.naturalHeight } 
          });

          // ---> RAW PIXEL EXTRACTION FOR WEB WORKER (AI MASKING) <---
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.naturalWidth;
          tempCanvas.height = img.naturalHeight;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(img, 0, 0);
          setBaseImageData(tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height));

          setImage(visualUrl); 
          setHistory({ past: [], future: [] }); 
          setUiKey(prev => prev + 1); 
          setView('BOOT_TO_EDITOR');
      };
      img.src = visualUrl;
  };

  return (
    <>
      {!appPrefs.animations && <style>{`* { animation: none !important; transition: none !important; }`}</style>}
      {view === 'BOOT' && <BootScreen onComplete={() => setView('HOME')} />}
      {view === 'BOOT_TO_HOME' && <BootScreen onComplete={() => setView('HOME')} />}
      {view === 'BOOT_TO_EDITOR' && <BootScreen onComplete={() => setView('EDITOR')} />}
      {view === 'BOOT_TO_MANUAL' && <BootScreen onComplete={() => setView('MANUAL')} />}
      {view === 'BOOT_TO_DIAGNOSTICS' && <BootScreen onComplete={() => setView('DIAGNOSTICS')} />}
      {view === 'BOOT_TO_LOGIN' && <BootScreen onComplete={() => setView('LOGIN')} />}
      {view === 'BOOT_TO_UPLINK' && <BootScreen onComplete={() => setView('UPLINK')} />} 

      {view === 'HOME' && <HomeScreen onUpload={handleUpload} onNavigate={setView} />}
      {view === 'MANUAL' && <ManualScreen onBack={() => setView('BOOT_TO_HOME')} />}
      {view === 'LOGIN' && <LoginScreen onBack={handleAbortLogin} />}
      {view === 'UPLINK' && <UplinkFeed session={session} onBack={() => setView('BOOT_TO_HOME')} onFork={handleForkFromUplink} />}
      {view === 'DIAGNOSTICS' && <DiagnosticsScreen onBack={() => setView('BOOT_TO_HOME')} session={session} appPrefs={appPrefs} setAppPrefs={setAppPrefs} onSignIn={handleDiagnosticsSignIn}/>}

      {view === 'EDITOR' && (
        <div className="app-shell">
          <LeftSidebar 
            onHome={handleGoHome} 
            onExportImage={async (format) => await exportImage(image, settings, format)} 
            onExportCube={saveCube} 
            onLoadPreset={handleCloudLoad}
            onImportFile={() => fileInputRef.current.click()} 
            onSaveToCloud={handleSaveToCloud} 
            session={session} 
            setShowAuth={() => setView('BOOT_TO_LOGIN')}
            currentSettings={settings} 
            imageSrc={image}
          />

          <input ref={fileInputRef} type="file" hidden accept="image/*,.cube" onChange={handleUpload} onClick={(e) => e.target.value = null} />

          <div className="canvas-area" key={`stage-${uiKey}`}>
            <div style={{position:'absolute', inset:0, opacity:0.3, pointerEvents:'none', backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '80px 80px'}}/>
            <ImageStage imageSrc={image} settings={deferredSettings} setSettings={setSettings} activeTab={activeTab} />
            <div className="canvas-hud">
              {/* LEFT SIDE: History Controls */}
              <div className="hud-group">
                <button className="hud-btn" onClick={undo} disabled={history.past.length === 0} title="Undo (Ctrl+Z)">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>
                </button>
                <button className="hud-btn" onClick={redo} disabled={history.future.length === 0} title="Redo (Ctrl+Y)">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13"/></svg>
                </button>
              </div>

              {/* RIGHT SIDE: Viewport Controls */}
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
            image={image} 
            session={session}                                 /* PASS SESSION DOWN */
            onRequireAuth={() => setView('BOOT_TO_LOGIN')}    /* PASS AUTH REDIRECT DOWN */
            baseImageData={baseImageData}                     /* ---> NEW AI RAW PIXEL DATA PASSED DOWN <--- */
          />

          {showCloud && <CloudMenu session={session} settings={settings} imageSrc={image} onLoadProject={handleCloudLoad} onClose={() => setShowCloud(false)} />}
        </div>
      )}
    </>
  );
}
