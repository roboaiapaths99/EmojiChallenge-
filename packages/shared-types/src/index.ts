// PRD §13.1 & §8.2 Core Data Types

export type GameMode = "single" | "two";
export type PlayerId = "p1" | "p2";

export interface PlayerState {
  id: PlayerId;
  faceIndex: number;
  xCenter: number;
  visible: boolean;
  quality: number;
}

export interface RoundResult {
  roundId: string;
  score: number;
  target?: string;
  durationMs: number;
  stableScore?: number;
}

export interface GameSession {
  id: string;
  eventId?: string;
  mode: GameMode;
  players: PlayerState[];
  rounds: RoundResult[];
  finalScore: number;
  photoId?: string;
  status: "in_progress" | "completed" | "abandoned";
  createdAt: string;
}

export interface RequiredBlendshape {
  name: string;
  target: number;
  weight: number;
  tolerance: number;
}

export interface EmojiProfile {
  id: string;
  emoji: string;
  name: string;
  difficulty: "easy" | "medium" | "hard";
  requiredBlendshapes: RequiredBlendshape[];
  inhibitorBlendshapes?: RequiredBlendshape[];
  alternatives?: RequiredBlendshape[][];
  threshold: number;
  scoreMultiplier: number;
  minStableMs: number;
}

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  groupId?: string;
}

export interface CameraSettingsInfo {
  deviceId: string;
  label: string;
  width: number;
  height: number;
  frameRate: number;
  aspectRatio?: number;
}

export interface CameraDiagnostics {
  selectedDeviceId: string;
  selectedLabel: string;
  actualWidth: number;
  actualHeight: number;
  actualFps: number;
  measuredFps: number;
  isLive: boolean;
  error?: string;
}

export type FaceStatus =
  | "OK"
  | "NO_FACE"
  | "WAITING_P2"
  | "TOO_MANY"
  | "TOO_SMALL"
  | "OFF_CENTER"
  | "SWAP"
  | "CAMERA_LOST"
  | "BUSY";
