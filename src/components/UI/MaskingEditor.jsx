import React, { useState, useEffect } from 'react';
import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

const MaskingEditor = ({ sourceImageData, settings, setSettings }) => {
    const [status, setStatus] = useState('SYSTEM STANDBY');
    const [isProcessing, setIsProcessing] = useState(true);
    const [segmenter, setSegmenter] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const initNeuralEngine = async () => {
            try {
                setStatus('[ DOWNLOADING WASM CORE... ]');
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
                );
                
                setStatus('[ LOADING TENSOR MODEL... ]');
                const imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
                        delegate: "GPU"
                    },
                    runningMode: "IMAGE",
                    outputCategoryMask: true,
                    outputConfidenceMasks: false
                });

                if (isMounted) {
                    setSegmenter(imageSegmenter);
                    setStatus('NEURAL ENGINE READY');
                    setIsProcessing(false);
                }
            } catch (error) {
                if (isMounted) {
                    setStatus(`ERROR: ${error.message}`);
                    setIsProcessing(false);
                }
            }
        };

        initNeuralEngine();
        return () => { isMounted = false; };
    }, []);

    const handleGenerateMask = () => {
        if (!sourceImageData || !segmenter) return;
        
        setIsProcessing(true);
        setStatus('[ COMPRESSING NEURAL PAYLOAD... ]');

        setTimeout(() => {
            try {
                const AI_SIZE = 256;
                const origCanvas = document.createElement('canvas');
                origCanvas.width = sourceImageData.width;
                origCanvas.height = sourceImageData.height;
                origCanvas.getContext('2d').putImageData(sourceImageData, 0, 0);

                const tinyCanvas = document.createElement('canvas');
                tinyCanvas.width = AI_SIZE;
                tinyCanvas.height = AI_SIZE;
                const tinyCtx = tinyCanvas.getContext('2d', { willReadFrequently: true });
                tinyCtx.drawImage(origCanvas, 0, 0, AI_SIZE, AI_SIZE);
                
                const tinyImageData = tinyCtx.getImageData(0, 0, AI_SIZE, AI_SIZE);

                setStatus('[ RUNNING INFERENCE... ]');
                const segmentationResult = segmenter.segment(tinyImageData);
                const maskArray = segmentationResult.categoryMask.getAsUint8Array();
                
                setSettings(prev => ({ 
                    ...prev, 
                    semanticMask: maskArray, 
                    maskWidth: AI_SIZE,
                    maskHeight: AI_SIZE,
                    invertMask: false,
                    showMaskOverlay: true 
                }));
                
                setStatus('MASK GENERATED SUCCESSFULLY');
            } catch (error) {
                setStatus(`ERROR: ${error.message}`);
            } finally {
                setIsProcessing(false);
            }
        }, 50);
    };

    return (
        <div className="control-section">
            <div className="panel-header">AI SEMANTIC MASKING</div>
            
            <div className="status-label" style={{ marginBottom: 15, color: isProcessing ? '#ffb800' : '#888' }}>
                {status}
            </div>

            <div className="btn-grid-2" style={{ marginBottom: 10 }}>
                <button 
                    className={`btn-tech ${isProcessing || !segmenter ? '' : 'primary'}`} 
                    disabled={isProcessing || !sourceImageData || !segmenter}
                    onClick={handleGenerateMask}
                >
                    ISOLATE SUBJECT
                </button>

                {/* --- DYNAMIC OVERLAY BUTTON --- */}
                <button 
                    className={`btn-tech ${settings.showMaskOverlay ? 'active' : ''}`}
                    disabled={!settings.semanticMask}
                    onClick={() => setSettings(prev => ({ ...prev, showMaskOverlay: !prev.showMaskOverlay }))}
                >
                    {settings.showMaskOverlay ? 'HIDE OVERLAY' : 'SHOW OVERLAY'}
                </button>
            </div>

            <div className="btn-grid-2">
                <button 
                    className={`btn-tech ${settings.invertMask ? 'active' : ''}`}
                    disabled={!settings.semanticMask}
                    onClick={() => setSettings(prev => ({ ...prev, invertMask: !prev.invertMask, showMaskOverlay: true }))} 
                >
                    INVERT MASK
                </button>
                
                <button 
                    className="btn-tech"
                    disabled={!settings.semanticMask}
                    onClick={() => setSettings(prev => ({ ...prev, semanticMask: null, showMaskOverlay: false }))}
                >
                    CLEAR MASK
                </button>
            </div>

            <div className="sidebar-divider" style={{ margin: '20px 0' }} />
            <div className="panel-header">MASK REFINEMENT</div>
            
            <div className="control-group">
                <div className="control-header">
                    <label>FEATHER</label>
                    <span className="control-val">{settings.maskFeather ?? 25}px</span>
                </div>
                <input 
                    type="range" min="0" max="100" 
                    value={settings.maskFeather ?? 25} 
                    onChange={(e) => setSettings(p => ({ ...p, maskFeather: parseInt(e.target.value) }))}
                />
            </div>

            <div className="control-group">
                <div className="control-header">
                    <label>MASK OPACITY</label>
                    <span className="control-val">{settings.maskOpacity ?? 100}%</span>
                </div>
                <input 
                    type="range" min="0" max="100" 
                    value={settings.maskOpacity ?? 100} 
                    onChange={(e) => setSettings(p => ({ ...p, maskOpacity: parseInt(e.target.value) }))}
                />
            </div>

            <div className="manual-section" style={{ marginTop: 20 }}>
                <p style={{ fontSize: '10px', color: '#666', fontFamily: 'monospace' }}>
                    * ON-DEVICE INFERENCE: NEURAL PROCESSING OCCURS 100% LOCALLY VIA WEBASSEMBLY. 
                </p>
            </div>
        </div>
    );
};

export default MaskingEditor;