import React, { useState, useEffect } from "react";
import { useCamera } from "./camera/useCamera";
import { useFaceTracking } from "./vision/useFaceTracking";
import { CameraSetup } from "./screens/CameraSetup";
import { AttractScreen } from "./screens/AttractScreen";
import { ModeSelectScreen } from "./screens/ModeSelectScreen";
import { OTPLoginScreen } from "./screens/OTPLoginScreen";
import { PlayerSetupScreen } from "./screens/PlayerSetupScreen";
import { RulesScreen } from "./screens/RulesScreen";
import { RoundScreen } from "./screens/RoundScreen";
import { SpeedScreen } from "./screens/SpeedScreen";
import { HuntScreen } from "./screens/HuntScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { PhotoScreen } from "./screens/PhotoScreen";
import { QRScreen } from "./screens/QRScreen";
import { ThankYouScreen } from "./screens/ThankYouScreen";
import { AdminPanel } from "./screens/AdminPanel";
import { CameraPanel } from "./diagnostics/CameraPanel";
import { DEFAULT_PROFILES } from "@emoji-face-challenge/expression-engine";
import type { PhotoCompositionResult } from "./photo/photoCompositor";
import type { EmojiSnapshot } from "./photo/emojiSnapshotCapture";
import type { GameMode, RoundResult } from "@emoji-face-challenge/shared-types";
import type { PlayerAuthData } from "./api/eventApi";
import "./App.css";

export type GameState =
  | "SETUP"
  | "ATTRACT"
  | "MODE_SELECT"
  | "OTP_LOGIN"
  | "PLAYER_SETUP"
  | "RULES"
  | "ROUND_1"
  | "ROUND_2"
  | "ROUND_3_SPEED"
  | "ROUND_4_HUNT"
  | "RESULT"
  | "PHOTO_CAPTURE"
  | "QR_DISPLAY"
  | "THANK_YOU";

