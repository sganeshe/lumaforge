import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

let segmenter = null;

self.onmessage = async (e) => {
    const { type, imageData } = e.data;

    // 1. INITIALIZE THE NEURAL ENGINE
    if (type === 'INIT') {
        try {
            self.postMessage({ type: 'STATUS', message: '[ DOWNLOADING WASM CORE... ]' });
            
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
            );
            
            self.postMessage({ type: 'STATUS', message: '[ LOADING TENSOR MODEL... ]' });
            
            segmenter = await ImageSegmenter.createFromOptions(vision, {
                baseOptions: {
                    // This is a hyper-optimized, quantized model for edge devices
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
                    delegate: "GPU" // Attempts WebGL acceleration if available
                },
                runningMode: "IMAGE",
                outputCategoryMask: true,
                outputConfidenceMasks: false
            });
            
            self.postMessage({ type: 'INIT_DONE' });
        } catch (error) {
            self.postMessage({ type: 'ERROR', error: error.message });
        }
    }

    // 2. RUN INFERENCE ON THE PIXELS
    if (type === 'SEGMENT' && segmenter) {
        try {
            self.postMessage({ type: 'STATUS', message: '[ ISOLATING SUBJECT... ]' });
            
            // Run the model on the raw ImageData
            const segmentationResult = segmenter.segment(imageData);
            
            // Returns a 1D array of 0s (background) and 255s (subject)
            const maskArray = segmentationResult.categoryMask.getAsUint8Array();
            
            self.postMessage({ 
                type: 'SEGMENT_DONE', 
                mask: maskArray,
                width: imageData.width,
                height: imageData.height
            });
        } catch (error) {
            self.postMessage({ type: 'ERROR', error: error.message });
        }
    }
};