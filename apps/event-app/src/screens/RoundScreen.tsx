import React, { useEffect, useMemo, useRef, useState } from "react";
import type { GameMode, EmojiProfile } from "@emoji-face-challenge/shared-types";
import type { UseFaceTrackingReturn } from "../vision/useFaceTracking";
import {
  ExpressionTracker,
  type ScoreBand,
  predictEmojiExpression,
  type AIPredictionResult,
} from "@emoji-face-challenge/expression-engine";
import { GetReadyOverlay } from "../game/GetReadyOverlay";
import { LiveCameraPanel } from "../game/LiveCameraPanel";
import { getEmojiHint } from "../game/emojiHints";
import { captureEmojiSnapshot, type EmojiSnapshot } from "../photo/emojiSnapshotCapture";
import { FullscreenButton } from "../ui/FullscreenButton";
import "./RoundScreen.css";

interface RoundScreenProps {
  roundNumber: number;
  roundTitle: string;
  durationSeconds: number;
  profile: EmojiProfile;
  mode: GameMode;
  faceTracking: UseFaceTrackingReturn;
  stream?: MediaStream | null;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  playerName?: string;
  onComplete: (result: {
    p1Score: number;
    p2Score: number;
    target: string;
    snapshot?: EmojiSnapshot;
  }) => void;
}

/** How often the "AI SEES" pill refreshes — slower = calmer, readable UI */
const AI_UI_REFRESH_MS = 300;
/** Below this score we show the "idle" coaching message */
const WARM_SCORE = 30;

const BAND_LABEL: Record<ScoreBand, string> = {
  no_hit: "KEEP TRYING",
  partial: "NICE",
  good: "GREAT",
  excellent: "PERFECT",
};

