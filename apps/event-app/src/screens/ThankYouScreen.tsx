import React, { useEffect } from "react";
import "./ThankYouScreen.css";

interface ThankYouScreenProps {
  onComplete: () => void;
}

export const ThankYouScreen: React.FC<ThankYouScreenProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="thank-you-page">
      <main className="thank-you-card">
        <div className="thank-you-emoji">🎉</div>
        <h1 className="thank-you-title">THANKS FOR PLAYING!</h1>
        <p className="thank-you-subtitle">Next player, step up to the camera!</p>

        <button className="thank-you-btn" onClick={onComplete}>
          RETURN TO START →
        </button>
      </main>
    </div>
  );
};
