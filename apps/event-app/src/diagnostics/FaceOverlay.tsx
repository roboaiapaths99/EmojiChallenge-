import React, { useRef, useEffect } from "react";
import type { ProcessedFace } from "../vision/faceGeometry";
import type { AssignedPlayer } from "../vision/playerAssigner";

interface FaceOverlayProps {
  faces: ProcessedFace[];
  assignedPlayers: AssignedPlayer[];
  showLandmarks?: boolean;
}

export const FaceOverlay: React.FC<FaceOverlayProps> = ({
  faces,
  assignedPlayers,
  showLandmarks = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const width = canvas.width;
    const height = canvas.height;

    for (const face of faces) {
      // Because video is mirrored for participant reflection:
      // screenX = (1 - rawX) * width
      const box = face.box;
      const screenMinX = (1 - box.maxX) * width;
      const boxW = box.width * width;
      const boxH = box.height * height;
      const boxY = box.minY * height;

      // Check if this face is assigned to P1 or P2
      const assigned = assignedPlayers.find((p) => p.face.index === face.index);
      const isP1 = assigned?.id === "p1";
      const isP2 = assigned?.id === "p2";

      const strokeColor = isP1 ? "#1F6FEB" : isP2 ? "#E0337E" : "#888888";

      // Draw bounding box
      ctx.lineWidth = 3;
      ctx.strokeStyle = strokeColor;
      ctx.strokeRect(screenMinX, boxY, boxW, boxH);

      // Draw Player Tag
      const tagText = isP1
        ? "PLAYER 1"
        : isP2
        ? "PLAYER 2"
        : `FACE ${face.index + 1}`;
      ctx.font = "bold 14px -apple-system, sans-serif";
      const textMetrics = ctx.measureText(tagText);
      const tagWidth = textMetrics.width + 16;
      const tagHeight = 24;

      ctx.fillStyle = strokeColor;
      ctx.fillRect(screenMinX, Math.max(0, boxY - tagHeight), tagWidth, tagHeight);

      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(tagText, screenMinX + 8, Math.max(16, boxY - 7));

      // Draw Quality & Pose line
      const qualityPct = Math.round(face.quality * 100);
      const subText = `Q: ${qualityPct}% | Yaw: ${Math.round(face.pose.yaw)}°`;
      ctx.font = "11px monospace";
      ctx.fillStyle = strokeColor;
      ctx.fillText(subText, screenMinX, boxY + boxH + 16);

      // Optionally draw landmarks
      if (showLandmarks && face.landmarks) {
        ctx.fillStyle = strokeColor;
        for (let i = 0; i < face.landmarks.length; i += 8) {
          const lm = face.landmarks[i];
          const lmX = (1 - lm.x) * width;
          const lmY = lm.y * height;
          ctx.beginPath();
          ctx.arc(lmX, lmY, 1.5, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
  }, [faces, assignedPlayers, showLandmarks]);

  return (
    <canvas
      ref={canvasRef}
      width={1280}
      height={720}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 12,
      }}
    />
  );
};
