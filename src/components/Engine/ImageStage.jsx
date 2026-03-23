/**
 * @file ImageStage.jsx
 * @description The primary interactive viewport for LUMAFORGE. 
 */

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { runCorePipeline } from './CorePipeline'; 

const ImageStage = ({ imageSrc, settings, setSettings, activeTab }) => {
  const containerRef = useRef(null);
  
  const [renderedUrl, setRenderedUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [renderError, setRenderError] = useState(false); 
  
  const [dragMode, setDragMode] = useState(null); 
  const [isCompare, setIsCompare] = useState(false); 
  const startPos = useRef({ x: 0, y: 0, cx: 0, cy: 0, cw: 0, ch: 0 });

  const pixelSettings = useMemo(() => {
      const { crop, cropApplied, rotate, flipX, flipY, zoom, aspectRatio, imageDimensions, watermark, ...colors } = settings;
      return colors;
  }, [settings]);

  useEffect(() => {
      if (!imageSrc) return;
      let isCancelled = false; 
      
      const render = async () => {
          setIsProcessing(true);
          setRenderError(false);
          try {
              const resultCanvas = await runCorePipeline(imageSrc, settings, 1200); 
              if (!isCancelled) setRenderedUrl(resultCanvas.toDataURL('image/png'));
          } catch(e) { 
              console.error("[LUMAFORGE_STAGE_FAULT] Live Render Failed:", e); 
              if (!isCancelled) setRenderError(true);
          }
          setIsProcessing(false);
      };
      
      const timeoutId = setTimeout(render, 50); 
      return () => { isCancelled = true; clearTimeout(timeoutId); };
  }, [imageSrc, pixelSettings]); 

  const isRotated = settings.rotate === 90 || settings.rotate === 270;

  const stageAspectRatio = useMemo(() => {
    let baseRatio = settings.imageDimensions?.ratio || 1;
    // Swap the container aspect ratio to hug the rotated image
    if (isRotated) baseRatio = 1 / baseRatio;
    
    if (!settings.cropApplied) return baseRatio;
    return (settings.crop.width / Math.max(1, settings.crop.height)) * baseRatio;
  }, [settings.crop, settings.cropApplied, settings.imageDimensions, isRotated]);

  // 1. UNIFIED POINTER DOWN HANDLER
  const handlePointerDown = (e, mode) => {
    if (!showCropOverlay) return;
    e.stopPropagation(); 
    setDragMode(mode);

    // Extract coordinates whether it's a mouse click or a screen touch
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    startPos.current = { 
        x: clientX, y: clientY, cx: settings.crop.x, cy: settings.crop.y, 
        cw: settings.crop.width, ch: settings.crop.height 
    };
  };

  // 2. UNIFIED POINTER MOVE HANDLER
  const handlePointerMove = (e) => {
    if (!dragMode || !containerRef.current) return;
    
    // Safely extract coordinates to prevent mobile crashing
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const rect = containerRef.current.getBoundingClientRect();
    
    const dx = ((clientX - startPos.current.x) / rect.width) * 100;
    const dy = ((clientY - startPos.current.y) / rect.height) * 100;
    let { cx, cy, cw, ch } = startPos.current; 
    let next = { x: cx, y: cy, width: cw, height: ch };

    if (dragMode === 'MOVE') {
      next.x = Math.max(0, Math.min(100 - cw, cx + dx)); 
      next.y = Math.max(0, Math.min(100 - ch, cy + dy));
    } else {
      if (dragMode.includes('N')) { const d = Math.min(Math.max(dy, -cy), ch - 10); next.y = cy + d; next.height = ch - d; }
      if (dragMode.includes('S')) next.height = Math.min(100 - cy, Math.max(10, ch + dy));
      if (dragMode.includes('W')) { const d = Math.min(Math.max(dx, -cx), cw - 10); next.x = cx + d; next.width = cw - d; }
      if (dragMode.includes('E')) next.width = Math.min(100 - cx, Math.max(10, cw + dx));
    }
    
    if (settings.crop.aspect && dragMode !== 'MOVE') {
       const imgRatio = settings.imageDimensions.ratio || 1;
       if (dragMode.includes('E') || dragMode.includes('W')) {
           const requiredHeight = next.width / (settings.crop.aspect * (1/imgRatio));
           if (next.y + requiredHeight <= 100) { next.height = requiredHeight; } 
           else { next.height = 100 - next.y; next.width = next.height * (settings.crop.aspect * (1/imgRatio)); }
       } else {
           const requiredWidth = next.height * (settings.crop.aspect * (1/imgRatio));
           if (next.x + requiredWidth <= 100) { next.width = requiredWidth; } 
           else { next.width = 100 - next.x; next.height = next.width / (settings.crop.aspect * (1/imgRatio)); }
       }
    }
    setSettings(p => ({ ...p, crop: { ...p.crop, ...next } }));
  };

  const handleMouseUp = () => setDragMode(null);

  if (!imageSrc) return null;

  const showCropOverlay = activeTab === 'CROP' && settings.aspectRatio !== 'ORIGINAL' && !settings.cropApplied;

  const totalScale = 1 + (settings.zoom / 100);
  
  const cropStyle = settings.cropApplied 
        ? { width: `${100 * (100/Math.max(1, settings.crop.width))}%`, height: `${100 * (100/Math.max(1, settings.crop.height))}%`, transform: `translate(${-settings.crop.x}%, ${-settings.crop.y}%)`, transformOrigin: '0 0' } 
        : { width: '100%', height: '100%', transform: 'none', transformOrigin: '50% 50%' };
        
  // GEOMETRY FIX: Anti-Squish scaling
  const imgScaleW = isRotated ? (settings.imageDimensions?.ratio || 1) : 1;
  const imgScaleH = isRotated ? (1 / (settings.imageDimensions?.ratio || 1)) : 1;

  const sharedImgStyle = { 
      width: `${imgScaleW * 100}%`, height: `${imgScaleH * 100}%`, display: 'block', 
      position: 'absolute', top: '50%', left: '50%', objectFit: 'fill', 
      transform: `translate(-50%, -50%) scaleX(${settings.flipX?-1:1}) scaleY(${settings.flipY?-1:1}) rotate(${settings.rotate}deg) scale(${totalScale})`, 
      transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)' 
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
      <div 
         ref={containerRef} 
         /* BIND BOTH MOUSE AND TOUCH EVENTS TO THE CONTAINER */
         onMouseMove={handlePointerMove} onTouchMove={handlePointerMove}
         onMouseUp={handleMouseUp} onTouchEnd={handleMouseUp} onMouseLeave={handleMouseUp} 
         style={{ position: 'relative', aspectRatio: `${stageAspectRatio}`, maxHeight: '100%', maxWidth: '100%', height: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflow: 'hidden', background: '#0a0a0a', touchAction: 'none' }}
      >
        <div style={{ ...cropStyle, position: 'absolute', top: 0, left: 0 }}>
           <img src={imageSrc} style={sharedImgStyle} draggable={false} alt="Original" />
           <img 
              src={renderedUrl || imageSrc} 
              style={{ ...sharedImgStyle, opacity: isCompare || renderError || !renderedUrl ? 0 : 1, transition: 'opacity 0.15s ease-out' }} 
              draggable={false} alt="Rendered" 
           />
        </div>

        {/* HUD: Compare Button (Moved top right so it doesn't block the image) */}
        <button 
           onMouseDown={() => setIsCompare(true)} onMouseUp={() => setIsCompare(false)} onMouseLeave={() => setIsCompare(false)}
           onTouchStart={() => setIsCompare(true)} onTouchEnd={() => setIsCompare(false)} 
           style={{ position: 'absolute', top: 15, right: 15, zIndex: 999, background: 'rgba(14,14,14,0.8)', color: 'var(--accent)', border: '1px solid #444', padding: '8px 12px', fontSize: 10, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold', borderRadius: 4, backdropFilter: 'blur(5px)' }}
        >
            {isCompare ? 'ORIGINAL' : 'COMPARE'}
        </button>

        {/* CROP OVERLAY (Interactive 8-way drag with correct Pointer functions) */}
        {showCropOverlay && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
            <div 
               onMouseDown={(e) => handlePointerDown(e, 'MOVE')} 
               onTouchStart={(e) => handlePointerDown(e, 'MOVE')}
               style={{ position: 'absolute', left: `${settings.crop.x}%`, top: `${settings.crop.y}%`, width: `${settings.crop.width}%`, height: `${settings.crop.height}%`, boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)', border: '1px solid var(--accent)', cursor: 'move' }}
            >
               <div onMouseDown={e=>{e.stopPropagation(); handlePointerDown(e,'NW')}} onTouchStart={e=>{e.stopPropagation(); handlePointerDown(e,'NW')}} className="crop-handle nw" />
               <div onMouseDown={e=>{e.stopPropagation(); handlePointerDown(e,'NE')}} onTouchStart={e=>{e.stopPropagation(); handlePointerDown(e,'NE')}} className="crop-handle ne" />
               <div onMouseDown={e=>{e.stopPropagation(); handlePointerDown(e,'SW')}} onTouchStart={e=>{e.stopPropagation(); handlePointerDown(e,'SW')}} className="crop-handle sw" />
               <div onMouseDown={e=>{e.stopPropagation(); handlePointerDown(e,'SE')}} onTouchStart={e=>{e.stopPropagation(); handlePointerDown(e,'SE')}} className="crop-handle se" />
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 999, color: 'var(--accent)', fontSize: '9px', fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.5)', padding: '4px 6px', borderRadius: 2 }}>PROCESSING...</div>}
        {renderError && <div style={{ position: 'absolute', top: 30, left: 10, zIndex: 999, color: '#ff4444', fontSize: '9px', fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.5)', padding: '4px 6px', borderRadius: 2 }}>ENGINE_FAULT: CHECK CONSOLE</div>}
      </div>
    </div>
  );
};

export default ImageStage;