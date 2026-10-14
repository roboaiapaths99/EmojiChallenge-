import React, { useState, useEffect } from "react";
import type { GameMode } from "@emoji-face-challenge/shared-types";
import { sendOtp, verifyOtp, type PlayerAuthData } from "../api/eventApi";
import "./OTPLoginScreen.css";

interface OTPLoginScreenProps {
  mode: GameMode;
  onSuccess: (players: { p1: PlayerAuthData; p2?: PlayerAuthData }) => void;
  onBack: () => void;
}

interface PlayerFormState {
  name: string;
  mobile: string;
  email: string;
  otp: string[];
  isOtpSent: boolean;
  isSending: boolean;
  isVerifying: boolean;
  isVerified: boolean;
  statusMessage: string;
  errorMessage: string;
  countdown: number;
}

export const OTPLoginScreen: React.FC<OTPLoginScreenProps> = ({
  mode,
  onSuccess,
  onBack,
}) => {
  // Player 1 state
  const [p1State, setP1State] = useState<PlayerFormState>({
    name: "",
    mobile: "",
    email: "",
    otp: ["", "", "", "", "", ""],
    isOtpSent: false,
    isSending: false,
    isVerifying: false,
    isVerified: false,
    statusMessage: "",
    errorMessage: "",
    countdown: 0,
  });

  // Player 2 state (for 2-player mode)
  const [p2State, setP2State] = useState<PlayerFormState>({
    name: "",
    mobile: "",
    email: "",
    otp: ["", "", "", "", "", ""],
    isOtpSent: false,
    isSending: false,
    isVerifying: false,
    isVerified: false,
    statusMessage: "",
    errorMessage: "",
    countdown: 0,
  });

  const [activeTab, setActiveTab] = useState<"p1" | "p2">("p1");

  // Timer intervals for countdown
  useEffect(() => {
    let timer: number;
    if (p1State.countdown > 0) {
      timer = window.setInterval(() => {
        setP1State((prev) => ({ ...prev, countdown: Math.max(0, prev.countdown - 1) }));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [p1State.countdown]);

  useEffect(() => {
    let timer: number;
    if (p2State.countdown > 0) {
      timer = window.setInterval(() => {
        setP2State((prev) => ({ ...prev, countdown: Math.max(0, prev.countdown - 1) }));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [p2State.countdown]);

  // Handle Send OTP
  const handleSendOtp = async (player: "p1" | "p2") => {
    const state = player === "p1" ? p1State : p2State;
    const setState = player === "p1" ? setP1State : setP2State;

    if (!state.name.trim()) {
      setState((prev) => ({
        ...prev,
        errorMessage: "Please enter your name first.",
        statusMessage: "",
      }));
      return;
    }

    const cleanMobile = state.mobile.replace(/\D/g, "").slice(-10);
    if (cleanMobile.length !== 10) {
      setState((prev) => ({
        ...prev,
        errorMessage: "Please enter a valid 10-digit mobile number.",
        statusMessage: "",
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isSending: true,
      errorMessage: "",
      statusMessage: "Sending real SMS via MetaReach gateway...",
    }));

    try {
      const res = await sendOtp(cleanMobile, state.name.trim());
      if (res.success) {
        setState((prev) => ({
          ...prev,
          isSending: false,
          isOtpSent: true,
          countdown: 30,
          statusMessage: "OTP sent via SMS! Enter 6-digit code received on your phone.",
          errorMessage: "",
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isSending: false,
          errorMessage: res.message || "Failed to send SMS.",
          statusMessage: "",
        }));
      }
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isSending: false,
        errorMessage: err.message || "Network error sending OTP",
        statusMessage: "",
      }));
    }
  };

  // Handle OTP digit changes
  const handleOtpDigitChange = (
    player: "p1" | "p2",
    index: number,
    value: string
  ) => {
    const setState = player === "p1" ? setP1State : setP2State;
    const digit = value.replace(/\D/g, "").slice(-1);

    setState((prev) => {
      const newOtp = [...prev.otp];
      newOtp[index] = digit;
      return { ...prev, otp: newOtp, errorMessage: "" };
    });

    // Auto-focus next input
    if (digit && index < 5) {
      const nextInput = document.getElementById(`${player}-otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  // Handle backspace navigation
  const handleOtpKeyDown = (
    player: "p1" | "p2",
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace") {
      const state = player === "p1" ? p1State : p2State;
      if (!state.otp[index] && index > 0) {
        const prevInput = document.getElementById(`${player}-otp-input-${index - 1}`);
        prevInput?.focus();
      }
    }
  };

  // Handle OTP paste
  const handleOtpPaste = (
    player: "p1" | "p2",
    e: React.ClipboardEvent<HTMLInputElement>
  ) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!paste) return;

    const setState = player === "p1" ? setP1State : setP2State;
    setState((prev) => {
      const newOtp = [...prev.otp];
      for (let i = 0; i < paste.length; i++) {
        newOtp[i] = paste[i];
      }
      return { ...prev, otp: newOtp, errorMessage: "" };
    });

    const targetIdx = Math.min(paste.length, 5);
    const nextInput = document.getElementById(`${player}-otp-input-${targetIdx}`);
    nextInput?.focus();
  };

  // Handle Verify OTP
  const handleVerifyOtp = async (player: "p1" | "p2") => {
    const state = player === "p1" ? p1State : p2State;
    const setState = player === "p1" ? setP1State : setP2State;

    const otpCode = state.otp.join("");
    if (otpCode.length !== 6) {
      setState((prev) => ({
        ...prev,
        errorMessage: "Please enter all 6 digits of the OTP.",
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isVerifying: true,
      errorMessage: "",
    }));

    try {
      const cleanMobile = state.mobile.replace(/\D/g, "").slice(-10);
      const res = await verifyOtp(cleanMobile, otpCode, state.name, state.email);
      if (res.success) {
        setState((prev) => ({
          ...prev,
          isVerifying: false,
          isVerified: true,
          statusMessage: "Verified successfully!",
          errorMessage: "",
        }));

        // If in 2-player mode and P1 just verified, auto switch to P2
        if (mode === "two" && player === "p1" && !p2State.isVerified) {
          setTimeout(() => setActiveTab("p2"), 400);
        }
      } else {
        setState((prev) => ({
          ...prev,
          isVerifying: false,
          errorMessage: res.message || "Invalid OTP code",
        }));
      }
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isVerifying: false,
        errorMessage: err.message || "Error verifying OTP",
      }));
    }
  };

  // Check if ready to start
  const canProceed =
    mode === "single"
      ? p1State.isVerified
      : p1State.isVerified && p2State.isVerified;

  const handleStartGame = () => {
    if (!canProceed) return;
    const cleanP1Mob = p1State.mobile.replace(/\D/g, "").slice(-10);
    const cleanP2Mob = p2State.mobile.replace(/\D/g, "").slice(-10);

    onSuccess({
      p1: {
        name: p1State.name.trim() || (cleanP1Mob ? `Player ${cleanP1Mob.slice(-4)}` : "Player 1"),
        mobile: cleanP1Mob,
        email: p1State.email.trim() || undefined,
        verified: true,
      },
      p2:
        mode === "two"
          ? {
              name: p2State.name.trim() || (cleanP2Mob ? `Player ${cleanP2Mob.slice(-4)}` : "Player 2"),
              mobile: cleanP2Mob,
              email: p2State.email.trim() || undefined,
              verified: true,
            }
          : undefined,
    });
  };

  const renderPlayerCard = (player: "p1" | "p2") => {
    const state = player === "p1" ? p1State : p2State;
    const setState = player === "p1" ? setP1State : setP2State;
    const isP1 = player === "p1";
    const label = isP1 ? "PLAYER 1" : "PLAYER 2";
    const badgeColor = isP1 ? "#ec4899" : "#06b6d4";

    return (
      <div className={`otp-card ${isP1 ? "card-p1" : "card-p2"} ${state.isVerified ? "is-verified" : ""}`}>
        <div className="card-header">
          <div className="player-badge" style={{ backgroundColor: badgeColor }}>
            {isP1 ? "👑 " : "⚡ "} {label}
          </div>
          {state.isVerified ? (
            <div className="verified-pill">
              <span>✓ VERIFIED</span>
            </div>
          ) : (
            <div className="pending-pill">
              <span>OTP REQUIRED</span>
            </div>
          )}
        </div>

        {/* Player Name */}
        <div className="form-group">
          <label className="input-label">Full Name / Nickname *</label>
          <input
            type="text"
            className="text-input"
            value={state.name}
            maxLength={24}
            disabled={state.isVerified}
            onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value }))}
            placeholder={isP1 ? "Enter Full Name (e.g. Rahul Sharma)" : "Enter Player 2 Full Name"}
          />
        </div>

        {/* Mobile Number Input */}
        <div className="form-group">
          <label className="input-label">Mobile Number (WhatsApp / SMS)</label>
          <div className="mobile-input-wrapper">
            <span className="country-prefix">+91</span>
            <input
              type="tel"
              className="mobile-input"
              value={state.mobile}
              disabled={state.isVerified}
              maxLength={10}
              placeholder="Enter 10-digit mobile"
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                setState((prev) => ({ ...prev, mobile: val, errorMessage: "" }));
              }}
            />
            {!state.isVerified && (
              <button
                type="button"
                className="send-otp-btn"
                disabled={state.isSending || state.countdown > 0 || state.mobile.length < 10}
                onClick={() => handleSendOtp(player)}
              >
                {state.isSending
                  ? "SENDING..."
                  : state.countdown > 0
                  ? `RESEND (${state.countdown}s)`
                  : state.isOtpSent
                  ? "RESEND OTP"
                  : "SEND OTP"}
              </button>
            )}
          </div>
        </div>

        {/* Email Address Input */}
        <div className="form-group">
          <label className="input-label">Email Address (Optional - For Photo Delivery)</label>
          <input
            type="email"
            className="text-input"
            value={state.email}
            disabled={state.isVerified}
            onChange={(e) => setState((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="e.g. attendee@company.com"
          />
        </div>

        {/* Status Banner */}
        {state.statusMessage && (
          <div className="status-banner success-msg">
            <span>✓ {state.statusMessage}</span>
          </div>
        )}
        {state.errorMessage && (
          <div className="status-banner error-msg">
            <span>⚠️ {state.errorMessage}</span>
          </div>
        )}

        {/* OTP Input Fields */}
        {state.isOtpSent && !state.isVerified && (
          <div className="otp-entry-section">
            <label className="input-label">Enter 6-Digit SMS Code</label>
            <div className="otp-boxes-row">
              {state.otp.map((digit, idx) => (
                <input
                  key={idx}
                  id={`${player}-otp-input-${idx}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  className="otp-box"
                  value={digit}
                  onChange={(e) => handleOtpDigitChange(player, idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(player, idx, e)}
                  onPaste={(e) => handleOtpPaste(player, e)}
                  autoFocus={idx === 0}
                />
              ))}
            </div>

            <button
              type="button"
              className="verify-otp-btn"
              disabled={state.isVerifying || state.otp.join("").length < 6}
              onClick={() => handleVerifyOtp(player)}
            >
              {state.isVerifying ? "VERIFYING..." : "VERIFY CODE ✓"}
            </button>
          </div>
        )}

        {state.isVerified && (
          <div className="verified-success-box">
            <div className="verified-icon">🛡️</div>
            <div>
              <div className="verified-title">{state.name} Authenticated</div>
              <div className="verified-sub">+91 {state.mobile} ready for match</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="otp-login-screen">
      {/* Background glow orbs */}
      <div className="ambient-glow glow-1" />
      <div className="ambient-glow glow-2" />

      <header className="otp-header">
        <button type="button" className="otp-back-btn" onClick={onBack}>
          ← BACK TO MODE
        </button>
        <div className="otp-title-block">
          <h1 className="otp-main-title">
            {mode === "single" ? "PLAYER AUTHENTICATION" : "DUAL PLAYER LOGIN"}
          </h1>
          <p className="otp-subtitle">
            Secure MetaReach SMS verification for instant score tracking & live souvenir delivery
          </p>
        </div>
        <div className="otp-spacer" />
      </header>

      {/* Mode tabs for 2-player mode */}
      {mode === "two" && (
        <div className="player-tabs-bar">
          <button
            type="button"
            className={`tab-btn tab-p1 ${activeTab === "p1" ? "active" : ""}`}
            onClick={() => setActiveTab("p1")}
          >
            <span>👑 Player 1</span>
            {p1State.isVerified ? <span className="tab-check">✓</span> : <span className="tab-dot" />}
          </button>
          <button
            type="button"
            className={`tab-btn tab-p2 ${activeTab === "p2" ? "active" : ""}`}
            onClick={() => setActiveTab("p2")}
          >
            <span>⚡ Player 2</span>
            {p2State.isVerified ? <span className="tab-check">✓</span> : <span className="tab-dot" />}
          </button>
        </div>
      )}

      {/* Main card stage */}
      <main className="otp-stage">
        {mode === "single" ? (
          <div className="single-card-wrapper">{renderPlayerCard("p1")}</div>
        ) : (
          <div className="dual-cards-wrapper">
            <div className={`desktop-dual-card ${activeTab === "p1" ? "tab-visible" : "tab-hidden"}`}>
              {renderPlayerCard("p1")}
            </div>
            <div className={`desktop-dual-card ${activeTab === "p2" ? "tab-visible" : "tab-hidden"}`}>
              {renderPlayerCard("p2")}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Action Footer */}
      <footer className="otp-footer">
        <div className="auth-status-bar">
          {mode === "single" ? (
            <span>
              {p1State.isVerified
                ? "✓ Mobile number verified! Ready to jump into the challenge."
                : "Enter mobile number to receive instant SMS verification code."}
            </span>
          ) : (
            <span>
              {p1State.isVerified && p2State.isVerified
                ? "✓ Both players verified! Ready for 1v1 battle."
                : `Player 1: ${p1State.isVerified ? "✓ Verified" : "Pending"} | Player 2: ${
                    p2State.isVerified ? "✓ Verified" : "Pending"
                  }`}
            </span>
          )}
        </div>

        <button
          type="button"
          className={`proceed-btn ${canProceed ? "enabled" : "disabled"}`}
          disabled={!canProceed}
          onClick={handleStartGame}
        >
          {canProceed
            ? mode === "single"
              ? "START CHALLENGE →"
              : "START 1V1 BATTLE →"
            : mode === "single"
            ? "VERIFY MOBILE TO PROCEED"
            : "VERIFY BOTH PLAYERS TO PROCEED"}
        </button>
      </footer>
    </div>
  );
};
