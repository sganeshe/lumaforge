/**
 * @file ImageStage.jsx
 * @description The primary interactive viewport for LUMAFORGE. 
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { runCorePipeline } from './CorePipeline';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum crop dimension as % of image side to prevent zero-size boxes. */
const MIN_CROP_PCT = 5;

/** Cursor styles per drag handle */
const HANDLE_CURSORS = {
  MOVE: 'move',
  N: 'n-resize',
  S: 's-resize',
  E: 'e-resize',
  W: 'w-resize',
  NW: 'nw-resize',
  NE: 'ne-resize',
  SW: 'sw-resize',
  SE: 'se-resize',
};

// ─── CropOverlay ──────────────────────────────────────────────────────────────

/**
 * Renders the dark scrim + crop box with 8 resize handles (4 corners + 4
 * edges) and a rule-of-thirds grid. Handles use native pointer events so
 * they work identically on mouse, pen, and touch.
 */
const CropOverlay = ({ crop, onPointerDown }) => {
  const { x, y, width: w, height: h } = crop;

  /** Returns inline style that positions an absolute handle. */
  const handleStyle = (top, left, cursor) => ({
    position: 'absolute',
    top,
    left,
    width: 18,
    height: 18,
    transform: 'translate(-50%, -50%)',
    background: 'var(--accent, #fff)',
    border: '2px solid rgba(0,0,0,0.6)',
    borderRadius: 3,
    cursor,
    touchAction: 'none',
    zIndex: 20,
    // Larger hit-area for touch without enlarging the visual handle
    outline: '10px solid transparent',
  });

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
      {/* ── Draggable crop box ── */}
      <div
        onPointerDown={(e) => onPointerDown(e, 'MOVE')}
        style={{
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          width: `${w}%`,
          height: `${h}%`,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
          border: '1px solid var(--accent, #fff)',
          cursor: 'move',
          touchAction: 'none',
          boxSizing: 'border-box',
        }}
      >
        {/* ── Rule-of-thirds grid ── */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <line x1="33.33%" y1="0" x2="33.33%" y2="100%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <line x1="66.66%" y1="0" x2="66.66%" y2="100%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <line x1="0" y1="33.33%" x2="100%" y2="33.33%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <line x1="0" y1="66.66%" x2="100%" y2="66.66%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        </svg>

        {/* ── 4 corners ── */}
        <div onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, 'NW'); }} style={handleStyle('0%',   '0%',   'nw-resize')} />
        <div onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, 'NE'); }} style={handleStyle('0%',   '100%', 'ne-resize')} />
        <div onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, 'SW'); }} style={handleStyle('100%', '0%',   'sw-resize')} />
        <div onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, 'SE'); }} style={handleStyle('100%', '100%', 'se-resize')} />

        {/* ── 4 edge midpoints ── */}
        <div onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, 'N'); }} style={handleStyle('0%',   '50%',  'n-resize')} />
        <div onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, 'S'); }} style={handleStyle('100%', '50%',  's-resize')} />
        <div onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, 'W'); }} style={handleStyle('50%',  '0%',   'w-resize')} />
        <div onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, 'E'); }} style={handleStyle('50%',  '100%', 'e-resize')} />
      </div>
    </div>
  );
};

