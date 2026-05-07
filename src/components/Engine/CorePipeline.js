/**
 * @file CorePipeline.js
 * @description The primary rendering engine for LUMAFORGE. 
 * Hybrid Engine: Uses hardware-accelerated CSS for base filters, 
 * pure JS Canvas arrays for advanced Tone Mapping, and a final 
 * Master Composite Layer for AI Semantic Mask blending.
 */

import { applyLutToPixel } from './LUTSystem';
import { generateCurveLUT } from './CurvesMath';

// =========================================================================
// HSL HELPERS (For Selective Color Targeting)
// =========================================================================
const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; } 
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s * 100, l * 100];
};

const hslToRgb = (h, s, l) => {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) { r = g = b = l; } 
    else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [r * 255, g * 255, b * 255];
};

// --- FAST SPATIAL BOX BLUR FOR MASKS ---
const applySpatialBlur = (mask, width, height, radius) => {
    if (radius < 1) return mask;
    let temp = new Float32Array(mask.length);
    let finalMask = new Float32Array(mask.length);

    // Horizontal Pass
    for (let y = 0; y < height; y++) {
        let sum = 0;
        let offset = y * width;
        for (let i = 0; i < radius; i++) sum += mask[offset + i];
        for (let x = 0; x < width; x++) {
            if (x + radius < width) sum += mask[offset + x + radius];
            if (x - radius > 0) sum -= mask[offset + x - radius - 1];
            let count = Math.min(x + radius, width - 1) - Math.max(x - radius, 0) + 1;
            temp[offset + x] = sum / count;
        }
    }

    // Vertical Pass
    for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let i = 0; i < radius; i++) sum += temp[i * width + x];
        for (let y = 0; y < height; y++) {
            if (y + radius < height) sum += temp[(y + radius) * width + x];
            if (y - radius > 0) sum -= temp[(y - radius - 1) * width + x];
            let count = Math.min(y + radius, height - 1) - Math.max(y - radius, 0) + 1;
            finalMask[y * width + x] = sum / count;
        }
    }
    return finalMask;
};

