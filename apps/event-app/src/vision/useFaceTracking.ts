import { useState, useEffect, useRef, useCallback } from "react";
import { getFaceLandmarker } from "./landmarker";
import {
  computeFaceBox,
  extractHeadPose,
  calculateQualityScore,
  type ProcessedFace,
} from "./faceGeometry";
import { playerAssigner, type PlayerAssignmentResult } from "./playerAssigner";
import type { GameMode, FaceStatus } from "@emoji-face-challenge/shared-types";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

export interface VisionMetrics {
  inferenceTimeMs: number;
  visionFps: number;
  isModelReady: boolean;
  facesDetected: number;
  status: FaceStatus;
  statusMessage: string;
}

export interface UseFaceTrackingReturn {
  metrics: VisionMetrics;
  assignment: PlayerAssignmentResult;
  processedFaces: ProcessedFace[];
  isReady: boolean;
  error: string | null;
}

// 640x360 provides instant landmark accuracy while reducing pixel processing by 80%
const INFERENCE_WIDTH = 640;
const INFERENCE_HEIGHT = 360;
// Target ~22 Hz inference intervals (45ms), freeing up the main thread so camera video renders at full 60 FPS
const TARGET_INFERENCE_INTERVAL_MS = 45;
// Throttled UI state sync interval (60ms) to eliminate React reconciliation thrashing
const UI_SYNC_INTERVAL_MS = 60;

