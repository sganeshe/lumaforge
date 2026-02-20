import React, { useEffect, useState } from 'react';

export const ManualScreen = ({ onBack }) => {
    const [renderText, setRenderText] = useState("");
    const fullText = "INITIALIZING OPTICS DOCUMENTATION... DATA STREAM SECURED.";

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
                <div className="terminal-title">OPTICS_MANUAL_v1.0.0</div>
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
                        <li><b>CROP & ASPECT:</b> Restricts the rendering area. Bounding boxes are mathematically constrained to standard cinematic ratios (16:9, 2:3, etc.) or unlocked for freeform extraction.</li>
                        <li><b>ROTATE & FLIP:</b> Applies a 2D transformation matrix to alter the focal orientation of the pixels.</li>
                        <li><b>ZOOM:</b> Scales the image linearly up to 200%. Note: Digital zooming beyond 100% requires the engine to interpolate missing pixel data, slightly degrading absolute sharpness.</li>
                    </ul>
                </div>

                {/* 02: EXPOSURE */}
                <div className="manual-section">
                    <h3>[ 02 ] PHOTOMETRIC EXPOSURE</h3>
                    <pre style={{ fontSize: '10px', opacity: 0.6, lineHeight: 1.2, margin: '15px 0' }}>{`
   HISTOGRAM DISTRIBUTION (LUMA)
    |          .::.
    |         .::::.
    |      ..:::::::..        .::.
    |   ..:::::::::::::....:::::::..
    +---------------------------------
      BLK    SHD    MID    HLT    WHT
                    `}</pre>
                    <p>
                        These parameters control the baseline luminance mapping of the image.
                    </p>
                    <ul>
                        <li><b>EXPOSURE:</b> Applies a global multiplier to all pixel values, shifting the entire histogram left (darker) or right (brighter).</li>
                        <li><b>CONTRAST:</b> Anchors the midtones and symmetrically pushes shadows darker and highlights brighter, expanding dynamic range.</li>
                        <li><b>HIGHLIGHTS & SHADOWS:</b> Targets specific regions of the histogram. Lowering highlights recovers blown-out skies; raising shadows reveals details hidden in dark areas.</li>
                        <li><b>WHITES & BLACKS:</b> Sets the absolute clipping points. Defines what values represent pure #FFFFFF (White) and pure #000000 (Black).</li>
                    </ul>
                </div>

                {/* 03: COLORIMETRY */}
                <div className="manual-section">
                    <h3>[ 03 ] COLORIMETRY (COLOR)</h3>
                    <p>
                        Adjusts the foundational chrominance vectors of the image data.
                    </p>
                    <ul>
                        <li><b>TEMP & TINT (White Balance):</b> Temp shifts the global color axis between Kelvin extremes (Blue ↔ Amber). Tint shifts the orthogonal axis (Green ↔ Magenta).</li>
                        <li><b>VIBRANCE:</b> A non-linear saturation algorithm. It intelligently increases the intensity of muted colors while preventing skin tones and already-saturated pixels from clipping.</li>
                        <li><b>SATURATION:</b> A linear multiplier. Forces all RGB color values toward or away from neutral gray uniformly.</li>
                        <li><b>HUE:</b> Rotates the entire color spectrum around the color wheel by degrees (0° to 360°).</li>
                    </ul>
                </div>

                {/* 04: CURVES */}
                <div className="manual-section">
                    <h3>[ 04 ] NON-LINEAR CURVES</h3>
                    <pre style={{ fontSize: '10px', opacity: 0.6, lineHeight: 1.2, margin: '15px 0' }}>{`
   SPLINE INTERPOLATION (S-CURVE)
  Y |                 . *
    |              . *
    |            .* |          . 
    |       * .
    |    * .
    |  * .
    +------------------------- X
      0                     255
                    `}</pre>
                    <p>
                        The curve engine utilizes cubic spline interpolation. Dragging a node calculates a seamless 256-point Look-Up Table on the fly.
                    </p>
                    <ul>
                        <li><b>MASTER (LUMA):</b> The white curve. Modifies global brightness without altering hue logic.</li>
                        <li><b>RGB CHANNELS:</b> Modifies specific color densities. For example, pulling the Blue curve down in the highlights injects Yellow (its inverse) into the brightest areas.</li>
                        <li><i>Note: Double-click any node to sever its connection to the spline.</i></li>
                    </ul>
                </div>

                {/* 05: 3-WAY GRADING */}
                <div className="manual-section">
                    <h3>[ 05 ] 3-WAY COLOR GRADING</h3>
                    <p>
                        Advanced split-toning. The engine mathematically masks the image into three zones: Shadows (darkest 33%), Midtones, and Highlights (brightest 33%). 
                    </p>
                    <ul>
                        <li><b>HUE/SAT PICKER:</b> Select a target color to inject into the specific zone.</li>
                        <li><b>LUMINANCE:</b> Darkens or brightens that specific tonal zone after the color is injected.</li>
                        <li><b>BLEND:</b> Controls the opacity and falloff of the color injection. A blend of 100% applies the full hex color; lower values subtly mix it with the original pixels.</li>
                    </ul>
                </div>

                {/* 06: FX & EMULATION */}
                <div className="manual-section">
                    <h3>[ 06 ] FX & FILM EMULATION</h3>
                    <p>
                        Simulates physical lens imperfections and analog film chemistry.
                    </p>
                    <ul>
                        <li><b>HALATION:</b> Emulates the scattering of light past the anti-halation backing of 35mm film. It isolates luminance values above the <b>THRESHOLD</b>, applies a gaussian blur, and screens it back to create a cinematic bloom/glow around bright lights.</li>
                        <li><b>GRAIN:</b> Generates a luma-masked procedural hash noise. Because actual film grain is less visible in pure white highlights, the algorithm dynamically reduces noise density in the brightest pixels to maintain realistic silver-halide physics.</li>
                        <li><b>SHARPEN & CLARITY:</b> Sharpen applies a localized convolution matrix to enhance edge contrast. Clarity specifically targets midtone micro-contrast to add "punch."</li>
                        <li><b>VIGNETTE:</b> Applies a radial exposure gradient to darken or lighten the extreme edges of the lens barrel, drawing focus to the center.</li>
                    </ul>
                </div>

                {/* 07: DATA */}
                <div className="manual-section">
                    <h3>[ 07 ] LUT ARCHITECTURE & METADATA</h3>
                    <p>
                        LUMAFORGE utilizes a lossless steganographic pipeline for data retention.
                    </p>
                    <ul>
                        <li><b>THE BLACK BOX:</b> When exporting a PNG, the exact mathematical state of the engine (all slider values, curve arrays, and geometry) is serialized and injected invisibly into the file's metadata headers. Re-uploading a LUMAFORGE-generated PNG will extract this data and instantly reconstruct your workspace.</li>
                        <li><b>3D LUT (.CUBE):</b> The engine supports industry-standard .CUBE files for deterministic color mapping. You can import external film emulation LUTs, or use "EXPORT .CUBE" to bake your current grade into a 33x33x33 matrix, which can then be deployed natively in Premiere Pro, DaVinci Resolve, or OBS Studio.</li>
                    </ul>
                </div>

            </div>
        </div>
    );
};