import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

let landmarkerInstance: FaceLandmarker | null = null;
let initPromise: Promise<FaceLandmarker> | null = null;

export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (landmarkerInstance) {
    return landmarkerInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // Load offline WASM assets from public/wasm
      const filesetResolver = await FilesetResolver.forVisionTasks("/wasm");

      // Try GPU acceleration first
      try {
        landmarkerInstance = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: "/models/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 3, // Support detecting >2 faces for boundary condition (§9.2)
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        console.info("MediaPipe FaceLandmarker initialized with GPU delegate");
        return landmarkerInstance;
      } catch (gpuError) {
        console.warn("GPU delegate failed, falling back to CPU:", gpuError);
        // Fallback to CPU delegate
        landmarkerInstance = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: "/models/face_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 3,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        console.info("MediaPipe FaceLandmarker initialized with CPU delegate");
        return landmarkerInstance;
      }
    } catch (err) {
      initPromise = null;
      console.error("Failed to initialize MediaPipe FaceLandmarker:", err);
      throw err;
    }
  })();

  return initPromise;
}

export function closeFaceLandmarker() {
  if (landmarkerInstance) {
    landmarkerInstance.close();
    landmarkerInstance = null;
    initPromise = null;
  }
}
