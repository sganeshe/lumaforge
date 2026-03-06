/**
 * @file CorePipeline.js
 * @description The primary rendering engine for LUMAFORGE. Handles all destructive, 
 * pixel-level mathematical operations including convolutions, Look-Up Tables (LUTs), 
 * and procedural noise generation.
 * @warning PERFORMANCE CRITICAL. 
 */

import { applyLutToPixel } from './LUTSystem';
import { generateCurveLUT } from './CurvesMath';

export const runCorePipeline = async (imageSrc, settings, maxDim = null) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        // SECURITY & CORS
        if (imageSrc && imageSrc.startsWith('http')) {
            img.crossOrigin = "anonymous";
        }
        
        img.src = imageSrc;

        img.onload = () => {
            try {
                let w = img.naturalWidth;
                let h = img.naturalHeight;

                // DOWN-SAMPLING
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
                const whiteVal = (settings.whites || 0) / 5;
                const blackVal = (settings.blacks || 0) / 5;
                const blurPx = settings.sharpen < 0 ? Math.abs(settings.sharpen) * 0.05 : 0;
                const scaledBlur = blurPx * resMult;

                ctx.filter = `
                  brightness(${100 + ((settings.exposure||0) * 20) + whiteVal}%) 
                  contrast(${100 + (settings.contrast||0) + blackVal + ((settings.dehaze||0)/4)}%) 
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
                   STAGE 3: MAIN PIXEL LOOP
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
                const scaleR = 1 + gH.r + gM.r, scaleG = 1 + gH.g + gM.g, scaleB = 1 + gH.b + gM.b;
                const offR = (gS.r + gM.r)*255, offG = (gS.g + gM.g)*255, offB = (gS.b + gM.b)*255;

                const grainInt = nP(settings.grainAmount) * 255; 
                const grainScale = Math.max(1, Math.floor(Math.max(1, (settings.grainSize||50) / 5) * resMult));
                const grainRough = (settings.grainRoughness||50) / 100;
                
                // Set up scalars for safe polynomial math
                const shadowVal = (settings.shadows || 0) / 100;
                const highlightVal = (settings.highlights || 0) / 100;

                // Better detection to skip the loop if values are completely neutral
                const isCurveActive = (sC.master?.length > 2) || (sC.red?.length > 2) || (sC.green?.length > 2) || (sC.blue?.length > 2);
                const isGradingActive = scaleR !== 1 || scaleG !== 1 || scaleB !== 1 || offR !== 0 || offG !== 0 || offB !== 0;
                
                const needsPixelLoop = settings.activeLut || grainInt > 0 || shadowVal !== 0 || highlightVal !== 0 || isGradingActive || isCurveActive;

                if (needsPixelLoop) {
                    for (let y = 0; y < h; y++) {
                        for (let x = 0; x < w; x++) {
                            const i = (y * w + x) * 4;
                            let r = data[i], g = data[i+1], b = data[i+2];

                            // 1. External 3D LUT Application
                            if (settings.activeLut) {
                                const lP = applyLutToPixel(r, g, b, settings.activeLut);
                                if (lP) { r = lP[0]; g = lP[1]; b = lP[2]; }
                            }

                            // 2. NEW: Pro Polynomial Tone Curve (Shadows & Highlights)
                            // This math creates a continuous curve that cannot crush colors or overflow
                            if (shadowVal !== 0 || highlightVal !== 0) {
                                const adjustTone = (c) => {
                                    let norm = c / 255;
                                    
                                    if (shadowVal !== 0) {
                                        // Smoothly lifts or crushes the bottom 50% of the histogram
                                        norm += shadowVal * Math.pow(1 - norm, 2) * norm * 2.0;
                                    }
                                    if (highlightVal !== 0) {
                                        // Smoothly boosts or recovers the top 50% of the histogram
                                        norm += highlightVal * Math.pow(norm, 2) * (1 - norm) * 2.0;
                                    }
                                    return norm * 255;
                                };
                                
                                r = adjustTone(r);
                                g = adjustTone(g);
                                b = adjustTone(b);
                            }

                            // 3. Curves & 3-Way Color Grading Injection
                            if (isCurveActive || isGradingActive) {
                                r = applyCurve(r, lutR) * scaleR + offR;
                                g = applyCurve(g, lutG) * scaleG + offG;
                                b = applyCurve(b, lutB) * scaleB + offB;
                            }

                            // 4. Procedural Grain
                            if (grainInt > 0) {
                                const luma = (0.299*r + 0.587*g + 0.114*b) / 255; 
                                const grainMask = Math.pow(1.0 - Math.max(0, Math.min(1, luma)), 1.2); 
                                const sx = Math.floor(x / grainScale), sy = Math.floor(y / grainScale);
                                
                                let noise = (Math.sin(sx * 12.9898 + sy * 78.233) * 43758.5453 % 1) - 0.5;
                                
                                if (grainRough > 0) {
                                    const fNoise = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1) - 0.5;
                                    noise = (noise * (1-grainRough)) + (fNoise * grainRough);
                                }
                                noise = (noise > 0 ? Math.pow(noise*2, 0.8) : -Math.pow(Math.abs(noise)*2, 0.8)) * 0.5;
                                const nVal = noise * grainInt * grainMask; 
                                r += nVal; g += nVal; b += nVal;
                            }
                            
                            // 5. Final Clamp
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
                    const kernel = [ 
                      [0, -sAmt, 0], 
                      [-sAmt, 1 + 4*sAmt, -sAmt], 
                      [0, -sAmt, 0] 
                    ];
                    
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