// Real API client for Event App communicating with backend on port 3001
export interface SessionUploadResult {
  photoId: string;
  token: string;
  claimUrl: string;
  previewUrl: string;
  emojiPhotosCount?: number;
}

export interface PlayerAuthData {
  mobile: string;
  name: string;
  email?: string;
  verified?: boolean;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");


/**
 * Send real OTP to player's mobile number via backend or direct MetaReach SMS gateway fallback
 */
export async function sendOtp(
  mobile: string,
  playerLabel: string = "Player"
): Promise<{ success: boolean; message: string }> {
  const cleanMobile = mobile.replace(/\D/g, "").slice(-10);
  if (cleanMobile.length !== 10) {
    return { success: false, message: "Please enter a valid 10-digit mobile number" };
  }

  // 1. Primary: backend API (handles server-to-server MetaReach SMS gateway with valid DLT template)
  try {
    const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: cleanMobile, playerLabel }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: data.success,
        message: data.message || `OTP sent to +91 ${cleanMobile}. Check your phone SMS.`,
      };
    } else {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        message: errData.message || errData.detail || "SMS Gateway could not send OTP. Please check mobile number.",
      };
    }
  } catch (err: any) {
    console.error("Backend /api/auth/send-otp error:", err);
    return {
      success: false,
      message: "Connection error: Could not reach SMS server. Ensure backend is running.",
    };
  }
}

/**
 * Verify OTP entered by player
 */
export async function verifyOtp(
  mobile: string,
  otp: string,
  playerName?: string,
  email?: string
): Promise<{ success: boolean; message: string; player?: PlayerAuthData }> {
  const cleanMobile = mobile.replace(/\D/g, "").slice(-10);
  const cleanOtp = otp.trim();
  const cleanEmail = email?.trim() || undefined;

  // 1. Primary: backend API
  try {
    const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: cleanMobile, otp: cleanOtp, playerName, email: cleanEmail }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        message: data.message || "Mobile verified successfully!",
        player: data.player,
      };
    } else {
      const errData = await res.json().catch(() => ({ detail: "Invalid OTP" }));
      return { success: false, message: errData.detail || "Invalid OTP code" };
    }
  } catch (err) {
    console.warn("Backend /api/auth/verify-otp error, checking client fallback store:", err);
  }

  // 2. Client fallback verification
  const stored = sessionStorage.getItem(`otp_${cleanMobile}`);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Date.now() > parsed.expiresAt) {
        sessionStorage.removeItem(`otp_${cleanMobile}`);
        return { success: false, message: "OTP has expired. Please request a new one." };
      }
      if (parsed.otp === cleanOtp) {
        sessionStorage.removeItem(`otp_${cleanMobile}`);
        return {
          success: true,
          message: "Mobile verified successfully!",
          player: {
            mobile: cleanMobile,
            name: playerName || `Player-${cleanMobile.slice(-4)}`,
            email: cleanEmail,
            verified: true,
          },
        };
      }
    } catch (e) {
      // ignore
    }
  }

  return { success: false, message: "Incorrect OTP code. Please try again." };
}

export async function submitGameSessionAndPhoto(params: {
  sessionId: string;
  mode: "single" | "two";
  p1Score: number;
  p2Score: number;
  finalScore: number;
  rounds: any[];
  playerName?: string;
  players?: PlayerAuthData[];
  photoBlob: Blob;
  emojiPhotos?: Array<{
    emoji: string;
    name: string;
    roundName?: string;
    score: number;
    blob: Blob;
  }>;
}): Promise<SessionUploadResult> {
  const {
    sessionId,
    mode,
    p1Score,
    p2Score,
    finalScore,
    rounds,
    playerName = "Challenger",
    players = [],
    photoBlob,
    emojiPhotos = [],
  } = params;

  // 1. Create or register session in database
  try {
    await fetch(`${API_BASE}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: sessionId,
        mode,
        playerName,
        players,
        p1Score,
        p2Score,
        finalScore,
        rounds,
      }),
    });
  } catch (err) {
    console.warn("Session creation request failed, continuing to upload photo:", err);
  }

  // 2. Upload main souvenir pose photo blob and candid emoji expression photos via FormData
  const formData = new FormData();
  formData.append("photo", photoBlob, `session_${sessionId}.jpg`);
  formData.append("playerName", playerName);

  if (emojiPhotos && emojiPhotos.length > 0) {
    emojiPhotos.forEach((ep, idx) => {
      formData.append(`emoji_photo_${idx}`, ep.blob, `emoji_${idx}_${encodeURIComponent(ep.name)}.jpg`);
    });
    formData.append(
      "emojiMeta",
      JSON.stringify(
        emojiPhotos.map((ep) => ({
          emoji: ep.emoji,
          name: ep.name,
          roundName: ep.roundName,
          score: ep.score,
        }))
      )
    );
  }

  const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/photo`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload photo (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return {
    photoId: result.photoId,
    token: result.token,
    claimUrl: result.claimUrl,
    previewUrl: result.previewUrl,
    emojiPhotosCount: emojiPhotos.length,
  };
}
