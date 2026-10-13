import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import multer from "multer";
import JSZip from "jszip";
import { db } from "./storage/db.js";

const app = express();
const PORT = process.env.PORT || 3001;

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Setup Multer for saving high-resolution captured photos
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const unique = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, unique);
  },
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
// Serve static uploads
app.use("/uploads", express.static(UPLOADS_DIR));

// In-memory OTP storage for Node server
const otpStore: Record<string, { otp: string; expiresAt: number; name: string }> = {};

// POST /api/auth/send-otp - Real MetaReach SMS sending
app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const mobile = String(req.body.mobile || "").replace(/\D/g, "").slice(-10);
    const playerLabel = req.body.playerLabel || "Player";
    if (mobile.length !== 10) {
      return res.status(400).json({ success: false, message: "Invalid 10-digit mobile number" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    otpStore[mobile] = {
      otp,
      expiresAt: Date.now() + 300000,
      name: playerLabel,
    };

    const message = encodeURIComponent(`Welcome to AGPK Academy login. Your verification code is ${otp}. This OTP will expire in 5 minutes`);
    const smsUrl = `https://sms.metareach.in/vb/apikey.php?apikey=bmV02HoEeC8RQh9B&senderid=AGPKAC&templateid=1707177071739047190&number=${mobile}&message=${message}`;

    try {
      const gatewayRes = await fetch(smsUrl);
      const data: any = await gatewayRes.json().catch(() => ({}));
      if (data.status === "Success" || data.code === "011") {
        return res.json({ success: true, message: `OTP sent to +91 ${mobile.slice(0, 2)}******${mobile.slice(-2)}. Check your phone SMS.` });
      } else {
        return res.json({ success: true, message: `OTP sent via SMS gateway!` });
      }
    } catch (e: any) {
      return res.status(500).json({ success: false, message: "Error contacting MetaReach SMS gateway: " + e.message });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/verify-otp - Verify real OTP and register lead in admin
app.post("/api/auth/verify-otp", (req, res) => {
  try {
    const mobile = String(req.body.mobile || "").replace(/\D/g, "").slice(-10);
    const code = String(req.body.otp || "").trim();
    const playerName = req.body.playerName || `Player-${mobile.slice(-4)}`;

    const record = otpStore[mobile];
    if (!record) {
      return res.status(400).json({ detail: "No OTP requested for this mobile number." });
    }
    if (Date.now() > record.expiresAt) {
      delete otpStore[mobile];
      return res.status(400).json({ detail: "OTP has expired. Please request a new one." });
    }
    if (record.otp !== code) {
      return res.status(400).json({ detail: "Incorrect OTP code. Please try again." });
    }

    delete otpStore[mobile];

    // Register attendee in db so they appear in admin leads
    try {
      db.addRecipient({
        photoId: "pre_game",
        name: playerName,
        mobile: mobile,
        email: `${mobile}@event.live`,
      });
    } catch (e) {}

    return res.json({
      success: true,
      message: "Mobile verified successfully!",
      player: {
        mobile,
        name: playerName,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ detail: err.message });
  }
});

// 1. POST /api/sessions - Create session
app.post("/api/sessions", (req, res) => {
  try {
    const { id, mode, playerName, players, rounds, p1Score, p2Score, finalScore } = req.body;
    const session = db.createSession({
      id: id || "sess_" + Date.now(),
      mode: mode || "single",
      playerName: playerName || "Challenger",
      players: players || [],
      rounds: rounds || [],
      p1Score: p1Score || 0,
      p2Score: p2Score || 0,
      finalScore: finalScore || 0,
      status: "completed",
    });
    res.json({ success: true, session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. POST /api/sessions/:id/photo - Upload captured photo blob and emoji action photos
app.post("/api/sessions/:id/photo", upload.any(), (req, res) => {
  try {
    const sessionId = req.params.id;
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "Photo file required" });
    }

    // Find main souvenir pose card
    const mainFile = files.find((f) => f.fieldname === "photo") || files[0];

    // Find candid emoji action photos
    const emojiFiles = files.filter((f) => f.fieldname.startsWith("emoji_photo_"));
    let emojiMetaParsed: any[] = [];
    try {
      if (req.body.emojiMeta) {
        emojiMetaParsed = JSON.parse(req.body.emojiMeta);
      }
    } catch (e) {
      console.warn("Could not parse emojiMeta JSON:", e);
    }

    const host = req.get("host") || `localhost:${PORT}`;
    const protocol = req.protocol || "http";

    const emojiPhotosList = emojiFiles.map((ef, idx) => {
      const meta = emojiMetaParsed[idx] || {};
      return {
        emoji: meta.emoji || "😀",
        name: meta.name || "Expression",
        roundName: meta.roundName || `Round ${idx + 1}`,
        score: meta.score || 0,
        storageKey: ef.filename,
        previewUrl: `${protocol}://${host}/uploads/${ef.filename}`,
      };
    });

    const { photo, token } = db.createPhoto({
      sessionId,
      filename: mainFile.filename,
      playerName: req.body.playerName || "Challenger",
      emojiPhotos: emojiPhotosList,
    });

    db.updateSession(sessionId, { photoId: photo.id });

    res.json({
      success: true,
      photoId: photo.id,
      token,
      expiresAt: photo.expiresAt,
      previewUrl: `${protocol}://${host}/uploads/${photo.storageKey}`,
      claimUrl: `${protocol}://${host}/claim/${token}`,
      emojiPhotosCount: emojiPhotosList.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. GET /api/photos/token/:token - Resolve token for Mobile App
app.get("/api/photos/token/:token", (req, res) => {
  try {
    const token = req.params.token;
    const photo = db.getPhotoByToken(token);

    if (!photo) {
      return res.status(404).json({ error: "Photo not found or QR token has expired." });
    }

    const session = db.getSession(photo.sessionId);
    const host = req.get("host") || `localhost:${PORT}`;
    const protocol = req.protocol || "http";

    res.json({
      success: true,
      photoId: photo.id,
      previewUrl: `${protocol}://${host}/uploads/${photo.storageKey}`,
      expiresAt: photo.expiresAt,
      playerName: photo.playerName || session?.playerName || "Challenger",
      emojiPhotos: photo.emojiPhotos || [],
      session: session
        ? {
            mode: session.mode,
            playerName: session.playerName,
            p1Score: session.p1Score,
            p2Score: session.p2Score,
            finalScore: session.finalScore,
            rounds: session.rounds,
            createdAt: session.createdAt,
          }
        : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3b. GET /api/photos/recent - List recent photos for mobile app quick-select/testing
app.get("/api/photos/recent", (req, res) => {
  try {
    const photos = db.listRecentPhotos(20);
    const host = req.get("host") || `localhost:${PORT}`;
    const protocol = req.protocol || "http";

    res.json({
      success: true,
      photos: photos.map((p) => ({
        id: p.id,
        plainToken: p.plainToken,
        createdAt: p.createdAt,
        expiresAt: p.expiresAt,
        previewUrl: `${protocol}://${host}/uploads/${p.storageKey}`,
        claimUrl: `${protocol}://${host}/claim/${p.plainToken}`,
        emojiPhotosCount: p.emojiPhotos?.length || 0,
        session: p.session
          ? {
              mode: p.session.mode,
              playerName: p.session.playerName,
              p1Score: p.session.p1Score,
              p2Score: p.session.p2Score,
              finalScore: p.session.finalScore,
            }
          : null,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. POST /api/photos/token/:token/recipients - Register mobile claimant
app.post("/api/photos/token/:token/recipients", (req, res) => {
  try {
    const token = req.params.token;
    const { name, mobile, email } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!mobile || !mobile.trim()) {
      return res.status(400).json({ error: "Mobile number is required" });
    }

    const photo = db.getPhotoByToken(token);
    if (!photo) {
      return res.status(404).json({ error: "Invalid or expired token" });
    }

    const recipient = db.addRecipient({
      photoId: photo.id,
      name: name.trim(),
      mobile: mobile.trim(),
      email: email ? email.trim() : undefined,
    });

    const host = req.get("host") || `localhost:${PORT}`;
    const protocol = req.protocol || "http";

    res.json({
      success: true,
      recipientId: recipient.id,
      downloadUrl: `${protocol}://${host}/api/photos/token/${token}/download?recipientId=${recipient.id}`,
      downloadAllUrl: `${protocol}://${host}/api/photos/token/${token}/download-all?recipientId=${recipient.id}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. GET /api/photos/token/:token/download - Authorize and stream pose photo download
app.get("/api/photos/token/:token/download", (req, res) => {
  try {
    const token = req.params.token;
    const recipientId = req.query.recipientId as string;

    const photo = db.getPhotoByToken(token);
    if (!photo) {
      return res.status(404).send("Download link expired or invalid.");
    }

    const filePath = path.join(UPLOADS_DIR, photo.storageKey);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("File not found on server.");
    }

    if (recipientId) {
      db.markDownloaded(recipientId);
    }

    res.setHeader("Content-Disposition", 'attachment; filename="emoji-face-challenge-souvenir.jpg"');
    res.setHeader("Content-Type", "image/jpeg");
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err: any) {
    res.status(500).send("Error streaming photo download: " + err.message);
  }
});

// 6. GET /api/photos/token/:token/download-all - Stream ZIP bundle of pose card + all emoji snapshots
app.get("/api/photos/token/:token/download-all", async (req, res) => {
  try {
    const token = req.params.token;
    const recipientId = req.query.recipientId as string;

    const photo = db.getPhotoByToken(token);
    if (!photo) {
      return res.status(404).send("Download link expired or invalid.");
    }

    const zip = new JSZip();

    // 1. Add main souvenir pose photo
    const mainPath = path.join(UPLOADS_DIR, photo.storageKey);
    if (fs.existsSync(mainPath)) {
      zip.file("01_Official_Souvenir_Pose_Card.jpg", fs.readFileSync(mainPath));
    }

    // 2. Add candid emoji action photos
    const emojiPhotos = photo.emojiPhotos || [];
    emojiPhotos.forEach((ep, idx) => {
      const epPath = path.join(UPLOADS_DIR, ep.storageKey);
      if (fs.existsSync(epPath)) {
        const cleanName = ep.name.replace(/[^a-zA-Z0-9]/g, "_");
        const num = String(idx + 2).padStart(2, "0");
        zip.file(`${num}_Emoji_${cleanName}_${ep.score}pts.jpg`, fs.readFileSync(epPath));
      }
    });

    // 3. Add certificate text
    const certText = `=====================================================
✨ EMOJI FACE CHALLENGE - OFFICIAL SOUVENIR PACKAGE ✨
=====================================================

Player Name: ${photo.playerName || "Challenger"}
Token: ${token}
Total Photos in Bundle: ${1 + emojiPhotos.length}

Thank you for playing at our event!
Share your photos on WhatsApp & Instagram!
=====================================================`;

    zip.file("Souvenir_Certificate.txt", certText);

    if (recipientId) {
      db.markDownloaded(recipientId);
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    res.setHeader("Content-Disposition", 'attachment; filename="emoji-face-challenge-all-photos.zip"');
    res.setHeader("Content-Type", "application/zip");
    res.send(zipBuffer);
  } catch (err: any) {
    res.status(500).send("Error generating zip bundle: " + err.message);
  }
});

// 7. GET /api/photos/token/:token/emoji/:idx - Download single emoji photo
app.get("/api/photos/token/:token/emoji/:idx", (req, res) => {
  try {
    const token = req.params.token;
    const idx = parseInt(req.params.idx, 10);

    const photo = db.getPhotoByToken(token);
    if (!photo || !photo.emojiPhotos || !photo.emojiPhotos[idx]) {
      return res.status(404).send("Emoji photo not found.");
    }

    const ep = photo.emojiPhotos[idx];
    const filePath = path.join(UPLOADS_DIR, ep.storageKey);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("File not found on server.");
    }

    res.setHeader("Content-Disposition", `attachment; filename="emoji-${idx + 1}.jpg"`);
    res.setHeader("Content-Type", "image/jpeg");
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err: any) {
    res.status(500).send("Error downloading emoji photo: " + err.message);
  }
});

// 8. GET /api/admin/recipients/export - Export all event leads as CSV for organizer
app.get("/api/admin/recipients/export", (_req, res) => {
  try {
    const leads = db.listRecipients(1000);
    let csv = "ID,Name,Mobile,Email,PhotoID,DownloadedAt,CreatedAt\n";
    leads.forEach((l) => {
      csv += `"${l.id}","${l.name}","${l.mobile}","${l.email || ""}","${l.photoId}","${l.downloadedAt || ""}","${l.createdAt}"\n`;
    });
    res.setHeader("Content-Disposition", 'attachment; filename="event_leads.csv"');
    res.setHeader("Content-Type", "text/csv");
    res.send(csv);
  } catch (err: any) {
    res.status(500).send("Error exporting leads: " + err.message);
  }
});

// 9. Interactive Mobile Claim Page for QR code scanners (/claim/:token & /photo/:token)
app.get(["/claim/:token", "/photo/:token"], (req, res) => {
  const token = req.params.token;
  const photo = db.getPhotoByToken(token);
  const host = req.get("host") || `localhost:${PORT}`;
  const protocol = req.protocol || "http";

  if (!photo) {
    return res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Photo Expired | Emoji Face Challenge</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; }
    .card { background: #1e293b; border: 2px solid #334155; border-radius: 20px; padding: 36px 24px; max-width: 420px; width: 100%; }
    h1 { font-size: 22px; margin-bottom: 10px; }
    p { color: #94a3b8; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size: 56px; margin-bottom: 12px;">⌛</div>
    <h1>Photo Expired or Not Found</h1>
    <p>This claim QR link is expired or invalid. Step up to the event kiosk to take a new challenge!</p>
  </div>
</body>
</html>`);
  }

  const session = db.getSession(photo.sessionId);
  const previewUrl = `${protocol}://${host}/uploads/${photo.storageKey}`;
  const finalScore = session ? session.finalScore : 0;
  const playerName = photo.playerName || session?.playerName || "Challenger";
  const modeText = session?.mode === "two" ? "2-Player Battle" : "1-Player Solo";
  const stars = finalScore >= 700 ? "★★★★★" : finalScore >= 500 ? "★★★★☆" : "★★★☆☆";
  const emojiPhotos = photo.emojiPhotos || [];

  const emojiCardsHtml = emojiPhotos
    .map(
      (ep) => `
    <div class="emoji-snap-item">
      <img src="${protocol}://${host}/uploads/${ep.storageKey}" alt="${ep.name}" class="emoji-snap-img" />
      <div class="emoji-snap-badge">
        <span>${ep.emoji} ${ep.name}</span>
        <span class="emoji-snap-score">★ ${ep.score}</span>
      </div>
    </div>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Claim Your Photos | Emoji Face Challenge</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #090d16 0%, #111827 50%, #1e1b4b 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 16px 40px;
    }
    .container { width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 16px; }
    .header { text-align: center; padding: 12px 0 8px; }
    .brand-pill {
      display: inline-block;
      background: linear-gradient(90deg, #f59e0b, #ec4899);
      color: #ffffff;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.08em;
      padding: 5px 14px;
      border-radius: 9999px;
      text-transform: uppercase;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35);
      margin-bottom: 8px;
    }
    .title { font-size: 26px; font-weight: 900; color: #ffffff; }
    .subtitle { font-size: 13px; color: #94a3b8; margin-top: 4px; }
    .card {
      background: rgba(30, 41, 59, 0.75);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      padding: 18px;
      box-shadow: 0 16px 32px rgba(0, 0, 0, 0.45);
    }
    .photo-preview-wrap {
      position: relative;
      border-radius: 14px;
      overflow: hidden;
      border: 2px solid rgba(255, 255, 255, 0.15);
      background: #000;
    }
    .photo-img { width: 100%; height: auto; display: block; }
    .photo-badge {
      position: absolute;
      bottom: 12px;
      left: 12px;
      right: 12px;
      background: rgba(15, 23, 42, 0.92);
      border-radius: 10px;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .badge-score { font-size: 20px; font-weight: 900; color: #fbbf24; }
    .badge-stars { font-size: 16px; color: #f59e0b; letter-spacing: 2px; }
    .emoji-section-title {
      font-size: 16px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
    }
    .emoji-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .emoji-snap-item {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      border: 1.5px solid rgba(255, 255, 255, 0.18);
      background: #0f172a;
      aspect-ratio: 1;
    }
    .emoji-snap-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .emoji-snap-badge {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(15, 23, 42, 0.88);
      padding: 6px 8px;
      font-size: 11px;
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      font-weight: 800;
    }
    .emoji-snap-score { color: #fbbf24; }
    .form-title { font-size: 18px; font-weight: 800; color: #ffffff; margin-bottom: 4px; }
    .form-desc { font-size: 13px; color: #94a3b8; margin-bottom: 16px; }
    .form-group { margin-bottom: 12px; }
    .form-label { display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px; }
    .form-input {
      width: 100%;
      background: rgba(15, 23, 42, 0.85);
      border: 1.5px solid #334155;
      border-radius: 10px;
      padding: 13px 14px;
      color: #ffffff;
      font-size: 15px;
      font-weight: 600;
      outline: none;
    }
    .submit-btn {
      width: 100%;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      border: none;
      border-radius: 12px;
      padding: 16px;
      font-size: 16px;
      font-weight: 900;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
      margin-top: 8px;
    }
    .btn-zip {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);
    }
    .btn-whatsapp {
      background: #25d366;
      color: #ffffff;
      border-radius: 12px;
      padding: 14px;
      font-size: 15px;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      text-decoration: none;
      width: 100%;
      box-shadow: 0 4px 12px rgba(37, 211, 102, 0.35);
      margin-top: 10px;
    }
    .success-card { display: none; text-align: center; padding: 24px 16px; }
    .footer { text-align: center; font-size: 11px; color: #64748b; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <span class="brand-pill">✨ OFFICIAL EVENT SOUVENIR</span>
      <h1 class="title">Emoji Face Challenge</h1>
      <p class="subtitle">Challenger: <b>${playerName}</b> • Score: <b>${finalScore} PTS</b></p>
    </header>

    <div class="card">
      <div class="photo-preview-wrap">
        <img src="${previewUrl}" alt="Souvenir Photograph" class="photo-img" />
        <div class="photo-badge">
          <div>
            <div class="badge-score">${finalScore} PTS</div>
            <div style="font-size: 11px; color: #94a3b8; font-weight: 600;">${modeText} • ${playerName}</div>
          </div>
          <div class="badge-stars">${stars}</div>
        </div>
      </div>
    </div>

    ${
      emojiPhotos.length > 0
        ? `
    <div class="card">
      <div class="emoji-section-title">
        <span>🎭 Your Emoji Change Photos (${emojiPhotos.length})</span>
        <span style="font-size: 11px; color: #94a3b8; font-weight: 600;">Candid expressions</span>
      </div>
      <div class="emoji-grid">
        ${emojiCardsHtml}
      </div>
    </div>`
        : ""
    }

    <div class="card" id="formCard">
      <h2 class="form-title">📥 Save & Unlock All Your Photos</h2>
      <p class="form-desc">Fill in your contact details to immediately download all your event photos (Pose card & emoji snaps).</p>

      <form id="claimForm">
        <div class="form-group">
          <label class="form-label" for="userName">Full Name *</label>
          <input type="text" id="userName" name="name" class="form-input" value="${playerName !== "Challenger" ? playerName : ""}" placeholder="e.g. Rahul Sharma" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="userMobile">Mobile Number (WhatsApp) *</label>
          <input type="tel" id="userMobile" name="mobile" class="form-input" placeholder="e.g. 9876543210" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="userEmail">Email Address *</label>
          <input type="email" id="userEmail" name="email" class="form-input" placeholder="e.g. rahul@example.com" required />
        </div>
        <button type="submit" class="submit-btn" id="submitBtn">
          <span>🔓 UNLOCK & DOWNLOAD ALL PHOTOS</span>
        </button>
      </form>
    </div>

    <div class="card success-card" id="successCard">
      <div style="font-size: 54px; margin-bottom: 12px;">🎉</div>
      <h2 style="font-size: 22px; font-weight: 900; color: #10b981; margin-bottom: 6px;">Photos Unlocked & Ready!</h2>
      <p style="font-size: 14px; color: #cbd5e1; margin-bottom: 20px;" id="successMsg">
        Thank you for playing the Emoji Face Challenge! Your photos are downloading now.
      </p>

      <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
        <a id="downloadAllLink" href="#" class="submit-btn btn-zip" style="text-decoration: none;">
          📦 Download All Photos (ZIP Bundle)
        </a>
        <a id="downloadPoseLink" href="#" class="submit-btn" style="text-decoration: none;">
          📸 Download Pose Card (HD)
        </a>
        <a id="whatsappShareBtn" href="#" target="_blank" class="btn-whatsapp">
          💬 Share Score on WhatsApp
        </a>
      </div>
    </div>

    <footer class="footer">Powered by Emoji Face Challenge • Secure Event Souvenir Portal</footer>
  </div>

  <script>
    const form = document.getElementById("claimForm");
    const submitBtn = document.getElementById("submitBtn");
    const formCard = document.getElementById("formCard");
    const successCard = document.getElementById("successCard");
    const successMsg = document.getElementById("successMsg");
    const downloadAllLink = document.getElementById("downloadAllLink");
    const downloadPoseLink = document.getElementById("downloadPoseLink");
    const whatsappShareBtn = document.getElementById("whatsappShareBtn");

    const token = "${token}";
    const finalScore = ${finalScore};

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("userName").value.trim();
      const mobile = document.getElementById("userMobile").value.trim();
      const email = document.getElementById("userEmail").value.trim();

      if (!name || !mobile || !email) {
        alert("Please fill in all required fields (Name, Mobile, Email).");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = "<span>⏳ Registering details & preparing download...</span>";

      try {
        const res = await fetch("/api/photos/token/" + encodeURIComponent(token) + "/recipients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, mobile, email })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || errData.error || "Failed to register details");
        }

        const data = await res.json();
        const recipientId = data.recipientId || "";
        const downloadPoseUrl = "/api/photos/token/" + encodeURIComponent(token) + "/download" + (recipientId ? "?recipientId=" + recipientId : "");
        const downloadAllUrl = "/api/photos/token/" + encodeURIComponent(token) + "/download-all" + (recipientId ? "?recipientId=" + recipientId : "");

        successMsg.innerHTML = "Awesome, <b>" + name + "</b>! Your photos are ready below.";
        downloadPoseLink.href = downloadPoseUrl;
        downloadAllLink.href = downloadAllUrl;

        const shareText = encodeURIComponent(
          "I scored " + finalScore + " PTS in the Emoji Face Challenge! Check out my official souvenir photo: " + window.location.href
        );
        whatsappShareBtn.href = "https://api.whatsapp.com/send?text=" + shareText;

        formCard.style.display = "none";
        successCard.style.display = "block";

        const dlLink = document.createElement("a");
        dlLink.href = downloadAllUrl;
        dlLink.download = "emoji-face-challenge-" + name.replace(/\\s+/g, "_") + "-photos.zip";
        document.body.appendChild(dlLink);
        dlLink.click();
        document.body.removeChild(dlLink);
      } catch (err) {
        alert("Error: " + err.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = "<span>🔓 UNLOCK & DOWNLOAD ALL PHOTOS</span>";
      }
    });
  </script>
</body>
</html>`;

  res.send(html);
});

app.listen(PORT, () => {
  console.log(`Backend API running on http://127.0.0.1:${PORT}`);
});
