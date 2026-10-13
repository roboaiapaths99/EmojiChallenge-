import type { EmojiProfile, RequiredBlendshape } from "@emoji-face-challenge/shared-types";
import { DEFAULT_PROFILES } from "./profiles";

export type ScoreBand = "no_hit" | "partial" | "good" | "excellent";

export interface ExpressionMatchResult {
  rawScore: number;
  smoothedScore: number;
  isStable: boolean;
  band: ScoreBand;
  quality: number;
}

export interface FeatureBreakdown {
  smileScore: number;
  jawOpenScore: number;
  browScore: number;
  eyeBlinkScore: number;
  eyeSquintScore?: number;
  mouthPuckerScore?: number;
}

export interface AIPredictionResult {
  predictedEmoji: string;
  predictedName: string;
  confidence: number;
  topMatches: Array<{ emoji: string; name: string; score: number }>;
  features: FeatureBreakdown;
}

/**
 * Score a single group of blendshape requirements against live frame values.
 */
function scoreBlendshapeGroup(
  blendshapes: Record<string, number>,
  requirements: RequiredBlendshape[]
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const req of requirements) {
    const liveVal = blendshapes[req.name] ?? 0;
    let featureScore: number;

    // Non-linear scoring: rewarding strong deliberate expressions
    if (liveVal >= req.target && req.target > 0.15) {
      featureScore = 1.0;
    } else {
      const distance = Math.abs(liveVal - req.target);
      featureScore = Math.max(0, 1 - distance / Math.max(0.05, req.tolerance));
    }

    weightedSum += featureScore * req.weight;
    totalWeight += req.weight;
  }

  return totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
}

/**
 * Calculate similarity with support for bilateral alternatives and negative inhibitor penalties.
 */
export function calculateRawSimilarity(
  blendshapes: Record<string, number>,
  profile: EmojiProfile,
  quality: number = 1.0
): number {
  // 1. Evaluate primary blendshape set
  let bestBaseScore = scoreBlendshapeGroup(blendshapes, profile.requiredBlendshapes);

  // 2. Evaluate bilateral alternatives (e.g., right eye wink vs left eye wink, right brow vs left brow)
  if (profile.alternatives && profile.alternatives.length > 0) {
    for (const alt of profile.alternatives) {
      const altScore = scoreBlendshapeGroup(blendshapes, alt);
      if (altScore > bestBaseScore) {
        bestBaseScore = altScore;
      }
    }
  }

  // 3. Apply inhibitor penalties (opposing counter-emotions like smiling while frowning)
  let inhibitorPenalty = 0;
  if (profile.inhibitorBlendshapes && profile.inhibitorBlendshapes.length > 0) {
    for (const inh of profile.inhibitorBlendshapes) {
      const liveVal = blendshapes[inh.name] ?? 0;
      if (liveVal >= inh.target) {
        const excess = Math.min(1.0, (liveVal - inh.target) / Math.max(0.1, inh.tolerance));
        inhibitorPenalty += excess * (inh.weight ?? 1.0) * 22;
      }
    }
  }

  const netScore = Math.max(0, bestBaseScore - inhibitorPenalty);
  // Apply face quality factor
  return Math.min(100, Math.max(0, netScore * quality));
}

export function classifyBand(score: number, threshold: number): ScoreBand {
  if (score < threshold) return "no_hit";
  if (score < 80) return "partial";
  if (score < 90) return "good";
  return "excellent";
}

/**
 * Predict top matching emoji expression from live blendshapes with rich multi-axis telemetry.
 */
