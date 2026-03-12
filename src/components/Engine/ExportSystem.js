/**
 * @file ExportSystem.js
 * @description Handles the high-fidelity rendering, geometry transformation, and 
 * steganographic archiving of the final image. Operates independently of the UI 
 * preview canvas to ensure maximum output resolution.
 */

import { runCorePipeline } from './CorePipeline';
import { injectMetadata } from './MetadataSystem'; 

const blobToBase64 = (blob) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onloadend = () => res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(blob);
});

/**
 * Executes the full-resolution render and triggers the browser download protocol.
 * @param {string} imageSrc - The URI of the original source image.
 * @param {Object} settings - The complete LUMAFORGE mathematical state.
 * @param {string} format - 'jpeg' or 'png'. Default is 'jpeg'.
 */
export const exportImage = async (imageSrc, settings, format = 'jpeg') => {
  if (!imageSrc) return;

  console.log("[LUMAFORGE_EXPORT] Archiving Source Negative...");
  let sourceBase64 = null;
  const isPNG = format === 'png';

  // Only archive the heavy Base64 source if we are exporting a PNG for Steganography
  if (isPNG) {
      try {
          const response = await fetch(imageSrc);
          const blob = await response.blob();
          sourceBase64 = await blobToBase64(blob);
      } catch (e) { 
          console.warn("[LUMAFORGE_IO_WARNING] Could not archive source image."); 
      }
  }

  console.log("[LUMAFORGE_EXPORT] Processing Full Resolution Matrix...");
  const rawRenderCanvas = await runCorePipeline(imageSrc, settings, null);
  
  const RW = rawRenderCanvas.width;
  const RH = rawRenderCanvas.height;

  let cropW = settings.aspectRatio === 'ORIGINAL' ? RW : (settings.crop.width / 100) * RW;
  let cropH = settings.aspectRatio === 'ORIGINAL' ? RH : (settings.crop.height / 100) * RH;
  let cropX = settings.aspectRatio === 'ORIGINAL' ? 0 : (settings.crop.x / 100) * RW;
  let cropY = settings.aspectRatio === 'ORIGINAL' ? 0 : (settings.crop.y / 100) * RH;

  // ---------------------------------------------------------
  // STAGE 1: Extract the Cropped Region Unrotated
  // ---------------------------------------------------------
  const unrotatedCanvas = document.createElement('canvas');
  unrotatedCanvas.width = cropW;
  unrotatedCanvas.height = cropH;
  const uCtx = unrotatedCanvas.getContext('2d');
  uCtx.imageSmoothingEnabled = true;
  uCtx.imageSmoothingQuality = 'high';

  uCtx.translate(cropW/2, cropH/2);
  const zoomScale = 1 + (settings.zoom / 100);
  uCtx.scale(zoomScale, zoomScale);
  uCtx.translate(-cropW/2, -cropH/2);
  uCtx.drawImage(rawRenderCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  // ---------------------------------------------------------
  // STAGE 2: Rotate and Flip on an Expanding Canvas
  // ---------------------------------------------------------
  const isRotated = settings.rotate === 90 || settings.rotate === 270;
  const finalCanvas = document.createElement('canvas');
  
  // SWAP WIDTH AND HEIGHT IF ROTATED TO PREVENT CLIPPING
  finalCanvas.width = isRotated ? cropH : cropW;
  finalCanvas.height = isRotated ? cropW : cropH;
  
  const fCtx = finalCanvas.getContext('2d');
  fCtx.imageSmoothingEnabled = true;
  fCtx.imageSmoothingQuality = 'high';

  fCtx.translate(finalCanvas.width/2, finalCanvas.height/2);
  fCtx.rotate((settings.rotate * Math.PI) / 180);
  fCtx.scale(settings.flipX ? -1 : 1, settings.flipY ? -1 : 1);
  fCtx.translate(-cropW/2, -cropH/2);
  fCtx.drawImage(unrotatedCanvas, 0, 0);

  // VIGNETTE (Applied to the final expanding canvas)
  if (settings.vignette !== 0) {
      fCtx.setTransform(1, 0, 0, 1, 0, 0); 
      fCtx.globalCompositeOperation = 'source-over';
      const fW = finalCanvas.width, fH = finalCanvas.height;
      const grad = fCtx.createRadialGradient(fW/2, fH/2, fW * 0.4, fW/2, fH/2, fW * 1.2);
      const vColor = settings.vignette >= 0 ? '0,0,0' : '255,255,255';
      const vOp = Math.abs(settings.vignette) / 100;
      grad.addColorStop(0, `rgba(${vColor}, 0)`);
      grad.addColorStop(1, `rgba(${vColor}, ${vOp})`);
      fCtx.fillStyle = grad;
      fCtx.fillRect(0, 0, fW, fH);
  }
  
  // DYNAMIC BRAND WATERMARKING (FIXED WITH TEXT FALLBACK)
  if (settings.watermark) {
      fCtx.setTransform(1, 0, 0, 1, 0, 0); 
      fCtx.globalCompositeOperation = 'source-over';
      fCtx.globalAlpha = 0.6; // Increased visibility
      fCtx.shadowColor = "rgba(0,0,0,0.85)";
      fCtx.shadowBlur = 15; 
      fCtx.shadowOffsetY = 4;

      const fW = finalCanvas.width, fH = finalCanvas.height;

      try {
          const logoImg = await new Promise((res, rej) => {
              const img = new Image(); 
              img.onload = () => res(img); 
              img.onerror = rej; 
              img.src = '/lf_white.png';
          });
          
          const targetWidth = Math.max(100, fW * 0.15); 
          const targetHeight = logoImg.height * (targetWidth / logoImg.width);
          const padding = Math.max(20, fW * 0.03); 
          
          fCtx.drawImage(logoImg, fW - targetWidth - padding, fH - targetHeight - padding, targetWidth, targetHeight);
      } catch (err) { 
          console.warn("[LUMAFORGE_ASSET_FAULT] Watermark image missing. Using text fallback.");
          const padding = Math.max(20, fW * 0.03);
          const fontSize = Math.max(24, fW * 0.035);
          fCtx.font = `bold ${fontSize}px sans-serif`;
          fCtx.fillStyle = "rgba(255, 255, 255, 0.8)";
          fCtx.textAlign = "right";
          fCtx.textBaseline = "bottom";
          fCtx.fillText("LUMAFORGE", fW - padding, fH - padding);
      }
  }
  fCtx.restore();

  // EXPORT PROMISE
  return new Promise((resolve, reject) => {
      const mimeType = isPNG ? 'image/png' : 'image/jpeg';
      const quality = isPNG ? 1.0 : 0.95;

      finalCanvas.toBlob(async (blob) => {
          if (!blob) return reject(new Error("Canvas toBlob failed."));
          
          let finalBlob = blob;
          
          if (isPNG) {
              console.log("[LUMAFORGE_EXPORT] Encoding Black Box Data...");
              const projectPayload = { settings: settings, source: sourceBase64, timestamp: Date.now(), version: "4.3.1" };
              try { 
                  finalBlob = await injectMetadata(blob, projectPayload); 
              } catch (e) { 
                  console.warn("[LUMAFORGE_ENCODE_FAULT] Steganography failed.", e); 
              }
          }
          
          const link = document.createElement('a');
          link.download = `LUMAFORGE_${Date.now()}.${format}`;
          link.href = URL.createObjectURL(finalBlob);
          link.click();
          
          URL.revokeObjectURL(link.href);
          resolve(); 
      }, mimeType, quality);
  });
};

/**
 * Executes the full-resolution render and returns the Blob (for Cloud Uploads).
 */
export const generateExportBlob = async (imageSrc, settings) => {
    if (!imageSrc) throw new Error("No source image provided.");

    let sourceBase64 = null;
    try {
        const response = await fetch(imageSrc);
        const blob = await response.blob();
        sourceBase64 = await blobToBase64(blob);
    } catch (e) { 
        console.warn("Could not archive source image."); 
    }

    const rawRenderCanvas = await runCorePipeline(imageSrc, settings, null);
    const RW = rawRenderCanvas.width;
    const RH = rawRenderCanvas.height;

    let cropW = settings.aspectRatio === 'ORIGINAL' ? RW : (settings.crop.width / 100) * RW;
    let cropH = settings.aspectRatio === 'ORIGINAL' ? RH : (settings.crop.height / 100) * RH;
    let cropX = settings.aspectRatio === 'ORIGINAL' ? 0 : (settings.crop.x / 100) * RW;
    let cropY = settings.aspectRatio === 'ORIGINAL' ? 0 : (settings.crop.y / 100) * RH;

    const unrotatedCanvas = document.createElement('canvas');
    unrotatedCanvas.width = cropW;
    unrotatedCanvas.height = cropH;
    const uCtx = unrotatedCanvas.getContext('2d');
    uCtx.imageSmoothingEnabled = true;
    uCtx.imageSmoothingQuality = 'high';

    uCtx.translate(cropW/2, cropH/2);
    const zoomScale = 1 + (settings.zoom / 100);
    uCtx.scale(zoomScale, zoomScale);
    uCtx.translate(-cropW/2, -cropH/2);
    uCtx.drawImage(rawRenderCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const isRotated = settings.rotate === 90 || settings.rotate === 270;
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = isRotated ? cropH : cropW;
    finalCanvas.height = isRotated ? cropW : cropH;
    const fCtx = finalCanvas.getContext('2d');
    fCtx.imageSmoothingEnabled = true;
    fCtx.imageSmoothingQuality = 'high';

    fCtx.translate(finalCanvas.width/2, finalCanvas.height/2);
    fCtx.rotate((settings.rotate * Math.PI) / 180);
    fCtx.scale(settings.flipX ? -1 : 1, settings.flipY ? -1 : 1);
    fCtx.translate(-cropW/2, -cropH/2);
    fCtx.drawImage(unrotatedCanvas, 0, 0);

    if (settings.vignette !== 0) {
        fCtx.setTransform(1, 0, 0, 1, 0, 0); 
        fCtx.globalCompositeOperation = 'source-over';
        const fW = finalCanvas.width, fH = finalCanvas.height;
        const grad = fCtx.createRadialGradient(fW/2, fH/2, fW * 0.4, fW/2, fH/2, fW * 1.2);
        const vColor = settings.vignette >= 0 ? '0,0,0' : '255,255,255';
        const vOp = Math.abs(settings.vignette) / 100;
        grad.addColorStop(0, `rgba(${vColor}, 0)`);
        grad.addColorStop(1, `rgba(${vColor}, ${vOp})`);
        fCtx.fillStyle = grad;
        fCtx.fillRect(0, 0, fW, fH);
    }
    
    if (settings.watermark) {
        fCtx.setTransform(1, 0, 0, 1, 0, 0); 
        fCtx.globalCompositeOperation = 'source-over';
        fCtx.globalAlpha = 0.6; 
        fCtx.shadowColor = "rgba(0,0,0,0.85)";
        fCtx.shadowBlur = 15; 
        fCtx.shadowOffsetY = 4;
        const fW = finalCanvas.width, fH = finalCanvas.height;
        try {
            const logoImg = await new Promise((res, rej) => {
                const img = new Image(); 
                img.onload = () => res(img); 
                img.onerror = rej; 
                img.src = '/lf_white.png';
            });
            const targetWidth = Math.max(100, fW * 0.15); 
            const targetHeight = logoImg.height * (targetWidth / logoImg.width);
            const padding = Math.max(20, fW * 0.03); 
            fCtx.drawImage(logoImg, fW - targetWidth - padding, fH - targetHeight - padding, targetWidth, targetHeight);
        } catch (err) { 
            const padding = Math.max(20, fW * 0.03);
            const fontSize = Math.max(24, fW * 0.035);
            fCtx.font = `bold ${fontSize}px sans-serif`;
            fCtx.fillStyle = "rgba(255, 255, 255, 0.8)";
            fCtx.textAlign = "right";
            fCtx.textBaseline = "bottom";
            fCtx.fillText("LUMAFORGE", fW - padding, fH - padding);
        }
    }
    fCtx.restore();

    return new Promise((resolve, reject) => {
        finalCanvas.toBlob(async (blob) => {
            if (!blob) return reject(new Error("Canvas toBlob failed."));
            const projectPayload = { settings, source: sourceBase64, timestamp: Date.now(), version: "4.3.1" };
            let finalBlob = blob;
            try { 
                finalBlob = await injectMetadata(blob, projectPayload); 
            } catch (e) { 
                console.warn("Steganography failed.", e); 
            }
            resolve(finalBlob); 
        }, 'image/png', 1.0);
    });
};