import JSZip from "jszip";

export interface EmojiSnapshot {
  id: string;
  roundName: string;
  emoji: string;
  emojiName: string;
  score: number;
  dataUrl: string;
  blob: Blob;
  timestamp: number;
}

/**
 * Captures a crisp, branded snapshot from the camera video element
 * during emoji expression matching.
 */
export async function captureEmojiSnapshot(params: {
  video: HTMLVideoElement;
  emoji: string;
  emojiName: string;
  roundName: string;
  score: number;
  playerName?: string;
}): Promise<EmojiSnapshot> {
  const { video, emoji, emojiName, roundName, score, playerName = "Challenger" } = params;

  const canvas = document.createElement("canvas");
  const width = 800;
  const height = 800;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire 2D canvas context");

  // Fill dark background
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, width, height);

  // 1. Draw centered camera frame (mirrored)
  const vW = video.videoWidth || 1280;
  const vH = video.videoHeight || 720;
  const vAspect = vW / vH;
  const targetAspect = 1; // square 1:1

  let sx = 0, sy = 0, sw = vW, sh = vH;
  if (vAspect > targetAspect) {
    sw = vH * targetAspect;
    sx = (vW - sw) / 2;
  } else {
    sh = vW / targetAspect;
    sy = (vH - sh) / 2;
  }

  try {
    if (video.videoWidth > 0 && video.readyState >= 2) {
      ctx.save();
      // Mirror image horizontally so it matches what player saw
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
      ctx.restore();
    }
  } catch (err) {
    console.warn("Could not capture video frame:", err);
  }

  // 2. Subtle gradient overlay at top and bottom for readable badges
  const topGrad = ctx.createLinearGradient(0, 0, 0, 160);
  topGrad.addColorStop(0, "rgba(15, 23, 42, 0.85)");
  topGrad.addColorStop(1, "rgba(15, 23, 42, 0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, 160);

  const btmGrad = ctx.createLinearGradient(0, height - 180, 0, height);
  btmGrad.addColorStop(0, "rgba(15, 23, 42, 0)");
  btmGrad.addColorStop(1, "rgba(15, 23, 42, 0.95)");
  ctx.fillStyle = btmGrad;
  ctx.fillRect(0, height - 180, width, 180);

  // 3. Top Header Bar
  // Left: Event branding pill
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.roundRect(24, 24, 230, 44, 22);
  ctx.fill();

  ctx.fillStyle = "#111827";
  ctx.font = "900 16px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("✨ EMOJI CHALLENGE", 42, 52);

  // Right: Round pill
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.beginPath();
  ctx.roundRect(width - 200, 24, 176, 44, 22);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(roundName.toUpperCase(), width - 112, 52);
  ctx.textAlign = "left";

  // 4. Large Target Emoji Floating Stamp (Top Right)
  ctx.font = "72px -apple-system, sans-serif";
  ctx.fillText(emoji, width - 110, 150);

  // 5. Bottom Frosted Info Card
  const cardY = height - 130;
  const cardH = 106;
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(24, cardY, width - 48, cardH, 18);
  ctx.fill();
  ctx.stroke();

  // Bottom card content:
  // Left: Emoji name & Challenger
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 28px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(`${emoji} ${emojiName}`, 48, cardY + 44);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 16px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(`CHALLENGER: ${playerName.toUpperCase()}`, 48, cardY + 80);

  // Right: Match Score Badge
  const badgeX = width - 240;
  ctx.fillStyle = score >= 80 ? "#10b981" : score >= 50 ? "#3b82f6" : "#f59e0b";
  ctx.beginPath();
  ctx.roundRect(badgeX, cardY + 22, 192, 62, 14);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 24px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`★ ${Math.round(score)} PTS`, badgeX + 96, cardY + 60);
  ctx.textAlign = "left";

  // 6. Solid Outer Border
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, width - 6, height - 6);

  // Convert to Blob and DataURL
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to generate emoji snapshot blob"));
          return;
        }
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        resolve({
          id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          roundName,
          emoji,
          emojiName,
          score: Math.round(score),
          dataUrl,
          blob,
          timestamp: Date.now(),
        });
      },
      "image/jpeg",
      0.92
    );
  });
}

/**
 * Triggers a direct browser file download for a dataURL or Blob.
 */
export function downloadFile(source: string | Blob, filename: string): void {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof source !== "string") {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

/**
 * Creates a single ZIP bundle containing the main Souvenir Pose Card
 * and all the candid Emoji Change Photos.
 */
export async function bundleAllPhotosZip(params: {
  souvenirBlob?: Blob | null;
  emojiSnapshots: EmojiSnapshot[];
  playerName?: string;
  finalScore?: number;
}): Promise<Blob> {
  const { souvenirBlob, emojiSnapshots, playerName = "Challenger", finalScore = 0 } = params;
  const zip = new JSZip();

  // 1. Add Main Souvenir Pose Card
  if (souvenirBlob) {
    zip.file(`01_Official_Souvenir_Pose_Card_${playerName.replace(/\s+/g, "_")}.jpg`, souvenirBlob);
  }

  // 2. Add Emoji Action Snapshots
  emojiSnapshots.forEach((snap, idx) => {
    const cleanName = snap.emojiName.replace(/[^a-zA-Z0-9]/g, "_") || "expression";
    const num = String(idx + 2).padStart(2, "0");
    zip.file(`${num}_Emoji_${cleanName}_${snap.score}pts.jpg`, snap.blob);
  });

  // 3. Add text souvenir summary certificate
  const dateStr = new Date().toLocaleString();
  const summaryText = `=====================================================
✨ OFFICIAL EMOJI FACE CHALLENGE SOUVENIR PACKAGE ✨
=====================================================

Player Name: ${playerName}
Final Score: ${finalScore} PTS
Date / Time: ${dateStr}
Total Emoji Action Snaps: ${emojiSnapshots.length}

Breakdown:
${emojiSnapshots.map((s, i) => `  ${i + 1}. ${s.emoji} ${s.emojiName} (${s.roundName}): ${s.score} PTS`).join("\n")}

Thank you for playing the Emoji Face Challenge!
Share your moments with friends on WhatsApp & Instagram.
=====================================================`;

  zip.file("Souvenir_Certificate_Info.txt", summaryText);

  return await zip.generateAsync({ type: "blob" });
}
