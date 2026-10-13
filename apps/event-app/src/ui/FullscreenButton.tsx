import React, { useState, useEffect } from "react";

export const FullscreenButton: React.FC<{
  className?: string;
  style?: React.CSSProperties;
  variant?: "floating" | "header" | "pill";
}> = ({ className, style, variant = "pill" }) => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    typeof document !== "undefined" ? !!document.fullscreenElement : false
  );

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggle = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen toggle warning:", err);
    }
  };

  if (variant === "floating") {
    return (
      <button
        type="button"
        onClick={toggle}
        style={{
          position: "fixed",
          bottom: "16px",
          right: "176px",
          zIndex: 900,
          background: isFullscreen ? "#065f46" : "#1f2937",
          color: isFullscreen ? "#34d399" : "#f3f4f6",
          border: isFullscreen ? "2px solid #10b981" : "2px solid #374151",
          padding: "8px 16px",
          borderRadius: "9999px",
          fontWeight: 800,
          fontSize: "0.8rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          boxShadow: "0 4px 10px rgba(0, 0, 0, 0.5)",
          transition: "all 0.15s ease",
          ...style,
        }}
        title="Toggle Fullscreen Mode (F11 / Ctrl+Shift+F)"
      >
        <span>{isFullscreen ? "🗗" : "⛶"}</span>
        <span>{isFullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={className || "ga-skip-btn"}
      onClick={toggle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        cursor: "pointer",
        ...style,
      }}
      title="Toggle Fullscreen Mode (F11 / Ctrl+Shift+F)"
      aria-label="Toggle Fullscreen"
    >
      <span>{isFullscreen ? "🗗" : "⛶"}</span>
      <span>{isFullscreen ? "WINDOWED" : "FULLSCREEN"}</span>
    </button>
  );
};
export default FullscreenButton;
