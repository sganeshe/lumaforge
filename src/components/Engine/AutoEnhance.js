/**
 * @file AutoEnhance.js
 * @description Analyzes image histograms to calculate optimal starting parameters.
 * Tuned for gentle, cinematic roll-offs. Now includes Saturation and Vibrance heuristics.
 */

export const analyzeAndEnhance = (imageSrc) => {
    return new Promise((resolve) => {
        const img = new Image();
        if (imageSrc && imageSrc.startsWith('http')) {
            img.crossOrigin = "anonymous";
        }
        img.src = imageSrc;

        img.onload = () => {
            const cvs = document.createElement('canvas');
            const maxDim = 400;
            const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
            cvs.width = Math.floor(img.width * ratio);
            cvs.height = Math.floor(img.height * ratio);
            const ctx = cvs.getContext('2d');
            ctx.drawImage(img, 0, 0, cvs.width, cvs.height);

            const data = ctx.getImageData(0, 0, cvs.width, cvs.height).data;
            const totalPixels = cvs.width * cvs.height;
            
            let rSum = 0, gSum = 0, bSum = 0, lumaSum = 0, satSum = 0;
            const lumaHist = new Array(256).fill(0);

            // 1. Scan Pixels
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i+1], b = data[i+2];
                rSum += r; gSum += g; bSum += b;
                
                const luma = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
                lumaSum += luma;
                lumaHist[Math.max(0, Math.min(255, luma))]++;

                // Fast Saturation Approximation: Delta between max and min color channels
                const pMax = Math.max(r, g, b);
                const pMin = Math.min(r, g, b);
                satSum += (pMax - pMin);
            }

            const avgR = rSum / totalPixels;
            const avgG = gSum / totalPixels;
            const avgB = bSum / totalPixels;
            const avgLuma = lumaSum / totalPixels;
            const avgSat = satSum / totalPixels;

            // 2. PERCENTILE CLIPPING (Still used, but for gentle math)
            let minBound = 0, maxBound = 255;
            let cumulative = 0;
            for (let i = 0; i < 256; i++) {
                cumulative += lumaHist[i];
                if (cumulative > totalPixels * 0.02 && minBound === 0) minBound = i; 
                if (cumulative > totalPixels * 0.98) { maxBound = i; break; } 
            }

            // 3. GENTLE EXPOSURE 
            // Target middle grey is ~125. Multiplier dropped from 3.5 to 1.5.
            const targetLuma = 125;
            let suggestedExposure = ((targetLuma - avgLuma) / 128) * 1.5; 

            // 4. GENTLE CONTRAST 
            const currentRange = Math.max(1, maxBound - minBound);
            let suggestedContrast = 0;
            if (currentRange < 230) {
                // Maxes out around +45 instead of +150
                suggestedContrast = ((255 - currentRange) / 255) * 45; 
            }

            // 5. GENTLE WHITE BALANCE
            // Multiplier dropped from 150 to 40. Just a nudge toward neutral.
            const suggestedTemp = ((avgB - avgR) / 128) * 40; 
            const avgRB = (avgR + avgB) / 2;
            const suggestedTint = ((avgG - avgRB) / 128) * 40;

            // 6. GENTLE SHADOWS / HIGHLIGHTS
            // Multiplier dropped from 3.0 to 1.2.
            const shadowVolume = lumaHist.slice(0, 40).reduce((a, b) => a + b, 0) / totalPixels;
            const highlightVolume = lumaHist.slice(215, 256).reduce((a, b) => a + b, 0) / totalPixels;

            let suggestedShadows = shadowVolume > 0.05 ? (shadowVolume * 100 * 1.2) : 0;
            let suggestedHighlights = highlightVolume > 0.05 ? -(highlightVolume * 100 * 1.2) : 0;

            // 7. NEW: VIBRANCE & SATURATION LOGIC
            let suggestedVibrance = 0;
            let suggestedSaturation = 0;
            
            // A healthy, natural photo has an average saturation variance of around 50 to 60.
            if (avgSat < 50) {
                const deficit = 50 - avgSat;
                // Favor vibrance (protects skin tones) over flat saturation
                suggestedVibrance = deficit * 0.8; 
                suggestedSaturation = deficit * 0.25;
            } else if (avgSat > 100) {
                // Slightly cool down extremely neon/over-saturated images
                const excess = avgSat - 100;
                suggestedVibrance = -excess * 0.4;
                suggestedSaturation = -excess * 0.15;
            }

            resolve({
                exposure: Math.max(-5, Math.min(5, suggestedExposure)),
                contrast: Math.max(-100, Math.min(100, suggestedContrast)),
                temp: Math.max(-100, Math.min(100, suggestedTemp)),
                tint: Math.max(-100, Math.min(100, suggestedTint)),
                shadows: Math.max(0, Math.min(100, suggestedShadows)),
                highlights: Math.max(-100, Math.min(0, suggestedHighlights)),
                saturation: Math.max(-100, Math.min(100, suggestedSaturation)),
                vibrance: Math.max(-100, Math.min(100, suggestedVibrance))
            });
        };
        
        img.onerror = () => resolve(null); 
    });
};