export const App: React.FC = () => {
  const camera = useCamera();
  // Start directly on ATTRACT screen without camera calibration blocking
  const [gameState, setGameState] = useState<GameState>("ATTRACT");
  const [gameMode, setGameMode] = useState<GameMode>("single");
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [showAdmin, setShowAdmin] = useState<boolean>(false);

  // Gameplay scoring accumulation
  const [rounds, setRounds] = useState<RoundResult[]>([]);
  const [p1Scores, setP1Scores] = useState<number[]>([0, 0, 0, 0]);
  const [p2Scores, setP2Scores] = useState<number[]>([0, 0, 0, 0]);
  const [emojiPhotos, setEmojiPhotos] = useState<EmojiSnapshot[]>([]);
  const [playerName, setPlayerName] = useState<string>("Challenger");
  const [playersAuth, setPlayersAuth] = useState<PlayerAuthData[]>([]);
  const [composedPhoto, setComposedPhoto] = useState<PhotoCompositionResult | null>(null);
  const [uploadInfo, setUploadInfo] = useState<any>(undefined);

  const masterVideoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    if (masterVideoRef.current && camera.stream) {
      masterVideoRef.current.muted = true;
      if (masterVideoRef.current.srcObject !== camera.stream) {
        masterVideoRef.current.srcObject = camera.stream;
      }
      masterVideoRef.current.play().catch((err) => {
        console.warn("Master video play warning:", err);
      });
    }
  }, [camera.stream]);

  // Real-time face tracking pipeline attached to permanent decoding video
  const faceTracking = useFaceTracking(
    masterVideoRef,
    gameMode,
    camera.diagnostics.isLive
  );

  // Keyboard shortcuts:
  // Ctrl+Shift+D: Toggle operator diagnostics
  // Ctrl+Shift+A: Toggle operator admin panel
  // Escape: Operator emergency escape back to Attract / Setup (PRD §9)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setShowDiagnostics((prev) => !prev);
      }
      if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        setShowAdmin((prev) => !prev);
      }
      if (e.ctrlKey && e.shiftKey && (e.key === "F" || e.key === "f")) {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
      if (e.key === "Escape") {
        if (gameState !== "SETUP" && gameState !== "ATTRACT") {
          setGameState("ATTRACT");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState]);

  // Reset scores for a new session
  const resetSession = (mode: GameMode) => {
    setGameMode(mode);
    setRounds([]);
    setP1Scores([0, 0, 0, 0]);
    setP2Scores([0, 0, 0, 0]);
    setComposedPhoto(null);
    setUploadInfo(undefined);
    setEmojiPhotos([]);
    setPlayersAuth([]);
    setPlayerName("Challenger");
  };

  const p1Total = p1Scores.reduce((a, b) => a + b, 0);
  const p2Total = p2Scores.reduce((a, b) => a + b, 0);

  // Emojis for rounds
  const easyProfile = DEFAULT_PROFILES[0]; // 😀
  const mediumProfile = DEFAULT_PROFILES[1]; // 😮
  const speedProfiles = [
    DEFAULT_PROFILES[0], // 😀
    DEFAULT_PROFILES[1], // 😮
    DEFAULT_PROFILES[2], // 😉
    DEFAULT_PROFILES[4], // 😆
  ];

  return (
    <div className="event-app-container">
      {/* 1. SETUP (Operator calibration drawer/mode, not forced on startup) */}
      {gameState === "SETUP" && (
        <CameraSetup
          camera={camera}
          faceTracking={faceTracking}
          currentMode={gameMode}
          onModeChange={setGameMode}
          onReady={() => setGameState("ATTRACT")}
          onOpenDiagnostics={() => setShowDiagnostics(true)}
        />
      )}

      {/* 2. ATTRACT */}
      {gameState === "ATTRACT" && (
        <AttractScreen
          onStart={() => {
            if (!camera.stream) {
              camera.requestPermission();
            }
            setGameState("MODE_SELECT");
          }}
          onOpenSettings={() => setGameState("SETUP")}
          onOpenAdmin={() => setShowAdmin(true)}
        />
      )}

      {/* 3. MODE SELECT */}
      {gameState === "MODE_SELECT" && (
        <ModeSelectScreen
          onSelectMode={(mode) => {
            resetSession(mode);
            setGameState("OTP_LOGIN");
          }}
          onBack={() => setGameState("ATTRACT")}
        />
      )}

      {/* 4. OTP MOBILE LOGIN VIA METAREACH SMS (1 Player or 2 Players) */}
      {gameState === "OTP_LOGIN" && (
        <OTPLoginScreen
          mode={gameMode}
          onSuccess={(players) => {
            const list: PlayerAuthData[] = [players.p1];
            if (players.p2) list.push(players.p2);
            setPlayersAuth(list);
            setPlayerName(players.p1.name);
            setGameState("PLAYER_SETUP");
          }}
          onBack={() => setGameState("MODE_SELECT")}
        />
      )}

      {/* 5. PLAYER SETUP & FRAMING CHECK */}
      {gameState === "PLAYER_SETUP" && (
        <PlayerSetupScreen
          mode={gameMode}
          faceTracking={faceTracking}
          stream={camera.stream}
          onRequestCamera={camera.requestPermission}
          cameraError={camera.error}
          onReady={() => setGameState("RULES")}
          onCancel={() => setGameState("OTP_LOGIN")}
        />
      )}

      {/* 6. RULES SCREEN */}
      {gameState === "RULES" && (
        <RulesScreen onStartGame={() => setGameState("ROUND_1")} />
      )}

      {/* 6. ROUND 1: EASY EXPRESSION */}
      {gameState === "ROUND_1" && (
        <RoundScreen
          roundNumber={1}
          roundTitle="EASY CHALLENGE"
          durationSeconds={8}
          profile={easyProfile}
          mode={gameMode}
          faceTracking={faceTracking}
          stream={camera.stream}
          videoRef={masterVideoRef}
          playerName={playerName}
          onComplete={({ p1Score, p2Score, target, snapshot }) => {
            setP1Scores((prev) => [p1Score, prev[1], prev[2], prev[3]]);
            setP2Scores((prev) => [p2Score, prev[1], prev[2], prev[3]]);
            if (snapshot) {
              setEmojiPhotos((prev) => [...prev, snapshot]);
            }
            setRounds((prev) => [
              ...prev.filter((r) => r.roundId !== "r1"),
              { roundId: "r1", score: p1Score, target, durationMs: 8000 },
            ]);
            setGameState("ROUND_2");
          }}
        />
      )}

      {/* 7. ROUND 2: MEDIUM EXPRESSION */}
      {gameState === "ROUND_2" && (
        <RoundScreen
          roundNumber={2}
          roundTitle="MEDIUM CHALLENGE"
          durationSeconds={8}
          profile={mediumProfile}
          mode={gameMode}
          faceTracking={faceTracking}
          stream={camera.stream}
          videoRef={masterVideoRef}
          playerName={playerName}
          onComplete={({ p1Score, p2Score, target, snapshot }) => {
            setP1Scores((prev) => [prev[0], p1Score, prev[2], prev[3]]);
            setP2Scores((prev) => [prev[0], p2Score, prev[2], prev[3]]);
            if (snapshot) {
              setEmojiPhotos((prev) => [...prev, snapshot]);
            }
            setRounds((prev) => [
              ...prev.filter((r) => r.roundId !== "r2"),
              { roundId: "r2", score: p1Score, target, durationMs: 8000 },
            ]);
            setGameState("ROUND_3_SPEED");
          }}
        />
      )}

      {/* 8. ROUND 3: SPEED CHALLENGE */}
      {gameState === "ROUND_3_SPEED" && (
        <SpeedScreen
          profiles={speedProfiles}
          perTargetMs={5000}
          mode={gameMode}
          faceTracking={faceTracking}
          stream={camera.stream}
          videoRef={masterVideoRef}
          playerName={playerName}
          onComplete={({ p1Score, p2Score, snapshots }) => {
            setP1Scores((prev) => [prev[0], prev[1], p1Score, prev[3]]);
            setP2Scores((prev) => [prev[0], prev[1], p2Score, prev[3]]);
            if (snapshots && snapshots.length > 0) {
              setEmojiPhotos((prev) => [...prev, ...snapshots]);
            }
            setRounds((prev) => [
              ...prev.filter((r) => r.roundId !== "r3"),
              { roundId: "r3", score: p1Score, target: "⚡ 4x", durationMs: speedProfiles.length * 5000 },
            ]);
            setGameState("ROUND_4_HUNT");
          }}
        />
      )}

      {/* 9. ROUND 4: EMOJI HUNT */}
      {gameState === "ROUND_4_HUNT" && (
        <HuntScreen
          profiles={DEFAULT_PROFILES}
          durationMs={18000}
          mode={gameMode}
          faceTracking={faceTracking}
          stream={camera.stream}
          videoRef={masterVideoRef}
          playerName={playerName}
          onComplete={({ p1Score, p2Score, snapshots }) => {
            setP1Scores((prev) => [prev[0], prev[1], prev[2], p1Score]);
            setP2Scores((prev) => [prev[0], prev[1], prev[2], p2Score]);
            if (snapshots && snapshots.length > 0) {
              setEmojiPhotos((prev) => [...prev, ...snapshots]);
            }
            setRounds((prev) => [
              ...prev.filter((r) => r.roundId !== "r4"),
              { roundId: "r4", score: p1Score, target: "🔍 HUNT", durationMs: 18000 },
            ]);
            setGameState("RESULT");
          }}
        />
      )}

      {/* 10. RESULT SCREEN */}
      {gameState === "RESULT" && (
        <ResultScreen
          mode={gameMode}
          p1Total={p1Total}
          p2Total={p2Total}
          rounds={rounds}
          emojiPhotos={emojiPhotos}
          onTakePhoto={() => setGameState("PHOTO_CAPTURE")}
        />
      )}

      {/* 11. SOUVENIR PHOTO CAPTURE & COMPOSITOR */}
      {gameState === "PHOTO_CAPTURE" && (
        <PhotoScreen
          mode={gameMode}
          p1Total={p1Total}
          p2Total={p2Total}
          rounds={rounds}
          emojiPhotos={emojiPhotos}
          stream={camera.stream}
          videoRef={masterVideoRef}
          initialPlayerName={playerName}
          players={playersAuth}
          onPhotoReady={(photo, info, pName) => {
            setComposedPhoto(photo);
            setUploadInfo(info);
            if (pName) setPlayerName(pName);
            setGameState("QR_DISPLAY");
          }}
        />
      )}

      {/* 12. QR CODE DISPLAY */}
      {gameState === "QR_DISPLAY" && composedPhoto && (
        <QRScreen
          photo={composedPhoto}
          uploadInfo={uploadInfo}
          emojiPhotos={emojiPhotos}
          playerName={playerName}
          finalScore={Math.max(p1Total, p2Total)}
          onDone={() => setGameState("THANK_YOU")}
        />
      )}

      {/* 13. THANK YOU / RESET LOOP */}
      {gameState === "THANK_YOU" && (
        <ThankYouScreen onComplete={() => setGameState("ATTRACT")} />
      )}

      {/* Global Operator Diagnostics Drawer (Ctrl+Shift+D) */}
      {showDiagnostics && (
        <CameraPanel
          diagnostics={camera.diagnostics}
          visionMetrics={faceTracking.metrics}
          devices={camera.devices}
          selectedDeviceId={camera.selectedDeviceId}
          isDisconnected={camera.isDisconnected}
          onSelectDevice={camera.selectDevice}
          onRetry={camera.retryConnection}
          onClose={() => setShowDiagnostics(false)}
        />
      )}

      {/* Global Operator Admin Panel (Ctrl+Shift+A) */}
      {showAdmin && (
        <AdminPanel
          onClose={() => setShowAdmin(false)}
          faceTracking={faceTracking}
        />
      )}


      {/* Persistent global video element for continuous camera and face tracking */}
      <video
        ref={masterVideoRef}
        playsInline
        muted
        autoPlay
        width={1280}
        height={720}
        style={{
          position: "fixed",
          top: "-9999px",
          left: "-9999px",
          width: "1280px",
          height: "720px",
          opacity: 0.001,
          pointerEvents: "none",
          zIndex: -999,
        }}
      />
    </div>
  );
};

export default App;
