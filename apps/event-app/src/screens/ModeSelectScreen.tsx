import React from "react";
import type { GameMode } from "@emoji-face-challenge/shared-types";
import "./ModeSelectScreen.css";

interface ModeSelectScreenProps {
  onSelectMode: (mode: GameMode) => void;
  onBack: () => void;
}

export const ModeSelectScreen: React.FC<ModeSelectScreenProps> = ({
  onSelectMode,
  onBack,
}) => {
  return (
    <div className="mode-select-page">
      <header className="mode-header">
        <button className="back-btn" onClick={onBack}>
          ← BACK
        </button>
        <span className="brand-pill">EMOJI FACE CHALLENGE</span>
      </header>

      <main className="mode-main">
        <h1 className="mode-title">HOW MANY PLAYERS?</h1>
        <p className="mode-subtitle">Choose your challenge mode to start</p>

        <div className="mode-cards-grid">
          {/* 1 Player Card */}
          <button
            className="mode-card mode-card-1p"
            onClick={() => onSelectMode("single")}
          >
            <div className="card-badge p1-badge">SOLO CHALLENGE</div>
            <div className="card-avatar">👤</div>
            <h2 className="card-heading">1 PLAYER</h2>
            <p className="card-desc">Beat the target scores across 4 rounds</p>
            <span className="card-cta">START SOLO →</span>
          </button>

          {/* 2 Players Card */}
          <button
            className="mode-card mode-card-2p"
            onClick={() => onSelectMode("two")}
          >
            <div className="card-badge p2-badge">HEAD-TO-HEAD</div>
            <div className="card-avatar">👥</div>
            <h2 className="card-heading">2 PLAYERS</h2>
            <p className="card-desc">Face off in real-time side-by-side battle</p>
            <span className="card-cta">START DUEL →</span>
          </button>
        </div>
      </main>
    </div>
  );
};
