import type { NormalizedLandmark, Matrix } from "@mediapipe/tasks-vision";

export interface FaceBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  xCenter: number;
  yCenter: number;
}

export interface HeadPose {
  pitch: number; // looking up/down in degrees
  yaw: number;   // looking left/right in degrees
  roll: number;  // tilting head in degrees
}

export interface ProcessedFace {
  index: number;
  box: FaceBox;
  pose: HeadPose;
  quality: number; // 0 to 1
  blendshapes: Record<string, number>;
  landmarks: NormalizedLandmark[];
  isTooSmall: boolean;
  isHeadTurned: boolean;
}

export function computeFaceBox(landmarks: NormalizedLandmark[]): FaceBox {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;

  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if (lm.x < minX) minX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y > maxY) maxY = lm.y;
  }

  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  const xCenter = minX + width / 2;
  const yCenter = minY + height / 2;

  return { minX, minY, maxX, maxY, width, height, xCenter, yCenter };
}

export function extractHeadPose(matrix?: Matrix): HeadPose {
  if (!matrix || !matrix.data || matrix.data.length < 16) {
    return { pitch: 0, yaw: 0, roll: 0 };
  }

  const m = matrix.data;
  // MediaPipe 4x4 column-major transformation matrix
  // [m0, m1, m2, m3,
  //  m4, m5, m6, m7,
  //  m8, m9, m10, m11,
  //  m12, m13, m14, m15]

  const pitch = Math.atan2(m[9], m[10]) * (180 / Math.PI);
  const yaw = Math.atan2(-m[8], Math.sqrt(m[9] * m[9] + m[10] * m[10])) * (180 / Math.PI);
  const roll = Math.atan2(m[4], m[0]) * (180 / Math.PI);

  return { pitch, yaw, roll };
}

export function calculateQualityScore(
  box: FaceBox,
  pose: HeadPose,
  minHeight: number = 0.12
): number {
  let score = 1.0;

  // Penalty if face is smaller than threshold
  if (box.height < minHeight) {
    const sizeRatio = box.height / minHeight;
    score *= Math.max(0.2, sizeRatio);
  }

  // Penalty if head is turned too far
  const absYaw = Math.abs(pose.yaw);
  const absPitch = Math.abs(pose.pitch);
  const absRoll = Math.abs(pose.roll);

  if (absYaw > 20) {
    score *= Math.max(0.3, 1 - (absYaw - 20) / 30);
  }
  if (absPitch > 20) {
    score *= Math.max(0.4, 1 - (absPitch - 20) / 25);
  }
  if (absRoll > 25) {
    score *= Math.max(0.5, 1 - (absRoll - 25) / 35);
  }

  // Margin penalty if touching canvas boundaries
  if (box.minX <= 0.02 || box.maxX >= 0.98 || box.minY <= 0.02 || box.maxY >= 0.98) {
    score *= 0.7;
  }

  return Math.max(0.1, Math.min(1.0, score));
}
