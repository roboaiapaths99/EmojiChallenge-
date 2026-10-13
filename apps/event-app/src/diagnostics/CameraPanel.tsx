import React from "react";
import type { CameraDiagnostics, CameraDeviceInfo } from "@emoji-face-challenge/shared-types";
import type { VisionMetrics } from "../vision/useFaceTracking";
import "./CameraPanel.css";

interface CameraPanelProps {
  diagnostics: CameraDiagnostics;
  visionMetrics: VisionMetrics;
  devices: CameraDeviceInfo[];
  selectedDeviceId: string;
  isDisconnected: boolean;
  onSelectDevice: (deviceId: string) => void;
  onRetry: () => void;
  onClose: () => void;
}

export const CameraPanel: React.FC<CameraPanelProps> = ({
  diagnostics,
  visionMetrics,
  devices,
  selectedDeviceId,
  isDisconnected,
  onSelectDevice,
  onRetry,
  onClose,
}) => {
  return (
    <div className="operator-diagnostics-drawer" role="dialog" aria-label="Operator Diagnostics">
      <div className="diagnostics-header">
        <div className="diagnostics-title-group">
          <span className="diagnostics-badge">OPERATOR PANEL</span>
          <h3>Hardware & Camera Diagnostics</h3>
        </div>
        <button className="diagnostics-close-btn" onClick={onClose} aria-label="Close operator panel">
          ✕
        </button>
      </div>

      <div className="diagnostics-body">
        {/* Connection Status Banner */}
        <div className={`status-pill ${diagnostics.isLive && !isDisconnected ? "status-ok" : "status-err"}`}>
          <span className="status-dot" />
          <span>
            {isDisconnected
              ? "DISCONNECTED — ATTEMPTING RECONNECT"
              : diagnostics.isLive
              ? "STREAM LIVE & HEALTHY"
              : "STREAM INACTIVE / ERROR"}
          </span>
        </div>

        {/* Device Picker */}
        <div className="diagnostics-field">
          <label htmlFor="diag-device-select">Input Video Device:</label>
          <select
            id="diag-device-select"
            value={selectedDeviceId}
            onChange={(e) => onSelectDevice(e.target.value)}
            className="diagnostics-select"
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {/* Metrics Grid */}
        <div className="diagnostics-metrics-grid">
          <div className="metric-card">
            <span className="metric-label">Actual Resolution</span>
            <span className="metric-value">
              {diagnostics.actualWidth > 0 ? `${diagnostics.actualWidth} × ${diagnostics.actualHeight}` : "—"}
            </span>
            <span className="metric-sub">via track.getSettings()</span>
          </div>

          <div className="metric-card">
            <span className="metric-label">Camera FPS</span>
            <span className="metric-value">
              {diagnostics.actualFps > 0 ? `${Math.round(diagnostics.actualFps)} FPS` : "—"}
            </span>
            <span className="metric-sub">driver setting</span>
          </div>

          <div className="metric-card">
            <span className="metric-label">Inference Latency</span>
            <span className="metric-value">
              {visionMetrics.inferenceTimeMs > 0 ? `${visionMetrics.inferenceTimeMs} ms` : "—"}
            </span>
            <span className="metric-sub">MediaPipe Landmarker</span>
          </div>

          <div className="metric-card">
            <span className="metric-label">Vision Cadence</span>
            <span className="metric-value">
              {visionMetrics.visionFps > 0 ? `${visionMetrics.visionFps} Hz` : "0 Hz"}
            </span>
            <span className="metric-sub">detection loop</span>
          </div>

          <div className="metric-card">
            <span className="metric-label">Faces Tracked</span>
            <span className="metric-value">
              {visionMetrics.facesDetected}
            </span>
            <span className="metric-sub">spatial assigned</span>
          </div>

          <div className="metric-card">
            <span className="metric-label">Model Status</span>
            <span className="metric-value">
              {visionMetrics.isModelReady ? "READY" : "LOADING"}
            </span>
            <span className="metric-sub">offline wasm</span>
          </div>
        </div>

        {diagnostics.error && (
          <div className="diagnostics-error-box">
            <strong>Error:</strong> {diagnostics.error}
          </div>
        )}

        <div className="diagnostics-actions">
          <button className="diag-action-btn" onClick={onRetry}>
            Restart Camera Stream
          </button>
        </div>
      </div>
    </div>
  );
};
