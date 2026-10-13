import React, { useEffect, useState } from "react";
import "./RulesScreen.css";

interface RulesScreenProps {
  onStartGame: () => void;
}

export const RulesScreen: React.FC<RulesScreenProps> = ({ onStartGame }) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(10);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      onStartGame();
      return;
    }

    const timer = window.setTimeout(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [secondsRemaining, onStartGame]);

  return (
    <div className="rules-page">
      <main className="rules-card">
        <span className="rules-tag">HOW TO PLAY</span>
        <h1 className="rules-title">GAME RULES</h1>

        <div className="rules-steps-list">
          <div className="rule-step-item">
            <span className="step-num">1</span>
            <span className="step-text">👀 LOOK AT THE EMOJI ON THE LEFT</span>
          </div>

          <div className="rule-step-item">
            <span className="step-num">2</span>
            <span className="step-text">😀 COPY IT WITH YOUR FACE (CAMERA ON THE RIGHT)</span>
          </div>

          <div className="rule-step-item">
            <span className="step-num">3</span>
            <span className="step-text">🟢 WHEN IT TURNS GREEN — HOLD IT!</span>
          </div>

          <div className="rule-step-item">
            <span className="step-num">4</span>
            <span className="step-text">🏁 4 ROUNDS · EACH STARTS WITH A 3-2-1</span>
          </div>

          <div className="rule-step-item">
            <span className="step-num">5</span>
            <span className="step-text">📸 SMILE FOR YOUR SOUVENIR PHOTO</span>
          </div>
        </div>

        <div className="rules-action-area">
          <button className="rules-start-btn" onClick={onStartGame}>
            I'M READY → ({secondsRemaining}s)
          </button>
        </div>
      </main>
    </div>
  );
};
