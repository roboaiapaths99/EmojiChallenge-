import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { PhotoCompositionResult } from "../photo/photoCompositor";
import type { SessionUploadResult } from "../api/eventApi";
import type { EmojiSnapshot } from "../photo/emojiSnapshotCapture";
import "./QRScreen.css";

interface QRScreenProps {
  photo: PhotoCompositionResult;
  uploadInfo?: SessionUploadResult;
  emojiPhotos?: EmojiSnapshot[];
  playerName?: string;
  finalScore?: number;
  onDone: () => void;
}

export const QRScreen: React.FC<QRScreenProps> = ({
  photo,
  uploadInfo,
  emojiPhotos = [],
  playerName = "",
  finalScore = 0,
  onDone,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(45);
  const [copied, setCopied] = useState<boolean>(false);

  // Use the backend generated claim URL or fallback to real public live domain
  const effectiveClaimUrl = (() => {
    if (uploadInfo?.claimUrl && !uploadInfo.claimUrl.includes("localhost") && !uploadInfo.claimUrl.includes("127.0.0.1")) {
      return uploadInfo.claimUrl;
    }
    const token = uploadInfo?.token || "preview";
    return `https://api.emojichallenge.technula.com/claim/${token}`;
  })();

  useEffect(() => {
    // 1. Fetch free public QR code generator API
    const freeQrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=8&data=${encodeURIComponent(
      effectiveClaimUrl
    )}`;

    const img = new Image();
    img.onload = () => {
      setQrDataUrl(freeQrApiUrl);
    };
    img.onerror = () => {
      // Offline fallback: Generate local QR code
      QRCode.toDataURL(effectiveClaimUrl, {
        width: 420,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#FFFFFF",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("QR generation error:", err));
    };
    img.src = freeQrApiUrl;
  }, [effectiveClaimUrl]);

  // Timeout auto-reset (45s)
  useEffect(() => {
    if (secondsRemaining <= 0) {
      onDone();
      return;
    }

    const timer = window.setTimeout(() => {
      setSecondsRemaining((s) => s - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [secondsRemaining, onDone]);

  return (
    <div className="qr-page">
      <header className="qr-header">
        <div className="header-left">
          <span className="brand-tag">✨ SOUVENIR {playerName ? `FOR ${playerName.toUpperCase()}` : ""} • {finalScore} PTS</span>
          <h2>ALL YOUR PHOTOS ARE READY!</h2>
        </div>
        <div className="header-right">
          <span className="timeout-pill">Auto-reset in {secondsRemaining}s</span>
          <button className="done-header-btn" onClick={onDone}>
            NEXT PLAYER →
          </button>
        </div>
      </header>

      <main className="qr-main">
        {/* Left: Branded Souvenir Photo Card + Candid Emoji Photos Strip Preview */}
        <section className="photo-preview-panel">
          <div className="photo-frame-wrap">
            <img
              src={photo.dataUrl}
              alt="Official Souvenir Photograph Card"
              className="composed-card-img"
            />
          </div>

          {/* Candid Emoji Change Action Photos Gallery Preview (View-only on kiosk display) */}
          {emojiPhotos.length > 0 && (
            <div
              style={{
                width: "100%",
                maxWidth: "460px",
                background: "var(--surface)",
                border: "2px solid var(--line-strong)",
                borderRadius: "16px",
                padding: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 900, color: "var(--ink)" }}>
                  🎭 EMOJI CANDID MOMENTS ({emojiPhotos.length})
                </span>
                <span style={{ fontSize: "11px", color: "var(--ink-2)", fontWeight: 700 }}>
                  📱 Scan QR on right to download
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "8px",
                  maxHeight: "120px",
                  overflowY: "auto",
                }}
              >
                {emojiPhotos.map((snap) => (
                  <div
                    key={snap.id}
                    style={{
                      position: "relative",
                      borderRadius: "10px",
                      overflow: "hidden",
                      border: "1.5px solid var(--line-strong)",
                      aspectRatio: "1",
                      background: "#000",
                    }}
                  >
                    <img
                      src={snap.dataUrl}
                      alt={snap.emojiName}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: "rgba(0,0,0,0.75)",
                        fontSize: "9px",
                        padding: "2px 4px",
                        display: "flex",
                        justifyContent: "space-between",
                        color: "#fff",
                        fontWeight: 900,
                      }}
                    >
                      <span>{snap.emoji}</span>
                      <span style={{ color: "var(--good)" }}>{snap.score}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right: Mobile QR Scan Hero Panel (Downloads happen on the web portal) */}
        <section className="qr-claim-options-panel">
          <div className="claim-card qr-highlight-card" style={{ padding: "28px 24px" }}>
            <div className="qr-card-header">
              <span className="qr-icon-tag" style={{ background: "#10b981", color: "#ffffff", padding: "6px 16px", fontSize: "13px" }}>
                📲 SCAN WITH YOUR PHONE CAMERA
              </span>
              <h3 style={{ fontSize: "22px", marginTop: "12px", marginBottom: "6px" }}>
                CLAIM & DOWNLOAD ON YOUR PHONE
              </h3>
              <p style={{ fontSize: "14px", maxWidth: "380px", margin: "0 auto 16px auto", lineHeight: 1.4 }}>
                Scan the QR code to open your secure souvenir page on the web. Enter your name & mobile to download your official HD souvenir card and complete ZIP photo package!
              </p>
            </div>

            <div
              className="qr-img-wrapper"
              style={{
                width: "220px",
                height: "220px",
                padding: "10px",
                boxShadow: "0 8px 24px rgba(16, 185, 129, 0.25)",
                border: "4px solid #10b981",
              }}
            >
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code to claim photo" className="rendered-qr-img" />
              ) : (
                <div className="qr-skeleton" />
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "var(--surface-alt)",
                border: "1px solid var(--line-strong)",
                padding: "8px 14px",
                borderRadius: "10px",
                fontSize: "12px",
                color: "var(--ink-2)",
                maxWidth: "380px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginTop: "12px",
                marginBottom: "12px",
              }}
            >
              <span>🔗</span>
              <span style={{ fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis" }}>
                {effectiveClaimUrl}
              </span>
            </div>

            <div className="claim-actions-row" style={{ display: "flex", gap: "12px", width: "100%", justifyContent: "center" }}>
              <a
                href={effectiveClaimUrl}
                target="_blank"
                rel="noreferrer"
                className="open-link-pill"
                style={{
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#ffffff",
                  padding: "10px 20px",
                  borderRadius: "999px",
                  fontWeight: 900,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                }}
              >
                🌐 Open Claim Web Page ↗
              </a>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(effectiveClaimUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="copy-link-pill"
                style={{
                  background: "var(--surface)",
                  color: "var(--ink)",
                  border: "2px solid var(--line-strong)",
                  padding: "10px 18px",
                  borderRadius: "999px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {copied ? "✓ Copied" : "📋 Copy Web Link"}
              </button>
            </div>

            <div
              style={{
                marginTop: "20px",
                padding: "10px 16px",
                background: "rgba(16, 185, 129, 0.08)",
                borderRadius: "10px",
                border: "1px dashed #10b981",
                fontSize: "12px",
                color: "#10b981",
                fontWeight: 700,
              }}
            >
              🔒 Private & Encrypted • Photos download straight to your phone browser
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default QRScreen;
