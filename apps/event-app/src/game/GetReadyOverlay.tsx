import React, { useEffect, useRef, useState } from "react";

interface GetReadyOverlayProps {
  /** e.g. "ROUND 1 OF 4" */
  roundLabel: string;
  /** e.g. "EASY CHALLENGE" */
  title: string;
  /** Big visual preview (emoji, emoji row, icon…) */
  preview: React.ReactNode;
  /** Render preview as a smaller horizontal row (e.g. several emojis) */
  previewIsRow?: boolean;
  /** Name shown under the preview */
  previewName?: string;
  /** One-line instruction for the player */
  hint: string;
  /** Countdown length in seconds */
  seconds?: number;
  onDone: () => void;
}

/**
 * Full-screen "GET READY" card with a 3-2-1 countdown, shown before every round
 * so players can see the target and prepare instead of being thrown straight in.
 */
export const GetReadyOverlay: React.FC<GetReadyOverlayProps> = ({
  roundLabel,
  title,
  preview,
  previewIsRow = false,
  previewName,
  hint,
  seconds = 3,
  onDone,
}) => {
  const [count, setCount] = useState<number>(seconds);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (count <= 0) {
      onDoneRef.current();
      return;
    }
    const t = window.setTimeout(() => setCount((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [count]);

  return (
    <div className="ga-ready-backdrop" role="dialog" aria-live="assertive">
      <div className="ga-ready-card">
        <span className="ga-ready-badge">{roundLabel}</span>
        <h1 className="ga-ready-title">{title}</h1>

        <div className={`ga-ready-preview ${previewIsRow ? "is-row" : ""}`}>{preview}</div>
        {previewName && <h2 className="ga-ready-name">{previewName}</h2>}

        <p className="ga-ready-hint">💡 {hint}</p>

        <div className="ga-ready-count-wrap">
          <span key={count} className="ga-ready-count">
            {count > 0 ? count : "GO!"}
          </span>
        </div>
        <p className="ga-ready-foot">Look at the camera on the right →</p>
      </div>
    </div>
  );
};
