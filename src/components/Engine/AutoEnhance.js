/**
 * @file AutoEnhance.js
 * @description Analyzes image histograms to calculate optimal starting parameters.
 * Tuned to mimic Snapseed's highly subtle, non-destructive Auto-Enhance logic.
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

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i+1], b = data[i+2];
                rSum += r; gSum += g; bSum += b;
                
                const luma = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
                lumaSum += luma;
                lumaHist[Math.max(0, Math.min(255, luma))]++;

                // Fast Saturation Approximation
                const pMax = Math.max(r, g, b);
                const pMin = Math.min(r, g, b);
                satSum += (pMax - pMin);
            }

            const avgR = rSum / totalPixels;
            const avgG = gSum / totalPixels;
            const avgB = bSum / totalPixels;
            const avgLuma = lumaSum / totalPixels;
            const avgSat = satSum / totalPixels;

            let minBound = 0, maxBound = 255;
            let cumulative = 0;
            for (let i = 0; i < 256; i++) {
                cumulative += lumaHist[i];
                if (cumulative > totalPixels * 0.02 && minBound === 0) minBound = i; 
                if (cumulative > totalPixels * 0.98) { maxBound = i; break; } 
            }

            // 1. SMART EXPOSURE (Deadzone: +/- 15)
            // If the lighting is naturally a little moody, leave it alone.
            let suggestedExposure = 0;
            const lumaDiff = 120 - avgLuma; 
            if (Math.abs(lumaDiff) > 15) { 
                // Math.pow ensures a gentle curve instead of a harsh snap
                suggestedExposure = Math.sign(lumaDiff) * Math.pow(Math.abs(lumaDiff) / 120, 0.8) * 1.5;
            }

            // 2. SMART CONTRAST
            // Only bump contrast if the image is truly muddy (range < 210). Max bump is +20.
            let suggestedContrast = 0;
            const currentRange = Math.max(1, maxBound - minBound);
            if (currentRange < 210) {
                suggestedContrast = ((210 - currentRange) / 210) * 20; 
            }

            // 3. SMART WHITE BALANCE (Protect Golden Hour)
            // If the color cast is mild, it might be an intentional sunset or neon light. Don't fix it.
            let suggestedTemp = 0;
            const tempDiff = avgB - avgR;
            if (Math.abs(tempDiff) > 20) { 
                suggestedTemp = Math.sign(tempDiff) * Math.pow(Math.abs(tempDiff) / 128, 0.8) * 20;
            }

            let suggestedTint = 0;
            const avgRB = (avgR + avgB) / 2;
            const tintDiff = avgG - avgRB;
            if (Math.abs(tintDiff) > 15) {
                suggestedTint = Math.sign(tintDiff) * Math.pow(Math.abs(tintDiff) / 128, 0.8) * 20;
            }

            // 4. AMBIANCE (Shadows/Highlights)
            // Only rescue details if more than 5% of the image is trapped in extreme darkness/light
            const shadowVolume = lumaHist.slice(0, 30).reduce((a, b) => a + b, 0) / totalPixels;
            const highlightVolume = lumaHist.slice(225, 256).reduce((a, b) => a + b, 0) / totalPixels;

            let suggestedShadows = shadowVolume > 0.05 ? Math.min(30, shadowVolume * 100 * 0.8) : 0;
            let suggestedHighlights = highlightVolume > 0.05 ? Math.max(-30, -(highlightVolume * 100 * 0.8)) : 0;

            // 5. THE "POP" (Vibrance only, zero Saturation)
            let suggestedVibrance = 0;
            if (avgSat < 60) {
                suggestedVibrance = ((60 - avgSat) / 60) * 25; // Max +25 vibrance
            } else if (avgSat > 100) {
                suggestedVibrance = -((avgSat - 100) / 100) * 10; // Gentle cool down
            }

            resolve({
                // Round everything to clean numbers for the UI sliders
                exposure: Number(suggestedExposure.toFixed(2)),
                contrast: Math.round(suggestedContrast),
                temp: Math.round(suggestedTemp),
                tint: Math.round(suggestedTint),
                shadows: Math.round(suggestedShadows),
                highlights: Math.round(suggestedHighlights),
                saturation: 0, // Pro move: Let vibrance do the work to protect skin tones
                vibrance: Math.round(suggestedVibrance)
            });
        };
        
        img.onerror = () => resolve(null); 
    });
};