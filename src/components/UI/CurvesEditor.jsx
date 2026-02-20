import React, { useRef, useState, useEffect } from 'react';
import { generateCurveLUT } from '../Engine/CurvesMath';

const CurvesEditor = ({ settings, setSettings, onSnapshot }) => {
  const [activeChannel, setActiveChannel] = useState('master'); 
  const svgRef = useRef(null);
  const [dragIdx, setDragIdx] = useState(null);

  const [localPoints, setLocalPoints] = useState(settings.curves[activeChannel]);

  useEffect(() => {
     setLocalPoints(settings.curves[activeChannel]);
  }, [settings.curves, activeChannel]);

  const colors = { master: '#ffffff', red: '#ff4444', green: '#44ff44', blue: '#4444ff' };

  const commitToGlobal = (pts) => {
    setSettings(prev => ({
        ...prev,
        curves: { ...prev.curves, [activeChannel]: pts }
    }));
  };

  const handleMouseDown = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const lx = ((e.clientX - rect.left) / 200) * 255;
    const ly = 255 - ((e.clientY - rect.top) / 200) * 255;

    const hitIndex = localPoints.findIndex(p => Math.hypot(p.x - lx, p.y - ly) < 15);

    if (hitIndex !== -1) {
      setDragIdx(hitIndex);
    } else {
      const newPoints = [...localPoints, { x: lx, y: ly }].sort((a, b) => a.x - b.x);
      setLocalPoints(newPoints);
      commitToGlobal(newPoints);
      
      const newIdx = newPoints.findIndex(p => p.x === lx && p.y === ly);
      setDragIdx(newIdx);
    }
  };

  const handleMouseMove = (e) => {
    if (dragIdx === null) return;
    const rect = svgRef.current.getBoundingClientRect();
    
    let lx = ((e.clientX - rect.left) / 200) * 255;
    let ly = 255 - (((e.clientY - rect.top) / 200) * 255);

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

  const handleMouseUp = () => {
    if (dragIdx !== null) {
        setDragIdx(null);
        onSnapshot();
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
              width: 12, height: 12, borderRadius: '50%',
              border: `1px solid ${activeChannel === ch ? '#fff' : '#444'}`,
              background: colors[ch],
              opacity: activeChannel === ch ? 1 : 0.3,
              cursor: 'pointer', transition: '0.2s'
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
          cursor: dragIdx !== null ? 'grabbing' : 'crosshair'
        }}
        onMouseLeave={handleMouseUp}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        {/* GRID BACKGROUND */}
        <div style={{position:'absolute', inset:0, backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '50px 50px', opacity:0.3, pointerEvents:'none'}} />
        
        {/* DIAGONAL REFERENCE */}
        <svg width="200" height="200" style={{position:'absolute', pointerEvents:'none', opacity:0.2}}>
            <line x1="0" y1="200" x2="200" y2="0" stroke="white" strokeDasharray="4 4" />
        </svg>

        {/* CURVE */}
        <svg 
          ref={svgRef}
          width="200" height="200" 
          style={{position:'absolute', inset:0}}
          onMouseDown={handleMouseDown}
        >
          <path d={pathD} fill="none" stroke={colors[activeChannel]} strokeWidth="2" />
          
          {localPoints.map((p, i) => (
            <circle 
              key={i}
              cx={(p.x / 255) * 200}
              cy={200 - (p.y / 255) * 200}
              r={dragIdx === i ? 6 : 4}
              fill="#fff"
              stroke="#000"
              strokeWidth="1"
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