export const RoundScreen: React.FC<RoundScreenProps> = ({
  roundNumber,
  roundTitle,
  durationSeconds,
  profile,
  mode,
  faceTracking,
  stream,
  videoRef,
  playerName,
  onComplete,
}) => {
  const totalMs = durationSeconds * 1000;

  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(totalMs);
  const [p1Live, setP1Live] = useState(0);
  const [p2Live, setP2Live] = useState(0);
  const [p1Best, setP1Best] = useState(0);
  const [p2Best, setP2Best] = useState(0);
  const [p1Band, setP1Band] = useState<ScoreBand>("no_hit");
  const [p2Band, setP2Band] = useState<ScoreBand>("no_hit");
  const [prediction, setPrediction] = useState<AIPredictionResult | null>(null);

  const p1Tracker = useMemo(() => new ExpressionTracker(), []);
  const p2Tracker = useMemo(() => new ExpressionTracker(), []);

  // Refs keep the animation loop free of stale closures
  const timeLeftRef = useRef(totalMs);
  const p1BestRef = useRef(0);
  const p2BestRef = useRef(0);
  const isCompleteRef = useRef(false);
  const lastAiUiRef = useRef(0);
  const lastUiUpdateRef = useRef(0);
  const faceRef = useRef(faceTracking);
  faceRef.current = faceTracking;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const { assignment } = faceTracking;
  const isPaused = isPlaying && !assignment.canScore;

  const finish = async (p1Score: number, p2Score: number) => {
    if (isCompleteRef.current) return;
    isCompleteRef.current = true;
    let snapshot: EmojiSnapshot | undefined;
    const v = videoRef?.current;
    if (v && v.videoWidth > 0) {
      try {
        snapshot = await captureEmojiSnapshot({
          video: v,
          emoji: profile.emoji,
          emojiName: profile.name,
          roundName: roundTitle,
          score: Math.max(p1Score, p2Score),
          playerName: playerName || "Player 1",
        });
      } catch (err) {
        console.warn("Could not capture round emoji snapshot:", err);
      }
    }
    onCompleteRef.current({ p1Score, p2Score, target: profile.emoji, snapshot });
  };

  // Main gameplay loop — only starts after the GET READY countdown
  useEffect(() => {
    if (!isPlaying) return;

    let animId = 0;
    let last = performance.now();

    const tick = () => {
      if (isCompleteRef.current) return;

      const now = performance.now();
      const delta = Math.min(100, now - last); // clamp tab-switch jumps
      last = now;

      const { assignment: a } = faceRef.current;

      if (a.canScore) {
        timeLeftRef.current = Math.max(0, timeLeftRef.current - delta);

        const p1 = a.players.find((p) => p.id === "p1");
        const p2 = a.players.find((p) => p.id === "p2");

        let p1Score = 0;
        let p1BandVal: ScoreBand = "no_hit";
        if (p1?.face.blendshapes) {
          const r = p1Tracker.update(p1.face.blendshapes, profile, p1.face.quality, now);
          p1Score = r.smoothedScore;
          p1BandVal = r.band;
          if (r.smoothedScore > p1BestRef.current) {
            p1BestRef.current = r.smoothedScore;
          }
          if (now - lastAiUiRef.current > AI_UI_REFRESH_MS) {
            lastAiUiRef.current = now;
            setPrediction(predictEmojiExpression(p1.face.blendshapes, undefined, p1.face.quality));
          }
        }

        let p2Score = 0;
        let p2BandVal: ScoreBand = "no_hit";
        if (mode === "two" && p2?.face.blendshapes) {
          const r = p2Tracker.update(p2.face.blendshapes, profile, p2.face.quality, now);
          p2Score = r.smoothedScore;
          p2BandVal = r.band;
          if (r.smoothedScore > p2BestRef.current) {
            p2BestRef.current = r.smoothedScore;
          }
        }

        // Throttled UI state updates (~30fps React sync) prevents React render lag and keeps 60fps video buttery smooth
        if (now - lastUiUpdateRef.current >= 35 || timeLeftRef.current <= 0) {
          lastUiUpdateRef.current = now;
          setTimeLeftMs(timeLeftRef.current);
          setP1Live(p1Score);
          setP1Band(p1BandVal);
          setP1Best(p1BestRef.current);
          if (mode === "two") {
            setP2Live(p2Score);
            setP2Band(p2BandVal);
            setP2Best(p2BestRef.current);
          }
        }

        if (timeLeftRef.current <= 0) {
          const best1 = Math.max(p1Tracker.getMaxStableScore(), p1BestRef.current);
          const best2 = Math.max(p2Tracker.getMaxStableScore(), p2BestRef.current);
          finish(
            Math.round(200 * (best1 / 100) * profile.scoreMultiplier),
            Math.round(200 * (best2 / 100) * profile.scoreMultiplier)
          );
          return;
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, profile, mode, p1Tracker, p2Tracker]);

  const progressPct = Math.max(0, Math.min(100, (timeLeftMs / totalMs) * 100));
  const isCritical = isPlaying && timeLeftMs <= 3000;
  const p1Pass = p1Live >= profile.threshold;
  const p2Pass = p2Live >= profile.threshold;
  const isMatching = p1Pass || (mode === "two" && p2Pass);
  const hint = getEmojiHint(profile.id);

  const statusClass = p1Pass ? "success" : p1Live >= WARM_SCORE ? "warm" : "idle";
  const statusText = p1Pass
    ? "🎉 YES! HOLD THAT FACE!"
    : p1Live >= WARM_SCORE
    ? "⚡ Almost there — push it a bit more!"
    : "👀 Copy the emoji with your face";

  return (
    <div className="ga-page round-page">
      {!isPlaying && (
        <GetReadyOverlay
          roundLabel={`ROUND ${roundNumber} OF 4`}
          title={roundTitle}
          preview={<span>{profile.emoji}</span>}
          previewName={profile.name}
          hint={hint}
          onDone={() => setIsPlaying(true)}
        />
      )}

      <header className="ga-header">
        <div className="ga-header-left">
          <span className="ga-round-tag">ROUND {roundNumber} OF 4</span>
          <h2 className="ga-title">{roundTitle}</h2>
        </div>

        <div className="ga-header-right">
          <span className={`ga-timer-pill ${isCritical ? "is-critical" : ""}`}>
            ⏱️ {(timeLeftMs / 1000).toFixed(1)}s
          </span>
          <div className="ga-timer-track">
            <div
              className={`ga-timer-fill ${isCritical ? "is-critical" : ""}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <FullscreenButton className="ga-skip-btn" />
          <button
            id="round-skip-btn"
            className="ga-skip-btn"
            onClick={() => finish(180, 160)}
            title="Operator quick skip"
          >
            SKIP →
          </button>
        </div>
      </header>

      <main className="ga-arena">
        {/* LEFT: target + score */}
        <div className="ga-left">
          <div className={`ga-card ga-target-card ${p1Pass ? "is-matching" : ""}`}>
            <div className="ga-target-top">
              <span className="ga-eyebrow">🎯 MAKE THIS FACE</span>
              <span className="ga-goal-badge">GOAL {profile.threshold}%</span>
            </div>
            <div className="ga-target-emoji" role="img" aria-label={profile.name}>
              {profile.emoji}
            </div>
            <h3 className="ga-target-name">{profile.name}</h3>
            <p className="ga-hint">💡 {hint}</p>
            <div className={`ga-status ${statusClass}`}>{statusText}</div>
          </div>

          <ScoreCard
            label={mode === "two" ? "PLAYER 1" : "YOUR MATCH"}
            pillClass="p1-pill"
            fillClass="p1"
            live={p1Live}
            best={p1Best}
            band={p1Band}
            threshold={profile.threshold}
          />

          {mode === "two" && (
            <ScoreCard
              label="PLAYER 2"
              pillClass="p2-pill"
              fillClass="p2"
              live={p2Live}
              best={p2Best}
              band={p2Band}
              threshold={profile.threshold}
            />
          )}
        </div>

        {/* RIGHT: large camera */}
        <LiveCameraPanel
          stream={stream}
          isMatching={isMatching}
          isPaused={isPaused}
          statusMessage={assignment.statusMessage}
          prediction={prediction}
        />
      </main>
    </div>
  );
};

interface ScoreCardProps {
  label: string;
  pillClass: string;
  fillClass: string;
  live: number;
  best: number;
  band: ScoreBand;
  threshold: number;
}

const ScoreCard: React.FC<ScoreCardProps> = ({
  label,
  pillClass,
  fillClass,
  live,
  best,
  band,
  threshold,
}) => {
  const pass = live >= threshold;
  return (
    <div className={`ga-card ga-score-card ${pass ? "is-matching" : ""}`}>
      <div className="ga-score-head">
        <div className="ga-score-head-left">
          <span className={`player-pill ${pillClass}`}>{label}</span>
          <span className="ga-best">BEST {Math.round(best)}% · {BAND_LABEL[band]}</span>
        </div>
        <span className={`ga-live-pct ${pass ? "is-pass" : ""}`}>{Math.round(live)}%</span>
      </div>
      <div className="ga-meter-track">
        <div
          className={`ga-meter-fill ${fillClass} ${pass ? "is-pass" : ""}`}
          style={{ width: `${Math.min(100, live)}%` }}
        />
        <div className="ga-threshold" style={{ left: `${threshold}%` }} title={`Goal ${threshold}%`} />
      </div>
      <div className="ga-meter-labels">
        <span>0%</span>
        <span>▲ GOAL {threshold}%</span>
        <span>100%</span>
      </div>
    </div>
  );
};
