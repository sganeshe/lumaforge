/**
 * @file ImageStage.jsx
 * @description The primary interactive viewport for LUMAFORGE. 
 * Handles real-time preview rendering via the CorePipeline, DOM-based geometry 
 * transformations (Zoom, Pan, Rotate, Crop), and the interactive crop UI.
 */

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { runCorePipeline } from './CorePipeline'; 

const ImageStage = ({ imageSrc, settings, setSettings, activeTab }) => {
  // DOM References
  const containerRef = useRef(null);
  
  // Render State
  const [renderedUrl, setRenderedUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [renderError, setRenderError] = useState(false); 
  
  // Interaction State
  const [dragMode, setDragMode] = useState(null); 
  const [isCompare, setIsCompare] = useState(false); 
  const startPos = useRef({ x: 0, y: 0, cx: 0, cy: 0, cw: 0, ch: 0 });

  /**
   * MEMOIZATION: Separate pixel-altering settings from geometry settings.
   * This prevents the heavy CorePipeline from re-running if the user is 
   * only zooming or moving the crop box.
   */
  const pixelSettings = useMemo(() => {
      const { crop, cropApplied, rotate, flipX, flipY, zoom, aspectRatio, imageDimensions, watermark, ...colors } = settings;
      return colors;
  }, [settings]);

  /**
   * RENDER LIFECYCLE: Debounced Pipeline Execution
   * Waits 50ms after the user stops dragging a slider before triggering the math engine.
   * Prevents browser UI freezing during rapid slider movements.
   */
  useEffect(() => {
      if (!imageSrc) return;
      let isCancelled = false; // Cleanup flag to prevent race conditions
      
      const render = async () => {
          setIsProcessing(true);
          setRenderError(false);
          try {
              // 1200px max preview dimension for high-performance UI rendering
              const resultCanvas = await runCorePipeline(imageSrc, settings, 1200); 
              if (!isCancelled) {
                  setRenderedUrl(resultCanvas.toDataURL('image/png'));
              }
          } catch(e) { 
              console.error("[LUMAFORGE_STAGE_FAULT] Live Render Failed:", e); 
              if (!isCancelled) setRenderError(true);
          }
          setIsProcessing(false);
      };
      
      const timeoutId = setTimeout(render, 50); 
      return () => { 
          isCancelled = true; 
          clearTimeout(timeoutId); 
      };
  }, [imageSrc, pixelSettings]); 

  /**
   * DYNAMIC ASPECT RATIO: Calculates the physical proportions of the viewport wrapper 
   * based on whether a crop has been committed to the engine.
   */
  const stageAspectRatio = useMemo(() => {
    const baseRatio = settings.imageDimensions?.ratio || 1;
    if (!settings.cropApplied) return baseRatio;
    return (settings.crop.width / Math.max(1, settings.crop.height)) * baseRatio;
  }, [settings.crop, settings.cropApplied, settings.imageDimensions]);

  if (!imageSrc) return null;

  // Only show the draggable crop box if the CROP tab is open and a crop hasn't been committed
  const showCropOverlay = activeTab === 'CROP' && settings.aspectRatio !== 'ORIGINAL' && !settings.cropApplied;

  /* =========================================================================
     INTERACTION: CROP BOX DRAGGING MATH
     
     Calculates percentage-based translations based on absolute mouse deltas.
     ========================================================================= */
  const handleMouseDown = (e, mode) => {
    if (!showCropOverlay) return;
    e.stopPropagation(); e.preventDefault();
    setDragMode(mode);
    
    // Snapshot the initial geometric state when the mouse is first clicked
    startPos.current = { 
        x: e.clientX, y: e.clientY, 
        cx: settings.crop.x, cy: settings.crop.y, 
        cw: settings.crop.width, ch: settings.crop.height 
    };
  };

  const handleMouseMove = (e) => {
    if (!dragMode || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Convert physical pixel movement into percentages (0-100)
    const dx = ((e.clientX - startPos.current.x) / rect.width) * 100;
    const dy = ((e.clientY - startPos.current.y) / rect.height) * 100;
    let { cx, cy, cw, ch } = startPos.current; 
    let next = { x: cx, y: cy, width: cw, height: ch };

    if (dragMode === 'MOVE') {
      // Clamp boundaries so the box cannot be dragged outside the 0-100% canvas area
      next.x = Math.max(0, Math.min(100 - cw, cx + dx)); 
      next.y = Math.max(0, Math.min(100 - ch, cy + dy));
    } else {
      // Handle directional resizing (North, South, East, West)
      if (dragMode.includes('D')) next.width = Math.min(100 - cx, Math.max(10, cw + dx));
      if (dragMode.includes('S')) next.height = Math.min(100 - cy, Math.max(10, ch + dy));
      if (dragMode.includes('A')) { 
          const d = Math.min(Math.max(dx, -cx), cw - 10); 
          next.x = cx + d; 
          next.width = cw - d; 
      }
      if (dragMode.includes('W')) { 
          const d = Math.min(Math.max(dy, -cy), ch - 10); 
          next.y = cy + d; 
          next.height = ch - d; 
      }
    }
    
    // Force mathematical aspect ratio constraints during resize (e.g., locking to 16:9)
    if (settings.crop.aspect && dragMode !== 'MOVE') {
       const imgRatio = settings.imageDimensions.ratio || 1;
       if (dragMode.includes('E') || dragMode.includes('W')) {
           next.height = next.width / (settings.crop.aspect * (1/imgRatio)); 
       } else {
           next.width = next.height * (settings.crop.aspect * (1/imgRatio)); 
       }
    }
    
    setSettings(p => ({ ...p, crop: { ...p.crop, ...next } }));
  };

  const handleMouseUp = () => setDragMode(null);

  /* =========================================================================
     CSS RENDERING & HARDWARE TRANSFORMS
     We utilize CSS transforms for geometry (Zoom/Rotate/Flip) rather than 
     re-rendering the canvas, leveraging GPU acceleration for smooth UI.
     ========================================================================= */
  const totalScale = 1 + (settings.zoom / 100);
  
  // If crop is applied, mathematically expand the inner content and shift it backward
  const cropStyle = settings.cropApplied 
        ? { 
            width: `${100 * (100/Math.max(1, settings.crop.width))}%`, 
            height: `${100 * (100/Math.max(1, settings.crop.height))}%`, 
            transform: `translate(${-settings.crop.x}%, ${-settings.crop.y}%)`, 
            transformOrigin: '0 0' 
          } 
        : { 
            width: '100%', height: '100%', transform: 'none', transformOrigin: '50% 50%' 
          };
        
  // Shared styles for the base image and the rendered overlay
  const sharedImgStyle = { 
      width: '100%', height: '100%', display: 'block', 
      objectFit: 'fill', /* CRITICAL: Prevents aspect-ratio collapse during tight cropping */
      transform: `scaleX(${settings.flipX?-1:1}) scaleY(${settings.flipY?-1:1}) rotate(${settings.rotate}deg) scale(${totalScale})`, 
      transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)' 
  };

  return (
    // 1. BOUNDING WRAPPER: Forces the stage into the center and limits it to 80% of the screen height
    <div style={{ width: '100%', height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      
      {/* 2. THE STAGE: Scales down automatically using flexbox & intrinsic aspect ratio */}
      <div 
         ref={containerRef} 
         onMouseMove={handleMouseMove} 
         onMouseUp={handleMouseUp} 
         onMouseLeave={handleMouseUp} 
         style={{ 
            position: 'relative', 
            aspectRatio: `${stageAspectRatio}`, 
            maxHeight: '100%', 
            maxWidth: '100%', 
            height: '100%', 
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)', 
            overflow: 'hidden', 
            background: '#0a0a0a' 
         }}
      >
        
        {/* 3. CROP MANIPULATION LAYER */}
        <div style={{ ...cropStyle, position: 'absolute', top: 0, left: 0 }}>
           {/* Bottom Layer: Original Source Image */}
           <img src={imageSrc} style={sharedImgStyle} draggable={false} alt="Original" />
           
           {/* Top Layer: Rendered Pipeline Output (Fades out when comparing) */}
           <img 
              src={renderedUrl || imageSrc} 
              style={{ 
                  ...sharedImgStyle, 
                  position: 'absolute', top: 0, left: 0, 
                  opacity: isCompare || renderError || !renderedUrl ? 0 : 1,
                  transition: 'opacity 0.15s ease-out'
              }} 
              draggable={false} 
              alt="Rendered" 
           />
        </div>

        {/* 4. POST-CROP OVERLAYS (Vignette is applied to the viewport, ignoring the crop shift) */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(circle, transparent 50%, rgba(${settings.vignette >= 0 ? '0,0,0' : '255,255,255'},${Math.abs(settings.vignette)/100}) 140%)` }}/>

        {/* 5. PRE-CROP UI OVERLAY (Crop Box Handles) */}
        {showCropOverlay && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
            <div 
               onMouseDown={(e) => handleMouseDown(e, 'MOVE')} 
               style={{ 
                   position: 'absolute', left: `${settings.crop.x}%`, top: `${settings.crop.y}%`, 
                   width: `${settings.crop.width}%`, height: `${settings.crop.height}%`, 
                   boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)', border: '1px solid var(--accent)', cursor: 'move' 
               }}
            >
               <div onMouseDown={e=>handleMouseDown(e,'NW')} style={{position:'absolute',width:12,height:12,top:-6,left:-6,cursor:'nw-resize',zIndex:10,background:'var(--accent)'}} />
               <div onMouseDown={e=>handleMouseDown(e,'SE')} style={{position:'absolute',width:12,height:12,bottom:-6,right:-6,cursor:'se-resize',zIndex:10,background:'var(--accent)'}} />
            </div>
          </div>
        )}

        {/* 6. HUD STATUS INDICATORS */}
        {isProcessing && <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 999, color: 'var(--accent)', fontSize: '9px', fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.5)', padding: '2px 4px' }}>PROCESSING...</div>}
        {renderError && <div style={{ position: 'absolute', top: 30, left: 10, zIndex: 999, color: '#ff4444', fontSize: '9px', fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.5)', padding: '2px 4px' }}>ENGINE_FAULT: CHECK CONSOLE</div>}

        {/* ORIGINAL COMPARISON HOLD BUTTON */}
        <button 
           onMouseDown={() => setIsCompare(true)} 
           onMouseUp={() => setIsCompare(false)} 
           onMouseLeave={() => setIsCompare(false)} 
           style={{ 
               position: 'absolute', top: 20, right: 20, zIndex: 999, 
               background: 'rgba(14,14,14,0.8)', color: 'var(--accent)', border: '1px solid #444', 
               padding: '8px 16px', fontSize: 11, cursor: 'pointer', fontFamily: 'monospace', 
               fontWeight: 'bold', borderRadius: 4, backdropFilter: 'blur(5px)' 
           }}
        >
            {isCompare ? 'ORIGINAL' : 'HOLD TO COMPARE'}
        </button>

      </div>
    </div>
  );
};

export default ImageStage;