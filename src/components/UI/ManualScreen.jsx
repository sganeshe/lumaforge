import React, { useEffect, useState, useRef } from 'react';

export const ManualScreen = ({ onBack }) => {
    const [renderText, setRenderText] = useState("");
    const [activeSection, setActiveSection] = useState("01");
    const [searchTerm, setSearchTerm] = useState("");
    
    const fullText = "INITIALIZING DOCUMENTATION... DATA SECURED. AWAITING COMMAND...";
    
    const contentRef = useRef(null);

    useEffect(() => {
        let i = 0;
        const interval = setInterval(() => {
            setRenderText(fullText.slice(0, i));
            i++;
            if (i > fullText.length) clearInterval(interval);
        }, 30);
        return () => clearInterval(interval);
    }, []);

    const scrollToSection = (id) => {
        const element = document.getElementById(`section-${id}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setActiveSection(id);
        }
    };

    const indexData = [
        { id: "01", title: "GEOMETRY & OPTICS", keywords: "crop aspect rotate flip zoom geometry scale size bounding" },
        { id: "02", title: "PHOTOMETRICS", keywords: "exposure contrast highlights shadows whites blacks histogram luma brightness" },
        { id: "03", title: "COLORIMETRY", keywords: "temp tint white balance vibrance saturation hue chroma color kelvin" },
        { id: "04", title: "NON-LINEAR CURVES", keywords: "spline curves master rgb channels luma s-curve nodes tone" },
        { id: "05", title: "3-WAY GRADING", keywords: "shadows midtones highlights luminance blend split toning wheels spatial" },
        { id: "06", title: "FILM EMULATION", keywords: "halation grain sharpen clarity vignette fx bloom cinematic analog noise" },
        { id: "07", title: "HEURISTIC ENHANCE", keywords: "heuristic enhance magic wand clipping grey world auto ai vision" },
        { id: "08", title: "OPTICS COPILOT (AI)", terms: "ai copilot prompt text grade artificial intelligence chat bot language" },
        { id: "09", title: "STEGANOGRAPHY", keywords: "steganography metadata payload png invisible lut cube preset export json" },
        { id: "10", title: "THE UPLINK", keywords: "uplink community feed publish fork remix network download share cloud" }
    ];

    const filteredIndex = indexData.filter(item => 
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (item.keywords && item.keywords.includes(searchTerm.toLowerCase()))
    );

    const isVisible = (id) => filteredIndex.some(item => item.id === id);

    return (
        <div className="terminal-page amber-theme" >
            <div className="terminal-header">
                <button 
                    onClick={onBack} 
                    className="terminal-back-btn">
                    ← TERMINATE
                </button>
                <div className="terminal-title" style={{ color: 'var(--amber, #ffb800)', letterSpacing: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                    CREATOR_MANUAL_v1.4.0
                </div>
            </div>
            
            <div style={{ marginTop: '-2rem', padding: '15px 20px', borderBottom: '1px dotted rgba(255, 184, 0, 0.3)', background: 'rgba(255, 184, 0, 0.02)' }}>
                <p style={{ margin: 0, color: 'var(--amber, #ffb800)', fontSize: '11px', letterSpacing: '1px' }}>
                    &gt; {renderText}<span style={{ animation: 'blink 1s step-end infinite' }}>_</span>
                </p>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <div style={{ width: '280px', borderRight: '1px solid rgba(255, 184, 0, 0.1)', padding: '20px', overflowY: 'auto', background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
                    
                    <div style={{ marginBottom: '25px' }}>
                        <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px', letterSpacing: '2px' }}>QUERY_DATABASE:</div>
                        <input 
                            type="text" 
                            placeholder="> SEARCH (e.g. LUT, AI)..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%', background: '#000', border: '1px solid #333', 
                                color: 'var(--amber, #ffb800)', padding: '12px 10px', 
                                fontFamily: 'monospace', fontSize: '11px', outline: 'none',
                                letterSpacing: '1px', transition: 'border 0.2s'
                            }}
                            onFocus={(e) => e.target.style.border = '1px solid var(--amber, #ffb800)'}
                            onBlur={(e) => e.target.style.border = '1px solid #333'}
                        />
                    </div>

                    <div style={{ fontSize: '10px', color: '#666', marginBottom: '15px', letterSpacing: '2px' }}>
                        DATA_INDEX {searchTerm && `[ ${filteredIndex.length} MATCHES ]`}
                    </div>

                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {filteredIndex.length > 0 ? (
                            filteredIndex.map((item) => (
                                <li key={item.id}>
                                    <button 
                                        onClick={() => scrollToSection(item.id)}
                                        style={{
                                            background: 'none', border: 'none', padding: '5px 0', margin: 0,
                                            color: activeSection === item.id && !searchTerm ? 'var(--amber, #ffb800)' : '#888',
                                            fontSize: '11px', letterSpacing: '1px', cursor: 'pointer',
                                            textAlign: 'left', width: '100%', transition: 'color 0.2s'
                                        }}
                                        onMouseOver={(e) => e.target.style.color = 'var(--amber, #ffb800)'}
                                        onMouseOut={(e) => e.target.style.color = activeSection === item.id && !searchTerm ? 'var(--amber, #ffb800)' : '#888'}
                                    >
                                        [{item.id}] {item.title}
                                    </button>
                                </li>
                            ))
                        ) : (
                            <li style={{ color: '#555', fontSize: '11px', fontStyle: 'italic', marginTop: '10px' }}>
                                NO MATCHING KEYWORD FOUND.
                            </li>
                        )}
                    </ul>
                </div>

                {/* RIGHT CONTENT: SCROLLABLE MANUAL */}
                <div ref={contentRef} className="terminal-content" style={{ flex: 1, padding: '30px 40px 40px 40px', overflowY: 'auto', scrollBehavior: 'smooth' }}>
                    
                    {isVisible("01") && (
                        <div id="section-01" className="manual-section" style={{ marginBottom: '50px' }}>
                            <h3 style={{ color: 'var(--amber, #ffb800)', borderBottom: '1px solid rgba(255, 184, 0, 0.2)', paddingBottom: '10px', letterSpacing: '2px' }}>[ 01 ] GEOMETRY & OPTICS</h3>
                            <p style={{ lineHeight: '1.6', color: '#aaa', fontSize: '13px' }}>The geometry engine manipulates the physical bounding box and scale of the source negative prior to pixel processing.</p>
                            <ul style={{ lineHeight: '1.8', fontSize: '13px', color: '#ccc' }}>
                                <li><b style={{ color: '#fff' }}>CROP & ASPECT:</b> Restricts the rendering area. Bounding boxes are mathematically constrained to standard cinematic ratios (16:9, 2:3, 4:5) or unlocked for freeform extraction.</li>
                                <li><b style={{ color: '#fff' }}>ROTATE & FLIP:</b> Applies a 2D transformation matrix to alter the focal orientation of the pixels.</li>
                                <li><b style={{ color: '#fff' }}>ZOOM:</b> Scales the image linearly up to 200%. Note: Digital zooming beyond 100% requires the engine to interpolate missing pixel data via nearest-neighbor algorithms.</li>
                            </ul>
                        </div>
                    )}

                    {isVisible("02") && (
                        <div id="section-02" className="manual-section" style={{ marginBottom: '50px' }}>
                            <h3 style={{ color: 'var(--amber, #ffb800)', borderBottom: '1px solid rgba(255, 184, 0, 0.2)', paddingBottom: '10px', letterSpacing: '2px' }}>[ 02 ] PHOTOMETRIC EXPOSURE</h3>
                            <pre style={{ fontSize: '10px', color: 'var(--amber, #ffb800)', background: 'rgba(0,0,0,0.4)', padding: '15px', borderLeft: '2px solid var(--amber, #ffb800)', lineHeight: 1.2, margin: '15px 0' }}>{`
   HISTOGRAM DISTRIBUTION (LUMA)
    |          .::.
    |         .::::.
    |       ..:::::::..        .::.
    |   ..:::::::::::::....:::::::..
    +---------------------------------
      BLK    SHD    MID    HLT    WHT
                            `}</pre>
                            <p style={{ lineHeight: '1.6', color: '#aaa', fontSize: '13px' }}>These parameters control the baseline luminance mapping of the image data before any color matrices are applied.</p>
                            <ul style={{ lineHeight: '1.8', fontSize: '13px', color: '#ccc' }}>
                                <li><b style={{ color: '#fff' }}>EXPOSURE:</b> Applies a global scalar multiplier to all pixel values, shifting the entire histogram.</li>
                                <li><b style={{ color: '#fff' }}>CONTRAST:</b> Anchors the midtones and symmetrically pushes shadows darker and highlights brighter.</li>
                                <li><b style={{ color: '#fff' }}>HIGHLIGHTS & SHADOWS:</b> Targets specific quartile regions of the histogram. Lowering highlights compresses blown-out data; raising shadows logarithmically lifts hidden details.</li>
                            </ul>
                        </div>
                    )}

                    {isVisible("03") && (
                        <div id="section-03" className="manual-section" style={{ marginBottom: '50px' }}>
                            <h3 style={{ color: 'var(--amber, #ffb800)', borderBottom: '1px solid rgba(255, 184, 0, 0.2)', paddingBottom: '10px', letterSpacing: '2px' }}>[ 03 ] COLORIMETRY (CHROMA)</h3>
                            <p style={{ lineHeight: '1.6', color: '#aaa', fontSize: '13px' }}>Adjusts the foundational chrominance vectors of the image data operating in the sRGB color space.</p>
                            <ul style={{ lineHeight: '1.8', fontSize: '13px', color: '#ccc' }}>
                                <li><b style={{ color: '#fff' }}>TEMP & TINT:</b> Temp shifts the global color axis between Kelvin extremes (Blue ↔ Amber). Tint shifts the orthogonal axis (Green ↔ Magenta).</li>
                                <li><b style={{ color: '#fff' }}>VIBRANCE:</b> A non-linear saturation algorithm. It intelligently increases the intensity of muted colors while protecting skin tones.</li>
                                <li><b style={{ color: '#fff' }}>HUE:</b> Rotates the entire color spectrum around the 360° color wheel matrix.</li>
                            </ul>
                        </div>
                    )}

                    {isVisible("04") && (
                        <div id="section-04" className="manual-section" style={{ marginBottom: '50px' }}>
                            <h3 style={{ color: 'var(--amber, #ffb800)', borderBottom: '1px solid rgba(255, 184, 0, 0.2)', paddingBottom: '10px', letterSpacing: '2px' }}>[ 04 ] NON-LINEAR CURVES</h3>
                            <pre style={{ fontSize: '10px', color: 'var(--amber, #ffb800)', background: 'rgba(0,0,0,0.4)', padding: '15px', borderLeft: '2px solid var(--amber, #ffb800)', lineHeight: 1.2, margin: '15px 0' }}>{`
   SPLINE INTERPOLATION (S-CURVE)
 Y |                . *
   |             . *
   |           .* |           . 
   |       * .
   |    * .
   |  * .
   +------------------------- X
     0                    255
                            `}</pre>
                            <p style={{ lineHeight: '1.6', color: '#aaa', fontSize: '13px' }}>The curve engine utilizes cubic spline interpolation. Modifying a node recalculates a seamless 256-point array on the fly.</p>
                            <ul style={{ lineHeight: '1.8', fontSize: '13px', color: '#ccc' }}>
                                <li><b style={{ color: '#fff' }}>MASTER (LUMA):</b> The white curve. Modifies global brightness dynamics without altering underlying hue logic.</li>
                                <li><b style={{ color: '#fff' }}>RGB CHANNELS:</b> Modifies specific color densities. Pulling the Blue curve down in the highlights mathematically injects Yellow (its inverse) into the brightest areas.</li>
                            </ul>
                        </div>
                    )}

                    {isVisible("05") && (
                        <div id="section-05" className="manual-section" style={{ marginBottom: '50px' }}>
                            <h3 style={{ color: 'var(--amber, #ffb800)', borderBottom: '1px solid rgba(255, 184, 0, 0.2)', paddingBottom: '10px', letterSpacing: '2px' }}>[ 05 ] 3-WAY COLOR GRADING</h3>
                            <p style={{ lineHeight: '1.6', color: '#aaa', fontSize: '13px' }}>Advanced spatial split-toning. The engine evaluates the luminance of every pixel and masks the image into three overlapping zones.</p>
                            <ul style={{ lineHeight: '1.8', fontSize: '13px', color: '#ccc' }}>
                                <li><b style={{ color: '#fff' }}>SHADOWS (0-33%):</b> Injects targeted hex values into the darkest pixels.</li>
                                <li><b style={{ color: '#fff' }}>MIDTONES (33-66%):</b> Shifts the core exposure zone. Highly impacts skin tones.</li>
                                <li><b style={{ color: '#fff' }}>HIGHLIGHTS (66-100%):</b> Tints the brightest light sources.</li>
                            </ul>
                        </div>
                    )}

                    {isVisible("06") && (
                        <div id="section-06" className="manual-section" style={{ marginBottom: '50px' }}>
                            <h3 style={{ color: 'var(--amber, #ffb800)', borderBottom: '1px solid rgba(255, 184, 0, 0.2)', paddingBottom: '10px', letterSpacing: '2px' }}>[ 06 ] FX & FILM EMULATION</h3>
                            <p style={{ lineHeight: '1.6', color: '#aaa', fontSize: '13px' }}>Simulates physical optical imperfections, lens distortion, and analog silver-halide chemistry.</p>
                            <ul style={{ lineHeight: '1.8', fontSize: '13px', color: '#ccc' }}>
                                <li><b style={{ color: '#fff' }}>HALATION:</b> Emulates the scattering of light past the anti-halation backing of 35mm film stock, creating a red/orange cinematic bloom.</li>
                                <li><b style={{ color: '#fff' }}>GRAIN:</b> Generates a luma-masked procedural hash noise mapped dynamically to midtones and shadows.</li>
                                <li><b style={{ color: '#fff' }}>SHARPEN & CLARITY:</b> Convolution matrices that enhance high-frequency edge contrast and low-frequency midtone micro-contrast.</li>
                            </ul>
                        </div>
                    )}

                    {isVisible("07") && (
                        <div id="section-07" className="manual-section" style={{ marginBottom: '50px' }}>
                            <h3 style={{ color: 'var(--amber, #ffb800)', borderBottom: '1px solid rgba(255, 184, 0, 0.2)', paddingBottom: '10px', letterSpacing: '2px' }}>[ 07 ] HEURISTIC ENHANCE (MAGIC WAND)</h3>
                            <p style={{ lineHeight: '1.6', color: '#aaa', fontSize: '13px' }}>An automated computer vision tool that analyzes the source image's statistical distribution to neutralize optical imbalances before grading.</p>
                            <ul style={{ lineHeight: '1.8', fontSize: '13px', color: '#ccc' }}>
                                <li><b style={{ color: '#fff' }}>PERCENTILE CLIPPING:</b> The engine processes a down-sampled buffer, ignoring the darkest and brightest 2% of anomalous pixels to calculate true contrast.</li>
                                <li><b style={{ color: '#fff' }}>THE GREY WORLD ALGORITHM:</b> Evaluates overall RGB density and mathematically calculates the exact inverse Temp/Tint values required to pull the image back to neutral gray.</li>
                            </ul>
                        </div>
                    )}

                    {isVisible("08") && (
                        <div id="section-08" className="manual-section" style={{ marginBottom: '50px' }}>
                            <h3 style={{ color: 'var(--amber, #ffb800)', borderBottom: '1px solid rgba(255, 184, 0, 0.2)', paddingBottom: '10px', letterSpacing: '2px' }}>[ 08 ] OPTICS COPILOT (AI ASSISTANT)</h3>
                            <p style={{ lineHeight: '1.6', color: '#aaa', fontSize: '13px' }}>Lumaforge integrates a proprietary AI-driven color grading copilot designed to translate natural language into mathematical image transformations.</p>
                            <ul style={{ lineHeight: '1.8', fontSize: '13px', color: '#ccc' }}>
                                <li><b style={{ color: '#fff' }}>PROMPT-TO-GRADE:</b> Input cinematic references (e.g., "Make this look like a cyberpunk neon city"). The Copilot analyzes the request and automatically adjusts the exact slider configurations, 3-way color wheels, and curves.</li>
                                <li><b style={{ color: '#fff' }}>CONTEXTUAL AWARENESS:</b> The AI understands the interplay between different tools. If you ask for a "filmic look," it knows to simultaneously lift the shadow curves, introduce luma-masked grain, and apply slight halation blooming.</li>
                            </ul>
                        </div>
                    )}

                    {isVisible("09") && (
                        <div id="section-09" className="manual-section" style={{ marginBottom: '50px' }}>
                            <h3 style={{ color: 'var(--amber, #ffb800)', borderBottom: '1px solid rgba(255, 184, 0, 0.2)', paddingBottom: '10px', letterSpacing: '2px' }}>[ 09 ] STEGANOGRAPHY & METADATA</h3>
                            <pre style={{ fontSize: '10px', color: 'var(--amber, #ffb800)', background: 'rgba(0,0,0,0.4)', padding: '15px', borderLeft: '2px solid var(--amber, #ffb800)', lineHeight: 1.2, margin: '15px 0' }}>{`
   [ PNG HEADER ] -> [ tEXt: luma_payload ] -> [ IDAT ] -> [ IEND ]
   {
     "v": "1.4.0",
     "grade": { "exp": 0.5, "con": 1.2, "lut": "Fuji_400H.cube" },
     "curves": { "master": [[0,0], [128,140], [255,255]] }
   }
                            `}</pre>
                            <p style={{ lineHeight: '1.6', color: '#aaa', fontSize: '13px' }}>LUMAFORGE completely rethinks preset management by utilizing a lossless steganographic pipeline. Your image <i>is</i> your preset.</p>
                            <ul style={{ lineHeight: '1.8', fontSize: '13px', color: '#ccc' }}>
                                <li><b style={{ color: '#fff' }}>THE INVISIBLE PAYLOAD:</b> When exporting a PNG, the exact JSON state of the rendering engine is serialized and injected into a custom <code>tEXt</code> chunk within the PNG binary header.</li>
                                <li><b style={{ color: '#fff' }}>DECRYPTION:</b> Dragging a LUMAFORGE-generated PNG back into the app will intercept the file read, parse the chunk, and instantly snap the UI back to the exact parameters used.</li>
                            </ul>
                        </div>
                    )}

                    {isVisible("10") && (
                        <div id="section-10" className="manual-section" style={{ marginBottom: '50px' }}>
                            <h3 style={{ color: 'var(--amber, #ffb800)', borderBottom: '1px solid rgba(255, 184, 0, 0.2)', paddingBottom: '10px', letterSpacing: '2px' }}>[ 10 ] THE UPLINK (COMMUNITY FEED)</h3>
                            <p style={{ lineHeight: '1.6', color: '#aaa', fontSize: '13px' }}>A decentralized, cloud-powered network for sharing and remixing steganographic project files.</p>
                            <ul style={{ lineHeight: '1.8', fontSize: '13px', color: '#ccc' }}>
                                <li><b style={{ color: '#fff' }}>PUBLISHING:</b> Push your high-resolution PNG and its embedded mathematical JSON payload directly to the global public feed.</li>
                                <li><b style={{ color: '#fff' }}>FORK & REMIX:</b> Intercept the transmission of any community post. The engine extracts the author's exact parameter states and immediately applies them onto your own selected source negative.</li>
                            </ul>
                        </div>
                    )}

                    {/* COMMAND PROMPT FOOTER */}
                    {filteredIndex.length > 0 && (
                        <div style={{ marginTop: '40px', padding: '20px', background: 'rgba(255, 184, 0, 0.05)', border: '1px solid var(--amber, #ffb800)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ color: 'var(--amber, #ffb800)', fontSize: '12px', letterSpacing: '2px', fontWeight: 'bold' }}>
                                &gt; END OF DOCUMENTATION.
                            </div>
                        </div>
                    )}

                </div>
            </div>

            <style>{`
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
                .terminal-content::-webkit-scrollbar { width: 8px; }
                .terminal-content::-webkit-scrollbar-track { background: #0a0a0a; }
                .terminal-content::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
                .terminal-content::-webkit-scrollbar-thumb:hover { background: var(--amber, #ffb800); }
            `}</style>
        </div>
    );
};