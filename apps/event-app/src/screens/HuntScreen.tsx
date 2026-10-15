import React, { useEffect, useRef, useState } from "react";
import type { GameMode, EmojiProfile } from "@emoji-face-challenge/shared-types";
import type { UseFaceTrackingReturn } from "../vision/useFaceTracking";
import {
  findHuntMatch,
  predictEmojiExpression,
  type AIPredictionResult,
} from "@emoji-face-challenge/expression-engine";
import { GetReadyOverlay } from "../game/GetReadyOverlay";
import { LiveCameraPanel } from "../game/LiveCameraPanel";
import { captureEmojiSnapshot, type EmojiSnapshot } from "../photo/emojiSnapshotCapture";
import { FullscreenButton } from "../ui/FullscreenButton";
import { sound } from "../game/soundEffects";
import "./HuntScreen.css";

interface MatchedItem {
  id: string;
  emoji: string;
  name: string;
  score: number;
  points: number;
}

interface HuntScreenProps {
  profiles: EmojiProfile[];
  mode: GameMode;
  faceTracking: UseFaceTrackingReturn;
  stream?: MediaStream | null;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  playerName?: string;
  /** Total hunt time in ms (default 18s) */
  durationMs?: number;
  onComplete: (result: {
    p1Score: number;
    p2Score: number;
    snapshots?: EmojiSnapshot[];
  }) => void;
}

const POINTS_PER_FIND = 150;
/** A face must be held this long before it counts — avoids random flicker unlocks */
const HOLD_TO_UNLOCK_MS = 500;
const AI_UI_REFRESH_MS = 300;
const TOAST_MS = 1800;

interface HoldState {
  id: string | null;
  since: number;
}

