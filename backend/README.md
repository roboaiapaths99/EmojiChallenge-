# Emoji Face Challenge — FastAPI Backend

Modern, high-performance Python FastAPI backend for the **Emoji Face Challenge** event application.

---

## Architecture Overview

```text
WEBCAM
   ↓
BROWSER (Event App)
   ↓
MediaPipe Face Landmarker (Live blendshapes & expressions)
   ↓
Expression Comparison & Real-time Scoring
   ↓
FastAPI Backend (Session persistence, Souvenir photo metadata, QR tokens, Claiming)
```

> **Note**: Live camera frame processing and facial landmark calculations remain 100% on the frontend client. The backend only receives game session completion results and the final captured souvenir photograph.

---

## Directory Structure

```text
backend/
├── app/
│   ├── main.py                     # FastAPI application entrypoint & middleware
│   │
│   ├── core/
│   │   ├── config.py               # Pydantic Settings & environment variables
│   │   ├── database.py             # MongoDB async engine (Motor) + local fallback
│   │   ├── security.py             # SHA-256 token hashing & admin authorization
│   │   └── logging.py              # Structured logging configuration
│   │
│   ├── api/
│   │   ├── router.py               # Assembled API router (/api)
│   │   └── routes/
│   │       ├── health.py           # GET /api/health
│   │       ├── sessions.py         # Session management & photo upload
│   │       ├── photos.py           # QR token resolution, claim, and downloads
│   │       ├── events.py           # Event configuration
│   │       ├── leaderboard.py      # Event leaderboard rankings
│   │       └── admin.py            # Administrative endpoints
│   │
│   ├── schemas/                    # Pydantic request/response schemas
│   ├── services/                   # Business logic layer
│   └── utils/                      # Token generators, validators, helpers
│
├── tests/                          # Automated pytest test suite
├── Dockerfile                      # Production container image
├── requirements.txt                # Pinned dependencies
└── .env.example                    # Environment variable configuration template
```

---

## Local Development

### 1. Create Virtual Environment
```bash
cd backend
python -m venv .venv

# Windows:
.venv\Scripts\activate

# macOS / Linux:
source .venv/bin/activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(If `MONGODB_URI` is left empty, the server automatically uses a local JSON database in `data/db.json` for zero-setup offline testing.)*

### 4. Run Server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 3001
```

### 5. Interactive API Documentation
- **Swagger UI**: [http://localhost:3001/docs](http://localhost:3001/docs)
- **ReDoc**: [http://localhost:3001/redoc](http://localhost:3001/redoc)
- **OpenAPI Schema**: [http://localhost:3001/openapi.json](http://localhost:3001/openapi.json)

---

## Running Automated Tests
```bash
pytest tests -v
```

---

## Production Docker Deployment

```bash
docker build -t emoji-face-challenge-backend .
docker run -p 3001:3001 --env-file .env emoji-face-challenge-backend
```
