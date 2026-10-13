import React, { useEffect, useState, useRef } from "react";
import type { GameMode } from "@emoji-face-challenge/shared-types";
import type { UseFaceTrackingReturn } from "../vision/useFaceTracking";
import { FaceOverlay } from "../diagnostics/FaceOverlay";
import "./PlayerSetupScreen.css";

interface PlayerSetupScreenProps {
  mode: GameMode;
  faceTracking: UseFaceTrackingReturn;
  stream?: MediaStream | null;
  onReady: () => void;
  onCancel: () => void;
}

export const PlayerSetupScreen: React.FC<PlayerSetupScreenProps> = ({
  mode,
  faceTracking,
  stream,
  onReady,
  onCancel,
}) => {
  const [countdown, setCountdown] = useState<number | null>(null);
  const localVideoRef = React.useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [stream]);

  const { assignment, processedFaces, isReady } = faceTracking;
  const isPositionsValid = assignment.canScore;

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  // Auto-start countdown when players are verified in correct positions
  useEffect(() => {
    if (!isPositionsValid) {
      setCountdown(null);
      return;
    }

    setCountdown(3);

    const interval = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return 3;
        if (prev <= 1) {
          window.clearInterval(interval);
          onReadyRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isPositionsValid]);

  return (
    <div className="player-setup-page">
      <header className="setup-nav">
        <button className="nav-cancel-btn" onClick={onCancel}>
          ← CANCEL
        </button>
        <span className="mode-indicator-tag">
          {mode === "single" ? "1-PLAYER SETUP" : "2-PLAYER SETUP"}
        </span>
        <button className="nav-skip-btn" onClick={onReady}>
          FORCE READY →
        </button>
      </header>

      <main className="setup-stage">
        <div className="setup-viewport-frame">
          {/* Live Camera Video Feed */}
          <video
            ref={localVideoRef}
            className="setup-live-camera"
            playsInline
            muted
            autoPlay
          />

          {/* Face Overlay */}
          {isReady && (
            <FaceOverlay
              faces={processedFaces}
              assignedPlayers={assignment.players}
              showLandmarks={false}
            />
          )}

          {/* Zones */}
          {mode === "single" ? (
            <div className="setup-zone-guide zone-1p">
              <div className="zone-rect p1-zone">
                <span className="zone-pill p1-pill">PLAYER 1 ZONE</span>
              </div>
            </div>
          ) : (
            <div className="setup-zone-guide zone-2p">
              <div className="zone-rect p1-zone">
                <span className="zone-pill p1-pill">PLAYER 1 (LEFT)</span>
              </div>
              <div className="zone-rect p2-zone">
                <span className="zone-pill p2-pill">PLAYER 2 (RIGHT)</span>
              </div>
            </div>
          )}

          {/* Big Status Banner on Viewport */}
          <div className="setup-guidance-bar">
            {countdown !== null ? (
              <div className="countdown-callout">
                <span className="countdown-number">{countdown}</span>
                <span className="countdown-label">GET READY!</span>
              </div>
            ) : (
              <div className={`instruction-pill ${isPositionsValid ? "pill-good" : "pill-warning"}`}>
                <span className="instruction-icon">{isPositionsValid ? "✓" : "⚠️"}</span>
                <span className="instruction-text">{assignment.statusMessage}</span>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="setup-footer-tips">
        <p>Stand 1.5–2.5 metres away. Look directly at the screen.</p>
      </footer>
    </div>
  );
};
