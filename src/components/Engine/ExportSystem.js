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

export const exportImage = async (imageSrc, settings, format = 'jpeg') => {
  if (!imageSrc) return;

  console.log("[LUMAFORGE_EXPORT] Archiving Source Negative...");
  let sourceBase64 = null;
  const isPNG = format === 'png';

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

  // STAGE 1: Extract the Cropped Region Unrotated
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

  // STAGE 2: Rotate and Flip on an Expanding Canvas
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

  // VIGNETTE 
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
  
  // UNIFIED & ALIGNABLE WATERMARK ENGINE
  if (settings.watermark) {
      console.log("[LUMAFORGE_EXPORT] Synthesizing Watermark Geometry Stack...");
      
      const fW = finalCanvas.width;
      const fH = finalCanvas.height;
      const padding = Math.max(20, fW * 0.03); 

      fCtx.setTransform(1, 0, 0, 1, 0, 0); 
      fCtx.globalCompositeOperation = 'source-over';
      fCtx.globalAlpha = 0.6; 
      fCtx.shadowColor = "rgba(0,0,0,0.85)";
      fCtx.shadowBlur = Math.max(10, fW * 0.01); 
      fCtx.shadowOffsetY = Math.max(2, fW * 0.002);

      let logoImg = null;
      let logoWidth = 0;
      let logoHeight = 0;
      let stackWidth = 0;
      let stackHeight = 0;
      
      const fontSize = Math.max(20, fW * 0.025); 
      fCtx.font = `bold ${fontSize}px monospace`; 
      const usernameText = settings.watermarkUser || 'sganeshe';
      const userTextMetrics = fCtx.measureText(usernameText);
      const userTextWidth = userTextMetrics.width;

      const mainText = "LUMAFORGE";
      const mainTextMetrics = fCtx.measureText(mainText);
      const mainTextWidth = mainTextMetrics.width;

      try {
          logoImg = await new Promise((res, rej) => {
              const img = new Image(); 
              img.onload = () => res(img); 
              img.onerror = rej; 
              img.src = '/lf_white.png'; 
          });
          
          logoWidth = Math.max(80, fW * 0.12); 
          logoHeight = logoImg.height * (logoWidth / logoImg.width);
          
          stackWidth = Math.max(logoWidth, userTextWidth);
          stackHeight = logoHeight + (fontSize * 1.2); 
      } catch (err) { 
          console.warn("[LUMAFORGE_ASSET_FAULT] Watermark image missing. Using dual-text stack.");
          logoWidth = 0;
          logoHeight = 0;
          stackWidth = Math.max(mainTextWidth, userTextWidth);
          stackHeight = fontSize * 2.2; 
      }

      let finalX = 0;
      switch (settings.watermarkAlign) {
          case 'left':
              finalX = padding;
              break;
          case 'center':
              finalX = (fW / 2) - (stackWidth / 2);
              break;
          case 'right':
          default:
              finalX = fW - stackWidth - padding;
              break;
      }

      fCtx.fillStyle = "rgba(255, 255, 255, 0.8)";
      
      if (settings.watermarkAlign === 'center') {
          fCtx.textAlign = "center";
          const centerX = finalX + (stackWidth / 2); 
          
          if (logoImg) {
              fCtx.drawImage(logoImg, centerX - (logoWidth/2), fH - stackHeight - padding, logoWidth, logoHeight);
          } else {
              fCtx.fillText(mainText, centerX, fH - stackHeight - padding + fontSize);
          }
          fCtx.fillText(usernameText, centerX, fH - padding);
      } else {
          fCtx.textAlign = settings.watermarkAlign; 
          
          const textX = settings.watermarkAlign === 'left' ? finalX : finalX + stackWidth;
          const logoDrawX = settings.watermarkAlign === 'left' ? finalX : finalX + (stackWidth - logoWidth);

          if (logoImg) {
              fCtx.drawImage(logoImg, logoDrawX, fH - stackHeight - padding, logoWidth, logoHeight);
          } else {
              fCtx.fillText(mainText, textX, fH - stackHeight - padding + fontSize);
          }
          fCtx.fillText(usernameText, textX, fH - padding);
      }
      fCtx.restore();
  }

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

export const generateExportBlob = async (imageSrc, settings) => {
    if (!imageSrc) throw new Error("No source image provided.");

    let sourceBase64 = null;
    try {
        const response = await fetch(imageSrc);
        const blob = await response.blob();
        sourceBase64 = await blobToBase64(blob);
    } catch (e) { }

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
    
    // Cloud blobs apply watermark if set
    if (settings.watermark) {
      const fW = finalCanvas.width;
      const fH = finalCanvas.height;
      const padding = Math.max(20, fW * 0.03); 

      fCtx.setTransform(1, 0, 0, 1, 0, 0); 
      fCtx.globalCompositeOperation = 'source-over';
      fCtx.globalAlpha = 0.6; 
      fCtx.shadowColor = "rgba(0,0,0,0.85)";
      fCtx.shadowBlur = Math.max(10, fW * 0.01); 
      fCtx.shadowOffsetY = Math.max(2, fW * 0.002);

      let logoImg = null;
      let logoWidth = 0; let logoHeight = 0;
      let stackWidth = 0; let stackHeight = 0;
      
      const fontSize = Math.max(20, fW * 0.025); 
      fCtx.font = `bold ${fontSize}px monospace`; 
      const usernameText = settings.watermarkUser || 'sganeshe';
      const userTextMetrics = fCtx.measureText(usernameText);
      const userTextWidth = userTextMetrics.width;

      const mainText = "LUMAFORGE";
      const mainTextMetrics = fCtx.measureText(mainText);
      const mainTextWidth = mainTextMetrics.width;

      try {
          logoImg = await new Promise((res, rej) => {
              const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = '/lf_white.png'; 
          });
          logoWidth = Math.max(80, fW * 0.12); 
          logoHeight = logoImg.height * (logoWidth / logoImg.width);
          stackWidth = Math.max(logoWidth, userTextWidth);
          stackHeight = logoHeight + (fontSize * 1.2); 
      } catch (err) { 
          logoWidth = 0; logoHeight = 0;
          stackWidth = Math.max(mainTextWidth, userTextWidth);
          stackHeight = fontSize * 2.2; 
      }

      let finalX = 0;
      switch (settings.watermarkAlign) {
          case 'left': finalX = padding; break;
          case 'center': finalX = (fW / 2) - (stackWidth / 2); break;
          case 'right': default: finalX = fW - stackWidth - padding; break;
      }

      fCtx.fillStyle = "rgba(255, 255, 255, 0.8)";
      if (settings.watermarkAlign === 'center') {
          fCtx.textAlign = "center";
          const centerX = finalX + (stackWidth / 2); 
          if (logoImg) fCtx.drawImage(logoImg, centerX - (logoWidth/2), fH - stackHeight - padding, logoWidth, logoHeight);
          else fCtx.fillText(mainText, centerX, fH - stackHeight - padding + fontSize);
          fCtx.fillText(usernameText, centerX, fH - padding);
      } else {
          fCtx.textAlign = settings.watermarkAlign; 
          const textX = settings.watermarkAlign === 'left' ? finalX : finalX + stackWidth;
          const logoDrawX = settings.watermarkAlign === 'left' ? finalX : finalX + (stackWidth - logoWidth);
          if (logoImg) fCtx.drawImage(logoImg, logoDrawX, fH - stackHeight - padding, logoWidth, logoHeight);
          else fCtx.fillText(mainText, textX, fH - stackHeight - padding + fontSize);
          fCtx.fillText(usernameText, textX, fH - padding);
      }
      fCtx.restore();
    }

    return new Promise((resolve, reject) => {
        finalCanvas.toBlob(async (blob) => {
            if (!blob) return reject(new Error("Canvas toBlob failed."));
            const projectPayload = { settings, source: sourceBase64, timestamp: Date.now(), version: "4.3.1" };
            let finalBlob = blob;
            try { finalBlob = await injectMetadata(blob, projectPayload); } catch (e) { }
            resolve(finalBlob); 
        }, 'image/png', 1.0);
    });
};