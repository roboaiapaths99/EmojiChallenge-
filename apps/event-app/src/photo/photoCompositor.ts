import type { RoundResult, GameMode } from "@emoji-face-challenge/shared-types";

export interface PhotoCompositionOptions {
  video: HTMLVideoElement;
  mode: GameMode;
  p1Score: number;
  p2Score: number;
  p1Name?: string;
  p2Name?: string;
  rounds: RoundResult[];
  eventName?: string;
}

export interface PhotoCompositionResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

export async function composeBrandedPhoto(
  options: PhotoCompositionOptions
): Promise<PhotoCompositionResult> {
  const {
    video,
    mode,
    p1Score,
    p2Score,
    p1Name = "CHALLENGER",
    p2Name = "CHALLENGER 2",
    rounds,
    eventName = "EMOJI FACE CHALLENGE"
  } = options;

  const canvas = document.createElement("canvas");
  // 1080x1350 resolution (4:5 vertical event photo standard)
  const width = 1080;
  const height = 1350;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas 2d context");

  // 1. Warm light background
  ctx.fillStyle = "#FAFAF7";
  ctx.fillRect(0, 0, width, height);

  // 2. High-contrast solid outer border
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#111111";
  ctx.strokeRect(7, 7, width - 14, height - 14);

  // 3. Top Header Card
  const headerY = 32;
  const headerH = 124;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(36, headerY, width - 72, headerH);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#111111";
  ctx.strokeRect(36, headerY, width - 72, headerH);

  // Top header left: Event badge + Title
  ctx.fillStyle = "#1F6FEB";
  ctx.font = "bold 16px -apple-system, sans-serif";
  ctx.fillText("★ OFFICIAL EVENT SOUVENIR ★", 56, headerY + 40);

  ctx.fillStyle = "#111111";
  ctx.font = "900 38px -apple-system, sans-serif";
  ctx.fillText(eventName, 56, headerY + 90);

  // Top header right: Challenger Name Badge
  const displayName = mode === "single" ? p1Name.toUpperCase() : `${p1Name.toUpperCase()} & ${p2Name.toUpperCase()}`;
  ctx.fillStyle = "#F4F4EE";
  ctx.fillRect(width - 450, headerY + 24, 390, 76);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#111111";
  ctx.strokeRect(width - 450, headerY + 24, 390, 76);

  ctx.fillStyle = "#666666";
  ctx.font = "bold 13px -apple-system, sans-serif";
  ctx.fillText("CHALLENGER", width - 430, headerY + 50);

  ctx.fillStyle = "#111111";
  ctx.font = "900 24px -apple-system, sans-serif";
  ctx.fillText(displayName.slice(0, 22), width - 430, headerY + 82);

  // 4. Capture Frame Viewport (Center)
  const photoX = 36;
  const photoY = 176;
  const photoW = width - 72;
  const photoH = 720;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(photoX, photoY, photoW, photoH, 18);
  ctx.clip();

  // Draw camera frame with natural center crop and natural mirroring
  const vW = video.videoWidth || 1280;
  const vH = video.videoHeight || 720;
  const vAspect = vW / vH;
  const targetAspect = photoW / photoH;

  let sx = 0, sy = 0, sw = vW, sh = vH;
  if (vAspect > targetAspect) {
    sw = vH * targetAspect;
    sx = (vW - sw) / 2;
  } else {
    sh = vW / targetAspect;
    sy = (vH - sh) / 2;
  }

  try {
    if (video && video.videoWidth > 0 && video.readyState >= 2) {
      // Draw mirrored so pose matches what user saw on screen
      ctx.save();
      ctx.translate(photoX + photoW, photoY);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, photoW, photoH);
      ctx.restore();
    } else {
      const grad = ctx.createLinearGradient(photoX, photoY, photoX + photoW, photoY + photoH);
      grad.addColorStop(0, "#1e293b");
      grad.addColorStop(1, "#334155");
      ctx.fillStyle = grad;
      ctx.fillRect(photoX, photoY, photoW, photoH);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 44px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("📸 SOUVENIR PHOTOGRAPH", photoX + photoW / 2, photoY + photoH / 2);
      ctx.textAlign = "left";
    }
  } catch (drawErr) {
    console.warn("Could not draw video frame to canvas:", drawErr);
  }
  ctx.restore();

  // Photo solid border
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#111111";
  ctx.strokeRect(photoX, photoY, photoW, photoH);

  // 5. Score & Star Rating Card
  const scoreCardY = 916;
  const scoreCardH = 160;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(36, scoreCardY, width - 72, scoreCardH);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#111111";
  ctx.strokeRect(36, scoreCardY, width - 72, scoreCardH);

  if (mode === "single") {
    // Single player score
    ctx.fillStyle = "#1F6FEB";
    ctx.font = "bold 20px -apple-system, sans-serif";
    ctx.fillText("FINAL SCORE", 64, scoreCardY + 48);

    ctx.fillStyle = "#111111";
    ctx.font = "900 64px -apple-system, sans-serif";
    ctx.fillText(`${p1Score} PTS`, 64, scoreCardY + 120);

    // Rating text & stars
    const starCount = p1Score >= 750 ? 5 : p1Score >= 600 ? 4 : p1Score >= 450 ? 3 : 2;
    const ratingLabel =
      p1Score >= 750
        ? "🌟 EXPRESSION MASTER"
        : p1Score >= 600
        ? "⚡ PRO PERFORMER"
        : p1Score >= 450
        ? "👍 GREAT AGILITY"
        : "🙂 GOOD EFFORT";

    ctx.fillStyle = "#111111";
    ctx.font = "900 22px -apple-system, sans-serif";
    ctx.fillText(ratingLabel, width - 380, scoreCardY + 54);

    ctx.fillStyle = "#FFC83D";
    ctx.font = "40px sans-serif";
    ctx.fillText("★".repeat(starCount) + "☆".repeat(5 - starCount), width - 380, scoreCardY + 112);
  } else {
    // Two players scores
    ctx.fillStyle = "#E7F0FF";
    ctx.fillRect(56, scoreCardY + 16, 430, 128);
    ctx.strokeStyle = "#1F6FEB";
    ctx.lineWidth = 3;
    ctx.strokeRect(56, scoreCardY + 16, 430, 128);

    ctx.fillStyle = "#1F6FEB";
    ctx.font = "bold 18px -apple-system, sans-serif";
    ctx.fillText(p1Name.toUpperCase().slice(0, 18), 76, scoreCardY + 52);
    ctx.fillStyle = "#111111";
    ctx.font = "900 48px -apple-system, sans-serif";
    ctx.fillText(`${p1Score} PTS`, 76, scoreCardY + 112);

    ctx.fillStyle = "#FDE8F1";
    ctx.fillRect(width - 486, scoreCardY + 16, 430, 128);
    ctx.strokeStyle = "#E0337E";
    ctx.lineWidth = 3;
    ctx.strokeRect(width - 486, scoreCardY + 16, 430, 128);

    ctx.fillStyle = "#E0337E";
    ctx.font = "bold 18px -apple-system, sans-serif";
    ctx.fillText(p2Name.toUpperCase().slice(0, 18), width - 466, scoreCardY + 52);
    ctx.fillStyle = "#111111";
    ctx.font = "900 48px -apple-system, sans-serif";
    ctx.fillText(`${p2Score} PTS`, width - 466, scoreCardY + 112);
  }

  // 6. Round Emojis & Challenges Showcase Strip
  const stripY = 1096;
  const stripH = 130;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(36, stripY, width - 72, stripH);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#111111";
  ctx.strokeRect(36, stripY, width - 72, stripH);

  // Draw each round's emoji chip
  const numRounds = Math.min(4, Math.max(1, rounds.length));
  const chipW = (width - 72 - 32) / numRounds;

  rounds.slice(0, 4).forEach((r, idx) => {
    const chipX = 52 + idx * chipW;
    const chipY = stripY + 14;
    const targetEmoji = r.target || (idx === 0 ? "😀" : idx === 1 ? "😮" : idx === 2 ? "⚡" : "🔍");

    // Chip box
    ctx.fillStyle = "#F4F4EE";
    ctx.fillRect(chipX, chipY, chipW - 16, 102);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#111111";
    ctx.strokeRect(chipX, chipY, chipW - 16, 102);

    // Emoji
    ctx.font = "38px sans-serif";
    ctx.fillText(targetEmoji.split(" ")[0] || "😀", chipX + 14, chipY + 48);

    // Round title & score
    ctx.fillStyle = "#666666";
    ctx.font = "bold 14px -apple-system, sans-serif";
    ctx.fillText(`ROUND ${idx + 1}`, chipX + 70, chipY + 40);

    ctx.fillStyle = "#111111";
    ctx.font = "900 22px -apple-system, sans-serif";
    ctx.fillText(`${r.score} PTS`, chipX + 70, chipY + 74);
  });

  // 7. Footer & Date & Security Stamp
  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  ctx.fillStyle = "#888882";
  ctx.font = "bold 15px -apple-system, sans-serif";
  ctx.fillText(`VERIFIED SOUVENIR PHOTO • ${dateStr} • AI VISION ENGINE`, 48, 1280);

  ctx.fillStyle = "#1F6FEB";
  ctx.font = "900 16px -apple-system, sans-serif";
  ctx.fillText("SCAN QR TO DOWNLOAD & SHARE →", width - 360, 1280);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to create JPEG blob"));
          return;
        }
        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        resolve({
          dataUrl,
          blob,
          width,
          height,
        });
      },
      "image/jpeg",
      0.95
    );
  });
}
