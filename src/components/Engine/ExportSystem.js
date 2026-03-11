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
  
  const finalCanvas = document.createElement('canvas');
  let cropW, cropH, cropX, cropY;
  
  if (settings.aspectRatio === 'ORIGINAL') { 
      cropW = rawRenderCanvas.width; cropH = rawRenderCanvas.height; cropX = 0; cropY = 0; 
  } else { 
      cropW = (settings.crop.width / 100) * rawRenderCanvas.width; 
      cropH = (settings.crop.height / 100) * rawRenderCanvas.height; 
      cropX = (settings.crop.x / 100) * rawRenderCanvas.width; 
      cropY = (settings.crop.y / 100) * rawRenderCanvas.height; 
  }
  
  finalCanvas.width = cropW;
  finalCanvas.height = cropH;
  const fCtx = finalCanvas.getContext('2d');
  
  fCtx.imageSmoothingEnabled = true;
  fCtx.imageSmoothingQuality = 'high';
  fCtx.save();
  
  fCtx.translate(cropW/2, cropH/2);
  fCtx.rotate((settings.rotate * Math.PI) / 180);
  fCtx.scale(settings.flipX ? -1 : 1, settings.flipY ? -1 : 1);
  
  const rad = (settings.rotate * Math.PI) / 180;
  const autoScale = Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad));
  fCtx.scale(autoScale, autoScale);
  
  const zoomScale = 1 + (settings.zoom / 100);
  fCtx.scale(zoomScale, zoomScale);
  
  fCtx.translate(-cropW/2, -cropH/2);
  fCtx.translate(-cropX, -cropY);
  fCtx.drawImage(rawRenderCanvas, 0, 0);

  // VIGNETTE
  if (settings.vignette !== 0) {
      fCtx.setTransform(1, 0, 0, 1, 0, 0); 
      fCtx.globalCompositeOperation = 'source-over';
      const grad = fCtx.createRadialGradient(cropW/2, cropH/2, cropW * 0.4, cropW/2, cropH/2, cropW * 1.2);
      const vColor = settings.vignette >= 0 ? '0,0,0' : '255,255,255';
      const vOp = Math.abs(settings.vignette) / 100;
      grad.addColorStop(0, `rgba(${vColor}, 0)`);
      grad.addColorStop(1, `rgba(${vColor}, ${vOp})`);
      fCtx.fillStyle = grad;
      fCtx.fillRect(0, 0, cropW, cropH);
  }
  
  // DYNAMIC BRAND WATERMARKING (FIXED WITH TEXT FALLBACK)
  if (settings.watermark) {
      fCtx.setTransform(1, 0, 0, 1, 0, 0); 
      fCtx.globalCompositeOperation = 'source-over';
      fCtx.globalAlpha = 0.6; // Increased visibility
      fCtx.shadowColor = "rgba(0,0,0,0.85)";
      fCtx.shadowBlur = 15; 
      fCtx.shadowOffsetY = 4;

      try {
          const logoImg = await new Promise((res, rej) => {
              const img = new Image(); 
              img.onload = () => res(img); 
              img.onerror = rej; 
              img.src = '/lf_white.png';
          });
          
          const targetWidth = Math.max(100, cropW * 0.15); 
          const targetHeight = logoImg.height * (targetWidth / logoImg.width);
          const padding = Math.max(20, cropW * 0.03); 
          
          fCtx.drawImage(logoImg, cropW - targetWidth - padding, cropH - targetHeight - padding, targetWidth, targetHeight);
      } catch (err) { 
          // FALLBACK: If lf_white.png is missing, draw text instead of failing silently
          console.warn("[LUMAFORGE_ASSET_FAULT] Watermark image missing. Using text fallback.");
          const padding = Math.max(20, cropW * 0.03);
          const fontSize = Math.max(24, cropW * 0.035);
          fCtx.font = `bold ${fontSize}px sans-serif`;
          fCtx.fillStyle = "rgba(255, 255, 255, 0.8)";
          fCtx.textAlign = "right";
          fCtx.textBaseline = "bottom";
          fCtx.fillText("LUMAFORGE", cropW - padding, cropH - padding);
      }
  }
  fCtx.restore();

  // FIX: Wrapped the final export in a Promise so the UI knows exactly when it finishes
  return new Promise((resolve, reject) => {
      const mimeType = isPNG ? 'image/png' : 'image/jpeg';
      const quality = isPNG ? 1.0 : 0.95;

      finalCanvas.toBlob(async (blob) => {
          if (!blob) return reject(new Error("Canvas toBlob failed."));
          
          let finalBlob = blob;
          
          // Only attempt steganography if the user explicitly chose PNG
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
          resolve(); // Resolves the promise, telling the UI to hide the loading animation
      }, mimeType, quality);
  });
};

