/**
 * @file MetadataSystem.js
 * @description Steganographic engine for reading and writing LumaForge project data 
 * invisibly inside PNG files, and extracting EXIF provenance from JPEG files.
 */

import piexif from "piexifjs"; // <-- We need this to read JPEG data

const blobToBase64 = (blob) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onloadend = () => res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(blob);
});

const crc32 = (buf) => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[i] = c;
    }
    let crc = -1;
    for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    return (crc ^ -1) >>> 0;
};

export const injectMetadata = async (imageBlob, settings) => {
    const buffer = await imageBlob.arrayBuffer();
    const uint8 = new Uint8Array(buffer);

    const keyword = "LumaForge_Data";
    const text = JSON.stringify(settings);
    
    const encoder = new TextEncoder();
    const keyBytes = encoder.encode(keyword);
    const textBytes = encoder.encode(text);
    
    const dataLen = keyBytes.length + 1 + textBytes.length;
    const chunkBlock = new Uint8Array(4 + dataLen);
    
    chunkBlock.set([116, 69, 88, 116], 0); 
    chunkBlock.set(keyBytes, 4);
    chunkBlock[4 + keyBytes.length] = 0;
    chunkBlock.set(textBytes, 4 + keyBytes.length + 1);

    const crcVal = crc32(chunkBlock);

    let iendIdx = -1;
    for (let i = uint8.length - 8; i >= 0; i--) {
        if (uint8[i] === 0x49 && uint8[i+1] === 0x45 && uint8[i+2] === 0x4E && uint8[i+3] === 0x44) {
            iendIdx = i - 4; 
            break;
        }
    }
    
    if (iendIdx === -1) return imageBlob; 

    const lenArr = new Uint8Array(4);
    new DataView(lenArr.buffer).setUint32(0, dataLen, false); 

    const crcArr = new Uint8Array(4);
    new DataView(crcArr.buffer).setUint32(0, crcVal, false);

    return new Blob([
        uint8.slice(0, iendIdx),
        lenArr,
        chunkBlock,
        crcArr,
        uint8.slice(iendIdx)
    ], { type: 'image/png' });
};

/**
 * READER: Scans an uploaded file at the binary level.
 * Handles both PNG chunk-hopping and JPEG EXIF extraction.
 */
export const readMetadata = async (file) => {
    try {
        const buffer = await file.arrayBuffer();
        const view = new DataView(buffer);
        const uint8 = new Uint8Array(buffer);

        // ==========================================================
        // 1. JPEG EXIF EXTRACTION
        // ==========================================================
        if (uint8[0] === 0xFF && uint8[1] === 0xD8) {
            console.log("[LUMAFORGE_SYSTEM] Detected JPEG. Scanning EXIF for Provenance...");
            try {
                const dataUrl = await blobToBase64(file);
                const exifObj = piexif.load(dataUrl);
                
                let userComment = exifObj["Exif"][piexif.ExifIFD.UserComment];
                if (userComment) {
                    // Convert to string if piexif returned a byte array
                    if (Array.isArray(userComment) || userComment instanceof Uint8Array) {
                        userComment = String.fromCharCode.apply(null, Array.from(userComment));
                    }
                    
                    // Strip the 8-byte "ASCII\0\0\0" header we injected during export
                    if (userComment.startsWith("ASCII\0\0\0")) {
                        userComment = userComment.substring(8);
                    }
                    
                    const payload = JSON.parse(userComment);
                    console.log("[LUMAFORGE_SYSTEM] JPEG Provenance Payload Extracted.");
                    return payload;
                } else {
                    console.log("[LUMAFORGE_SYSTEM] No Lumaforge EXIF found in JPEG.");
                    return null;
                }
            } catch (err) {
                console.warn("[LUMAFORGE_FAULT] Failed to parse JPEG EXIF:", err);
                return null;
            }
        }

        // ==========================================================
        // 2. PNG EXTRACTION
        // ==========================================================
        if (uint8[0] === 0x89 && uint8[1] === 0x50) {
            console.log("[LUMAFORGE_SYSTEM] Detected PNG. Scanning binary chunks...");
            let offset = 8; 
            const decoder = new TextDecoder();

            while (offset < buffer.byteLength) {
                if (offset + 4 > buffer.byteLength) break;
                const length = view.getUint32(offset, false);
                if (offset + 8 > buffer.byteLength) break;
                
                const type = String.fromCharCode(
                    uint8[offset + 4], uint8[offset + 5], uint8[offset + 6], uint8[offset + 7]
                );

                if (type === 'tEXt') {
                    const dataStart = offset + 8;
                    if (length > 15) {
                        const checkKeyword = decoder.decode(uint8.slice(dataStart, dataStart + 14));
                        if (checkKeyword === "LumaForge_Data" && uint8[dataStart + 14] === 0) {
                            const jsonStart = dataStart + 15;
                            const jsonLen = length - 15;
                            const jsonStr = decoder.decode(uint8.slice(jsonStart, jsonStart + jsonLen));
                            
                            console.log("[LUMAFORGE_SYSTEM] PNG Black Box Metadata Extracted.");
                            return JSON.parse(jsonStr);
                        }
                    }
                }
                offset += 12 + length;
            }
        }
        
    } catch (e) {
        console.error("[LUMAFORGE_FAULT] Metadata Read Error. Proceeding with clean load:", e);
    }
    
    return null;
};