const ImageStage = ({ imageSrc, settings, setSettings, activeTab }) => {
  const containerRef = useRef(null);

  const [renderedUrl, setRenderedUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const [dragMode, setDragMode] = useState(null);
  const [isCompare, setIsCompare] = useState(false);

  const startPos = useRef({ x: 0, y: 0, cx: 0, cy: 0, cw: 0, ch: 0 });

  const isRotated = settings.rotate === 90 || settings.rotate === 270;

  const showCropOverlay =
    activeTab === 'CROP' &&
    settings.aspectRatio !== 'ORIGINAL' &&
    !settings.cropApplied;

  const pixelSettings = useMemo(() => {
    const {
      crop, cropApplied, rotate, flipX, flipY,
      zoom, aspectRatio, imageDimensions, watermark,
      ...colors
    } = settings;
    return colors;
  }, [settings]);

  const stageAspectRatio = useMemo(() => {
    const imgRatio = settings.imageDimensions?.ratio ?? 1;
    let baseRatio = isRotated ? 1 / imgRatio : imgRatio;
    if (!settings.cropApplied) return baseRatio;
    const ch = Math.max(0.01, settings.crop.height); // guard div-by-zero
    return (settings.crop.width / ch) * baseRatio;
  }, [settings.crop, settings.cropApplied, settings.imageDimensions, isRotated]);

  useEffect(() => {
    if (!imageSrc) return;

    const abortCtrl = new AbortController();

    const render = async () => {
      setIsProcessing(true);
      setRenderError(false);
      try {
        const resultCanvas = await runCorePipeline(imageSrc, settings, 1200);
        if (!abortCtrl.signal.aborted) {
          setRenderedUrl(resultCanvas.toDataURL('image/png'));
        }
      } catch (e) {
        if (!abortCtrl.signal.aborted) {
          console.error('[LUMAFORGE_STAGE_FAULT] Live Render Failed:', e);
          setRenderError(true);
        }
      } finally {
        if (!abortCtrl.signal.aborted) {
          setIsProcessing(false);
        }
      }
    };

    const timeoutId = setTimeout(render, 80);

    return () => {
      abortCtrl.abort();
      clearTimeout(timeoutId);
      setIsProcessing(false);
    };
  }, [imageSrc, pixelSettings]);

  const handlePointerDown = useCallback(
    (e, mode) => {
      if (!showCropOverlay) return;
      e.stopPropagation();
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragMode(mode);
      startPos.current = {
        x: e.clientX,
        y: e.clientY,
        cx: settings.crop.x,
        cy: settings.crop.y,
        cw: settings.crop.width,
        ch: settings.crop.height,
      };
    },
    [showCropOverlay, settings.crop],
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (!dragMode || !containerRef.current) return;
      e.preventDefault();

      const rect = containerRef.current.getBoundingClientRect();
      const dx = ((e.clientX - startPos.current.x) / rect.width) * 100;
      const dy = ((e.clientY - startPos.current.y) / rect.height) * 100;
      const { cx, cy, cw, ch } = startPos.current;
      let next = { x: cx, y: cy, width: cw, height: ch };

      if (dragMode === 'MOVE') {
        next.x = Math.max(0, Math.min(100 - cw, cx + dx));
        next.y = Math.max(0, Math.min(100 - ch, cy + dy));
      } else {
        if (dragMode.includes('N')) {
          const d = Math.min(Math.max(dy, -cy), ch - MIN_CROP_PCT);
          next.y = cy + d;
          next.height = ch - d;
        }
        if (dragMode.includes('S')) {
          next.height = Math.min(100 - cy, Math.max(MIN_CROP_PCT, ch + dy));
        }
        if (dragMode.includes('W')) {
          const d = Math.min(Math.max(dx, -cx), cw - MIN_CROP_PCT);
          next.x = cx + d;
          next.width = cw - d;
        }
        if (dragMode.includes('E')) {
          next.width = Math.min(100 - cx, Math.max(MIN_CROP_PCT, cw + dx));
        }

        if (settings.crop.aspect && dragMode !== 'MOVE') {
          const imgRatio = settings.imageDimensions?.ratio ?? 1;
          const aspectInPct = settings.crop.aspect / imgRatio;
          const isHorizontalDrag =
            dragMode === 'E'  || dragMode === 'W'  ||
            dragMode === 'NE' || dragMode === 'NW' ||
            dragMode === 'SE' || dragMode === 'SW';

          if (isHorizontalDrag) {
            const requiredH = next.width / aspectInPct;
            if (next.y + requiredH <= 100) {
              next.height = requiredH;
            } else {
              next.height = 100 - next.y;
              next.width = next.height * aspectInPct;
            }
          } else {
            const requiredW = next.height * aspectInPct;
            if (next.x + requiredW <= 100) {
              next.width = requiredW;
            } else {
              next.width = 100 - next.x;
              next.height = next.width / aspectInPct;
            }
          }
        }
      }

      setSettings((p) => ({ ...p, crop: { ...p.crop, ...next } }));
    },
    [dragMode, settings.crop.aspect, settings.imageDimensions],
  );

  const handlePointerUp = useCallback(() => setDragMode(null), []);

  const totalScale = 1 + settings.zoom / 100;

  const cropStyle = settings.cropApplied
    ? {
        width: `${(100 * 100) / Math.max(0.01, settings.crop.width)}%`,
        height: `${(100 * 100) / Math.max(0.01, settings.crop.height)}%`,
        transform: `translate(${-settings.crop.x}%, ${-settings.crop.y}%)`,
        transformOrigin: '0 0',
      }
    : { width: '100%', height: '100%', transform: 'none' };

  const imgScaleW = isRotated ? (settings.imageDimensions?.ratio ?? 1) : 1;
  const imgScaleH = isRotated ? 1 / (settings.imageDimensions?.ratio ?? 1) : 1;

  const sharedImgStyle = {
    width: `${imgScaleW * 100}%`,
    height: `${imgScaleH * 100}%`,
    display: 'block',
    position: 'absolute',
    top: '50%',
    left: '50%',
    objectFit: 'fill',
    transform: `translate(-50%, -50%) scaleX(${settings.flipX ? -1 : 1}) scaleY(${settings.flipY ? -1 : 1}) rotate(${settings.rotate}deg) scale(${totalScale})`,
    transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  };

  if (!imageSrc) return null;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          position: 'relative',
          aspectRatio: String(stageAspectRatio),
          maxHeight: '100%',
          maxWidth: '100%',
          height: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          background: '#0a0a0a',
          touchAction: 'none',
          cursor: dragMode ? HANDLE_CURSORS[dragMode] : 'default',
        }}
      >
        {/* ── Image layers ── */}
        <div style={{ ...cropStyle, position: 'absolute', top: 0, left: 0 }}>
          <img src={imageSrc} style={sharedImgStyle} draggable={false} alt="Original" />
          <img
            src={renderedUrl ?? imageSrc}
            style={{
              ...sharedImgStyle,
              opacity: isCompare || renderError || !renderedUrl ? 0 : 1,
              transition: 'opacity 0.15s ease-out',
            }}
            draggable={false}
            alt="Rendered"
          />
        </div>

        {/* ── Compare button ── */}
        <button
          onPointerDown={() => setIsCompare(true)}
          onPointerUp={() => setIsCompare(false)}
          onPointerLeave={() => setIsCompare(false)}
          style={{
            position: 'absolute', top: 15, right: 15, zIndex: 999,
            background: 'rgba(14,14,14,0.8)', color: 'var(--accent)',
            border: '1px solid #444', padding: '8px 12px', fontSize: 10,
            cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold',
            borderRadius: 4, backdropFilter: 'blur(5px)', userSelect: 'none',
          }}
        >
          {isCompare ? 'ORIGINAL' : 'COMPARE'}
        </button>

        {/* ── Crop overlay ── */}
        {showCropOverlay && (
          <CropOverlay crop={settings.crop} onPointerDown={handlePointerDown} />
        )}

        {/* ── Status indicators ── */}
        {isProcessing && (
          <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 999, color: 'var(--accent)', fontSize: 9, fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.5)', padding: '4px 6px', borderRadius: 2 }}>
            PROCESSING…
          </div>
        )}
        {renderError && (
          <div style={{ position: 'absolute', top: 30, left: 10, zIndex: 999, color: '#ff4444', fontSize: 9, fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.5)', padding: '4px 6px', borderRadius: 2 }}>
            CHECK CONSOLE
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageStage;