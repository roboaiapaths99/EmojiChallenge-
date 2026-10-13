import React from "react";
import type { GameMode, RoundResult } from "@emoji-face-challenge/shared-types";
import type { EmojiSnapshot } from "../photo/emojiSnapshotCapture";
import "./ResultScreen.css";

interface ResultScreenProps {
  mode: GameMode;
  p1Total: number;
  p2Total: number;
  rounds: RoundResult[];
  emojiPhotos?: EmojiSnapshot[];
  onTakePhoto: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  mode,
  p1Total,
  p2Total,
  rounds,
  emojiPhotos = [],
  onTakePhoto,
}) => {
  const winner =
    p1Total > p2Total ? "PLAYER 1" : p2Total > p1Total ? "PLAYER 2" : "TIE";

  const starCount =
    p1Total >= 750 ? 5 : p1Total >= 600 ? 4 : p1Total >= 450 ? 3 : p1Total >= 250 ? 2 : 1;

  // Deduplicate rounds strictly so only 4 rounds ever display
  const uniqueRounds = React.useMemo(() => {
    const seen = new Set<string>();
    const res: RoundResult[] = [];
    for (const r of rounds) {
      if (!seen.has(r.roundId)) {
        seen.add(r.roundId);
        res.push(r);
      }
    }
    return res.slice(0, 4);
  }, [rounds]);

  return (
    <div className="result-page">
      <header className="result-header">
        <span className="brand-tag">CHALLENGE COMPLETE</span>
        <h1 className="result-title">FINAL RESULTS</h1>
      </header>

      <main className="result-main">
        {mode === "single" ? (
          <section className="result-solo-card">
            <span className="solo-label">TOTAL SCORE</span>
            <div className="solo-score-number">{p1Total}</div>
            <div className="solo-stars">
              {"★".repeat(starCount)}
              {"☆".repeat(5 - starCount)}
            </div>
            <p className="solo-rating-msg">
              {starCount === 5
                ? "UNSTOPPABLE EXPRESSION MASTER!"
                : starCount >= 3
                ? "GREAT FACIAL AGILITY!"
                : "GOOD EFFORT!"}
            </p>
          </section>
        ) : (
          <section className="result-duel-grid">
            <div className={`duel-player-card ${winner === "PLAYER 1" ? "card-winner" : ""}`}>
              <span className="player-pill p1-pill">PLAYER 1</span>
              <div className="duel-score-number">{p1Total}</div>
              {winner === "PLAYER 1" && <div className="winner-crown-tag">👑 WINNER!</div>}
            </div>

            <div className="duel-vs-divider">VS</div>

            <div className={`duel-player-card ${winner === "PLAYER 2" ? "card-winner" : ""}`}>
              <span className="player-pill p2-pill">PLAYER 2</span>
              <div className="duel-score-number">{p2Total}</div>
              {winner === "PLAYER 2" && <div className="winner-crown-tag">👑 WINNER!</div>}
            </div>
          </section>
        )}

        {/* Round Breakdown Cards (PRD §7.9 & §10.2) */}
        <section className="rounds-summary-card">
          <h3 className="breakdown-title">ROUND BREAKDOWN</h3>
          <div className="rounds-pills-row">
            {uniqueRounds.map((r, i) => (
              <div key={r.roundId} className="round-summary-pill">
                <span className="pill-r-label">ROUND {i + 1}</span>
                <span className="pill-r-target">{r.target || "🎯"}</span>
                <span className="pill-r-score">{r.score} PTS</span>
              </div>
            ))}
          </div>
        </section>

        {/* Emoji Action Photos Strip */}
        {emojiPhotos.length > 0 && (
          <section className="rounds-summary-card" style={{ marginTop: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 className="breakdown-title" style={{ margin: 0 }}>
                🎭 YOUR EMOJI MOMENTS ({emojiPhotos.length})
              </h3>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink-2)" }}>
                Captured during expression changes!
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(auto-fit, minmax(130px, 1fr))`,
                gap: "12px",
                maxHeight: "220px",
                overflowY: "auto",
                padding: "4px",
              }}
            >
              {emojiPhotos.map((snap) => (
                <div
                  key={snap.id}
                  style={{
                    position: "relative",
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: "2px solid var(--line-strong)",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
                    background: "#000",
                    aspectRatio: "1",
                  }}
                >
                  <img
                    src={snap.dataUrl}
                    alt={snap.emojiName}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: "rgba(15, 23, 42, 0.85)",
                      padding: "4px 6px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "11px",
                      color: "#fff",
                      fontWeight: 800,
                    }}
                  >
                    <span>{snap.emoji}</span>
                    <span style={{ color: "#fbbf24" }}>★ {snap.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Big Action Button */}
        <div className="result-cta-section">
          <button className="take-photo-btn" onClick={onTakePhoto}>
            📷 TAKE SOUVENIR POSE PHOTO →
          </button>
          <span className="cta-hint">Next: 3-second pose countdown for your official souvenir card</span>
        </div>
      </main>
    </div>
  );
};
