import { useState, useEffect, useRef, useCallback } from "react";
import {
  cameraService,
  type CameraStreamResult,
  type CameraErrorDetails,
} from "./cameraService";
import type { CameraDeviceInfo, CameraDiagnostics } from "@emoji-face-challenge/shared-types";

const LOCAL_STORAGE_KEY_DEVICE_ID = "efc_selected_camera_id";
const RECONNECT_INTERVAL_MS = 2000;
const RECONNECT_MAX_ATTEMPTS = 15; // 30 seconds total

export interface UseCameraReturn {
  devices: CameraDeviceInfo[];
  selectedDeviceId: string;
  isPermissionGranted: boolean;
  isLoading: boolean;
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  diagnostics: CameraDiagnostics;
  error: CameraErrorDetails | null;
  isDisconnected: boolean;
  requestPermission: () => Promise<boolean>;
  selectDevice: (deviceId: string) => Promise<void>;
  retryConnection: () => Promise<void>;
  savePreferredDevice: () => void;
}

export function useCamera(): UseCameraReturn {
  const [devices, setDevices] = useState<CameraDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEY_DEVICE_ID) || "";
  });
  const [isPermissionGranted, setIsPermissionGranted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<CameraErrorDetails | null>(null);
  const [isDisconnected, setIsDisconnected] = useState<boolean>(false);

  const [diagnostics, setDiagnostics] = useState<CameraDiagnostics>({
    selectedDeviceId: "",
    selectedLabel: "No camera active",
    actualWidth: 0,
    actualHeight: 0,
    actualFps: 0,
    measuredFps: 0,
    isLive: false,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(performance.now());
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const activeStreamResultRef = useRef<CameraStreamResult | null>(null);

  // FPS measurement using requestVideoFrameCallback or requestAnimationFrame
  useEffect(() => {
    let animId: number;
    let isRunning = true;

    const measureLoop = () => {
      if (!isRunning) return;

      const now = performance.now();
      const elapsed = now - lastFpsTimeRef.current;

      if (elapsed >= 1000) {
        const measured = Math.round((frameCountRef.current * 1000) / elapsed);
        setDiagnostics((prev) => ({ ...prev, measuredFps: measured }));
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }

      animId = requestAnimationFrame(measureLoop);
    };

    animId = requestAnimationFrame(measureLoop);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animId);
    };
  }, []);

  // Hook video frame callbacks to track real arrival rate
  const onVideoFrameCallback = useCallback(() => {
    frameCountRef.current += 1;
    if (videoRef.current && "requestVideoFrameCallback" in videoRef.current) {
      videoRef.current.requestVideoFrameCallback(onVideoFrameCallback);
    }
  }, []);

  const attachStreamToVideo = useCallback((newStream: MediaStream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = newStream;
      videoRef.current.play().catch((err) => {
        console.warn("Video play error on attach:", err);
      });

      if ("requestVideoFrameCallback" in videoRef.current) {
        videoRef.current.requestVideoFrameCallback(onVideoFrameCallback);
      }
    }
  }, [onVideoFrameCallback]);

  const refreshDeviceList = useCallback(async () => {
    const list = await cameraService.enumerateVideoDevices();
    setDevices(list);
    return list;
  }, []);

  const startSelectedCamera = useCallback(
    async (deviceIdToStart?: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await cameraService.startCamera(deviceIdToStart);
        activeStreamResultRef.current = result;
        setStream(result.stream);
        setIsDisconnected(false);

        const currentId = result.settings.deviceId;
        setSelectedDeviceId(currentId);

        setDiagnostics({
          selectedDeviceId: currentId,
          selectedLabel: result.settings.label,
          actualWidth: result.settings.width,
          actualHeight: result.settings.height,
          actualFps: result.settings.frameRate,
          measuredFps: 0,
          isLive: true,
        });

        attachStreamToVideo(result.stream);
      } catch (err: unknown) {
        console.error("Camera start failed:", err);
        const errDetails = err as CameraErrorDetails;
        setError(errDetails);
        setStream(null);
        setDiagnostics((prev) => ({
          ...prev,
          isLive: false,
          error: errDetails?.message || "Failed to start camera",
        }));
      } finally {
        setIsLoading(false);
      }
    },
    [attachStreamToVideo]
  );

  const requestPermission = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const savedId = localStorage.getItem(LOCAL_STORAGE_KEY_DEVICE_ID) || undefined;
      await startSelectedCamera(savedId);
      setIsPermissionGranted(true);
      await refreshDeviceList();
      return true;
    } catch (err: unknown) {
      console.warn("Camera request permission error:", err);
      setError(err as CameraErrorDetails);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshDeviceList, startSelectedCamera]);

  // Attempt camera initialization on mount
  useEffect(() => {
    requestPermission().catch(() => {});
  }, [requestPermission]);

  const selectDevice = useCallback(
    async (newDeviceId: string) => {
      setSelectedDeviceId(newDeviceId);
      await startSelectedCamera(newDeviceId);
    },
    [startSelectedCamera]
  );

  const savePreferredDevice = useCallback(() => {
    if (selectedDeviceId) {
      localStorage.setItem(LOCAL_STORAGE_KEY_DEVICE_ID, selectedDeviceId);
    }
  }, [selectedDeviceId]);

  // Disconnection recovery: PRD §6.3 automatic re-acquisition for 30s
  const attemptReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return;

    setIsDisconnected(true);
    reconnectAttemptsRef.current = 0;

    const runAttempt = async () => {
      reconnectAttemptsRef.current += 1;
      try {
        const availableDevices = await cameraService.enumerateVideoDevices();
        setDevices(availableDevices);

        const targetExists = availableDevices.some((d) => d.deviceId === selectedDeviceId);
        if (targetExists || availableDevices.length > 0) {
          const idToAttempt = targetExists ? selectedDeviceId : availableDevices[0].deviceId;
          await startSelectedCamera(idToAttempt);
          // Successfully restored!
          setIsDisconnected(false);
          if (reconnectTimerRef.current) {
            window.clearInterval(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          return;
        }
      } catch (e) {
        console.warn(`Re-acquisition attempt ${reconnectAttemptsRef.current} failed:`, e);
      }

      if (reconnectAttemptsRef.current >= RECONNECT_MAX_ATTEMPTS) {
        if (reconnectTimerRef.current) {
          window.clearInterval(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      }
    };

    reconnectTimerRef.current = window.setInterval(runAttempt, RECONNECT_INTERVAL_MS);
    runAttempt();
  }, [selectedDeviceId, startSelectedCamera]);

  const attemptReconnectRef = useRef(attemptReconnect);
  attemptReconnectRef.current = attemptReconnect;

  const refreshDeviceListRef = useRef(refreshDeviceList);
  refreshDeviceListRef.current = refreshDeviceList;

  const isDisconnectedRef = useRef(isDisconnected);
  isDisconnectedRef.current = isDisconnected;

  // Subscribe to disconnect and devicechange events ONCE on mount
  useEffect(() => {
    const unsubDisconnect = cameraService.subscribeDisconnect(() => {
      console.warn("Camera stream ended / disconnected.");
      attemptReconnectRef.current();
    });

    const unsubDeviceChange = cameraService.subscribeDeviceChange(async () => {
      console.info("Media devices changed.");
      const updatedList = await refreshDeviceListRef.current();
      if (isDisconnectedRef.current && updatedList.length > 0) {
        attemptReconnectRef.current();
      }
    });

    return () => {
      unsubDisconnect();
      unsubDeviceChange();
      if (reconnectTimerRef.current) {
        window.clearInterval(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, []);

  return {
    devices,
    selectedDeviceId,
    isPermissionGranted,
    isLoading,
    stream,
    videoRef,
    diagnostics,
    error,
    isDisconnected,
    requestPermission,
    selectDevice,
    retryConnection: () => startSelectedCamera(selectedDeviceId || undefined),
    savePreferredDevice,
  };
}
