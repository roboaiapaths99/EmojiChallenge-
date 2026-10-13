import type { UseCameraReturn } from "../camera/useCamera";
import type { UseFaceTrackingReturn } from "../vision/useFaceTracking";
import { FaceOverlay } from "../diagnostics/FaceOverlay";
import "./CameraSetup.css";

interface CameraSetupProps {
  camera: UseCameraReturn;
  faceTracking: UseFaceTrackingReturn;
  currentMode: "single" | "two";
  onModeChange: (mode: "single" | "two") => void;
  onReady: () => void;
  onOpenDiagnostics: () => void;
}

export const CameraSetup: React.FC<CameraSetupProps> = ({
  camera,
  faceTracking,
  currentMode,
  onModeChange,
  onReady,
  onOpenDiagnostics,
}) => {

  const {
    devices,
    selectedDeviceId,
    isPermissionGranted,
    isLoading,
    videoRef,
    diagnostics,
    error,
    isDisconnected,
    requestPermission,
    selectDevice,
    savePreferredDevice,
    retryConnection,
  } = camera;

  const handleStartGame = () => {
    savePreferredDevice();
    // Attempt fullscreen if supported
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn("Fullscreen request error:", err);
      });
    }
    onReady();
  };

  return (
    <div className="camera-setup-page">
      {/* Disconnect Alert Overlay (PRD §6.3) */}
      {isDisconnected && (
        <div className="disconnect-alert-banner" role="alert">
          <div className="alert-content">
            <span className="alert-icon">⚠️</span>
            <div className="alert-text">
              <h2>CAMERA DISCONNECTED — CHECK CAMERA</h2>
              <p>Reconnecting automatically to preferred camera device…</p>
            </div>
            <button className="alert-retry-btn" onClick={retryConnection}>
              RECONNECT NOW
            </button>
          </div>
        </div>
      )}

      {/* Header bar */}
      <header className="setup-header">
        <div className="brand-group">
          <span className="brand-tag">EVENT OPERATOR SETUP</span>
          <h1 className="brand-title">EMOJI FACE CHALLENGE</h1>
        </div>

        <div className="header-actions">
          <button
            className="operator-pill-btn"
            onClick={onOpenDiagnostics}
            title="Press Ctrl+Shift+D or click to open diagnostics"
          >
            ⚙️ DIAGNOSTICS {diagnostics.isLive && `(${diagnostics.measuredFps} FPS)`}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="setup-main">
        {/* Left Column: Live Camera Viewport */}
        <div className="preview-container">
          <div className="video-viewport">
            <video
              ref={videoRef}
              className="live-video-element"
              autoPlay
              playsInline
              muted
            />

            {!isPermissionGranted && !isLoading && (
              <div className="viewport-overlay">
                <div className="permission-prompt">
                  <div className="camera-icon-badge">📷</div>
                  <h2>Camera Permission Required</h2>
                  <p>Click below to grant camera access and enumerate available devices.</p>
                  <button className="grant-btn" onClick={requestPermission}>
                    ENABLE CAMERA ACCESS
                  </button>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="viewport-overlay">
                <div className="loading-indicator">
                  <div className="spinner" />
                  <p>Initializing camera stream…</p>
                </div>
              </div>
            )}

            {/* Live Camera Info Chip */}
            {diagnostics.isLive && (
              <div className="live-status-chip">
                <span className="live-dot" />
                <span>
                  {diagnostics.actualWidth}×{diagnostics.actualHeight} @ {Math.round(diagnostics.actualFps)} FPS
                </span>
              </div>
            )}

            {/* Real-time MediaPipe Face Tracking Overlay */}
            {diagnostics.isLive && faceTracking.isReady && (
              <FaceOverlay
                faces={faceTracking.processedFaces}
                assignedPlayers={faceTracking.assignment.players}
                showLandmarks={false}
              />
            )}

            {/* Live Tracking Status Chip */}
            {diagnostics.isLive && (
              <div
                className={`tracking-status-chip ${
                  faceTracking.assignment.canScore ? "chip-ok" : "chip-pending"
                }`}
              >
                <span>{faceTracking.assignment.statusMessage}</span>
              </div>
            )}

            {/* Face Zone Overlay Guides (PRD §7.3) */}
            {currentMode === "single" && (
              <div className="zone-guide zone-guide-1p">
                <div className="zone-box p1-zone">
                  <span className="zone-label">PLAYER 1 ZONE</span>
                </div>
              </div>
            )}

            {currentMode === "two" && (
              <div className="zone-guide zone-guide-2p">
                <div className="zone-box p1-zone">
                  <span className="zone-label">P1 ZONE (BLUE)</span>
                </div>
                <div className="zone-box p2-zone">
                  <span className="zone-label">P2 ZONE (PINK)</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Operator Controls Card */}
        <aside className="controls-sidebar">
          {error && (
            <div className="error-banner">
              <h3>Camera Notice</h3>
              <p>{error.message}</p>
              {error.type === "PERMISSION_DENIED" && (
                <small>Check your browser address bar permissions and reload.</small>
              )}
            </div>
          )}

          <section className="control-group">
            <label className="group-label" htmlFor="camera-device-select">
              Connected Video Device
            </label>
            <select
              id="camera-device-select"
              value={selectedDeviceId}
              onChange={(e) => selectDevice(e.target.value)}
              disabled={devices.length === 0 || isLoading}
              className="device-dropdown"
            >
              {devices.length === 0 ? (
                <option value="">No cameras enumerated</option>
              ) : (
                devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))
              )}
            </select>
            <p className="field-hint">
              {devices.length > 1
                ? "Multiple cameras detected. Select USB external webcam or laptop webcam."
                : "Using default detected camera."}
            </p>
          </section>

          {/* Verification / Test Mode (PRD §6.1 Step 10 & §14.2) */}
          <section className="control-group">
            <label className="group-label">Player Position & Zone Test</label>
            <div className="test-btn-row">
              <button
                className={`mode-toggle-btn ${currentMode === "single" ? "active-1p" : ""}`}
                onClick={() => onModeChange("single")}
              >
                1-Player Framing
              </button>
              <button
                className={`mode-toggle-btn ${currentMode === "two" ? "active-2p" : ""}`}
                onClick={() => onModeChange("two")}
              >
                2-Player Framing
              </button>
            </div>
            <p className="field-hint">
              {currentMode === "single"
                ? "Requires exactly 1 centered face (1.5–2.5m away)."
                : "Requires exactly 2 faces (Left = P1 Blue, Right = P2 Pink)."}
            </p>
          </section>

          {/* Launch Action */}
          <div className="launch-section">
            <button
              className="start-game-btn"
              disabled={!diagnostics.isLive || isDisconnected}
              onClick={handleStartGame}
            >
              START GAME → ATTRACT MODE
            </button>
            <p className="launch-subtext">Switches to fullscreen display on TV/monitor</p>
          </div>
        </aside>
      </main>
    </div>
  );
};
