# 🎭 Emoji Face Challenge

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Face%20Landmarker-orange.svg)](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker)

An AI-powered, real-time facial expression challenge game and event souvenir kiosk. Players mimic target emoji expressions using their webcam. Powered by computer vision and blendshape action units, players earn points, unlock souvenir photo cards, and claim their candid photos via mobile QR scan.

---

## 🌟 Key Features

- **Real-Time AI Vision**: In-browser MediaPipe Face Landmarker WASM model tracking 52 facial blendshapes and landmarks at 60 FPS.
- **Dynamic Gameplay Arena**:
  - **Round 1 & 2 (Single & Multi-target)**: Match core expressions with real-time accuracy scoring.
  - **Speed Round**: Rapid succession emoji transitions.
  - **Emoji Hunt**: Scan and hold expressions to unlock bonus points.
  - **Emerald Match Reticle**: Reticle corners and camera border illuminate emerald green (`#10b981`) upon reaching match thresholds.
  - **Naturally Mirrored Camera**: 55–60% screen width display with natural reflection (`scaleX(-1)`).
- **Branded Souvenir Photo Card**: Auto-composited 1080×1350 souvenir card featuring the player's photo, player name, score, rank, and event badges.
- **Candid Emoji Action Photos**: Automatic candid reaction snaps taken at every emoji change throughout all rounds.
- **Mobile QR Claim & Web Download**: Attendees scan the kiosk QR code on their mobile phone to enter their contact details (Name, Mobile, Email) and download their high-res pose card and ZIP bundle directly to their phone.
- **Admin Control & Lead Intelligence**: Real-time event analytics dashboard with live lead tracking (`🟢 LIVE SYNC`), CSV lead export, WhatsApp quick links, and 1-click demo data purge.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- Python 3.10+
- Webcam

### Installation

1. **Clone repository**:
   ```bash
   git clone https://github.com/roboaiapaths99/EmojiChallenge-.git
   cd EmojiChallenge-
   ```

2. **Install Frontend & Monorepo Dependencies**:
   ```bash
   npm install
   ```

3. **Install Python Backend Dependencies**:
   ```bash
   pip install -r backend/requirements.txt
   ```

### Running the Services

1. **Start the FastAPI Backend** (Port 3001):
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 3001 --app-dir backend
   ```

2. **Start the Event Kiosk App** (Port 5173):
   ```bash
   npm --workspace=apps/event-app run dev
   ```

3. Open your browser:
   - **Game Arena**: [http://localhost:5173/](http://localhost:5173/)
   - **Backend API Docs**: [http://127.0.0.1:3001/docs](http://127.0.0.1:3001/docs)

---

## 🎮 Controls & Shortcuts

- **Fullscreen Toggle**: Click `[ ⛶ FULLSCREEN ]` on-screen or press **`Ctrl + Shift + F`** / **`F11`**.
- **Admin Panel**: Click **ADMIN** on the attract screen to inspect attendee leads, gameplay telemetry, and AI benchmarks.

---

## 📂 Architecture

```
├── apps/
│   └── event-app/          # React 19 + Vite frontend kiosk
├── packages/
│   ├── expression-engine/  # Facial blendshape classifier & scoring
│   └── shared-types/       # TypeScript shared contracts
├── backend/
│   ├── app/                # FastAPI backend (photo storage, claims, admin leads)
│   ├── data/               # Persistent database and photo uploads
│   └── requirements.txt
```

---

## 📄 License
MIT
