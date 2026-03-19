import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import CurvesEditor from './CurvesEditor';
import { HexColorPicker } from "react-colorful";
import { analyzeAndEnhance } from '../Engine/AutoEnhance';

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

const EditorControls = ({ activeTab, setActiveTab, settings, setSettings, onSnapshot, onReset, image, session, onRequireAuth }) => {
  
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
      <div className="tabs">
        {['CROP', 'EDIT', 'COLOR', 'CURVES', 'FX', 'DATA'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={activeTab===tab?'active':''}>{tab}</button>
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
             <div className="divider"/><label className="control-header">ASPECT RATIO</label>
             <div className="aspect-grid">
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
                        background: 'rgba(255, 184, 0, 0.15)',
                        color: 'var(--amber)',
                        border: '1px solid var(--amber)',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        cursor: isAnalyzing ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
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

        {/* 5. FX */}
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

        {/* 6. DATA */}
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
                      style={{
                          marginBottom: 10, 
                          opacity: session ? 1 : 0.6,
                          borderColor: !session ? '#444' : ''
                      }}
                  >
                      {!session ? '🔒 WATERMARK (LOGIN REQUIRED)' : (settings.watermark ? 'WATERMARK: ACTIVE' : 'WATERMARK: INACTIVE')}
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