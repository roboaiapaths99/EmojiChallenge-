import React, { useEffect, useMemo, useRef, useState } from "react";
import type { GameMode, EmojiProfile } from "@emoji-face-challenge/shared-types";
import type { UseFaceTrackingReturn } from "../vision/useFaceTracking";
import {
  ExpressionTracker,
  predictEmojiExpression,
  type AIPredictionResult,
} from "@emoji-face-challenge/expression-engine";
import { GetReadyOverlay } from "../game/GetReadyOverlay";
import { LiveCameraPanel } from "../game/LiveCameraPanel";
import { getEmojiHint } from "../game/emojiHints";
import { captureEmojiSnapshot, type EmojiSnapshot } from "../photo/emojiSnapshotCapture";
import { FullscreenButton } from "../ui/FullscreenButton";
import { sound } from "../game/soundEffects";
import "./SpeedScreen.css";

interface SpeedScreenProps {
  profiles: EmojiProfile[]; // target emojis, played in order
  mode: GameMode;
  faceTracking: UseFaceTrackingReturn;
  stream?: MediaStream | null;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  playerName?: string;
  /** Time allowed per emoji (ms). Default 5s — relaxed but still "speedy". */
  perTargetMs?: number;
  onComplete: (result: {
    p1Score: number;
    p2Score: number;
    snapshots?: EmojiSnapshot[];
  }) => void;
}

const AI_UI_REFRESH_MS = 300;
const TOAST_MS = 1400;

