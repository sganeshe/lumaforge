/**
 * @file ExportSystem.js
 * @description Handles the high-fidelity rendering, geometry transformation, and 
 * steganographic archiving of the final image. Operates independently of the UI 
 * preview canvas to ensure maximum output resolution.
 */

import { runCorePipeline } from './CorePipeline';
import { injectMetadata } from './MetadataSystem'; 

/**
 * Converts a standard Blob object into a Base64 string.
 * Used to losslessly encode the original source negative for the Black Box payload.
 * @param {Blob} blob - The raw image blob.
 * @returns {Promise<string>} Base64 encoded string.
 */
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
 */
export const exportImage = async (imageSrc, settings) => {
  if (!imageSrc) return;

  console.log("[LUMAFORGE_EXPORT] Archiving Source Negative...");
  let sourceBase64 = null;
  try {
      // Fetch the raw source image to embed in the final PNG for non-destructive editing
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      sourceBase64 = await blobToBase64(blob);
  } catch (e) { 
      console.warn("[LUMAFORGE_IO_WARNING] Could not archive source image. Payload will contain settings only."); 
  }

  // 1. RUN UNIFIED PIPELINE
  // Passing maxDim = null forces the engine to process at the true native resolution of the file.
  console.log("[LUMAFORGE_EXPORT] Processing Full Resolution Matrix...");
  const rawRenderCanvas = await runCorePipeline(imageSrc, settings, null);
  
  // 2. APPLY GEOMETRY (Crop, Rotate, Flip, Zoom)
  // Geometry is applied post-pipeline to prevent destructive pixel loss during rotation/scaling.
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
  
  // Force high-quality interpolation for spatial transformations
  fCtx.imageSmoothingEnabled = true;
  fCtx.imageSmoothingQuality = 'high';

  fCtx.save();
  
  // Shift origin to center for accurate rotational physics
  fCtx.translate(cropW/2, cropH/2);
  fCtx.rotate((settings.rotate * Math.PI) / 180);
  fCtx.scale(settings.flipX ? -1 : 1, settings.flipY ? -1 : 1);
  
  // Mathematical auto-scaling to prevent transparent corners when rotating
  const rad = (settings.rotate * Math.PI) / 180;
  const autoScale = Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad));
  fCtx.scale(autoScale, autoScale);
  
  // Apply User Digital Zoom
  const zoomScale = 1 + (settings.zoom / 100);
  fCtx.scale(zoomScale, zoomScale);
  
  // Revert origin shift and apply absolute crop coordinates
  fCtx.translate(-cropW/2, -cropH/2);
  fCtx.translate(-cropX, -cropY);
  
  fCtx.drawImage(rawRenderCanvas, 0, 0);

  // 3. POST-GEOMETRY VIGNETTE
  // Vignette must be applied here, otherwise cropping would slice off the edges of the vignette.
  if (settings.vignette !== 0) {
      // Reset transform matrix strictly for overlays
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
  
  // 4. DYNAMIC BRAND WATERMARKING
  if (settings.watermark) {
      try {
          const logoImg = await new Promise((res, rej) => {
              const img = new Image(); 
              img.onload = () => res(img); 
              img.onerror = rej; 
              img.src = '/lf_white.png';
          });
          
          fCtx.setTransform(1, 0, 0, 1, 0, 0); 
          fCtx.globalCompositeOperation = 'source-over';
          fCtx.globalAlpha = 0.35; 
          
          // Dynamically scale logo based on final output resolution (15% of width)
          const targetWidth = Math.max(100, cropW * 0.15); 
          const targetHeight = logoImg.height * (targetWidth / logoImg.width);
          const padding = Math.max(20, cropW * 0.03); 
          
          // Drop shadow ensures visibility against purely white image backgrounds
          fCtx.shadowColor = "rgba(0,0,0,0.85)";
          fCtx.shadowBlur = 15; 
          fCtx.shadowOffsetY = 4;
          
          fCtx.drawImage(logoImg, cropW - targetWidth - padding, cropH - targetHeight - padding, targetWidth, targetHeight);
      } catch (err) { 
          console.warn("[LUMAFORGE_ASSET_FAULT] Watermark failed to render", err); 
      }
  }
  fCtx.restore();

  // 5. EXPORT & METADATA STEGANOGRAPHY
  
  finalCanvas.toBlob(async (blob) => {
      if (!blob) return;
      console.log("[LUMAFORGE_EXPORT] Encoding Black Box Data...");
      
      // Construct the exact state required to recreate this session in the future
      const projectPayload = { 
          settings: settings, 
          source: sourceBase64, 
          timestamp: Date.now(), 
          version: "4.3.1" 
      };
      
      let finalBlob = blob;
      try { 
          finalBlob = await injectMetadata(blob, projectPayload); 
      } catch (e) { 
          console.warn("[LUMAFORGE_ENCODE_FAULT] Steganography failed. Exporting raw PNG.", e); 
      }
      
      // Trigger Native Browser Download
      const link = document.createElement('a');
      link.download = `LUMAFORGE_${Date.now()}.png`;
      link.href = URL.createObjectURL(finalBlob);
      link.click();
      
      // Garbage collection to prevent memory leaks with massive 4K blobs
      URL.revokeObjectURL(link.href);
  }, 'image/png', 1.0);
};

/**
 * Executes the full-resolution render and returns the Blob (for Cloud Uploads).
 * This uses the exact same pipeline as exportImage but intercepts the download.
 * @param {string} imageSrc - The URI of the original source image.
 * @param {Object} settings - The complete LUMAFORGE mathematical state.
 * @returns {Promise<Blob>} The final, metadata-injected PNG Blob.
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
        try {
            const logoImg = await new Promise((res, rej) => {
                const img = new Image(); 
                img.onload = () => res(img); 
                img.onerror = rej; 
                img.src = '/lf_white.png';
            });
            
            fCtx.setTransform(1, 0, 0, 1, 0, 0); 
            fCtx.globalCompositeOperation = 'source-over';
            fCtx.globalAlpha = 0.35; 
            
            const targetWidth = Math.max(100, cropW * 0.15); 
            const targetHeight = logoImg.height * (targetWidth / logoImg.width);
            const padding = Math.max(20, cropW * 0.03); 
            
            fCtx.shadowColor = "rgba(0,0,0,0.85)";
            fCtx.shadowBlur = 15; 
            fCtx.shadowOffsetY = 4;
            
            fCtx.drawImage(logoImg, cropW - targetWidth - padding, cropH - targetHeight - padding, targetWidth, targetHeight);
        } catch (err) { }
    }
    fCtx.restore();

    // Return the blob wrapped in a Promise so LeftSidebar can await it
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
            
            resolve(finalBlob); // Give the Blob back!
        }, 'image/png', 1.0);
    });
};