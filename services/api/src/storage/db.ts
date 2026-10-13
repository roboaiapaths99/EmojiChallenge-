import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface StoredSession {
  id: string;
  eventId?: string;
  mode: "single" | "two";
  playerName?: string;
  players: any[];
  rounds: any[];
  p1Score: number;
  p2Score: number;
  finalScore: number;
  status: string;
  photoId?: string;
  createdAt: string;
}

export interface StoredEmojiPhoto {
  emoji: string;
  name: string;
  roundName?: string;
  score: number;
  storageKey: string;
  previewUrl: string;
}

export interface StoredPhoto {
  id: string;
  sessionId: string;
  storageKey: string;
  tokenHash: string;
  plainToken: string;
  expiresAt: number;
  status: "ready" | "expired";
  playerName?: string;
  emojiPhotos?: StoredEmojiPhoto[];
  createdAt: string;
}

export interface StoredRecipient {
  id: string;
  photoId: string;
  name: string;
  mobile: string;
  email?: string;
  downloadedAt?: string;
  createdAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, "db.json");

interface DatabaseSchema {
  sessions: StoredSession[];
  photos: StoredPhoto[];
  recipients: StoredRecipient[];
}

function loadDb(): DatabaseSchema {
  if (!fs.existsSync(DB_FILE)) {
    const initial: DatabaseSchema = { sessions: [], photos: [], recipients: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  try {
    const content = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("Failed to parse database file, resetting to empty:", err);
    return { sessions: [], photos: [], recipients: [] };
  }
}

function saveDb(data: DatabaseSchema) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export const db = {
  // Sessions
  createSession(session: Omit<StoredSession, "createdAt">): StoredSession {
    const state = loadDb();
    const newSession: StoredSession = {
      ...session,
      createdAt: new Date().toISOString(),
    };
    state.sessions.push(newSession);
    saveDb(state);
    return newSession;
  },

  getSession(id: string): StoredSession | undefined {
    const state = loadDb();
    return state.sessions.find((s) => s.id === id);
  },

  updateSession(id: string, updates: Partial<StoredSession>): StoredSession | undefined {
    const state = loadDb();
    const idx = state.sessions.findIndex((s) => s.id === id);
    if (idx === -1) return undefined;
    state.sessions[idx] = { ...state.sessions[idx], ...updates };
    saveDb(state);
    return state.sessions[idx];
  },

  // Photos
  createPhoto(data: {
    sessionId: string;
    filename: string;
    playerName?: string;
    emojiPhotos?: StoredEmojiPhoto[];
  }): { photo: StoredPhoto; token: string } {
    const state = loadDb();
    const photoId = "photo_" + crypto.randomBytes(8).toString("hex");

    // PRD §11.3: Generate cryptographically random token
    const plainToken = crypto.randomBytes(16).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(plainToken).digest("hex");
    const expiresAt = Date.now() + 60 * 60 * 1000; // 60 minutes TTL

    const photo: StoredPhoto = {
      id: photoId,
      sessionId: data.sessionId,
      storageKey: data.filename,
      tokenHash,
      plainToken,
      expiresAt,
      status: "ready",
      playerName: data.playerName || "Challenger",
      emojiPhotos: data.emojiPhotos || [],
      createdAt: new Date().toISOString(),
    };

    state.photos.push(photo);
    saveDb(state);

    return { photo, token: plainToken };
  },

  updatePhoto(id: string, updates: Partial<StoredPhoto>): StoredPhoto | undefined {
    const state = loadDb();
    const idx = state.photos.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    state.photos[idx] = { ...state.photos[idx], ...updates };
    saveDb(state);
    return state.photos[idx];
  },

  getPhotoByToken(token: string): StoredPhoto | undefined {
    const state = loadDb();
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const photo = state.photos.find((p) => p.tokenHash === tokenHash);
    if (!photo) return undefined;

    // Check expiration
    if (Date.now() > photo.expiresAt) {
      photo.status = "expired";
      saveDb(state);
      return undefined;
    }
    return photo;
  },

  getPhotoById(id: string): StoredPhoto | undefined {
    const state = loadDb();
    return state.photos.find((p) => p.id === id);
  },

  listRecentPhotos(limit = 10): (StoredPhoto & { session?: StoredSession })[] {
    const state = loadDb();
    return [...state.photos]
      .reverse()
      .slice(0, limit)
      .map((photo) => ({
        ...photo,
        session: state.sessions.find((s) => s.id === photo.sessionId),
      }));
  },

  // Recipients
  addRecipient(data: { photoId: string; name: string; mobile: string; email?: string }): StoredRecipient {
    const state = loadDb();
    const recipient: StoredRecipient = {
      id: "rec_" + crypto.randomBytes(8).toString("hex"),
      photoId: data.photoId,
      name: data.name,
      mobile: data.mobile,
      email: data.email,
      createdAt: new Date().toISOString(),
    };
    state.recipients.push(recipient);
    saveDb(state);
    return recipient;
  },

  markDownloaded(recipientId: string): void {
    const state = loadDb();
    const r = state.recipients.find((rec) => rec.id === recipientId);
    if (r) {
      r.downloadedAt = new Date().toISOString();
      saveDb(state);
    }
  },

  getRecipientsForPhoto(photoId: string): StoredRecipient[] {
    const state = loadDb();
    return state.recipients.filter((r) => r.photoId === photoId);
  },

  listRecipients(limit = 100): StoredRecipient[] {
    const state = loadDb();
    return [...state.recipients].reverse().slice(0, limit);
  },
};
