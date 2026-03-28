import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import CurvesEditor from './CurvesEditor';
import MaskingEditor from './MaskingEditor'; 
import { HexColorPicker } from "react-colorful";
import { analyzeAndEnhance } from '../Engine/AutoEnhance';
import { supabase } from '../../lib/supabaseClient';
// --- NEW IMPORT: Bring in the real rendering engine ---
import { runCorePipeline } from '../Engine/CorePipeline';

// =========================================================================
// UPLINK BROWSER COMPONENT (WITH PERFECT HOVER PREVIEW)
// =========================================================================
const UplinkBrowser = memo(({ setSettings, onSnapshot, image }) => {
    const [feed, setFeed] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Hover Preview State
    const [hoveredPreset, setHoveredPreset] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [perfectPreviewUrl, setPerfectPreviewUrl] = useState(null);

    useEffect(() => {
        const loadFeed = async () => {
            try {
                const { data, error } = await supabase
                    .from('uplink_posts')
                    .select('id, preset_name, settings, created_at')
                    .order('created_at', { ascending: false })
                    .limit(50);
                
                if (!error && data) {
                    setFeed(data);
                }
            } catch (err) {
                console.error("[LUMAFORGE_NETWORK_FAULT] Failed to fetch Uplink Feed", err);
            } finally {
                setLoading(false);
            }
        };
        loadFeed();
    }, []);

    // --- NEW: ASYNC PERFECT PREVIEW GENERATOR ---
    useEffect(() => {
        let isMounted = true;

        if (!hoveredPreset || !image) {
            setPerfectPreviewUrl(null);
            return;
        }

        const generatePerfectPreview = async () => {
            try {
                const parsedSettings = typeof hoveredPreset.settings === 'string' 
                    ? JSON.parse(hoveredPreset.settings) 
                    : hoveredPreset.settings;

                // Run the actual engine, but cap the size at 300px so it processes in ~15ms
                const renderedCanvas = await runCorePipeline(image, parsedSettings, 300);
                
                if (isMounted) {
                    setPerfectPreviewUrl(renderedCanvas.toDataURL('image/jpeg', 0.8));
                }
            } catch (err) {
                console.warn("[LUMAFORGE_PREVIEW_FAULT] Failed to generate exact preview", err);
            }
        };

        generatePerfectPreview();

        return () => { isMounted = false; };
    }, [hoveredPreset, image]);

    const handleApplyPreset = (presetSettings) => {
        onSnapshot(); 
        setSettings(prev => {
            const incomingSettings = typeof presetSettings === 'string' ? JSON.parse(presetSettings) : presetSettings;
            return {
                ...prev,
                ...incomingSettings,
                imageDimensions: prev.imageDimensions,
                crop: prev.crop,
                cropApplied: prev.cropApplied,
                rotate: prev.rotate,
                flipX: prev.flipX,
                flipY: prev.flipY,
                aspectRatio: prev.aspectRatio,
                semanticMask: prev.semanticMask,
                maskWidth: prev.maskWidth,
                maskHeight: prev.maskHeight,
                invertMask: prev.invertMask,
                showMaskOverlay: prev.showMaskOverlay
            };
        });
    };

    // We keep this as an instant visual fallback for the 15ms it takes the engine to boot
    const getApproximateCss = (s) => {
        if (!s) return 'none';
        const parsed = typeof s === 'string' ? JSON.parse(s) : s;
        const blurPx = parsed.sharpen < 0 ? Math.abs(parsed.sharpen) * 0.05 : 0;
        return `
            brightness(${100 + ((parsed.exposure||0) * 20)}%) 
            contrast(${100 + (parsed.contrast||0) + ((parsed.dehaze||0)/4)}%) 
            saturate(${100 + (parsed.saturation||0) + (parsed.vibrance||0) + ((parsed.dehaze||0)/4)}%) 
            sepia(${parsed.sepia||0}%) invert(${parsed.invert||0}%) hue-rotate(${parsed.hue||0}deg)
            blur(${blurPx}px)
        `;
    };

    const handleMouseMove = (e, item) => {
        setMousePos({ x: e.clientX, y: e.clientY });
        if (hoveredPreset?.id !== item.id) {
            setHoveredPreset(item);
        }
    };

    return (
        <div className="control-section" style={{ position: 'relative' }}>
            <div className="panel-header">THE UPLINK FEED</div>
            <p style={{fontSize: 10, color: '#888', marginBottom: 15, fontFamily: 'monospace'}}>
                GLOBAL COMMUNITY PRESETS
            </p>
            
            {loading ? (
                <div className="status-label" style={{ color: '#ffb800' }}>[ DOWNLOADING FEED... ]</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {feed.map(item => (
                        <div 
                            key={item.id} 
                            onMouseMove={(e) => handleMouseMove(e, item)}
                            onMouseLeave={() => setHoveredPreset(null)}
                            style={{
                                background: 'rgba(255,255,255,0.03)', 
                                border: '1px solid rgba(255,255,255,0.1)',
                                padding: '12px', 
                                borderRadius: '6px', 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                transition: 'all 0.2s ease',
                                cursor: 'crosshair'
                            }}
                            className="uplink-card-hover"
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                                <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                    {item.preset_name ? item.preset_name.toUpperCase() : 'UNTITLED PRESET'}
                                </span>
                                <span style={{ color: '#666', fontSize: '9px', fontFamily: 'monospace' }}>
                                    NET_ID: {item.id.substring(0, 8)}
                                </span>
                            </div>
                            <button 
                                className="btn-tech primary" 
                                style={{ padding: '6px 14px', fontSize: '10px', marginLeft: '10px' }}
                                onClick={() => handleApplyPreset(item.settings)}
                            >
                                APPLY
                            </button>
                        </div>
                    ))}
                    {feed.length === 0 && (
                        <div className="status-label">NO PRESETS DETECTED IN MAINFRAME.</div>
                    )}
                </div>
            )}

            {/* FLOATING SPLIT-SCREEN HOVER PREVIEW */}
            {hoveredPreset && image && (
                <div style={{
                    position: 'fixed',
                    top: Math.max(20, Math.min(window.innerHeight - 220, mousePos.y - 100)),
                    left: mousePos.x - 260, 
                    width: '220px',
                    height: '220px',
                    zIndex: 99999,
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
                    border: '2px solid rgba(255,184,0,0.5)',
                    backgroundColor: '#050505',
                    pointerEvents: 'none',
                    animation: 'fade-up 0.2s ease-out'
                }}>
                    {/* ORIGINAL (LEFT HALF) */}
                    <div style={{ position: 'absolute', inset: 0, clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' }}>
                        <img src={image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Original" />
                    </div>
                    
                    {/* EDITED (RIGHT HALF) */}
                    <div style={{ position: 'absolute', inset: 0, clipPath: 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)' }}>
                        {perfectPreviewUrl ? (
                            <img 
                                src={perfectPreviewUrl} 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                alt="Perfect Preview" 
                            />
                        ) : (
                            <img 
                                src={image} 
                                style={{ 
                                    width: '100%', height: '100%', objectFit: 'cover', 
                                    filter: getApproximateCss(hoveredPreset.settings) 
                                }} 
                                alt="Approximate Preview" 
                            />
                        )}
                    </div>

                    {/* DIVIDER LINE & BADGES */}
                    <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '2px', backgroundColor: 'var(--amber)' }} />
                    <div style={{ position: 'absolute', bottom: 5, left: 5, fontSize: 9, background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>ORIGINAL</div>
                    <div style={{ position: 'absolute', bottom: 5, right: 5, fontSize: 9, background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>PREVIEW</div>
                </div>
            )}
        </div>
    );
});

// =========================================================================
// EXISTING UI COMPONENTS
// =========================================================================

const Histogram = memo(({ imageSrc, exposure, contrast, whites, blacks, shadows, highlights }) => {
    const canvasRef = useRef(null);
    const [refresh, setRefresh] = useState(0);

    useEffect(() => { 
        const h = setTimeout(() => setRefresh(r => r + 1), 150); 
        return () => clearTimeout(h); 
    }, [exposure, contrast, whites, blacks, shadows, highlights]);

    useEffect(() => {
        if (!imageSrc || !canvasRef.current) return;
        const img = new Image(); 
        img.src = imageSrc;
        
        img.onload = () => {
            const cvs = canvasRef.current; 
            if(!cvs) return;
            const ctx = cvs.getContext('2d');
            const w = 250; const h = 100;
            cvs.width = w; cvs.height = h;

            ctx.drawImage(img, 0, 0, w, h);
            const data = ctx.getImageData(0,0,w,h).data;
            
            const rH = new Array(256).fill(0);
            const gH = new Array(256).fill(0);
            const bH = new Array(256).fill(0);
            
            for(let i=0; i<data.length; i+=4) { 
                rH[data[i]]++; gH[data[i+1]]++; bH[data[i+2]]++; 
            }
            
            const max = Math.max(...rH, ...gH, ...bH) || 1;
            
            ctx.clearRect(0, 0, w, h); 
            ctx.globalCompositeOperation = 'screen';
            
            const draw = (arr, c) => { 
                ctx.fillStyle = c; 
                ctx.beginPath(); 
                ctx.moveTo(0, h); 
                for(let i=0; i<256; i++){
                    const val = (arr[i] + (arr[i-1]||arr[i]) + (arr[i+1]||arr[i])) / 3;
                    ctx.lineTo((i/255)*w, h - (val/max)*h); 
                } 
                ctx.lineTo(w, h); 
                ctx.fill(); 
            };
            
            draw(rH, 'rgba(255, 50, 50, 0.6)'); 
            draw(gH, 'rgba(50, 255, 50, 0.6)'); 
            draw(bH, 'rgba(50, 80, 255, 0.6)');
        };
    }, [imageSrc, refresh]);

    return (
        <div className="histogram-wrapper" style={{marginBottom:24}}>
            <div className="control-header" style={{margin:'10px 0 0 10px'}}>
                <label>RGB SIGNALS</label>
            </div>
            <canvas ref={canvasRef} className="histogram-canvas"/>
        </div>
    );
});

const SmartSlider = memo(({ label, value, min, max, onChange, onSnapshot, def = 0, compact = false }) => {
    const [localValue, setLocalValue] = useState(value);
    const [isDragging, setIsDragging] = useState(false);
    const lastUpdate = useRef(0);

    useEffect(() => { 
        if (!isDragging) setLocalValue(value); 
    }, [value, isDragging]);

    const handleMouseDown = () => { 
        if (onSnapshot) onSnapshot();
        setIsDragging(true); 
    };

    const handleChange = (e) => {
        const newVal = parseFloat(e.target.value);
        setLocalValue(newVal); 
        
        const now = Date.now();
        if (now - lastUpdate.current > 30) { 
            onChange(newVal); 
            lastUpdate.current = now; 
        }
    };

    const handleMouseUp = () => { 
        setIsDragging(false); 
        onChange(localValue);
    };

    return (
        <div className={compact ? "" : "control-group"}>
            <div className="control-header" style={compact ? {marginBottom:2, fontSize:9, color:'#666'} : {}}>
                <label>{label}</label>
                <span className="control-val" style={compact ? {fontSize:9} : {}}>{Math.round(localValue)}</span>
            </div>
            <input 
                type="range" min={min} max={max} step={max > 10 ? 1 : 0.1} 
                value={localValue} 
                onMouseDown={handleMouseDown} 
                onChange={handleChange} 
                onMouseUp={handleMouseUp}
                onDoubleClick={() => { 
                    if(onSnapshot) onSnapshot(); 
                    setLocalValue(def); 
                    onChange(def); 
                }}
            />
        </div>
    );
});

const SmartColorPicker = memo(({ value, onChange, onSnapshot }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [localColor, setLocalColor] = useState(value); 
    const popoverRef = useRef();

    useEffect(() => {
        if (!isOpen) {
            setLocalColor(value);
        }
    }, [value, isOpen]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const handleLiveChange = (newColor) => {
        setLocalColor(newColor); 
        onChange(newColor);      
    };

    return (
        <div style={{ position: 'relative', marginTop: 5 }}>
            <div 
                style={{
                    width: 40, 
                    height: 40, 
                    backgroundColor: localColor, 
                    cursor: 'pointer', 
                    borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}
                onClick={() => {
                    if (!isOpen && onSnapshot) onSnapshot(); 
                    setIsOpen(true);
                }}
            />

            {isOpen && (
                <div 
                    ref={popoverRef}
                    style={{ 
                        position: 'absolute', 
                        top: 50, 
                        left: 0, 
                        zIndex: 9999,
                        background: '#1a1a1a',
                        padding: '10px',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.8)',
                        border: '1px solid #333'
                    }}
                >
                    <HexColorPicker 
                        color={localColor} 
                        onChange={handleLiveChange} 
                    />
                </div>
            )}
        </div>
    );
});

const GradeControl = memo(({ label, tone, settings, setSettings, onSnapshot }) => {
    const handleHex = useCallback((hex) => {
        const r = parseInt(hex.slice(1,3),16)/255;
        const g = parseInt(hex.slice(3,5),16)/255;
        const b = parseInt(hex.slice(5,7),16)/255;
        setSettings(p => ({
            ...p, 
            gradingHex: {...p.gradingHex, [tone]: hex}, 
            grading: {...p.grading, [tone]: {r, g, b}}
        }));
    }, [setSettings, tone]);

    return (
        <div style={{marginBottom: 20}}>
            <div className="control-header" style={{marginBottom:5}}><label>{label}</label></div>
            <div style={{display:'flex', gap:15, alignItems:'flex-start', marginBottom:10}}>
                <SmartColorPicker 
                    value={settings.gradingHex?.[tone] || "#808080"} 
                    onChange={handleHex} 
                    onSnapshot={onSnapshot}
                />
                <div style={{flex:1}}>
                    <SmartSlider 
                        label="BLEND" compact={true} min={0} max={100} 
                        value={settings.gradingBlend[tone]} 
                        onChange={v => setSettings(p => ({...p, gradingBlend: {...p.gradingBlend, [tone]: v}}))} 
                        onSnapshot={onSnapshot}
                    />
                    <div style={{height: 8}} /> 
                    <SmartSlider 
                        label="LUMA" compact={true} min={-100} max={100} 
                        value={settings.gradingLum[tone]} 
                        onChange={v => setSettings(p => ({...p, gradingLum: {...p.gradingLum, [tone]: v}}))} 
                        onSnapshot={onSnapshot}
                    />
                </div>
            </div>
        </div>
    );
});

const EditorControls = ({ activeTab, setActiveTab, settings, setSettings, onSnapshot, onReset, image, session, onRequireAuth, baseImageData }) => {
  
  const update = useCallback((key, val) => setSettings(p => ({ ...p, [key]: val })), [setSettings]);

  const applyAspect = useCallback((baseRatioName) => {
      onSnapshot(); 
      setSettings(prev => {
          if (baseRatioName === 'FREE') return { ...prev, aspectRatio: 'FREE', cropApplied: false, crop: { ...prev.crop, aspect: null } };
          
          const imgRatio = prev.imageDimensions?.ratio || 1;
          if (baseRatioName === 'ORIGINAL') {
              return { ...prev, aspectRatio: 'ORIGINAL', cropApplied: false, crop: { ...prev.crop, aspect: imgRatio } };
          }
          
          let newRatioName = baseRatioName;
          const flippedBase = baseRatioName.includes(':') ? baseRatioName.split(':').reverse().join(':') : null;

          if (prev.aspectRatio === baseRatioName && baseRatioName !== '1:1') {
              newRatioName = flippedBase;
          } else if (prev.aspectRatio === flippedBase) {
              newRatioName = baseRatioName;
          }

          const [wStr, hStr] = newRatioName.split(':');
          const targetRatio = parseFloat(wStr) / parseFloat(hStr);
          
          let w = 60; 
          let h = w / (targetRatio * (1/imgRatio));
          if (h > 80) { h = 80; w = h * (targetRatio * (1/imgRatio)); }
          
          return { 
              ...prev, 
              aspectRatio: newRatioName, 
              cropApplied: false, 
              crop: { x: 50-(w/2), y: 50-(h/2), width: w, height: h, aspect: targetRatio }
          };
      });
  }, [setSettings, onSnapshot]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleMagicAuto = async () => {
      if (!image) return;
      setIsAnalyzing(true);
      onSnapshot(); 
      
      const optimalSettings = await analyzeAndEnhance(image);
      
      if (optimalSettings) {
          setSettings(prev => ({
              ...prev,
              exposure: optimalSettings.exposure,
              contrast: optimalSettings.contrast,
              temp: optimalSettings.temp,
              tint: optimalSettings.tint,
              shadows: optimalSettings.shadows,
              highlights: optimalSettings.highlights,
              saturation: optimalSettings.saturation,
              vibrance: optimalSettings.vibrance
          }));
      }
      setIsAnalyzing(false);
  };

  return (
    <div className="editor-controls">
      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        {['CROP', 'EDIT', 'COLOR', 'CURVES', 'MASK', 'FX', 'UPLINK', 'DATA'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={activeTab===tab?'active':''} style={{ flex: '1 1 auto', fontSize: '10px' }}>
                {tab}
            </button>
        ))}
      </div>

      <div className="controls-scroll">
        
        {/* 1. CROP */}
        {activeTab === 'CROP' && (
           <div className="control-section">
             <div className="panel-header">GEOMETRY</div>
             <div className="btn-grid-2">
                <button onClick={()=>{
                    onSnapshot(); 
                    setSettings(p => ({ 
                        ...p, 
                        rotate: (p.rotate - 90 + 360) % 360, 
                        cropApplied: false, 
                        aspectRatio: 'ORIGINAL', 
                        crop: { x: 10, y: 10, width: 80, height: 80, aspect: null } 
                    }));
                }}>ROTATE L</button>
                <button onClick={()=>{
                    onSnapshot(); 
                    setSettings(p => ({ 
                        ...p, 
                        rotate: (p.rotate + 90) % 360, 
                        cropApplied: false, 
                        aspectRatio: 'ORIGINAL', 
                        crop: { x: 10, y: 10, width: 80, height: 80, aspect: null } 
                    }));
                }}>ROTATE R</button>
                <button onClick={()=>{onSnapshot(); update('flipX', !settings.flipX);}}>FLIP HORIZONTAL</button>
                <button onClick={()=>{onSnapshot(); update('flipY', !settings.flipY);}}>FLIP VERTICAL</button>
             </div>
             <div className="sidebar-divider" />
             <div className="panel-header">ASPECT RATIO</div>
             <div className="btn-grid-2">
                {['ORIGINAL','FREE','1:1','16:9','4:5','2:3'].map(baseR => {
                    const flippedR = baseR.includes(':') ? baseR.split(':').reverse().join(':') : null;
                    const isActive = settings.aspectRatio === baseR || settings.aspectRatio === flippedR;
                    const displayLabel = isActive && settings.aspectRatio === flippedR && baseR !== '1:1' ? flippedR : baseR;

                    return (
                        <button key={baseR} className={isActive ? 'active' : ''} 
                            onClick={() => applyAspect(baseR)}>
                            {displayLabel}
                        </button>
                    )
                })}
             </div>
             <div className="sidebar-divider" />
             {settings.aspectRatio !== 'ORIGINAL' && (
                <button className="primary-btn" style={{marginTop:20}} onClick={() => { onSnapshot(); setSettings(p => ({...p, cropApplied: !p.cropApplied})); }}>
                    {settings.cropApplied ? "UNLOCK CROP" : "APPLY CROP"}
                </button>
             )}
           </div>
        )}

        {/* 2. LIGHT */}
        {activeTab === 'EDIT' && (
          <div className="control-section">
            <div className="panel-header">
                <span>TONE MAPPING</span>
                <button 
                    onClick={handleMagicAuto} 
                    disabled={isAnalyzing}
                    style={{
                        background: 'rgba(255, 184, 0, 0.15)', color: 'var(--amber)', border: '1px solid var(--amber)',
                        padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontFamily: 'var(--font-mono)',
                        cursor: isAnalyzing ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                >
                    {isAnalyzing ? 'ANALYZING...' : '🪄 AUTO FIX'}
                </button>
            </div>
            {['exposure','contrast','highlights','shadows','whites','blacks'].map(k => 
                <SmartSlider key={k} label={k.toUpperCase()} value={settings[k]} 
                    min={k==='exposure'? -5:-100} max={k==='exposure'?5:100} 
                    onChange={v=>update(k,v)} onSnapshot={onSnapshot}
                />
            )}
          </div>
        )}

        {/* 3. COLOR */}
        {activeTab === 'COLOR' && (
          <div className="control-section">
            <div className="panel-header">BALANCE</div>
            {['temp','tint','saturation','vibrance'].map(k => 
                <SmartSlider key={k} label={k.toUpperCase()} value={settings[k]} min={-100} max={100} onChange={v=>update(k,v)} onSnapshot={onSnapshot}/>
            )}
            <div className="divider" />
            <div className="panel-header">COLOR GRADING</div>
            {['shadows','midtones','highlights'].map(t => 
                <GradeControl key={t} label={t.toUpperCase()} tone={t} settings={settings} setSettings={setSettings} onSnapshot={onSnapshot}/>
            )}
          </div>
        )}

        {/* 4. CURVES */}
        {activeTab === 'CURVES' && (
          <div className="control-section">
             <div className="panel-header">RGB CURVES</div>
             <p style={{fontSize:10, color:'#666', marginBottom:20, fontFamily:'var(--font-ui)'}}>
                Click to add point. Double-click to remove.
             </p>
             <CurvesEditor settings={settings} setSettings={setSettings} onSnapshot={onSnapshot} />
          </div>
        )}

        {/* 5. MASKING PANEL */}
        {activeTab === 'MASK' && (
            <MaskingEditor 
                sourceImageData={baseImageData} 
                settings={settings} 
                setSettings={setSettings} 
            />
        )}

        {/* 6. FX */}
        {activeTab === 'FX' && (
          <div className="control-section">
            <div className="panel-header">OPTICS</div>
            {['sharpen','dehaze','vignette'].map(k => 
                <SmartSlider key={k} label={k.toUpperCase().replace('SHARPEN','SHARPEN / BLUR')} value={settings[k]} min={-100} max={100} onChange={v=>update(k,v)} onSnapshot={onSnapshot}/>
            )}
            
            <div className="divider" />
            <div className="panel-header">FILM EMULATION</div>
            {['grainAmount','grainSize','grainRoughness'].map(k => 
                <SmartSlider key={k} label={k.replace('grain','').toUpperCase()} value={settings[k]} min={0} max={100} onChange={v=>update(k,v)} onSnapshot={onSnapshot}/>
            )}
            
            <div className="divider" />
            <div className="panel-header">BLOOM</div> 
            <SmartSlider label="INTENSITY" value={settings.halationAmount} min={0} max={100} onChange={v=>update('halationAmount',v)} onSnapshot={onSnapshot}/>
            <SmartSlider label="THRESHOLD" value={settings.halationThreshold} min={0} max={100} onChange={v=>update('halationThreshold',v)} onSnapshot={onSnapshot}/>
          </div>
        )}

        {/* 7. NEW UPLINK PANEL */}
        {activeTab === 'UPLINK' && (
            <UplinkBrowser setSettings={setSettings} onSnapshot={onSnapshot} image={image} />
        )}

        {/* 8. DATA */}
        {activeTab === 'DATA' && (
           <div className="control-section">
              <div className="panel-header">SYSTEM I/O</div>
              <Histogram imageSrc={image} exposure={settings.exposure} contrast={settings.contrast} whites={settings.whites} blacks={settings.blacks} shadows={settings.shadows} highlights={settings.highlights}/>
              
              <div style={{marginTop: 20}}>
                  <button 
                      onClick={() => {
                          if (!session) {
                              onRequireAuth(); 
                              return;
                          }
                          update('watermark', !settings.watermark);
                      }} 
                      className={`btn-toggle ${settings.watermark && session ? 'active' : ''}`} 
                      style={{ marginBottom: 10, opacity: session ? 1 : 0.6, borderColor: !session ? '#444' : '' }}
                  >
                      {!session ? 'WATERMARK (LOGIN REQUIRED)' : (settings.watermark ? 'WATERMARK: ACTIVE' : 'WATERMARK: INACTIVE')}
                  </button>

                  {settings.watermark && session && (
                      <div className="control-subgroup" style={{background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 4, border: '1px solid #333'}}>
                          <div className="control-header" style={{marginBottom: 5}}><label>CREATOR IDENT</label></div>
                          <input 
                              type="text" 
                              value={settings.watermarkUser || ''} 
                              onChange={e => update('watermarkUser', e.target.value)} 
                              style={{width: '100%', background: '#0a0a0a', border: '1px solid #444', color: 'var(--accent)', padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 10, boxSizing: 'border-box'}}
                              placeholder="username"
                          />
                          
                          <div className="control-header" style={{marginBottom: 5}}><label>ALIGNMENT</label></div>
                          <div className="btn-grid-3">
                              <button onClick={()=>update('watermarkAlign', 'left')} className={settings.watermarkAlign === 'left' ? 'active' : ''}>← LEFT</button>
                              <button onClick={()=>update('watermarkAlign', 'center')} className={settings.watermarkAlign === 'center' ? 'active' : ''}>↔ CTR</button>
                              <button onClick={()=>update('watermarkAlign', 'right')} className={settings.watermarkAlign === 'right' ? 'active' : ''}>→ RIGHT</button>
                          </div>
                      </div>
                  )}
              </div>
           </div>
        )}
      </div>

      <div className="action-bar">
        <button className="btn-reset" onClick={onReset}>RESET ALL</button>
      </div>
    </div>
  );
};

export default EditorControls;