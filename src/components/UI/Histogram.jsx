import React, { useEffect, useRef, useState } from 'react';
import { applyLutToPixel } from '../Engine/LUTSystem';

const Histogram = ({ imageSrc, settings }) => {
  const canvasRef = useRef(null);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    if (!imageSrc || !canvasRef.current) return;
    
    if (computing) return;
    setComputing(true);

    const img = new Image();
    img.src = imageSrc;
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      const sampleSize = 128; 
      canvas.width = sampleSize;
      canvas.height = sampleSize; 

      const whiteVal = settings.whites / 5;
      const blackVal = settings.blacks / 5;
      const dehazeVal = settings.dehaze / 4;
      
      ctx.filter = `
        brightness(${100 + (settings.exposure * 20) + whiteVal}%) 
        contrast(${100 + settings.contrast + blackVal + dehazeVal}%) 
        saturate(${100 + settings.saturation + settings.vibrance + dehazeVal}%) 
        sepia(${settings.sepia}%) 
        invert(${settings.invert}%) 
        hue-rotate(${settings.hue}deg)
      `;

      ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
      ctx.filter = 'none'; 

      const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize);
      const data = imgData.data;

      const n = (val) => val / 100;
      const nP = (val) => Math.max(0, val / 100);
      const clamp = (val) => Math.max(0, Math.min(255, val));

      const getGrade = (t) => {
        const c = settings.grading[t];
        const l = n(settings.gradingLum[t]);
        const b = nP(settings.gradingBlend[t]);
        return { r: (c.r-0.5)*b+l, g: (c.g-0.5)*b+l, b: (c.b-0.5)*b+l };
      };
      
      const gS = getGrade('shadows');
      const gM = getGrade('midtones');
      const gH = getGrade('highlights');

      const scaleR = 1 + gH.r + gM.r;
      const scaleG = 1 + gH.g + gM.g;
      const scaleB = 1 + gH.b + gM.b;
      const offR = (gS.r + gM.r) * 255;
      const offG = (gS.g + gM.g) * 255;
      const offB = (gS.b + gM.b) * 255;

      const shadowY = 0.0 + (settings.shadows / 200);
      const highlightY = 1.0 + (settings.highlights / 200);

      const histR = new Array(256).fill(0);
      const histG = new Array(256).fill(0);
      const histB = new Array(256).fill(0);
      let maxCount = 0;

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i+1], b = data[i+2];

        if (settings.activeLut) {
           const [lr, lg, lb] = applyLutToPixel(r, g, b, settings.activeLut);
           r = lr; g = lg; b = lb;
        }

        const mapTone = (c) => {
          const norm = c / 255;
          let out;
          if (norm < 0.5) out = shadowY + (norm / 0.5) * (0.5 - shadowY);
          else out = 0.5 + ((norm - 0.5) / 0.5) * (highlightY - 0.5);
          return out * 255;
        };
        r = mapTone(r); g = mapTone(g); b = mapTone(b);

        r = clamp(r * scaleR + offR);
        g = clamp(g * scaleG + offG);
        b = clamp(b * scaleB + offB);

        if (settings.temp !== 0) {
            const tVal = settings.temp / 200;
            if (settings.temp > 0) { r += tVal * (255 - r); g += tVal * (140 - g); }
            else { b += Math.abs(tVal) * (255 - b); g += Math.abs(tVal) * (100 - g); }
        }
        histR[Math.round(r)]++;
        histG[Math.round(g)]++;
        histB[Math.round(b)]++;
      }

      maxCount = Math.max(...histR, ...histG, ...histB);
      maxCount = maxCount * 0.8; 

      canvas.width = 256;
      canvas.height = 100;
      ctx.clearRect(0, 0, 256, 100);
      
      ctx.globalCompositeOperation = 'screen';

      const drawChannel = (arr, color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, 100);
        for (let i = 0; i < 256; i++) {
          const percent = arr[i] / maxCount;
          const h = Math.min(100, percent * 100);
          ctx.lineTo(i, 100 - h);
        }
        ctx.lineTo(255, 100);
        ctx.closePath();
        ctx.fill();
      };

      drawChannel(histR, 'rgba(255, 50, 50, 0.8)');
      drawChannel(histG, 'rgba(50, 255, 50, 0.8)');
      drawChannel(histB, 'rgba(50, 50, 255, 0.8)');

      setComputing(false);
    };

  }, [imageSrc, settings]); 

  return (
    <div style={{
      width: '100%', 
      height: '110px', 
      background: '#0a0a0a', 
      border: '1px solid #333', 
      borderRadius: 4, 
      marginBottom: 20,
      position: 'relative',
      overflow: 'hidden'
    }}>
      <canvas 
        ref={canvasRef} 
        style={{width: '100%', height: '100%', display: 'block'}} 
      />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(transparent 90%, rgba(255,255,255,0.05) 1px)',
        backgroundSize: '100% 25%'
      }}/>
      <div style={{
        position: 'absolute', top: 4, left: 6, 
        fontSize: 9, fontFamily: 'monospace', color: '#666', fontWeight: 'bold'
      }}>
        RGB_DENSITY
      </div>
    </div>
  );
};

export default Histogram;