/**
 * Executes the full-resolution render and returns the Blob (for Cloud Uploads).
 * Always defaults to PNG to preserve Uplink remixing capabilities.
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
    
    const finalCanvas = document.createElement('canvas');
    let cropW, cropH, cropX, cropY;
    
    if (settings.aspectRatio === 'ORIGINAL') { 
        cropW = rawRenderCanvas.width; cropH = rawRenderCanvas.height; cropX = 0; cropY = 0; 
    } else { 
        cropW = (settings.crop.width / 100) * rawRenderCanvas.width; 
        cropH = (settings.crop.height / 100) * rawRenderCanvas.height; 
        cropX = (settings.crop.x / 100) * rawRenderCanvas.width; 
        cropY = (settings.crop.y / 100) * rawRenderCanvas.height; 
    }
    
    finalCanvas.width = cropW;
    finalCanvas.height = cropH;
    const fCtx = finalCanvas.getContext('2d');
    
    fCtx.imageSmoothingEnabled = true;
    fCtx.imageSmoothingQuality = 'high';
    fCtx.save();
    
    fCtx.translate(cropW/2, cropH/2);
    fCtx.rotate((settings.rotate * Math.PI) / 180);
    fCtx.scale(settings.flipX ? -1 : 1, settings.flipY ? -1 : 1);
    
    const rad = (settings.rotate * Math.PI) / 180;
    const autoScale = Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad));
    fCtx.scale(autoScale, autoScale);
    
    const zoomScale = 1 + (settings.zoom / 100);
    fCtx.scale(zoomScale, zoomScale);
    
    fCtx.translate(-cropW/2, -cropH/2);
    fCtx.translate(-cropX, -cropY);
    fCtx.drawImage(rawRenderCanvas, 0, 0);

    if (settings.vignette !== 0) {
        fCtx.setTransform(1, 0, 0, 1, 0, 0); 
        fCtx.globalCompositeOperation = 'source-over';
        const grad = fCtx.createRadialGradient(cropW/2, cropH/2, cropW * 0.4, cropW/2, cropH/2, cropW * 1.2);
        const vColor = settings.vignette >= 0 ? '0,0,0' : '255,255,255';
        const vOp = Math.abs(settings.vignette) / 100;
        grad.addColorStop(0, `rgba(${vColor}, 0)`);
        grad.addColorStop(1, `rgba(${vColor}, ${vOp})`);
        fCtx.fillStyle = grad;
        fCtx.fillRect(0, 0, cropW, cropH);
    }
    
    if (settings.watermark) {
        fCtx.setTransform(1, 0, 0, 1, 0, 0); 
        fCtx.globalCompositeOperation = 'source-over';
        fCtx.globalAlpha = 0.6; 
        fCtx.shadowColor = "rgba(0,0,0,0.85)";
        fCtx.shadowBlur = 15; 
        fCtx.shadowOffsetY = 4;
        try {
            const logoImg = await new Promise((res, rej) => {
                const img = new Image(); 
                img.onload = () => res(img); 
                img.onerror = rej; 
                img.src = '/lf_white.png';
            });
            const targetWidth = Math.max(100, cropW * 0.15); 
            const targetHeight = logoImg.height * (targetWidth / logoImg.width);
            const padding = Math.max(20, cropW * 0.03); 
            fCtx.drawImage(logoImg, cropW - targetWidth - padding, cropH - targetHeight - padding, targetWidth, targetHeight);
        } catch (err) { 
            const padding = Math.max(20, cropW * 0.03);
            const fontSize = Math.max(24, cropW * 0.035);
            fCtx.font = `bold ${fontSize}px sans-serif`;
            fCtx.fillStyle = "rgba(255, 255, 255, 0.8)";
            fCtx.textAlign = "right";
            fCtx.textBaseline = "bottom";
            fCtx.fillText("LUMAFORGE", cropW - padding, cropH - padding);
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