export const SpeedScreen: React.FC<SpeedScreenProps> = ({
  profiles,
  mode,
  faceTracking,
  stream,
  videoRef,
  playerName,
  perTargetMs = 5000,
  onComplete,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetIndex, setTargetIndex] = useState(0);
  const [targetTimeLeftMs, setTargetTimeLeftMs] = useState(perTargetMs);
  const [p1Total, setP1Total] = useState(0);
  const [p2Total, setP2Total] = useState(0);
  const [p1Live, setP1Live] = useState(0);
  const [p2Live, setP2Live] = useState(0);
  const [prediction, setPrediction] = useState<AIPredictionResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const p1Tracker = useMemo(() => new ExpressionTracker(), []);
  const p2Tracker = useMemo(() => new ExpressionTracker(), []);

  const indexRef = useRef(0);
  const timeLeftRef = useRef(perTargetMs);
  const p1BestRef = useRef(0);
  const p2BestRef = useRef(0);
  const p1TotalRef = useRef(0);
  const p2TotalRef = useRef(0);
  const isFinishedRef = useRef(false);
  const lastAiUiRef = useRef(0);
  const lastUiUpdateRef = useRef(0);
  const speedSnapshotsRef = useRef<EmojiSnapshot[]>([]);
  const faceRef = useRef(faceTracking);
  faceRef.current = faceTracking;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const current = profiles[targetIndex] ?? profiles[0];
  const { assignment } = faceTracking;
  const isPaused = isPlaying && !assignment.canScore;

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!isPlaying) return;

    let animId = 0;
    let last = performance.now();

    const lockCurrentTarget = () => {
      const best1 = Math.max(p1Tracker.getMaxStableScore(), p1BestRef.current);
      const best2 = Math.max(p2Tracker.getMaxStableScore(), p2BestRef.current);
      const pts1 = Math.round(best1);
      const pts2 = Math.round(best2);

      p1TotalRef.current += pts1;
      p2TotalRef.current += pts2;
      setP1Total(p1TotalRef.current);
      setP2Total(p2TotalRef.current);

      const target = profiles[indexRef.current];
      setToast(pts1 >= (target?.threshold ?? 50) ? `✅ ${target?.emoji} +${pts1} PTS` : `${target?.emoji} +${pts1} PTS`);
      sound.playTargetLockSound();

      // Capture action snapshot for this emoji change
      const v = videoRef?.current;
      if (v && v.videoWidth > 0 && target) {
        captureEmojiSnapshot({
          video: v,
          emoji: target.emoji,
          emojiName: target.name,
          roundName: `Speed: ${target.name}`,
          score: pts1,
          playerName: playerName || "Player 1",
        })
          .then((snap) => {
            speedSnapshotsRef.current.push(snap);
          })
          .catch((e) => console.warn("Speed snapshot capture error:", e));
      }

      p1Tracker.reset();
      p2Tracker.reset();
      p1BestRef.current = 0;
      p2BestRef.current = 0;
      setP1Live(0);
      setP2Live(0);

      if (indexRef.current + 1 >= profiles.length) {
        isFinishedRef.current = true;
        sound.playRoundCompleteSound();
        setTimeout(() => {
          onCompleteRef.current({
            p1Score: p1TotalRef.current,
            p2Score: p2TotalRef.current,
            snapshots: speedSnapshotsRef.current,
          });
        }, 120);
        return;
      }

      indexRef.current += 1;
      setTargetIndex(indexRef.current);
      timeLeftRef.current = perTargetMs;
      setTargetTimeLeftMs(perTargetMs);
    };

    const tick = () => {
      if (isFinishedRef.current) return;

      const now = performance.now();
      const delta = Math.min(100, now - last);
      last = now;

      const { assignment: a } = faceRef.current;
      const profile = profiles[indexRef.current];

      if (a.canScore && profile) {
        timeLeftRef.current = Math.max(0, timeLeftRef.current - delta);

        const p1 = a.players.find((p) => p.id === "p1");
        const p2 = a.players.find((p) => p.id === "p2");

        let p1Score = 0;
        if (p1?.face.blendshapes) {
          const r = p1Tracker.update(p1.face.blendshapes, profile, p1.face.quality, now);
          p1Score = r.smoothedScore;
          p1BestRef.current = Math.max(p1BestRef.current, r.smoothedScore);
          if (now - lastAiUiRef.current > AI_UI_REFRESH_MS) {
            lastAiUiRef.current = now;
            setPrediction(predictEmojiExpression(p1.face.blendshapes, undefined, p1.face.quality));
          }
        }

        let p2Score = 0;
        if (mode === "two" && p2?.face.blendshapes) {
          const r = p2Tracker.update(p2.face.blendshapes, profile, p2.face.quality, now);
          p2Score = r.smoothedScore;
          p2BestRef.current = Math.max(p2BestRef.current, r.smoothedScore);
        }

        // Throttled UI state updates (~30fps React sync)
        if (now - lastUiUpdateRef.current >= 35 || timeLeftRef.current <= 0) {
          lastUiUpdateRef.current = now;
          setTargetTimeLeftMs(timeLeftRef.current);
          setP1Live(p1Score);
          if (mode === "two") {
            setP2Live(p2Score);
          }
        }

        if (timeLeftRef.current <= 0) {
          lockCurrentTarget();
          if (isFinishedRef.current) return;
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, profiles, mode, perTargetMs, p1Tracker, p2Tracker]);

  const progressPct = Math.max(0, Math.min(100, (targetTimeLeftMs / perTargetMs) * 100));
  const isCritical = isPlaying && targetTimeLeftMs <= 1500;
  const p1Pass = p1Live >= current.threshold;
  const p2Pass = p2Live >= current.threshold;

  return (
    <div className="ga-page speed-page">
      {!isPlaying && (
        <GetReadyOverlay
          roundLabel="ROUND 3 OF 4"
          title="SPEED CHALLENGE"
          preview={profiles.map((p) => (
            <span key={p.id}>{p.emoji}</span>
          ))}
          previewIsRow
          previewName={`${profiles.length} faces · ${perTargetMs / 1000}s each`}
          hint="Copy each emoji before its timer runs out!"
          onDone={() => setIsPlaying(true)}
        />
      )}

      <header className="ga-header">
        <div className="ga-header-left">
          <span className="ga-round-tag">ROUND 3 OF 4</span>
          <h2 className="ga-title">SPEED CHALLENGE</h2>
        </div>

        <div className="speed-sequence" aria-label="Emoji sequence">
          {profiles.map((p, idx) => (
            <div
              key={p.id}
              className={`speed-seq-item ${idx === targetIndex ? "is-active" : idx < targetIndex ? "is-done" : ""}`}
            >
              <span>{p.emoji}</span>
              {idx < targetIndex && <span className="speed-seq-check">✓</span>}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <FullscreenButton className="ga-skip-btn" />
          <button
            id="speed-skip-btn"
            className="ga-skip-btn"
            onClick={() => {
              isFinishedRef.current = true;
              onCompleteRef.current({ p1Score: 210, p2Score: 190 });
            }}
            title="Operator quick skip"
          >
            SKIP →
          </button>
        </div>
      </header>

      <main className="ga-arena">
        <div className="ga-left">
          <div className={`ga-card ga-target-card ${p1Pass ? "is-matching" : ""}`}>
            <div className="ga-target-top">
              <span className="ga-eyebrow">
                FACE {targetIndex + 1} OF {profiles.length}
              </span>
              <span className="ga-goal-badge">GOAL {current.threshold}%</span>
            </div>

            <div key={current.id} className="ga-target-emoji speed-emoji-enter" role="img" aria-label={current.name}>
              {current.emoji}
            </div>
            <h3 className="ga-target-name">{current.name}</h3>
            <p className="ga-hint">💡 {getEmojiHint(current.id)}</p>

            <div className="speed-target-timer">
              <span className={`speed-target-secs ${isCritical ? "is-critical" : ""}`}>
                {(targetTimeLeftMs / 1000).toFixed(1)}s
              </span>
              <div className="ga-timer-track">
                <div
                  className={`ga-timer-fill ${isCritical ? "is-critical" : ""}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          <SpeedScoreRow
            label={mode === "two" ? "PLAYER 1" : "YOUR SCORE"}
            pillClass="p1-pill"
            fillClass="p1"
            total={p1Total}
            live={p1Live}
            pass={p1Pass}
            threshold={current.threshold}
          />
          {mode === "two" && (
            <SpeedScoreRow
              label="PLAYER 2"
              pillClass="p2-pill"
              fillClass="p2"
              total={p2Total}
              live={p2Live}
              pass={p2Pass}
              threshold={current.threshold}
            />
          )}
        </div>

        <LiveCameraPanel
          stream={stream}
          isMatching={p1Pass || (mode === "two" && p2Pass)}
          isPaused={isPaused}
          statusMessage={assignment.statusMessage}
          prediction={prediction}
          matchLabel="GOT IT!"
        >
          {toast && (
            <div key={toast} className="ga-cam-toast">
              {toast}
            </div>
          )}
        </LiveCameraPanel>
      </main>
    </div>
  );
};

interface SpeedScoreRowProps {
  label: string;
  pillClass: string;
  fillClass: string;
  total: number;
  live: number;
  pass: boolean;
  threshold: number;
}

const SpeedScoreRow: React.FC<SpeedScoreRowProps> = ({
  label,
  pillClass,
  fillClass,
  total,
  live,
  pass,
  threshold,
}) => (
  <div className={`ga-card ga-score-card ${pass ? "is-matching" : ""}`}>
    <div className="ga-score-head">
      <div className="ga-score-head-left">
        <span className={`player-pill ${pillClass}`}>{label}</span>
        <span className="ga-best">TOTAL {total} PTS</span>
      </div>
      <span className={`ga-live-pct ${pass ? "is-pass" : ""}`}>{Math.round(live)}%</span>
    </div>
    <div className="ga-meter-track">
      <div
        className={`ga-meter-fill ${fillClass} ${pass ? "is-pass" : ""}`}
        style={{ width: `${Math.min(100, live)}%` }}
      />
      <div className="ga-threshold" style={{ left: `${threshold}%` }} />
    </div>
  </div>
);
