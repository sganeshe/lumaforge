/**
 * @file CurvesMath.js
 * @description Mathematical engine for generating 1D Look-Up Tables (LUTs) from user-defined UI control points.
 * UPGRADED: Utilizes Monotone Cubic Spline Interpolation (Industry Standard).
 */

export const generateCurveLUT = (points) => {
    // 1. DATA SANITIZATION & SORTING
    const safePoints = points || [{x: 0, y: 0}, {x: 255, y: 255}];
    
    const p = [...safePoints].sort((a, b) => a.x - b.x);
    
    if (p.length === 0) {
        p.push({ x: 0, y: 0 }, { x: 255, y: 255 });
    }
    
    // 2. ENDPOINT CLAMPING
    if (p[0].x > 0) p.unshift({ x: 0, y: 0 });
    if (p[p.length - 1].x < 255) p.push({ x: 255, y: 255 });

    const n = p.length;
    
    const x = new Float32Array(n);
    const y = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        x[i] = p[i].x;
        y[i] = p[i].y;
    }
    
    // 3. CALCULATE SECANT SLOPES
    const secants = new Float32Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
        const dx = x[i + 1] - x[i];
        secants[i] = dx === 0 ? 0 : (y[i + 1] - y[i]) / dx;
    }

    // 4. CALCULATE TANGENTS
    const m = new Float32Array(n);
    m[0] = secants[0];
    m[n - 1] = secants[n - 2];
    for (let i = 1; i < n - 1; i++) {
        if (secants[i - 1] * secants[i] <= 0) {
            m[i] = 0;
        } else {
            m[i] = (secants[i - 1] + secants[i]) / 2;
        }
    }

    // 5. LUT GENERATION (Hermite Spline Interpolation)
    const lut = new Float32Array(256);
    const INV_255 = 0.00392156862745098;
    let k = 0;

    for (let i = 0; i < 256; i++) {
        while (k < n - 2 && i > x[k + 1]) k++;
        
        const x0 = x[k], x1 = x[k + 1];
        const y0 = y[k], y1 = y[k + 1];
        
        if (x1 === x0) {
            lut[i] = y0 * INV_255;
            continue;
        }

        const h = x1 - x0;
        const t = (i - x0) / h;
        const t2 = t * t;
        const t3 = t2 * t;

        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        let val = h00 * y0 + h10 * h * m[k] + h01 * y1 + h11 * h * m[k + 1];

        val = val < 0 ? 0 : val > 255 ? 255 : val;

        lut[i] = val * INV_255;
    }
    
    return lut;
};