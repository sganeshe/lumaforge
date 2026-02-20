/**
 * @file CurvesMath.js
 * @description Mathematical engine for generating 1D Look-Up Tables (LUTs) from user-defined UI control points.
 * These tables are used by the CorePipeline to execute O(1) time-complexity pixel mapping for the RGB curves.
 */

/**
 * Converts a sparse array of control points into a dense 256-element LUT array (normalized 0.0 to 1.0).
 * Utilizes Cosine Interpolation to generate a smooth, mathematically continuous curve that prevents 
 * tonal banding or harsh clipping between the control nodes. 
 * * @param {Array<{x: number, y: number}>} points - Array of control points, where x is input Luma (0-255) and y is output Luma (0-255).
 * @returns {Array<number>} A 256-length array containing the pre-calculated, normalized floating-point multipliers (0.0 - 1.0).
 */
export const generateCurveLUT = (points) => {
    // 1. DATA SANITIZATION & SORTING
    // Guard clause: Ensure points array exists, fallback to a neutral linear mapping
    const safePoints = points || [{x: 0, y: 0}, {x: 255, y: 255}];
    
    // Sort control points ascending by X-axis (Input Luminance) to ensure continuous geometric progression
    const p = [...safePoints].sort((a, b) => a.x - b.x);
    
    // Failsafe: If array was somehow emptied, force a neutral linear mapping
    if (p.length === 0) {
        p.push({ x: 0, y: 0 }, { x: 255, y: 255 });
    }
    
    // 2. ENDPOINT CLAMPING
    // The LUT strictly requires boundaries at x=0 and x=255. 
    // If the user hasn't defined them, we anchor the curve to prevent out-of-bounds array access in the pixel loop.
    if (p[0].x > 0) p.unshift({ x: 0, y: 0 });
    if (p[p.length - 1].x < 255) p.push({ x: 255, y: 255 });

    // Isolate axes for faster array reads during the interpolation loop
    const x = p.map(pt => pt.x);
    const y = p.map(pt => pt.y);
    const n = x.length;
    
    // 3. SLOPE DELTAS (Prepared for potential future Monotone Cubic Spline upgrades)
    const m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) {
        const dx = x[i + 1] - x[i];
        const dy = y[i + 1] - y[i];
        if (dx === 0) m[i] = 0; // Prevent divide-by-zero Infinity crashes
        else m[i] = dy / dx;
    }
    if (n > 1) m[n - 1] = m[n - 2];

    // 4. LUT GENERATION (0 to 255)
    // Pre-calculating all 256 possible byte values saves the CorePipeline from doing this math millions of times per frame.
    const lut = [];
    let k = 0; // Current bounding segment index

    for (let i = 0; i < 256; i++) {
        // Shift to the next geometric segment if our current integer 'i' exceeds the upper X bound of the current segment
        while (k < n - 2 && i > x[k + 1]) k++;
        
        const x0 = x[k], x1 = x[k + 1];
        const y0 = y[k], y1 = y[k + 1];
        
        // Failsafe: Linear fallback if calculation yields a 0-width segment (overlapping points)
        if (x1 === x0) {
            lut.push(y0 / 255);
            continue;
        }

        // 't' represents the normalized horizontal distance (0.0 to 1.0) between the two bounding control points
        const t = (i - x0) / (x1 - x0);
        
        // COSINE INTERPOLATION
        // Smooths the linear 't' value using a trigonometric curve.
        // Math.PI yields a half-sine wave, shifting the interpolation weight smoothly from y0 to y1.
        const ft = t * Math.PI;
        const f = (1 - Math.cos(ft)) * 0.5;
        const val = y0 * (1 - f) + y1 * f;

        // Finalize: Clamp the output to valid 8-bit color space limits, then normalize to a 0.0 - 1.0 float for the pipeline
        lut.push(Math.max(0, Math.min(255, val)) / 255);
    }
    
    return lut;
};