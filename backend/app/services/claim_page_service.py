from typing import Optional, Dict, Any


def render_claim_html(
    token: str,
    photo: Optional[Dict[str, Any]],
    session: Optional[Dict[str, Any]],
    preview_url: str,
    host: str,
    scheme: str = "http"
) -> str:
    """
    Renders a stunning, mobile-responsive event claim & lead capture page.
    When users scan the QR code on their phone, they land here, see previews of their
    Branded Souvenir Pose Card and candid Emoji Change photos, enter Name, Mobile, and Email,
    and download all high-resolution photographs.
    """
    if not photo:
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Photo Expired | Emoji Face Challenge</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }}
    .card {{ background: #1e293b; border: 2px solid #334155; border-radius: 20px; padding: 36px 28px; text-align: center; max-width: 440px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }}
    .icon {{ font-size: 64px; margin-bottom: 16px; display: block; }}
    h1 {{ font-size: 24px; font-weight: 800; margin-bottom: 12px; color: #f8fafc; }}
    p {{ color: #94a3b8; font-size: 15px; line-height: 1.5; }}
  </style>
</head>
<body>
  <div class="card">
    <span class="icon">⌛</span>
    <h1>Photo Expired or Not Found</h1>
    <p>This QR code link has expired or is invalid. Please visit the event kiosk to take a new challenge!</p>
  </div>
</body>
</html>"""

    # Extract session metrics
    mode_text = "Single Player"
    final_score = 0
    player_name = "Challenger"
    rounds_summary = ""
    if session:
        mode = session.get("mode", "single")
        mode_text = "1-Player Solo" if mode == "single" else "2-Player Battle"
        final_score = int(session.get("finalScore", session.get("p1Score", 0)))
        player_name = session.get("playerName", "Challenger")
        rounds = session.get("rounds", [])
        if rounds:
            rounds_summary = " • ".join([f"R{i+1}: {r.get('score', 0)} pts" for i, r in enumerate(rounds)])

    stars = "★★★★★" if final_score >= 700 else "★★★★☆" if final_score >= 500 else "★★★☆☆"
    emoji_photos = photo.get("emojiPhotos", [])
    has_emoji_photos = len(emoji_photos) > 0

    # Render emoji photo cards HTML
    emoji_cards_html = ""
    for idx, ep in enumerate(emoji_photos):
        ep_preview = ep.get("previewUrl", f"/uploads/{ep.get('storageKey', '')}")
        ep_emoji = ep.get("emoji", "😀")
        ep_name = ep.get("name", "Emoji")
        ep_score = ep.get("score", 0)
        emoji_cards_html += f"""
        <div class="emoji-snap-item">
          <img src="{ep_preview}" alt="{ep_name}" class="emoji-snap-img" />
          <div class="emoji-snap-badge">
            <span>{ep_emoji} {ep_name}</span>
            <span class="emoji-snap-score">★ {ep_score}</span>
          </div>
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Claim Your Photos | Emoji Face Challenge</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      background: linear-gradient(135deg, #090d16 0%, #111827 50%, #1e1b4b 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 16px 40px;
    }}

    .container {{
      width: 100%;
      max-width: 480px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }}

    /* Header */
    .header {{
      text-align: center;
      padding: 12px 0 8px;
    }}
    .brand-pill {{
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
    }}
    .title {{
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.02em;
      color: #ffffff;
      text-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }}
    .subtitle {{
      font-size: 13px;
      color: #94a3b8;
      margin-top: 4px;
    }}

    /* Card styling */
    .card {{
      background: rgba(30, 41, 59, 0.75);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      padding: 18px;
      box-shadow: 0 16px 32px rgba(0, 0, 0, 0.45);
    }}

    /* Photo Frame Preview */
    .photo-preview-wrap {{
      position: relative;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
      border: 2px solid rgba(255, 255, 255, 0.15);
      background: #000;
    }}
    .photo-img {{
      width: 100%;
      height: auto;
      display: block;
      transition: transform 0.3s ease;
    }}
    .photo-badge {{
      position: absolute;
      bottom: 12px;
      left: 12px;
      right: 12px;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }}
    .badge-score {{
      font-size: 20px;
      font-weight: 900;
      color: #fbbf24;
    }}
    .badge-stars {{
      font-size: 16px;
      color: #f59e0b;
      letter-spacing: 2px;
    }}

    /* Emoji Action Photos Section */
    .emoji-section-title {{
      font-size: 16px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }}
    .emoji-grid {{
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }}
    .emoji-snap-item {{
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      border: 1.5px solid rgba(255, 255, 255, 0.18);
      background: #0f172a;
      aspect-ratio: 1;
    }}
    .emoji-snap-img {{
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }}
    .emoji-snap-badge {{
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
      align-items: center;
      font-weight: 800;
    }}
    .emoji-snap-score {{
      color: #fbbf24;
    }}

    /* Form Section */
    .form-title {{
      font-size: 18px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }}
    .form-desc {{
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 16px;
    }}
    .form-group {{
      margin-bottom: 12px;
    }}
    .form-label {{
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: #cbd5e1;
      margin-bottom: 6px;
      letter-spacing: 0.02em;
    }}
    .form-input {{
      width: 100%;
      background: rgba(15, 23, 42, 0.85);
      border: 1.5px solid #334155;
      border-radius: 10px;
      padding: 13px 14px;
      color: #ffffff;
      font-size: 15px;
      font-weight: 600;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }}
    .form-input:focus {{
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
    }}
    .form-input::placeholder {{
      color: #64748b;
      font-weight: 400;
    }}

    /* Buttons */
    .submit-btn {{
      width: 100%;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      border: none;
      border-radius: 12px;
      padding: 16px;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.02em;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
      margin-top: 8px;
      transition: transform 0.15s, box-shadow 0.15s;
    }}
    .submit-btn:active {{
      transform: scale(0.98);
    }}
    .submit-btn:disabled {{
      opacity: 0.6;
      cursor: not-allowed;
    }}

    .btn-zip {{
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);
    }}

    /* Success Card */
    .success-card {{
      display: none;
      text-align: center;
      padding: 24px 16px;
    }}
    .success-icon {{
      font-size: 54px;
      margin-bottom: 12px;
      display: inline-block;
      animation: pop 0.4s ease-out;
    }}
    @keyframes pop {{
      0% {{ transform: scale(0.4); }}
      80% {{ transform: scale(1.15); }}
      100% {{ transform: scale(1); }}
    }}
    .success-title {{
      font-size: 22px;
      font-weight: 900;
      color: #10b981;
      margin-bottom: 6px;
    }}
    .success-subtitle {{
      font-size: 14px;
      color: #cbd5e1;
      margin-bottom: 20px;
    }}
    .btn-whatsapp {{
      background: #25d366;
      color: #ffffff;
      border: none;
      border-radius: 12px;
      padding: 14px 20px;
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
    }}

    .footer {{
      text-align: center;
      font-size: 11px;
      color: #64748b;
      margin-top: 8px;
    }}
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header class="header">
      <span class="brand-pill">✨ OFFICIAL EVENT SOUVENIR</span>
      <h1 class="title">Emoji Face Challenge</h1>
      <p class="subtitle">Challenger: <b>{player_name}</b> • Score: <b>{final_score} PTS</b></p>
    </header>

    <!-- Main Souvenir Pose Card Preview -->
    <div class="card">
      <div class="photo-preview-wrap">
        <img src="{preview_url}" alt="Your Souvenir Photograph" class="photo-img" id="souvenirImg" />
        <div class="photo-badge">
          <div>
            <div class="badge-score">{final_score} PTS</div>
            <div style="font-size: 11px; color: #94a3b8; font-weight: 600;">{mode_text} • {player_name}</div>
          </div>
          <div class="badge-stars">{stars}</div>
        </div>
      </div>
    </div>

    <!-- Candid Emoji Change Photos Preview -->
    {f'''
    <div class="card">
      <div class="emoji-section-title">
        <span>🎭 Your Emoji Change Photos ({len(emoji_photos)})</span>
        <span style="font-size: 11px; color: #94a3b8; font-weight: 600;">Candid expressions</span>
      </div>
      <div class="emoji-grid">
        {emoji_cards_html}
      </div>
    </div>
    ''' if has_emoji_photos else ''}

    <!-- Lead Capture Form Card -->
    <div class="card" id="formCard">
      <h2 class="form-title">📥 Save & Unlock All Your Photos</h2>
      <p class="form-desc">Fill in your contact details to immediately download all your event photos (Pose card & emoji snaps).</p>

      <form id="claimForm">
        <div class="form-group">
          <label class="form-label" for="userName">Full Name *</label>
          <input
            type="text"
            id="userName"
            name="name"
            class="form-input"
            value="{player_name if player_name != 'Challenger' else ''}"
            placeholder="e.g. Rahul Sharma"
            required
            autocomplete="name"
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="userMobile">Mobile Number (WhatsApp) *</label>
          <input
            type="tel"
            id="userMobile"
            name="mobile"
            class="form-input"
            placeholder="e.g. 9876543210"
            required
            autocomplete="tel"
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="userEmail">Email Address *</label>
          <input
            type="email"
            id="userEmail"
            name="email"
            class="form-input"
            placeholder="e.g. rahul@example.com"
            required
            autocomplete="email"
          />
        </div>

        <button type="submit" class="submit-btn" id="submitBtn">
          <span>🔓 UNLOCK & DOWNLOAD ALL PHOTOS</span>
        </button>
      </form>
    </div>

    <!-- Success Celebration Card (revealed upon claim) -->
    <div class="card success-card" id="successCard">
      <span class="success-icon">🎉</span>
      <h2 class="success-title">Photos Unlocked & Ready!</h2>
      <p class="success-subtitle" id="successMsg">
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

    <footer class="footer">
      Powered by Emoji Face Challenge • Secure Event Souvenir Portal
    </footer>
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

    const token = "{token}";
    const finalScore = {final_score};

    form.addEventListener("submit", async (e) => {{
      e.preventDefault();

      const name = document.getElementById("userName").value.trim();
      const mobile = document.getElementById("userMobile").value.trim();
      const email = document.getElementById("userEmail").value.trim();

      if (!name || !mobile || !email) {{
        alert("Please fill in all required fields (Name, Mobile, Email).");
        return;
      }}

      submitBtn.disabled = true;
      submitBtn.innerHTML = "<span>⏳ Registering details & preparing download...</span>";

      try {{
        const res = await fetch("/api/photos/token/" + encodeURIComponent(token) + "/recipients", {{
          method: "POST",
          headers: {{ "Content-Type": "application/json" }},
          body: JSON.stringify({{ name, mobile, email }})
        }});

        if (!res.ok) {{
          const errData = await res.json().catch(() => ({{}}));
          throw new Error(errData.detail || errData.error || "Failed to register details");
        }}

        const data = await res.json();
        const recipientId = data.recipientId || "";
        const downloadPoseUrl = "/api/photos/token/" + encodeURIComponent(token) + "/download" + (recipientId ? "?recipientId=" + recipientId : "");
        const downloadAllUrl = "/api/photos/token/" + encodeURIComponent(token) + "/download-all" + (recipientId ? "?recipientId=" + recipientId : "");

        // Set up post-claim screen
        successMsg.innerHTML = "Awesome, <b>" + name + "</b>! Your photos are ready below.";
        downloadPoseLink.href = downloadPoseUrl;
        downloadAllLink.href = downloadAllUrl;

        // WhatsApp Share link
        const shareText = encodeURIComponent(
          "I scored " + finalScore + " PTS in the Emoji Face Challenge! Check out my official souvenir photo: " + window.location.href
        );
        whatsappShareBtn.href = "https://api.whatsapp.com/send?text=" + shareText;

        formCard.style.display = "none";
        successCard.style.display = "block";

        // Trigger automatic ZIP download
        const dlLink = document.createElement("a");
        dlLink.href = downloadAllUrl;
        dlLink.download = "emoji-face-challenge-" + name.replace(/\\s+/g, "_") + "-photos.zip";
        document.body.appendChild(dlLink);
        dlLink.click();
        document.body.removeChild(dlLink);

      }} catch (err) {{
        alert("Error: " + err.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = "<span>🔓 UNLOCK & DOWNLOAD ALL PHOTOS</span>";
      }}
    }});
  </script>
</body>
</html>"""