export function useFaceTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  mode: GameMode = "single",
  isActive: boolean = true
): UseFaceTrackingReturn {
  const [isReady, setIsReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [assignment, setAssignment] = useState<PlayerAssignmentResult>({
    status: "NO_FACE",
    statusMessage: "INITIALIZING VISION…",
    players: [],
    canScore: false,
  });

  const [metrics, setMetrics] = useState<VisionMetrics>({
    inferenceTimeMs: 0,
    visionFps: 0,
    isModelReady: false,
    facesDetected: 0,
    status: "NO_FACE",
    statusMessage: "INITIALIZING VISION…",
  });

  const [processedFaces, setProcessedFaces] = useState<ProcessedFace[]>([]);

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const isRunningRef = useRef<boolean>(false);
  const lastInferenceTimeRef = useRef<number>(0);
  const lastUiSyncTimeRef = useRef<number>(0);
  const frameCounterRef = useRef<number>(0);
  const lastFpsCheckRef = useRef<number>(performance.now());
  const rollingInferenceTimeRef = useRef<number[]>([]);

  // Downscaled offscreen canvas for hardware-accelerated low-latency scaling
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Keep latest tracking state in refs to avoid recreating callbacks
  const latestFacesRef = useRef<ProcessedFace[]>([]);
  const latestAssignmentRef = useRef<PlayerAssignmentResult>(assignment);
  const calculatedFpsRef = useRef<number>(0);

  // Initialize offscreen scaling canvas
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = INFERENCE_WIDTH;
    canvas.height = INFERENCE_HEIGHT;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    offscreenCanvasRef.current = canvas;
    offscreenCtxRef.current = ctx;

    return () => {
      offscreenCanvasRef.current = null;
      offscreenCtxRef.current = null;
    };
  }, []);

  // Initialize MediaPipe Face Landmarker
  useEffect(() => {
    let isCancelled = false;

    getFaceLandmarker()
      .then((instance) => {
        if (!isCancelled) {
          landmarkerRef.current = instance;
          setIsReady(true);
          setMetrics((prev) => ({ ...prev, isModelReady: true }));
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Failed to load FaceLandmarker:", err);
          setError("Failed to load local FaceLandmarker model.");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Inference Loop: non-blocking, throttled, low-latency
  const runVisionLoop = useCallback(() => {
    if (!isRunningRef.current) return;

    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    const offscreen = offscreenCanvasRef.current;
    const offscreenCtx = offscreenCtxRef.current;

    if (
      video &&
      landmarker &&
      offscreen &&
      offscreenCtx &&
      video.readyState >= 2 &&
      !video.paused &&
      !video.ended
    ) {
      const now = performance.now();

      if (now - lastInferenceTimeRef.current >= TARGET_INFERENCE_INTERVAL_MS) {
        lastInferenceTimeRef.current = now;

        const startInference = performance.now();
        try {
          // Fast downscaled blit to offscreen canvas
          offscreenCtx.drawImage(video, 0, 0, INFERENCE_WIDTH, INFERENCE_HEIGHT);

          // Run inference on downscaled canvas (MediaPipe runs in <12ms!)
          const result = landmarker.detectForVideo(offscreen, now);
          const inferenceDuration = performance.now() - startInference;

          rollingInferenceTimeRef.current.push(inferenceDuration);
          if (rollingInferenceTimeRef.current.length > 20) {
            rollingInferenceTimeRef.current.shift();
          }

          frameCounterRef.current += 1;
          const fpsElapsed = now - lastFpsCheckRef.current;
          if (fpsElapsed >= 1000) {
            calculatedFpsRef.current = Math.round((frameCounterRef.current * 1000) / fpsElapsed);
            frameCounterRef.current = 0;
            lastFpsCheckRef.current = now;
          }

          // Process detected faces
          const faces: ProcessedFace[] = [];
          if (result && result.faceLandmarks) {
            for (let i = 0; i < result.faceLandmarks.length; i++) {
              const rawLandmarks = result.faceLandmarks[i];
              const matrix = result.facialTransformationMatrixes?.[i];
              const box = computeFaceBox(rawLandmarks);
              const pose = extractHeadPose(matrix);
              const quality = calculateQualityScore(box, pose, mode === "single" ? 0.11 : 0.09);

              const blendshapes: Record<string, number> = {};
              if (result.faceBlendshapes && result.faceBlendshapes[i]) {
                for (const cat of result.faceBlendshapes[i].categories) {
                  blendshapes[cat.categoryName] = cat.score;
                }
              }

              faces.push({
                index: i,
                box,
                pose,
                quality,
                blendshapes,
                landmarks: rawLandmarks,
                isTooSmall: box.height < (mode === "single" ? 0.11 : 0.09),
                isHeadTurned: Math.abs(pose.yaw) > 25 || Math.abs(pose.pitch) > 22,
              });
            }
          }

          const assignResult = playerAssigner.assign(mode, faces, now);
          const prevStatus = latestAssignmentRef.current?.status;

          latestFacesRef.current = faces;
          latestAssignmentRef.current = assignResult;

          // Throttled UI state synchronization to prevent React rendering lag
          if (
            now - lastUiSyncTimeRef.current >= UI_SYNC_INTERVAL_MS ||
            assignResult.status !== prevStatus
          ) {
            lastUiSyncTimeRef.current = now;

            const avgInference = Math.round(
              rollingInferenceTimeRef.current.reduce((a, b) => a + b, 0) /
                (rollingInferenceTimeRef.current.length || 1)
            );

            setProcessedFaces(faces);
            setAssignment(assignResult);
            setMetrics({
              inferenceTimeMs: avgInference,
              visionFps: calculatedFpsRef.current,
              isModelReady: true,
              facesDetected: faces.length,
              status: assignResult.status,
              statusMessage: assignResult.statusMessage,
            });
          }
        } catch (inferenceErr) {
          console.warn("MediaPipe inference error:", inferenceErr);
        }
      }
    }

    if (isRunningRef.current) {
      requestAnimationFrame(runVisionLoop);
    }
  }, [mode, videoRef]);

  useEffect(() => {
    if (isReady && isActive) {
      isRunningRef.current = true;
      requestAnimationFrame(runVisionLoop);
    } else {
      isRunningRef.current = false;
      playerAssigner.reset();
    }

    return () => {
      isRunningRef.current = false;
      playerAssigner.reset();
    };
  }, [isReady, isActive, runVisionLoop]);

  return {
    metrics,
    assignment,
    processedFaces,
    isReady,
    error,
  };
}
