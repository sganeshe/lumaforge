import React, { useEffect, useState } from 'react';

export const ManualScreen = ({ onBack }) => {
    const [renderText, setRenderText] = useState("");
    const fullText = "INITIALIZING OPTICS DOCUMENTATION... DATA STREAM SECURED. WAITING FOR COMMAND...";

    useEffect(() => {
        let i = 0;
        const interval = setInterval(() => {
            setRenderText(fullText.slice(0, i));
            i++;
            if (i > fullText.length) clearInterval(interval);
        }, 30);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="terminal-page amber-theme">
            <div className="terminal-header">
                <button onClick={onBack} className="terminal-back-btn">← TERMINATE MANUAL</button>
                <div className="terminal-title">LUMAFORGE_OPTICS_MANUAL_v1.2.0</div>
            </div>
            
            <div className="terminal-content" style={{ paddingBottom: '100px' }}>
                <p className="typewriter-text">{renderText}</p>
                
                {/* 01: GEOMETRY */}
                <div className="manual-section">
                    <h3>[ 01 ] GEOMETRY & OPTICS</h3>
                    <p>
                        The geometry engine manipulates the physical bounding box and scale of the source negative prior to pixel processing.
                    </p>
                    <ul>
                        <li><b>CROP & ASPECT:</b> Restricts the rendering area. Bounding boxes are mathematically constrained to standard cinematic ratios (16:9, 2:3, 4:5) or unlocked for freeform extraction.</li>
                        <li><b>ROTATE & FLIP:</b> Applies a 2D transformation matrix to alter the focal orientation of the pixels.</li>
                        <li><b>ZOOM:</b> Scales the image linearly up to 200%. Note: Digital zooming beyond 100% requires the engine to interpolate missing pixel data via nearest-neighbor or bicubic algorithms, slightly degrading absolute sharpness.</li>
                    </ul>
                </div>

                {/* 02: EXPOSURE */}
                <div className="manual-section">
                    <h3>[ 02 ] PHOTOMETRIC EXPOSURE</h3>
                    
                    <pre style={{ fontSize: '10px', opacity: 0.6, lineHeight: 1.2, margin: '15px 0' }}>{`
   HISTOGRAM DISTRIBUTION (LUMA)
    |          .::.
    |         .::::.
    |       ..:::::::..        .::.
    |   ..:::::::::::::....:::::::..
    +---------------------------------
      BLK    SHD    MID    HLT    WHT
                    `}</pre>
                    <p>
                        These parameters control the baseline luminance mapping of the image data before any color matrices are applied.
                    </p>
                    <ul>
                        <li><b>EXPOSURE:</b> Applies a global scalar multiplier to all pixel values, shifting the entire histogram left (darker) or right (brighter).</li>
                        <li><b>CONTRAST:</b> Anchors the midtones and symmetrically pushes shadows darker and highlights brighter, expanding the dynamic range curve.</li>
                        <li><b>HIGHLIGHTS & SHADOWS:</b> Targets specific quartile regions of the histogram. Lowering highlights compresses blown-out data; raising shadows logarithmically lifts hidden details.</li>
                        <li><b>WHITES & BLACKS:</b> Sets the absolute clipping thresholds. Defines the absolute bounds for pure #FFFFFF and pure #000000.</li>
                    </ul>
                </div>

                {/* 03: COLORIMETRY */}
                <div className="manual-section">
                    <h3>[ 03 ] COLORIMETRY (CHROMA)</h3>
                    <p>
                        Adjusts the foundational chrominance vectors of the image data operating in the sRGB color space.
                    </p>
                    <ul>
                        <li><b>TEMP & TINT (White Balance):</b> Temp shifts the global color axis between Kelvin extremes (Blue ↔ Amber). Tint shifts the orthogonal axis (Green ↔ Magenta).</li>
                        <li><b>VIBRANCE:</b> A non-linear saturation algorithm. It intelligently increases the intensity of muted colors while protecting skin tones and preventing already-saturated pixels from clipping out of gamut.</li>
                        <li><b>SATURATION:</b> A linear vector multiplier. Forces all RGB color values uniformly toward or away from neutral gray.</li>
                        <li><b>HUE:</b> Rotates the entire color spectrum around the 360° color wheel matrix.</li>
                    </ul>
                </div>

                {/* 04: CURVES */}
                <div className="manual-section">
                    <h3>[ 04 ] NON-LINEAR CURVES</h3>
                    
                    <pre style={{ fontSize: '10px', opacity: 0.6, lineHeight: 1.2, margin: '15px 0' }}>{`
   SPLINE INTERPOLATION (S-CURVE)
  Y |                . *
    |             . *
    |           .* |          . 
    |       * .
    |    * .
    |  * .
    +------------------------- X
      0                    255
                    `}</pre>
                    <p>
                        The curve engine utilizes cubic spline interpolation. Modifying a node recalculates a seamless 256-point array on the fly, allowing for hyper-specific tonal adjustments.
                    </p>
                    <ul>
                        <li><b>MASTER (LUMA):</b> The white curve. Modifies global brightness dynamics without altering underlying hue logic.</li>
                        <li><b>RGB CHANNELS:</b> Modifies specific color densities. Pulling the Blue curve down in the highlights mathematically injects Yellow (its inverse) into the brightest areas.</li>
                        <li><i>Note: Double-click any node to sever its connection to the mathematical spline.</i></li>
                    </ul>
                </div>

                {/* 05: 3-WAY GRADING */}
                <div className="manual-section">
                    <h3>[ 05 ] 3-WAY COLOR GRADING</h3>
                    <p>
                        Advanced spatial split-toning. The engine evaluates the luminance of every pixel and masks the image into three overlapping zones.
                    </p>
                    <ul>
                        <li><b>SHADOWS (0-33%):</b> Injects targeted hex values into the darkest pixels. Excellent for adding cool cinematic blues to the black levels.</li>
                        <li><b>MIDTONES (33-66%):</b> Shifts the core exposure zone. Highly impacts skin tones and overall environmental lighting.</li>
                        <li><b>HIGHLIGHTS (66-100%):</b> Tints the brightest light sources.</li>
                        <li><b>LUMINANCE & BLEND:</b> Controls the opacity and light-falloff of the color injection. A blend of 100% replaces the pixel; lower values dynamically mix it with the original RGB data.</li>
                    </ul>
                </div>

                {/* 06: FX & EMULATION */}
                <div className="manual-section">
                    <h3>[ 06 ] FX & FILM EMULATION</h3>
                    <p>
                        Simulates physical optical imperfections, lens distortion, and analog silver-halide chemistry.
                    </p>
                    <ul>
                        <li><b>HALATION:</b> Emulates the scattering of light past the anti-halation backing of 35mm film stock. It isolates luminance values above the user-defined threshold, applies a multi-pass gaussian blur, and screens it back to create a red/orange cinematic bloom around bright light sources.</li>
                        <li><b>GRAIN:</b> Generates a luma-masked procedural hash noise. Because actual film grain is less visible in pure white highlights, the algorithm dynamically maps noise density to the midtones and shadows to maintain realistic chemical physics.</li>
                        <li><b>SHARPEN & CLARITY:</b> Sharpen applies a localized 3x3 convolution matrix to enhance high-frequency edge contrast. Clarity specifically targets low-frequency midtone micro-contrast to add structural "punch."</li>
                        <li><b>VIGNETTE:</b> Applies a radial exposure gradient originating from the canvas center to mimic light falloff on spherical lens barrels.</li>
                    </ul>
                </div>

                {/* 07: HEURISTIC AUTO-ENHANCE */}
                <div className="manual-section">
                    <h3>[ 07 ] HEURISTIC AUTO-ENHANCE (MAGIC WAND)</h3>
                    
                    <p>
                        An automated computer vision tool that analyzes the source image's statistical distribution to neutralize optical imbalances before grading.
                    </p>
                    <ul>
                        <li><b>PERCENTILE CLIPPING:</b> The engine processes a down-sampled buffer, explicitly ignoring the darkest and brightest 2% of anomalous pixels to calculate the image's true mathematical contrast range.</li>
                        <li><b>THE GREY WORLD ALGORITHM:</b> Evaluates overall RGB density. If the mean vector leans heavily toward a specific spectrum (e.g., tungsten lighting), the engine mathematically calculates the exact inverse Temp/Tint values required to pull the image back to neutral gray.</li>
                        <li><b>VOLUME RECOVERY:</b> Analyzes the percentage of pixels trapped in absolute shadows or clipped highlights, logarithmically adjusting recovery sliders to rescue texture data.</li>
                        <li><b>INTENTIONAL DEADZONES:</b> The algorithm contains built-in mathematical tolerances. If lighting casts (like golden hour sunsets) fall within standard "mood" deviations, the engine intentionally leaves them untouched to preserve the photographer's intent.</li>
                    </ul>
                </div>

                {/* 08: METADATA & STEGANOGRAPHY */}
                <div className="manual-section">
                    <h3>[ 08 ] STEGANOGRAPHY & METADATA PAYLOADS</h3>
                    
                    <pre style={{ fontSize: '10px', opacity: 0.6, lineHeight: 1.2, margin: '15px 0' }}>{`
   [ PNG HEADER ] -> [ IHDR ] -> [ tEXt: luma_payload ] -> [ IDAT ] -> [ IEND ]
   {
     "v": "2.0.0",
     "grade": { "exp": 0.5, "con": 1.2, "lut": "Fuji_400H.cube" },
     "curves": { "master": [[0,0], [128,140], [255,255]] }
   }
                    `}</pre>
                    <p>
                        LUMAFORGE completely rethinks preset management by utilizing a lossless steganographic pipeline. Your image <i>is</i> your preset.
                    </p>
                    <ul>
                        <li><b>THE INVISIBLE PAYLOAD:</b> When exporting a PNG, the exact JSON state of the entire React rendering engine (all slider floats, curve arrays, and active LUT profiles) is serialized, compressed, and injected into a custom <code>tEXt</code> chunk within the PNG binary header.</li>
                        <li><b>DECRYPTION & RECONSTRUCTION:</b> The metadata is completely invisible to standard image viewers. However, dragging a LUMAFORGE-generated PNG back into the app will intercept the file read, parse the <code>tEXt</code> chunk, and instantly snap the UI and engine back to the exact parameters used to create the image.</li>
                        <li><b>3D LUT (.CUBE) I/O:</b> The engine natively parses industry-standard .CUBE files for deterministic 3D color mapping. You can import external film emulation LUTs, or use "EXPORT .CUBE" to bake your mathematical grade into a 33x33x33 matrix, deployable directly into Premiere Pro, DaVinci Resolve, or game engines.</li>
                    </ul>
                </div>

                {/* 09: THE UPLINK */}
                <div className="manual-section">
                    <h3>[ 09 ] THE UPLINK (COMMUNITY MAINFRAME)</h3>
                    
                    <p>
                        A decentralized, cloud-powered network for sharing and remixing steganographic project files. 
                    </p>
                    <ul>
                        <li><b>PUBLISHING:</b> Bypasses local storage arrays to push your high-resolution PNG and its embedded mathematical JSON payload directly to the global public feed.</li>
                        <li><b>FORK & REMIX:</b> Click "FORK & REMIX" on any community post to intercept the transmission. The engine extracts the author's exact parameter states (LUTs, curves, spatial offsets) and immediately applies them onto your own selected source negative.</li>
                        <li><b>DATA STREAM FILTERING:</b> Dynamically queries the database, sorting network payloads by <code>LATEST</code> timestamps, <code>POPULAR</code> consensus metrics, or <code>OLDEST</code> archive records.</li>
                    </ul>
                </div>

                {/* 10: EXECUTION PIPELINE */}
                <div className="manual-section">
                    <h3>[ 10 ] CANVAS EXECUTION PIPELINE</h3>
                    <p>
                        For technical predictability, the engine processes layer mathematics in a strict, non-destructive sequential pipeline:
                    </p>
                    <pre style={{ fontSize: '11px', opacity: 0.8, background: 'rgba(0,0,0,0.2)', padding: '10px', borderLeft: '2px solid var(--amber)' }}>
                        1. Geometry & Spatial Transform (Crop/Rotate)<br/>
                        2. Pre-LUT Photometrics (Exposure, Contrast, Temp/Tint)<br/>
                        3. Non-Linear Spline Curves<br/>
                        4. .CUBE 3D LUT Application (Matrix Mapping)<br/>
                        5. 3-Way Spatial Split Toning<br/>
                        6. Post-LUT FX (Halation Bloom, Clarity)<br/>
                        7. Luma-Masked Hash Grain Overlay<br/>
                        8. Vignette & Final Border Framing
                    </pre>
                </div>

            </div>
        </div>
    );
};