export function predictEmojiExpression(
  blendshapes: Record<string, number>,
  profiles: EmojiProfile[] = DEFAULT_PROFILES,
  quality: number = 1.0
): AIPredictionResult {
  const matches: Array<{ emoji: string; name: string; score: number }> = [];

  for (const profile of profiles) {
    const score = calculateRawSimilarity(blendshapes, profile, quality);
    matches.push({
      emoji: profile.emoji,
      name: profile.name,
      score: Math.round(score),
    });
  }

  matches.sort((a, b) => b.score - a.score);

  const top = matches[0] || { emoji: "😐", name: "Neutral", score: 0 };

  const smileLeft = blendshapes["mouthSmileLeft"] ?? 0;
  const smileRight = blendshapes["mouthSmileRight"] ?? 0;
  const jawOpen = blendshapes["jawOpen"] ?? 0;
  const browUp = Math.max(
    blendshapes["browInnerUp"] ?? 0,
    Math.max(blendshapes["browOuterUpLeft"] ?? 0, blendshapes["browOuterUpRight"] ?? 0)
  );
  const blinkMax = Math.max(blendshapes["eyeBlinkLeft"] ?? 0, blendshapes["eyeBlinkRight"] ?? 0);
  const squintMax = Math.max(blendshapes["eyeSquintLeft"] ?? 0, blendshapes["eyeSquintRight"] ?? 0);
  const pucker = blendshapes["mouthPucker"] ?? 0;

  return {
    predictedEmoji: top.emoji,
    predictedName: top.name,
    confidence: top.score,
    topMatches: matches.slice(0, 4),
    features: {
      smileScore: Math.round(((smileLeft + smileRight) / 2) * 100),
      jawOpenScore: Math.round(jawOpen * 100),
      browScore: Math.round(Math.min(1, browUp) * 100),
      eyeBlinkScore: Math.round(blinkMax * 100),
      eyeSquintScore: Math.round(squintMax * 100),
      mouthPuckerScore: Math.round(pucker * 100),
    },
  };
}

export class ExpressionTracker {
  private smoothedScore: number = 0;
  private readonly alpha: number = 0.3; // Calmer EMA smoothing — steady, readable meter
  private stableStartTime: number | null = null;
  private maxStableScore: number = 0;

  public reset() {
    this.smoothedScore = 0;
    this.stableStartTime = null;
    this.maxStableScore = 0;
  }

  public update(
    blendshapes: Record<string, number>,
    profile: EmojiProfile,
    quality: number,
    now: number = performance.now()
  ): ExpressionMatchResult {
    const raw = calculateRawSimilarity(blendshapes, profile, quality);

    // Apply EMA smoothing
    this.smoothedScore =
      this.smoothedScore === 0
        ? raw
        : this.alpha * raw + (1 - this.alpha) * this.smoothedScore;

    const band = classifyBand(this.smoothedScore, profile.threshold);

    // Check stability window
    if (this.smoothedScore >= profile.threshold) {
      if (this.stableStartTime === null) {
        this.stableStartTime = now;
      }
      if (this.smoothedScore > this.maxStableScore) {
        this.maxStableScore = this.smoothedScore;
      }
    } else {
      this.stableStartTime = null;
    }

    const durationStable =
      this.stableStartTime !== null ? now - this.stableStartTime : 0;
    const isStable = durationStable >= profile.minStableMs;

    return {
      rawScore: Math.round(raw),
      smoothedScore: Math.round(this.smoothedScore),
      isStable,
      band,
      quality,
    };
  }

  public getMaxStableScore(): number {
    return Math.round(this.maxStableScore);
  }
}

// Round 4 Hunt Mode: find best match among all enabled profiles
export function findHuntMatch(
  blendshapes: Record<string, number>,
  profiles: EmojiProfile[],
  quality: number
): { profile: EmojiProfile; score: number; band: ScoreBand } | null {
  let bestMatch: { profile: EmojiProfile; score: number; band: ScoreBand } | null = null;

  for (const profile of profiles) {
    const raw = calculateRawSimilarity(blendshapes, profile, quality);
    if (raw >= profile.threshold) {
      if (!bestMatch || raw > bestMatch.score) {
        bestMatch = {
          profile,
          score: Math.round(raw),
          band: classifyBand(raw, profile.threshold),
        };
      }
    }
  }

  return bestMatch;
}
