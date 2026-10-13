import type { GameMode, FaceStatus, PlayerId } from "@emoji-face-challenge/shared-types";
import type { ProcessedFace } from "./faceGeometry";

export interface AssignedPlayer {
  id: PlayerId;
  face: ProcessedFace;
  screenXCenter: number; // Normalized 0..1 in mirrored screen coordinate space
}

export interface PlayerAssignmentResult {
  status: FaceStatus;
  statusMessage: string;
  players: AssignedPlayer[];
  canScore: boolean;
}

export class PlayerAssigner {
  private lastP1ScreenX: number | null = null;
  private lastP2ScreenX: number | null = null;
  private swapDetectedSince: number | null = null;

  public reset() {
    this.lastP1ScreenX = null;
    this.lastP2ScreenX = null;
    this.swapDetectedSince = null;
  }

  public assign(
    mode: GameMode,
    faces: ProcessedFace[],
    now: number = performance.now()
  ): PlayerAssignmentResult {
    // 0 faces (PRD §9.2)
    if (faces.length === 0) {
      this.reset();
      return {
        status: "NO_FACE",
        statusMessage: "STEP INTO THE CAMERA AREA",
        players: [],
        canScore: false,
      };
    }

    // 1-Player Mode Evaluation
    if (mode === "single") {
      // Pick the largest foreground face (closest player) to ignore distant bystanders
      const face = [...faces].sort(
        (a, b) => b.box.height * b.box.width - a.box.height * a.box.width
      )[0];
      const screenX = 1 - face.box.xCenter; // Mirrored coordinate for viewer

      if (face.box.height < 0.06) {
        return {
          status: "TOO_SMALL",
          statusMessage: "MOVE CLOSER",
          players: [],
          canScore: false,
        };
      }

      this.lastP1ScreenX = screenX;
      return {
        status: "OK",
        statusMessage: "READY",
        players: [{ id: "p1", face, screenXCenter: screenX }],
        canScore: true,
      };
    }

    // 2-Player Mode Evaluation
    if (faces.length === 1) {
      return {
        status: "WAITING_P2",
        statusMessage: "WAITING FOR PLAYER 2",
        players: [],
        canScore: false,
      };
    }

    // Take the 2 largest foreground faces if extra spectators are detected
    const activeFaces = [...faces]
      .sort((a, b) => b.box.height * b.box.width - a.box.height * a.box.width)
      .slice(0, 2);

    // Exactly 2 faces detected
    // Calculate mirrored screen x-coordinates (0 on left of screen, 1 on right of screen)
    const faceA = activeFaces[0];
    const faceB = activeFaces[1];
    const screenXA = 1 - faceA.box.xCenter;
    const screenXB = 1 - faceB.box.xCenter;

    // Check size requirement
    if (faceA.box.height < 0.09 || faceB.box.height < 0.09) {
      return {
        status: "TOO_SMALL",
        statusMessage: "MOVE CLOSER",
        players: [],
        canScore: false,
      };
    }

    // Sort by horizontal screen center: left face is P1, right face is P2
    let p1Face: ProcessedFace;
    let p2Face: ProcessedFace;
    let p1ScreenX: number;
    let p2ScreenX: number;

    if (screenXA < screenXB) {
      p1Face = faceA;
      p2Face = faceB;
      p1ScreenX = screenXA;
      p2ScreenX = screenXB;
    } else {
      p1Face = faceB;
      p2Face = faceA;
      p1ScreenX = screenXB;
      p2ScreenX = screenXA;
    }

    // Check if players merged / too close horizontally (PRD §20)
    const separation = Math.abs(p2ScreenX - p1ScreenX);
    if (separation < 0.18) {
      return {
        status: "OFF_CENTER",
        statusMessage: "SPREAD OUT INTO YOUR ZONES",
        players: [],
        canScore: false,
      };
    }

    // Check swap hysteresis: if we have tracking history and positions suddenly invert
    if (this.lastP1ScreenX !== null && this.lastP2ScreenX !== null) {
      const p1DistToOldP2 = Math.abs(p1ScreenX - this.lastP2ScreenX);
      const p2DistToOldP1 = Math.abs(p2ScreenX - this.lastP1ScreenX);

      // If faces matched the reverse identities much closer
      if (p1DistToOldP2 < 0.2 && p2DistToOldP1 < 0.2) {
        if (this.swapDetectedSince === null) {
          this.swapDetectedSince = now;
        }

        // If swap persisted for over 400ms, alert players to return to their position
        if (now - this.swapDetectedSince > 400) {
          return {
            status: "SWAP",
            statusMessage: "RETURN TO YOUR POSITION",
            players: [],
            canScore: false,
          };
        }
      } else {
        this.swapDetectedSince = null;
      }
    }

    this.lastP1ScreenX = p1ScreenX;
    this.lastP2ScreenX = p2ScreenX;

    return {
      status: "OK",
      statusMessage: "READY",
      players: [
        { id: "p1", face: p1Face, screenXCenter: p1ScreenX },
        { id: "p2", face: p2Face, screenXCenter: p2ScreenX },
      ],
      canScore: true,
    };
  }
}

export const playerAssigner = new PlayerAssigner();