export const HuntScreen: React.FC<HuntScreenProps> = ({
  profiles,
  mode,
  faceTracking,
  stream,
  videoRef,
  playerName,
  durationMs = 18000,
  onComplete,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState(durationMs);
  const [p1Matches, setP1Matches] = useState<MatchedItem[]>([]);
  const [p2Matches, setP2Matches] = useState<MatchedItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<AIPredictionResult | null>(null);
  const [holdingId, setHoldingId] = useState<string | null>(null);

  const matchedP1 = useRef<Set<string>>(new Set());
  const matchedP2 = useRef<Set<string>>(new Set());
  const holdP1 = useRef<HoldState>({ id: null, since: 0 });
  const holdP2 = useRef<HoldState>({ id: null, since: 0 });
  const timeLeftRef = useRef(durationMs);
  const isFinishedRef = useRef(false);
  const lastAiUiRef = useRef(0);
  const lastUiUpdateRef = useRef(0);
  const huntSnapshotsRef = useRef<EmojiSnapshot[]>([]);
  const faceRef = useRef(faceTracking);
  faceRef.current = faceTracking;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const { assignment } = faceTracking;
  const isPaused = isPlaying && !assignment.canScore;

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!isPlaying) return;

    let animId = 0;
    let last = performance.now();

    /** Returns the profile that was just unlocked (after holding), or null */
    const evaluate = (
      blendshapes: Record<string, number>,
      quality: number,
      hold: React.MutableRefObject<HoldState>,
      found: React.MutableRefObject<Set<string>>,
      now: number
    ) => {
      const m = findHuntMatch(blendshapes, profiles, quality);
      if (!m || found.current.has(m.profile.id)) {
        hold.current = { id: null, since: 0 };
        return null;
      }
      if (hold.current.id !== m.profile.id) {
        hold.current = { id: m.profile.id, since: now };
        return null;
      }
      if (now - hold.current.since >= HOLD_TO_UNLOCK_MS) {
        found.current.add(m.profile.id);
        hold.current = { id: null, since: 0 };
        return m;
      }
      return null;
    };

    const tick = () => {
      if (isFinishedRef.current) return;

      const now = performance.now();
      const delta = Math.min(100, now - last);
      last = now;

      const { assignment: a } = faceRef.current;

      if (a.canScore) {
        timeLeftRef.current = Math.max(0, timeLeftRef.current - delta);

        if (now - lastUiUpdateRef.current >= 40 || timeLeftRef.current <= 0) {
          lastUiUpdateRef.current = now;
          setTimeLeftMs(timeLeftRef.current);
        }

        const p1 = a.players.find((p) => p.id === "p1");
        const p2 = a.players.find((p) => p.id === "p2");

        if (p1?.face.blendshapes) {
          if (now - lastAiUiRef.current > AI_UI_REFRESH_MS) {
            lastAiUiRef.current = now;
            setPrediction(predictEmojiExpression(p1.face.blendshapes, profiles, p1.face.quality));
          }
          const m = evaluate(p1.face.blendshapes, p1.face.quality, holdP1, matchedP1, now);
          setHoldingId(holdP1.current.id);
          if (m) {
            sound.playHuntFoundSound();
            const item: MatchedItem = {
              id: m.profile.id,
              emoji: m.profile.emoji,
              name: m.profile.name,
              score: m.score,
              points: POINTS_PER_FIND,
            };
            setP1Matches((prev) => [...prev, item]);
            setToast(`${mode === "two" ? "P1 " : ""}FOUND ${item.emoji} +${POINTS_PER_FIND}`);

            const v = videoRef?.current;
            if (v && v.videoWidth > 0) {
              captureEmojiSnapshot({
                video: v,
                emoji: m.profile.emoji,
                emojiName: m.profile.name,
                roundName: `Hunt: ${m.profile.name}`,
                score: m.score,
                playerName: playerName || "Player 1",
              })
                .then((snap) => huntSnapshotsRef.current.push(snap))
                .catch((e) => console.warn("Hunt snapshot capture error:", e));
            }
          }
        }

        if (mode === "two" && p2?.face.blendshapes) {
          const m = evaluate(p2.face.blendshapes, p2.face.quality, holdP2, matchedP2, now);
          if (m) {
            sound.playHuntFoundSound();
            const item: MatchedItem = {
              id: m.profile.id,
              emoji: m.profile.emoji,
              name: m.profile.name,
              score: m.score,
              points: POINTS_PER_FIND,
            };
            setP2Matches((prev) => [...prev, item]);
            setToast(`P2 FOUND ${item.emoji} +${POINTS_PER_FIND}`);
          }
        }

        if (timeLeftRef.current <= 0) {
          isFinishedRef.current = true;
          sound.playRoundCompleteSound();
          setTimeout(() => {
            onCompleteRef.current({
              p1Score: matchedP1.current.size * POINTS_PER_FIND,
              p2Score: matchedP2.current.size * POINTS_PER_FIND,
              snapshots: huntSnapshotsRef.current,
            });
          }, 120);
          return;
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, profiles, mode]);

  const p1Score = p1Matches.length * POINTS_PER_FIND;
  const p2Score = p2Matches.length * POINTS_PER_FIND;
  const foundCount = new Set([...p1Matches, ...p2Matches].map((m) => m.id)).size;
  const progressPct = Math.max(0, Math.min(100, (timeLeftMs / durationMs) * 100));
  const isCritical = isPlaying && timeLeftMs <= 4000;

  return (
    <div className="ga-page hunt-page">
      {!isPlaying && (
        <GetReadyOverlay
          roundLabel="ROUND 4 OF 4"
          title="EMOJI HUNT"
          preview={<span>🔍</span>}
          previewName={`Find as many as you can in ${Math.round(durationMs / 1000)}s`}
          hint={`Make ANY emoji face and hold it briefly — each new one is +${POINTS_PER_FIND}!`}
          onDone={() => setIsPlaying(true)}
        />
      )}

      <header className="ga-header">
        <div className="ga-header-left">
          <span className="ga-round-tag">ROUND 4 OF 4</span>
          <h2 className="ga-title">EMOJI HUNT</h2>
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
            id="hunt-skip-btn"
            className="ga-skip-btn"
            onClick={() => {
              isFinishedRef.current = true;
              onCompleteRef.current({ p1Score: 300, p2Score: 250 });
            }}
            title="Operator quick skip"
          >
            SKIP →
          </button>
        </div>
      </header>

      <main className="ga-arena">
        <div className="ga-left">
          {/* Score summary */}
          <div className="ga-card hunt-summary">
            <div className="hunt-found-big">
              <span className="hunt-found-num">{foundCount}</span>
              <span className="hunt-found-of">/ {profiles.length} FOUND</span>
            </div>
            <div className="hunt-player-scores">
              <span className="player-pill p1-pill">
                {mode === "two" ? "P1" : "SCORE"} {p1Score}
              </span>
              {mode === "two" && <span className="player-pill p2-pill">P2 {p2Score}</span>}
            </div>
          </div>

          {/* Catalog */}
          <div className="ga-card hunt-catalog">
            <h3 className="ga-eyebrow hunt-catalog-title">💡 TRY THESE FACES</h3>
            <div className="hunt-grid">
              {profiles.map((p) => {
                const isFound = matchedP1.current.has(p.id) || matchedP2.current.has(p.id);
                const isHolding = holdingId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`hunt-tile ${isFound ? "is-found" : ""} ${isHolding ? "is-holding" : ""}`}
                    title={p.name}
                  >
                    <span className="hunt-tile-emoji">{p.emoji}</span>
                    <span className="hunt-tile-name">{p.name}</span>
                    {isFound && <span className="hunt-tile-check">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <LiveCameraPanel
          stream={stream}
          isMatching={holdingId !== null}
          isPaused={isPaused}
          statusMessage={assignment.statusMessage}
          prediction={prediction}
          matchLabel="HOLD IT…"
        >
          {toast && (
            <div key={toast + foundCount} className="ga-cam-toast">
              🎉 {toast}
            </div>
          )}
        </LiveCameraPanel>
      </main>
    </div>
  );
};
