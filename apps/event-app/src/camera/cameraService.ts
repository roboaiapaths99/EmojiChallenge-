// PRD §6.4: Exact Camera Subsystem & Fallback Constraint Ladder
import type { CameraDeviceInfo, CameraSettingsInfo } from "@emoji-face-challenge/shared-types";

export type CameraErrorType =
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "BUSY_OR_UNREADABLE"
  | "OVERCONSTRAINED"
  | "UNSUPPORTED_BROWSER"
  | "NO_USABLE_STREAM"
  | "UNKNOWN_ERROR";

export interface CameraErrorDetails {
  type: CameraErrorType;
  message: string;
  originalError?: unknown;
}

export interface CameraStreamResult {
  stream: MediaStream;
  videoTrack: MediaStreamTrack;
  settings: CameraSettingsInfo;
  capabilities: MediaTrackCapabilities | null;
  attemptIndex: number;
}

// Optimized constraint sequence (PRD §6.4 & §20 Troubleshooting: 720p low-latency)
const FALLBACK_LADDER: MediaTrackConstraints[] = [
  // 1. 1280x720 @ 30-60 FPS (Zero driver latency, instant responsiveness)
  {
    width: { ideal: 1280, min: 640 },
    height: { ideal: 720, min: 480 },
    frameRate: { ideal: 30, min: 24 },
  },
  // 2. 1920x1080 @ 30 FPS
  {
    width: { ideal: 1920, min: 640 },
    height: { ideal: 1080, min: 480 },
    frameRate: { ideal: 30, min: 24 },
  },
  // 3. 1280x720 @ 24 FPS
  {
    width: { ideal: 1280, min: 640 },
    height: { ideal: 720, min: 480 },
    frameRate: { ideal: 24, min: 15 },
  },
  // 4. Browser default video
  {},
];

export class CameraService {
  private currentStream: MediaStream | null = null;
  private currentTrack: MediaStreamTrack | null = null;
  private onDisconnectCallbacks: Set<() => void> = new Set();
  private onDeviceChangeCallbacks: Set<() => void> = new Set();

  public getCurrentStream(): MediaStream | null {
    return this.currentStream;
  }

  public getCurrentTrack(): MediaStreamTrack | null {
    return this.currentTrack;
  }

  constructor() {
    if (typeof window !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener("devicechange", this.handleDeviceChange);
    }
  }

  public destroy() {
    this.stopCurrentStream();
    if (typeof window !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices.removeEventListener("devicechange", this.handleDeviceChange);
    }
    this.onDisconnectCallbacks.clear();
    this.onDeviceChangeCallbacks.clear();
  }

  private handleDeviceChange = () => {
    for (const callback of this.onDeviceChangeCallbacks) {
      callback();
    }
  };

  public subscribeDisconnect(callback: () => void): () => void {
    this.onDisconnectCallbacks.add(callback);
    return () => this.onDisconnectCallbacks.delete(callback);
  }

  public subscribeDeviceChange(callback: () => void): () => void {
    this.onDeviceChangeCallbacks.add(callback);
    return () => this.onDeviceChangeCallbacks.delete(callback);
  }

  public stopCurrentStream() {
    if (this.currentStream) {
      const streamToStop = this.currentStream;
      this.currentStream = null;
      this.currentTrack = null;
      for (const track of streamToStop.getTracks()) {
        try {
          track.stop();
        } catch (_) {}
      }
    }
  }

  public async requestInitialPermission(): Promise<boolean> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw this.mapError(new Error("MediaDevices not supported"), "UNSUPPORTED_BROWSER");
    }

    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      // Stop temporary stream immediately after permission grant
      for (const track of tempStream.getTracks()) {
        track.stop();
      }
      return true;
    } catch (err) {
      throw this.mapError(err);
    }
  }

  public async enumerateVideoDevices(): Promise<CameraDeviceInfo[]> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");

      return videoInputs.map((d, index) => ({
        deviceId: d.deviceId,
        label: d.label || `Camera ${index + 1}`,
        groupId: d.groupId,
      }));
    } catch (err) {
      console.warn("Failed to enumerate camera devices:", err);
      return [];
    }
  }

  public async startCamera(deviceId?: string): Promise<CameraStreamResult> {
    // PRD §6.2.6: Stop old video track before starting a new one
    this.stopCurrentStream();

    let lastError: unknown = null;

    for (let i = 0; i < FALLBACK_LADDER.length; i++) {
      const ladderConstraints = FALLBACK_LADDER[i];
      const videoConstraints: MediaTrackConstraints = {
        ...ladderConstraints,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false, // PRD §6.4: audio must be false
        });

        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length === 0) {
          throw new Error("No video track in acquired stream");
        }

        const track = videoTracks[0];
        this.currentStream = stream;
        this.currentTrack = track;

        // Monitor track ended event (e.g. camera unplugged)
        track.addEventListener("ended", () => {
          if (this.currentTrack === track) {
            for (const callback of this.onDisconnectCallbacks) {
              callback();
            }
          }
        });

        const trackSettings = track.getSettings();
        const capabilities = typeof track.getCapabilities === "function" ? track.getCapabilities() : null;

        const settings: CameraSettingsInfo = {
          deviceId: trackSettings.deviceId || deviceId || "unknown",
          label: track.label || "Connected Camera",
          width: trackSettings.width || 0,
          height: trackSettings.height || 0,
          frameRate: trackSettings.frameRate || 0,
          aspectRatio: trackSettings.aspectRatio,
        };

        return {
          stream,
          videoTrack: track,
          settings,
          capabilities,
          attemptIndex: i,
        };
      } catch (err) {
        lastError = err;
        // If device was specified and overconstrained or not found, proceed to next fallback step
        console.warn(`Camera fallback attempt ${i + 1} failed:`, err);
      }
    }

    if (deviceId) {
      console.warn("Retrying camera initialization with default device after ID failed...");
      return this.startCamera(undefined);
    }

    // PRD §6.4 step 5: show operator error if no usable camera stream exists
    throw this.mapError(lastError, "NO_USABLE_STREAM");
  }

  private mapError(err: unknown, defaultType: CameraErrorType = "UNKNOWN_ERROR"): CameraErrorDetails {
    if (err instanceof DOMException || (typeof err === "object" && err !== null && "name" in err)) {
      const domErr = err as { name: string; message: string };
      switch (domErr.name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
          return {
            type: "PERMISSION_DENIED",
            message: "Camera permission was denied. Please allow camera access in browser settings.",
            originalError: err,
          };
        case "NotFoundError":
        case "DevicesNotFoundError":
          return {
            type: "NOT_FOUND",
            message: "No camera found. Please plug in a webcam or enable the built-in camera.",
            originalError: err,
          };
        case "NotReadableError":
        case "TrackStartError":
          return {
            type: "BUSY_OR_UNREADABLE",
            message: "Camera is busy in another application (e.g. Zoom/Teams). Close other apps and retry.",
            originalError: err,
          };
        case "OverconstrainedError":
          return {
            type: "OVERCONSTRAINED",
            message: "Requested camera resolution/framerate is not supported by this device.",
            originalError: err,
          };
        default:
          return {
            type: defaultType,
            message: domErr.message || "An unexpected camera error occurred.",
            originalError: err,
          };
      }
    }

    return {
      type: defaultType,
      message: err instanceof Error ? err.message : "Unable to start camera stream.",
      originalError: err,
    };
  }
}

export const cameraService = new CameraService();
