import React, { useRef, useState, useEffect } from 'react';
import { generateCurveLUT } from '../Engine/CurvesMath';

const CurvesEditor = ({ settings, setSettings, onSnapshot }) => {
  const [activeChannel, setActiveChannel] = useState('master'); 
  const svgRef = useRef(null);
  
  // Interaction State
  const [dragIdx, setDragIdx] = useState(null);
  const [hasDragged, setHasDragged] = useState(false); 

  const [localPoints, setLocalPoints] = useState(settings.curves[activeChannel] || [{x: 0, y: 0}, {x: 255, y: 255}]);

  useEffect(() => {
     setLocalPoints(settings.curves[activeChannel] || [{x: 0, y: 0}, {x: 255, y: 255}]);
  }, [settings.curves, activeChannel]);

  const colors = { master: '#ffffff', red: '#ff4444', green: '#44ff44', blue: '#4444ff' };

  const commitToGlobal = (pts) => {
    setSettings(prev => ({
        ...prev,
        curves: { ...prev.curves, [activeChannel]: pts }
    }));
  };

  // HELPER: Extracts coordinates from both Mouse and Touch events
  const getCoordinates = (e) => {
    if (e.touches && e.touches.length > 0) {
        return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  };

  const handlePointerDown = (e) => {
    const { clientX, clientY } = getCoordinates(e);
    const rect = svgRef.current.getBoundingClientRect();
    const lx = ((clientX - rect.left) / 200) * 255;
    const ly = 255 - ((clientY - rect.top) / 200) * 255;

    // Fat-finger tolerance: Increased hit radius to 20 for easier mobile tapping
    const hitIndex = localPoints.findIndex(p => Math.hypot(p.x - lx, p.y - ly) < 20);

    if (hitIndex !== -1) {
      setDragIdx(hitIndex);
      setHasDragged(false);
    } else {
      const newPoints = [...localPoints, { x: lx, y: ly }].sort((a, b) => a.x - b.x);
      setLocalPoints(newPoints);
      commitToGlobal(newPoints);
      
      onSnapshot(); 
      
      const newIdx = newPoints.findIndex(p => p.x === lx && p.y === ly);
      setDragIdx(newIdx);
      setHasDragged(false);
    }
  };

  const handlePointerMove = (e) => {
    if (dragIdx === null) return;
    
    setHasDragged(true); 
    
    const { clientX, clientY } = getCoordinates(e);
    const rect = svgRef.current.getBoundingClientRect();
    let lx = ((clientX - rect.left) / 200) * 255;
    let ly = 255 - (((clientY - rect.top) / 200) * 255);

    lx = Math.max(0, Math.min(255, lx));
    ly = Math.max(0, Math.min(255, ly));

    if (dragIdx === 0) lx = 0;
    if (dragIdx === localPoints.length - 1) lx = 255;

    const newPoints = [...localPoints];
    newPoints[dragIdx] = { x: lx, y: ly };

    if (dragIdx > 0 && lx < newPoints[dragIdx-1].x) lx = newPoints[dragIdx-1].x + 1;
    if (dragIdx < localPoints.length-1 && lx > newPoints[dragIdx+1].x) lx = newPoints[dragIdx+1].x - 1;
    newPoints[dragIdx].x = lx;

    setLocalPoints(newPoints);
    commitToGlobal(newPoints);
  };

  const handlePointerUp = () => {
    if (dragIdx !== null) {
        if (hasDragged) {
            onSnapshot();
        }
        setDragIdx(null);
        setHasDragged(false);
    }
  };

  const handleDoubleClick = (e, idx) => {
    e.stopPropagation();
    if (idx === 0 || idx === localPoints.length - 1) return;
    
    const newPoints = localPoints.filter((_, i) => i !== idx);
    setLocalPoints(newPoints);
    commitToGlobal(newPoints);
    
    onSnapshot();
  };

  const pathD = (() => {
    const lut = generateCurveLUT(localPoints);
    let d = `M 0 ${200 - (lut[0] * 200)}`;
    
    for (let i = 10; i < 256; i += 10) {
      d += ` L ${ (i/255)*200 } ${ 200 - (lut[i] * 200) }`;
    }
    d += ` L 200 ${ 200 - (lut[255] * 200) }`;
    return d;
  })();

  return (
    <div className="curves-container">
      {/* CHANNEL SELECTOR */}
      <div style={{display:'flex', gap:10, marginBottom:15, justifyContent:'center'}}>
        {['master', 'red', 'green', 'blue'].map(ch => (
          <button 
            key={ch}
            onClick={() => setActiveChannel(ch)}
            style={{
              width: 24, height: 24, borderRadius: '50%', // Increased size for touch targets
              border: `2px solid ${activeChannel === ch ? '#fff' : '#444'}`,
              background: colors[ch],
              opacity: activeChannel === ch ? 1 : 0.3,
              cursor: 'pointer', transition: '0.2s',
              padding: 0
            }}
          />
        ))}
      </div>

      {/* EDITOR AREA */}
      <div 
        style={{
          width: 200, height: 200, 
          background: '#111', border: '1px solid #333',
          position: 'relative', margin: '0 auto',
          cursor: dragIdx !== null ? 'grabbing' : 'crosshair',
          touchAction: 'none' // STRICT MOBILE SCROLL LOCK
        }}
        onMouseLeave={handlePointerUp}
        onMouseUp={handlePointerUp}
        onTouchCancel={handlePointerUp}
        onTouchEnd={handlePointerUp}
        onMouseMove={handlePointerMove}
        onTouchMove={handlePointerMove}
      >
        <div style={{position:'absolute', inset:0, backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '50px 50px', opacity:0.3, pointerEvents:'none'}} />
        
        <svg width="200" height="200" style={{position:'absolute', pointerEvents:'none', opacity:0.2}}>
            <line x1="0" y1="200" x2="200" y2="0" stroke="white" strokeDasharray="4 4" />
        </svg>

        <svg 
          ref={svgRef}
          width="200" height="200" 
          style={{position:'absolute', inset:0, touchAction: 'none'}}
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
        >
          <path d={pathD} fill="none" stroke={colors[activeChannel]} strokeWidth="2" />
          
          {localPoints.map((p, i) => (
            <circle 
              key={i}
              cx={(p.x / 255) * 200}
              cy={200 - (p.y / 255) * 200}
              r={dragIdx === i ? 8 : 6} // Slightly larger nodes
              fill="#fff"
              stroke="rgba(255,255,255,0.2)" // Invisible fat-finger stroke
              strokeWidth="15" // Massive hit radius for touch
              style={{cursor:'pointer', transition:'r 0.1s'}}
              onDoubleClick={(e) => handleDoubleClick(e, i)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
};

export default CurvesEditor;