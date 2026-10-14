import React, { useEffect, useRef } from "react";
import type { AIPredictionResult } from "@emoji-face-challenge/expression-engine";

interface LiveCameraPanelProps {
  stream?: MediaStream | null;
  /** Player currently meets the target threshold → green glow */
  isMatching: boolean;
  /** Face not positioned correctly → show friendly pause overlay */
  isPaused: boolean;
  statusMessage?: string;
  /** Latest AI prediction (throttled by caller) */
  prediction?: AIPredictionResult | null;
  /** Text inside the green burst when matching */
  matchLabel?: string;
  /** Optional extra overlay content (e.g. hunt "found!" toast) */
  children?: React.ReactNode;
}

/**
 * Large, full-height mirrored camera viewport used on the right side of every
 * gameplay screen, with a HUD for live status, AI detection and face guide.
 */
export const LiveCameraPanel: React.FC<LiveCameraPanelProps> = ({
  stream,
  isMatching,
  isPaused,
  statusMessage,
  prediction,
  matchLabel = "MATCH!",
  children,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (v && stream) {
      v.muted = true;
      v.playsInline = true;
      v.setAttribute("playsinline", "true");
      v.setAttribute("webkit-playsinline", "true");
      v.autoplay = true;

      if (v.srcObject !== stream) {
        v.srcObject = stream;
      }

      const handlePlay = () => {
        v.play().catch((err) => console.warn("LiveCameraPanel loadedmetadata play error:", err));
      };
      v.addEventListener("loadedmetadata", handlePlay);
      v.play().catch((err) => console.warn("LiveCameraPanel initial play error:", err));

      return () => {
        v.removeEventListener("loadedmetadata", handlePlay);
      };
    }
  }, [stream]);

  return (
    <section className={`ga-cam ${isMatching ? "is-matching" : ""}`} aria-label="Live camera">
      <video ref={videoRef} className="ga-cam-video" playsInline muted autoPlay />

      {/* Top HUD */}
      <div className="ga-cam-hud-top">
        <span className="ga-live-badge">
          <span className="ga-rec-dot" /> LIVE CAMERA
        </span>
        {prediction && (
          <span className="ga-ai-pill">
            <span className="ga-ai-label">AI SEES</span>
            <span className="ga-ai-emoji">{prediction.predictedEmoji}</span>
            <span className="ga-ai-name">{prediction.predictedName}</span>
            <span className="ga-ai-conf">{prediction.confidence}%</span>
          </span>
        )}
      </div>

      {/* Face guide */}
      <div className={`ga-reticle ${isMatching ? "is-matching" : ""}`} aria-hidden="true">
        <span className="ga-corner tl" />
        <span className="ga-corner tr" />
        <span className="ga-corner bl" />
        <span className="ga-corner br" />
      </div>
      {isMatching && <div className="ga-match-burst">⭐ {matchLabel} ⭐</div>}

      {children}

      {/* Bottom telemetry */}
      {prediction && !isPaused && (
        <div className="ga-cam-footer">
          <span className="ga-chip">😁 Smile <b>{prediction.features.smileScore}%</b></span>
          <span className="ga-chip">😮 Mouth <b>{prediction.features.jawOpenScore}%</b></span>
          <span className="ga-chip">🤨 Brows <b>{prediction.features.browScore}%</b></span>
          <span className="ga-chip">😉 Blink <b>{prediction.features.eyeBlinkScore}%</b></span>
        </div>
      )}

      {isPaused && (
        <div className="ga-cam-paused">
          <div className="ga-paused-card">
            <span className="ga-paused-icon">🙋</span>
            <h3>STEP INTO THE FRAME</h3>
            <p>{statusMessage || "Stand in front of the camera so we can see your face."}</p>
            <small>The timer is paused until we see you.</small>
          </div>
        </div>
      )}
    </section>
  );
};
