import React, { useEffect, useState } from "react";
import { FullscreenButton } from "../ui/FullscreenButton";
import "./AttractScreen.css";

interface AttractScreenProps {
  onStart: () => void;
  onOpenSettings: () => void;
}

const HERO_EMOJIS = ["😀", "🤩", "😜", "😮", "😎", "😆", "🥳", "🔥"];

export const AttractScreen: React.FC<AttractScreenProps> = ({
  onStart,
  onOpenSettings,
}) => {
  const [emojiIndex, setEmojiIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setEmojiIndex((prev) => (prev + 1) % HERO_EMOJIS.length);
    }, 1400);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="attract-page">
      <div className="attract-operator-corner" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <FullscreenButton
          style={{
            padding: "8px 16px",
            backgroundColor: "var(--surface)",
            border: "2px solid var(--line)",
            borderRadius: "var(--radius-full)",
            fontSize: "13px",
            fontWeight: 700,
            color: "var(--ink-2)",
          }}
        />
        <button
          className="attract-operator-btn"
          onClick={onOpenSettings}
          title="Return to Camera Setup / Diagnostics"
        >
          ⚙️ Setup
        </button>
      </div>

      <main className="attract-content">
        {/* Animated Feature Emoji Hero */}
        <div className="attract-emoji-hero" aria-hidden="true">
          {HERO_EMOJIS[emojiIndex]}
        </div>

        {/* Event Header Pill */}
        <span className="attract-badge">🔥 OFFICIAL EVENT EXPERIENCE</span>

        {/* Title */}
        <h1 className="attract-title">EMOJI FACE CHALLENGE</h1>

        {/* Event Value Highlights */}
        <div className="attract-taglines">
          <div className="tagline-pill">
            <span className="pill-dot blue-dot" />
            <span>⚡ MATCH THE EMOJIS</span>
          </div>
          <div className="tagline-pill">
            <span className="pill-dot pink-dot" />
            <span>🏆 BEAT THE SCORE</span>
          </div>
          <div className="tagline-pill">
            <span className="pill-dot yellow-dot" />
            <span>📸 GET HD PHOTOS ON QR SCAN</span>
          </div>
        </div>

        {/* Souvenir Highlight Features Banner */}
        <div className="attract-feature-strip">
          <div className="feature-item">
            <span className="feature-icon">📸</span>
            <div className="feature-text">
              <strong>Official Pose Card</strong>
              <span>Customized with your name & score</span>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🎭</span>
            <div className="feature-text">
              <strong>Candid Emoji Action Photos</strong>
              <span>Captured as you make funny faces</span>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📱</span>
            <div className="feature-text">
              <strong>Instant QR Mobile Claim</strong>
              <span>Scan & download right to WhatsApp</span>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <button className="attract-start-btn pulse-glow" onClick={onStart}>
          <span>🚀</span>
          <span>STEP UP & PLAY NOW</span>
        </button>

        {/* Footer */}
        <footer className="attract-footer">
          <span className="player-badge">🎮 1 Player Solo or 2-Player Head-to-Head</span>
          <span className="instruction-sub">
            Step in front of the camera, match facial expressions & take home your official photos!
          </span>
        </footer>
      </main>
    </div>
  );
};
export default AttractScreen;
