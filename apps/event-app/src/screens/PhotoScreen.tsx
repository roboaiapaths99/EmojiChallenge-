import React, { useEffect, useState, useRef } from "react";
import type { GameMode, RoundResult } from "@emoji-face-challenge/shared-types";
import { composeBrandedPhoto, type PhotoCompositionResult } from "../photo/photoCompositor";
import { submitGameSessionAndPhoto, type SessionUploadResult } from "../api/eventApi";
import type { EmojiSnapshot } from "../photo/emojiSnapshotCapture";
import "./PhotoScreen.css";

interface PhotoScreenProps {
  mode: GameMode;
  p1Total: number;
  p2Total: number;
  rounds: RoundResult[];
  emojiPhotos?: EmojiSnapshot[];
  stream?: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  initialPlayerName?: string;
  players?: any[];
  onPhotoReady: (
    photo: PhotoCompositionResult,
    uploadInfo?: SessionUploadResult,
    playerName?: string
  ) => void;
}

export const PhotoScreen: React.FC<PhotoScreenProps> = ({
  mode,
  p1Total,
  p2Total,
  rounds,
  emojiPhotos = [],
  stream,
  videoRef,
  initialPlayerName = "Challenger",
  players = [],
  onPhotoReady,
}) => {
  const [countdown, setCountdown] = useState<number>(3);
  const [playerName, setPlayerName] = useState<string>(initialPlayerName);
  const [flash, setFlash] = useState<boolean>(false);
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // Attach camera stream to local video element
  useEffect(() => {
    if (localVideoRef.current && stream) {
      localVideoRef.current.muted = true;
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch((err) => {
        console.warn("Could not play camera video on PhotoScreen:", err);
      });
    }
  }, [stream]);

  const onPhotoReadyRef = useRef(onPhotoReady);
  onPhotoReadyRef.current = onPhotoReady;

  const propsRef = useRef({ mode, p1Total, p2Total, rounds, emojiPhotos });
  propsRef.current = { mode, p1Total, p2Total, rounds, emojiPhotos };

  const hasCapturedRef = useRef<boolean>(false);

  // Countdown timer: reliably decrements once per second, unaffected by parent re-renders
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [countdown === 0]);

  // When countdown hits 0, trigger photo capture
  useEffect(() => {
    if (countdown !== 0 || isComposing || hasCapturedRef.current) return;
    hasCapturedRef.current = true;
    setFlash(true);
    setIsComposing(true);

    const runCapture = async () => {
      try {
        const video =
          localVideoRef.current && localVideoRef.current.videoWidth > 0
            ? localVideoRef.current
            : videoRef.current && videoRef.current.videoWidth > 0
            ? videoRef.current
            : localVideoRef.current || videoRef.current;

        if (!video) throw new Error("Video element missing for photo capture");

        setUploadStatus("Composing official souvenir card…");
        const {
          mode: currentMode,
          p1Total: currentP1,
          p2Total: currentP2,
          rounds: currentRounds,
          emojiPhotos: currentEmojiPhotos,
        } = propsRef.current;

        const p1ActualName = players[0]?.name || playerName || "Player 1";
        const p2ActualName = players[1]?.name || "Player 2";

        const photoResult = await composeBrandedPhoto({
          video,
          mode: currentMode,
          p1Score: currentP1,
          p2Score: currentP2,
          p1Name: p1ActualName,
          p2Name: p2ActualName,
          rounds: currentRounds,
          eventName: "EMOJI FACE CHALLENGE",
        });

        // Upload photo and emoji photos to backend
        setUploadStatus("Saving souvenir package to server…");
        const sessionId = "sess_" + Date.now();
        let uploadInfo: SessionUploadResult | undefined = undefined;

        try {
          uploadInfo = await submitGameSessionAndPhoto({
            sessionId,
            mode: currentMode,
            p1Score: currentP1,
            p2Score: currentP2,
            finalScore: Math.max(currentP1, currentP2),
            rounds: currentRounds,
            playerName: p1ActualName,
            players: players,
            photoBlob: photoResult.blob,
            emojiPhotos: currentEmojiPhotos.map((ep) => ({
              emoji: ep.emoji,
              name: ep.emojiName,
              roundName: ep.roundName,
              score: ep.score,
              blob: ep.blob,
            })),
          });
          console.log("Photo package uploaded successfully:", uploadInfo);
        } catch (uploadErr) {
          console.warn("Backend upload failed, continuing with offline preview:", uploadErr);
        }

        setTimeout(() => {
          onPhotoReadyRef.current(photoResult, uploadInfo, p1ActualName);
        }, 300);
      } catch (err) {
        console.error("Failed to compose branded photo:", err);
        setUploadStatus("Failed to take photo. Click RETRY below.");
        setIsComposing(false);
        setFlash(false);
        hasCapturedRef.current = false;
      }
    };

    runCapture();
  }, [countdown, isComposing, videoRef]);

  return (
    <div className="photo-screen-page">
      {flash && <div className="camera-flash-overlay" />}

      <header className="photo-header">
        <div>
          <span className="brand-tag">SOUVENIR PHOTO MOMENT</span>
          <h2>STRIKE A POSE & SMILE!</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--ink-2)" }}>PRINT NAME:</span>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Your Name"
            style={{
              padding: "8px 16px",
              borderRadius: "9999px",
              border: "2px solid var(--line-strong)",
              fontWeight: 800,
              fontSize: "15px",
              background: "var(--surface)",
              color: "var(--ink)",
              boxShadow: "0 2px 0 var(--line-strong)",
            }}
          />
        </div>
      </header>

      <main className="photo-stage">
        <div className="photo-viewport-box">
          {/* Live Full-Resolution Video Element */}
          <video
            ref={localVideoRef}
            className="photo-live-feed"
            playsInline
            muted
            autoPlay
          />

          {countdown > 0 && (
            <div className="photo-countdown-badge">
              <span className="countdown-digit">{countdown}</span>
              <span className="countdown-pose-msg">STRIKE YOUR BEST POSE!</span>
            </div>
          )}

          {isComposing && (
            <div className="composing-badge">
              <span className="spinner" />
              <span>{uploadStatus || "DEVELOPING SOUVENIR CARD…"}</span>
            </div>
          )}

          {countdown === 0 && !isComposing && (
            <div style={{ zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", background: "rgba(0,0,0,0.8)", padding: "20px 32px", borderRadius: "16px" }}>
              <span style={{ color: "#ffffff", fontWeight: 700 }}>{uploadStatus || "Ready to capture!"}</span>
              <button
                type="button"
                onClick={() => setCountdown(3)}
                style={{
                  background: "#10b981",
                  color: "#ffffff",
                  border: "none",
                  padding: "12px 24px",
                  borderRadius: "9999px",
                  fontWeight: 900,
                  fontSize: "1rem",
                  cursor: "pointer",
                }}
              >
                📸 RETAKE PHOTO NOW
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="photo-footer">
        <p>Your photo will be framed with your scores & available via QR code!</p>
      </footer>
    </div>
  );
};