// =========================================================================
// THE CORE PIPELINE
// =========================================================================
export const runCorePipeline = async (imageSrc, settings, maxDim = null) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        if (imageSrc && imageSrc.startsWith('http')) {
            img.crossOrigin = "anonymous";
        }
        
        img.src = imageSrc;

        img.onload = () => {
            try {
                let w = img.naturalWidth;
                let h = img.naturalHeight;

                if (maxDim && (w > maxDim || h > maxDim)) {
                    const ratio = Math.min(maxDim / w, maxDim / h);
                    w = Math.floor(w * ratio);
                    h = Math.floor(h * ratio);
                }

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                const resMult = Math.max(1, w / 2000); 

                /* =========================================================================
                   STAGE 1: HARDWARE-ACCELERATED BASE FILTERS 
                   ========================================================================= */
                const blurPx = settings.sharpen < 0 ? Math.abs(settings.sharpen) * 0.05 : 0;
                const scaledBlur = blurPx * resMult;

                ctx.filter = `
                  brightness(${100 + ((settings.exposure||0) * 20)}%) 
                  contrast(${100 + (settings.contrast||0) + ((settings.dehaze||0)/4)}%) 
                  saturate(${100 + (settings.saturation||0) + (settings.vibrance||0) + ((settings.dehaze||0)/4)}%) 
                  sepia(${settings.sepia||0}%) invert(${settings.invert||0}%) hue-rotate(${settings.hue||0}deg)
                  blur(${scaledBlur}px)
                `;
                
                ctx.drawImage(img, 0, 0, w, h);
                ctx.filter = 'none'; 

                /* =========================================================================
                   STAGE 2: HALATION EMULATION
                   ========================================================================= */
                if (settings.halationAmount > 0) {
                    const bScale = 0.25; 
                    const bw = Math.floor(w * bScale), bh = Math.floor(h * bScale);
                    const bCvs = document.createElement('canvas');
                    bCvs.width = bw; bCvs.height = bh;
                    const bCtx = bCvs.getContext('2d');
                    bCtx.drawImage(canvas, 0, 0, bw, bh);
                    
                    const bData = bCtx.getImageData(0, 0, bw, bh);
                    const bd = bData.data;
                    const thresh = ((settings.halationThreshold||0) / 100) * 255;
                    
                    for (let i = 0; i < bd.length; i+=4) {
                        const l = 0.299*bd[i] + 0.587*bd[i+1] + 0.114*bd[i+2]; 
                        if (l < thresh) { 
                            bd[i] = bd[i+1] = bd[i+2] = 0; 
                        } else { 
                            bd[i] = Math.min(255, bd[i] * 1.15); 
                        }
                    }
                    bCtx.putImageData(bData, 0, 0);
                    
                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';
                    ctx.globalAlpha = settings.halationAmount / 100;
                    ctx.filter = `blur(${Math.max(2, 15 * resMult)}px)`;
                    ctx.drawImage(bCvs, 0, 0, w, h);
                    ctx.restore();
                }

                /* =========================================================================
                   STAGE 3: MAIN LOOP
                   ========================================================================= */
                const imgData = ctx.getImageData(0, 0, w, h);
                const data = imgData.data;

                const clamp = (val) => isNaN(val) ? 0 : Math.max(0, Math.min(255, Math.floor(val)));
                const n = (val) => (val||0) / 100;
                const nP = (val) => Math.max(0, (val||0) / 100);

                const sC = settings.curves || { master:[], red:[], green:[], blue:[] };
                const lutM = generateCurveLUT(sC.master || [{x:0,y:0},{x:255,y:255}]);
                const lutR = generateCurveLUT(sC.red || [{x:0,y:0},{x:255,y:255}]);
                const lutG = generateCurveLUT(sC.green || [{x:0,y:0},{x:255,y:255}]);
                const lutB = generateCurveLUT(sC.blue || [{x:0,y:0},{x:255,y:255}]);

                const applyCurve = (val, channelLUT) => {
                    const mVal = lutM[clamp(val)];
                    if (mVal === undefined) return val; 
                    const cVal = channelLUT[clamp(mVal * 255)];
                    return cVal === undefined ? mVal * 255 : cVal * 255;
                };

                const getGrade = (t) => {
                  const c = settings.grading?.[t] || {r:0.5, g:0.5, b:0.5}; 
                  const l = n(settings.gradingLum?.[t] || 0); 
                  const b = nP(settings.gradingBlend?.[t] !== undefined ? settings.gradingBlend[t] : 100);
                  return { r: (c.r-0.5)*b+l, g: (c.g-0.5)*b+l, b: (c.b-0.5)*b+l };
                };
                
                const gS = getGrade('shadows'), gM = getGrade('midtones'), gH = getGrade('highlights');

                const shadowVal = (settings.shadows || 0) / 100;
                const highlightVal = (settings.highlights || 0) / 100;
                const whiteVal = (settings.whites || 0) / 100; 
                const blackVal = (settings.blacks || 0) / 100; 

                const grainInt = nP(settings.grainAmount) * 180; 
                const grainScale = Math.max(1, Math.floor(Math.max(1, (settings.grainSize||50) / 5) * resMult));
                const grainRough = (settings.grainRoughness||50) / 100;

                const isCurveActive = (sC.master?.length > 2) || (sC.red?.length > 2) || (sC.green?.length > 2) || (sC.blue?.length > 2);
                const isGradingActive = gS.r !== 0 || gS.g !== 0 || gS.b !== 0 || gM.r !== 0 || gM.g !== 0 || gM.b !== 0 || gH.r !== 0 || gH.g !== 0 || gH.b !== 0;
                
                const isSelectiveColorActive = (settings.targetHueShift !== undefined && settings.targetHueShift !== 0) || 
                                               (settings.targetSatShift !== undefined && settings.targetSatShift !== 0) || 
                                               (settings.targetLumShift !== undefined && settings.targetLumShift !== 0);
                
                const needsPixelLoop = settings.activeLut || grainInt > 0 || shadowVal !== 0 || highlightVal !== 0 || whiteVal !== 0 || blackVal !== 0 || isGradingActive || isCurveActive || isSelectiveColorActive;

                let noiseLUT = null;
                if (grainInt > 0 && needsPixelLoop) {
                    noiseLUT = new Float32Array(65536);
                    for (let i = 0; i < 65536; i++) {
                        noiseLUT[i] = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
                    }
                }

                if (needsPixelLoop) {
                    for (let y = 0; y < h; y++) {
                        for (let x = 0; x < w; x++) {
                            const i = (y * w + x) * 4;
                            let r = data[i], g = data[i+1], b = data[i+2];

                            if (settings.activeLut) {
                                const lP = applyLutToPixel(r, g, b, settings.activeLut);
                                if (lP) { r = lP[0]; g = lP[1]; b = lP[2]; }
                            }

                            if (shadowVal !== 0 || highlightVal !== 0 || whiteVal !== 0 || blackVal !== 0) {
                                const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                                let newLuma = luma;

                                if (blackVal !== 0) newLuma += blackVal * Math.pow(1 - luma, 4) * 0.4;
                                if (shadowVal !== 0) newLuma += shadowVal * Math.pow(1 - luma, 2) * luma * 2.5;
                                if (highlightVal !== 0) newLuma += highlightVal * Math.pow(luma, 2) * (1 - luma) * 2.5;
                                if (whiteVal !== 0) newLuma += whiteVal * Math.pow(luma, 4) * 0.4;

                                if (luma > 0) {
                                    const ratio = newLuma / luma;
                                    r *= ratio; g *= ratio; b *= ratio;
                                } else if (newLuma > 0) {
                                    r = g = b = newLuma * 255;
                                }
                            }

                            if (isCurveActive) {
                                r = applyCurve(r, lutR);
                                g = applyCurve(g, lutG);
                                b = applyCurve(b, lutB);
                            }

                            if (isGradingActive) {
                                const gradeLuma = clamp(0.299 * r + 0.587 * g + 0.114 * b) / 255;
                                
                                let shadowWeight = Math.max(0, 1.0 - (gradeLuma * 2.0)); 
                                let highlightWeight = Math.max(0, (gradeLuma - 0.5) * 2.0); 
                                let midtoneWeight = Math.max(0, 1.0 - shadowWeight - highlightWeight);

                                r += (gS.r * shadowWeight + gM.r * midtoneWeight + gH.r * highlightWeight) * 255;
                                g += (gS.g * shadowWeight + gM.g * midtoneWeight + gH.g * highlightWeight) * 255;
                                b += (gS.b * shadowWeight + gM.b * midtoneWeight + gH.b * highlightWeight) * 255;
                            }

                            // =====================================================================
                            // SELECTIVE COLOR (HSL)
                            // =====================================================================
                            const isSelectiveColorActive = settings.targetRange > 0 && 
                                (settings.targetHueShift !== 0 || settings.targetSatShift !== 0 || settings.targetLumShift !== 0);

                            if (isSelectiveColorActive) {
                                let [pHue, pSat, pLum] = rgbToHsl(r, g, b); 

                                let dist = Math.abs(pHue - (settings.targetHue || 0));
                                if (dist > 180) dist = 360 - dist;

                                const range = settings.targetRange || 30;
                                if (dist < range) {
                                    let falloff = 1 - (dist / range);
                                    falloff = falloff * falloff * (3 - 2 * falloff); 

                                    pHue = (pHue + (settings.targetHueShift || 0) * falloff + 360) % 360;

                                    let sShift = (settings.targetSatShift || 0) * falloff;
                                    if (sShift > 0) {
                                        pSat += (100 - pSat) * (sShift / 100);
                                    } else {
                                        pSat += pSat * (sShift / 100);
                                    }

                                    let lShift = (settings.targetLumShift || 0) * falloff;
                                    if (lShift > 0) {
                                        pLum += (100 - pLum) * (lShift / 100);
                                    } else {
                                        pLum += pLum * (lShift / 100);
                                    }

                                    pSat = Math.max(0, Math.min(100, pSat));
                                    pLum = Math.max(0, Math.min(100, pLum));

                                    const [nr, ng, nb] = hslToRgb(pHue, pSat, pLum);
                                    r = nr; g = ng; b = nb;
                                }
                            }

                            if (grainInt > 0 && noiseLUT) {
                                const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255; 
                                const filmicMask = Math.max(0, 1.0 - Math.pow(Math.abs(luma - 0.5) * 2.0, 2.0)); 

                                const gx = Math.floor(x / grainScale);
                                const gy = Math.floor(y / grainScale);
                                
                                const hash1 = (Math.imul(gx, 1640531513) ^ Math.imul(gy, 2654435789)) & 65535;
                                let rawNoise = noiseLUT[hash1];

                                if (grainRough > 0) {
                                    const hash2 = (Math.imul(x, 1640531513) ^ Math.imul(y, 2654435789)) & 65535;
                                    rawNoise = (rawNoise * (1 - grainRough)) + (noiseLUT[hash2] * grainRough);
                                }
                                
                                const nVal = rawNoise * grainInt * filmicMask;

                                r += nVal; g += nVal; b += nVal;
                            }
                            
                            data[i] = clamp(r); data[i+1] = clamp(g); data[i+2] = clamp(b);
                        }
                    }
                    ctx.putImageData(imgData, 0, 0);
                }

                /* =========================================================================
                   STAGE 4: GLOBAL OVERLAYS & SPATIAL CONVOLUTION
                   ========================================================================= */
                const drawOverlay = (color, opacity, mode = 'overlay') => {
                    if (opacity <= 0) return;
                    ctx.save(); 
                    ctx.globalCompositeOperation = mode; 
                    ctx.globalAlpha = opacity;
                    ctx.fillStyle = color; 
                    ctx.fillRect(0, 0, w, h); 
                    ctx.restore();
                };

                if (settings.temp > 0) drawOverlay('rgb(255, 140, 0)', settings.temp/200, 'overlay');
                else if (settings.temp < 0) drawOverlay('rgb(0, 100, 255)', Math.abs(settings.temp)/200, 'overlay');
                if (settings.tint > 0) drawOverlay('rgb(255, 0, 255)', settings.tint/200, 'overlay');
                else if (settings.tint < 0) drawOverlay('rgb(0, 255, 0)', Math.abs(settings.tint)/200, 'overlay');
                
                if (settings.dehaze > 0) drawOverlay('black', settings.dehaze/200, 'multiply');
                else if (settings.dehaze < 0) drawOverlay('white', Math.abs(settings.dehaze)/200, 'screen');

                if (settings.sharpen > 0) {
                    const sAmt = nP(settings.sharpen) * 4; 
                    const kernel = [[0, -sAmt, 0], [-sAmt, 1 + 4*sAmt, -sAmt], [0, -sAmt, 0]];
                    const sharpData = ctx.getImageData(0, 0, w, h);
                    const sPx = sharpData.data; 
                    const tPx = new Uint8ClampedArray(sPx); 
                    
                    for (let y = 1; y < h - 1; y++) { 
                      for (let x = 1; x < w - 1; x++) { 
                        for (let c = 0; c < 3; c++) { 
                          let sum = 0; 
                          for (let ky = -1; ky <= 1; ky++) { 
                            for (let kx = -1; kx <= 1; kx++) { 
                                sum += tPx[((y+ky)*w + (x+kx))*4 + c] * kernel[ky+1][kx+1]; 
                            } 
                          } 
                          sPx[(y*w + x)*4 + c] = clamp(sum); 
                        } 
                      } 
                    }
                    ctx.putImageData(sharpData, 0, 0);
                }

                /* =========================================================================
                   STAGE 5: THE MASTER MASK COMPOSITE (WITH FEATHERING & OVERLAY)
                   ========================================================================= */
                const hasMask = settings.semanticMask && settings.semanticMask.length > 0;
                
                if (hasMask) {
                    const mLen = settings.semanticMask.length;
                    const maskW = settings.maskWidth || 256;
                    const maskH = settings.maskHeight || 256;

                    const tinyMaskCvs = document.createElement('canvas');
                    tinyMaskCvs.width = maskW; tinyMaskCvs.height = maskH;
                    const tinyMaskCtx = tinyMaskCvs.getContext('2d');
                    const tinyMaskImg = tinyMaskCtx.createImageData(maskW, maskH);
                    
                    for(let i = 0; i < mLen; i++){
                        const val = settings.semanticMask[i];
                        const idx = i * 4;
                        tinyMaskImg.data[idx] = val;
                        tinyMaskImg.data[idx+1] = val;
                        tinyMaskImg.data[idx+2] = val;
                        tinyMaskImg.data[idx+3] = 255;
                    }
                    tinyMaskCtx.putImageData(tinyMaskImg, 0, 0);

                    const bigMaskCvs = document.createElement('canvas');
                    bigMaskCvs.width = w; bigMaskCvs.height = h;
                    const bigMaskCtx = bigMaskCvs.getContext('2d', { willReadFrequently: true });
                    
                    const featherAmt = settings.maskFeather !== undefined ? settings.maskFeather : 25; 

                    bigMaskCtx.filter = `blur(${featherAmt * resMult}px)`; 

                    bigMaskCtx.drawImage(tinyMaskCvs, 0, 0, w, h);

                    const smoothMaskData = bigMaskCtx.getImageData(0, 0, w, h).data;
                    const maskOpacity = settings.maskOpacity !== undefined ? settings.maskOpacity / 100 : 1.0;

                    const rawCanvas = document.createElement('canvas');
                    rawCanvas.width = w; rawCanvas.height = h;
                    const rawCtx = rawCanvas.getContext('2d');
                    rawCtx.drawImage(img, 0, 0, w, h);
                    const rawData = rawCtx.getImageData(0, 0, w, h).data;

                    const finalData = ctx.getImageData(0, 0, w, h);
                    const fd = finalData.data;

                    for (let y = 0; y < h; y++) {
                        for (let x = 0; x < w; x++) {
                            const i = (y * w + x) * 4;

                            const maskConfidence = (smoothMaskData[i] / 255.0) * maskOpacity;
                            const blendWeight = settings.invertMask ? (1.0 - maskConfidence) : maskConfidence;

                            fd[i]   = rawData[i]   + (fd[i]   - rawData[i])   * blendWeight;
                            fd[i+1] = rawData[i+1] + (fd[i+1] - rawData[i+1]) * blendWeight;
                            fd[i+2] = rawData[i+2] + (fd[i+2] - rawData[i+2]) * blendWeight;

                            if (settings.showMaskOverlay) {
                                const overlayStrength = blendWeight * 0.5; 
                                fd[i]   = fd[i]   * (1 - overlayStrength) + (255 * overlayStrength);
                                fd[i+1] = fd[i+1] * (1 - overlayStrength) + (0 * overlayStrength);
                                fd[i+2] = fd[i+2] * (1 - overlayStrength) + (0 * overlayStrength);
                            }
                        }
                    }
                    ctx.putImageData(finalData, 0, 0);
                }
                
                resolve(canvas);

            } catch (error) {
                console.error("[LUMAFORGE_ENGINE_FAULT] Core Pipeline Crash:", error);
                reject(error);
            }
        };

        img.onerror = (err) => {
            console.error("[LUMAFORGE_IO_FAULT] Source file failed to decode into Pipeline", err);
            reject(err);
        };
    });
};