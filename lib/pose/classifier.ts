"use client";

import { DETECTION, LM } from "@/lib/constants";
import type { Stance, StrikeType, Side } from "@/lib/session/types";
import {
  calculateAngle,
  calculateVelocity,
  distance,
  getHipRotation,
  getPrimaryAxis,
  getStance,
  type Landmark,
  type VelocityVector,
} from "./landmarks";

/**
 * Strike classification engine.
 *
 * Buffers a rolling window of pose frames and, on each new frame, computes
 * per-limb kinematics (velocities, joint angles, primary motion axis, hip
 * rotation) and scores candidate strike types against heuristic rules.
 * A strike is emitted when its score clears MIN_CONFIDENCE and the limb is
 * not in cooldown. The highest scoring candidate per frame wins.
 *
 * Thresholds live in lib/constants.ts and are deliberately tunable — the
 * debug panel in Phase 7 mutates them at runtime.
 */

export interface ClassifierFrame {
  landmarks: Landmark[];
  worldLandmarks: Landmark[];
  /** Timestamp in ms since session start (perf.now). */
  timestamp: number;
}

export interface DetectedStrike {
  type: StrikeType;
  side: Side;
  confidence: number;
  timestamp: number;
  /** Indices of landmarks that "fired" the strike — used for the orange overlay flash. */
  limbIndices: number[];
}

interface CandidateContext {
  side: Side;
  wrist: Landmark;
  prevWrist: Landmark;
  elbow: Landmark;
  shoulder: Landmark;
  hip: Landmark;
  ankle: Landmark;
  prevAnkle: Landmark;
  knee: Landmark;
  prevKnee: Landmark;
  wristVel: VelocityVector;
  ankleVel: VelocityVector;
  kneeVel: VelocityVector;
  elbowVel: VelocityVector;
  elbowAngle: number;
  kneeAngle: number;
  shoulders: [Landmark, Landmark];
  hips: [Landmark, Landmark];
  hipRotation: number;
  /** true if this side is the "lead" (jab/front foot) side per stance. */
  isLead: boolean;
}

/** Helpers for a scoring language that keeps rule bodies readable. */
function pass(target: number, value: number, soft = 0.25): number {
  // Returns 0..1 smooth pass/fail. Full credit if value >= target.
  if (value >= target) return 1;
  const floor = target * (1 - soft);
  if (value <= floor) return 0;
  return (value - floor) / (target - floor);
}

function inRange(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 1;
  const span = max - min;
  const softPad = span * 0.25;
  if (value < min) return Math.max(0, 1 - (min - value) / softPad);
  return Math.max(0, 1 - (value - max) / softPad);
}

export class StrikeClassifier {
  private buffer: ClassifierFrame[] = [];
  private stance: Stance | null = null;
  private stanceFramesCollected = 0;
  private stanceVotes: { orthodox: number; southpaw: number } = {
    orthodox: 0,
    southpaw: 0,
  };
  /** Limb -> last strike timestamp (ms). */
  private cooldowns: Partial<Record<string, number>> = {};

  /** Public so the debug panel can read current buffer size. */
  public lastDebug: {
    wristVelL: number;
    wristVelR: number;
    ankleVelL: number;
    ankleVelR: number;
    hipRotation: number;
    elbowAngleL: number;
    elbowAngleR: number;
  } | null = null;

  reset(): void {
    this.buffer = [];
    this.stance = null;
    this.stanceFramesCollected = 0;
    this.stanceVotes = { orthodox: 0, southpaw: 0 };
    this.cooldowns = {};
    this.lastDebug = null;
  }

  getStance(): Stance | null {
    return this.stance;
  }

  /**
   * Push a frame and optionally return a detected strike (or null).
   */
  pushFrame(frame: ClassifierFrame): DetectedStrike | null {
    this.buffer.push(frame);
    if (this.buffer.length > DETECTION.FRAME_BUFFER_SIZE) this.buffer.shift();

    // Need at least 3 frames to compute stable velocities.
    if (this.buffer.length < 3) return null;

    const prev = this.buffer[this.buffer.length - 2];
    const curr = frame;
    const dt = Math.max(0.001, (curr.timestamp - prev.timestamp) / 1000);

    const lms = curr.landmarks;
    const prevLms = prev.landmarks;

    // Guard against truncated landmark arrays.
    if (!lms[LM.LEFT_WRIST] || !lms[LM.RIGHT_ANKLE]) return null;

    // --- Stance detection (first N frames) ---
    if (
      this.stanceFramesCollected < DETECTION.STANCE_DETECTION_FRAMES &&
      lms[LM.LEFT_ANKLE] &&
      lms[LM.RIGHT_ANKLE]
    ) {
      const vote = getStance(lms[LM.LEFT_ANKLE], lms[LM.RIGHT_ANKLE]);
      this.stanceVotes[vote] += 1;
      this.stanceFramesCollected += 1;
      if (this.stanceFramesCollected === DETECTION.STANCE_DETECTION_FRAMES) {
        this.stance =
          this.stanceVotes.orthodox >= this.stanceVotes.southpaw
            ? "orthodox"
            : "southpaw";
      } else if (!this.stance) {
        // Provisional stance so lead/rear detection still works early.
        this.stance =
          this.stanceVotes.orthodox >= this.stanceVotes.southpaw
            ? "orthodox"
            : "southpaw";
      }
    }

    const stance: Stance = this.stance ?? "orthodox";

    // --- Per-side contexts ---
    const shoulders: [Landmark, Landmark] = [
      lms[LM.LEFT_SHOULDER],
      lms[LM.RIGHT_SHOULDER],
    ];
    const hips: [Landmark, Landmark] = [lms[LM.LEFT_HIP], lms[LM.RIGHT_HIP]];
    const hipRotation = getHipRotation(shoulders, hips);

    const mkCtx = (side: Side): CandidateContext => {
      const isLeft = side === "left";
      const wristI = isLeft ? LM.LEFT_WRIST : LM.RIGHT_WRIST;
      const elbowI = isLeft ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW;
      const shoulderI = isLeft ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;
      const hipI = isLeft ? LM.LEFT_HIP : LM.RIGHT_HIP;
      const ankleI = isLeft ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE;
      const kneeI = isLeft ? LM.LEFT_KNEE : LM.RIGHT_KNEE;
      const wrist = lms[wristI];
      const prevWrist = prevLms[wristI];
      const elbow = lms[elbowI];
      const prevElbow = prevLms[elbowI];
      const shoulder = lms[shoulderI];
      const hip = lms[hipI];
      const ankle = lms[ankleI];
      const prevAnkle = prevLms[ankleI];
      const knee = lms[kneeI];
      const prevKnee = prevLms[kneeI];
      const wristVel = calculateVelocity(wrist, prevWrist, dt);
      const ankleVel = calculateVelocity(ankle, prevAnkle, dt);
      const kneeVel = calculateVelocity(knee, prevKnee, dt);
      const elbowVel = calculateVelocity(elbow, prevElbow, dt);
      const elbowAngle = calculateAngle(shoulder, elbow, wrist);
      const kneeAngle = calculateAngle(hip, knee, ankle);
      // Lead side = front foot side. Orthodox = left lead.
      const isLead = (stance === "orthodox" && isLeft) ||
        (stance === "southpaw" && !isLeft);
      return {
        side,
        wrist,
        prevWrist,
        elbow,
        shoulder,
        hip,
        ankle,
        prevAnkle,
        knee,
        prevKnee,
        wristVel,
        ankleVel,
        kneeVel,
        elbowVel,
        elbowAngle,
        kneeAngle,
        shoulders,
        hips,
        hipRotation,
        isLead,
      };
    };

    const leftCtx = mkCtx("left");
    const rightCtx = mkCtx("right");

    this.lastDebug = {
      wristVelL: leftCtx.wristVel.magnitude,
      wristVelR: rightCtx.wristVel.magnitude,
      ankleVelL: leftCtx.ankleVel.magnitude,
      ankleVelR: rightCtx.ankleVel.magnitude,
      hipRotation,
      elbowAngleL: leftCtx.elbowAngle,
      elbowAngleR: rightCtx.elbowAngle,
    };

    // --- Score all candidates, pick best above MIN_CONFIDENCE ---
    const candidates: {
      type: StrikeType;
      ctx: CandidateContext;
      score: number;
      limbKey: string;
      limbIndices: number[];
    }[] = [];

    for (const ctx of [leftCtx, rightCtx]) {
      // Arm strikes — only if wrist velocity is meaningful
      if (ctx.wristVel.magnitude > DETECTION.WRIST_VELOCITY_THRESHOLD * 0.6) {
        const armLimbs = [
          ctx.side === "left" ? LM.LEFT_WRIST : LM.RIGHT_WRIST,
          ctx.side === "left" ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW,
        ];
        const jab = this.scoreJab(ctx);
        if (jab && ctx.isLead) {
          candidates.push({
            type: "jab",
            ctx,
            score: jab,
            limbKey: `wrist-${ctx.side}`,
            limbIndices: armLimbs,
          });
        }
        const cross = this.scoreCross(ctx);
        if (cross && !ctx.isLead) {
          candidates.push({
            type: "cross",
            ctx,
            score: cross,
            limbKey: `wrist-${ctx.side}`,
            limbIndices: armLimbs,
          });
        }
        const hook = this.scoreHook(ctx);
        if (hook) {
          candidates.push({
            type: "hook",
            ctx,
            score: hook,
            limbKey: `wrist-${ctx.side}`,
            limbIndices: armLimbs,
          });
        }
        const upper = this.scoreUppercut(ctx);
        if (upper) {
          candidates.push({
            type: "uppercut",
            ctx,
            score: upper,
            limbKey: `wrist-${ctx.side}`,
            limbIndices: armLimbs,
          });
        }
      }

      // Elbow strikes — short-range, very acute angle
      if (ctx.elbowVel.magnitude > DETECTION.ELBOW_VELOCITY_THRESHOLD) {
        const elbow = this.scoreElbow(ctx);
        if (elbow) {
          candidates.push({
            type: "elbow",
            ctx,
            score: elbow,
            limbKey: `elbow-${ctx.side}`,
            limbIndices: [
              ctx.side === "left" ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW,
              ctx.side === "left" ? LM.LEFT_WRIST : LM.RIGHT_WRIST,
            ],
          });
        }
      }

      // Leg strikes
      if (
        ctx.ankleVel.magnitude > DETECTION.ANKLE_VELOCITY_THRESHOLD * 0.6 ||
        ctx.kneeVel.magnitude > DETECTION.ANKLE_VELOCITY_THRESHOLD * 0.6
      ) {
        const legLimbs = [
          ctx.side === "left" ? LM.LEFT_KNEE : LM.RIGHT_KNEE,
          ctx.side === "left" ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE,
        ];
        const kick = this.scoreRoundhouse(ctx);
        if (kick) {
          candidates.push({
            type: "kick",
            ctx,
            score: kick,
            limbKey: `ankle-${ctx.side}`,
            limbIndices: legLimbs,
          });
        }
        const teep = this.scoreTeep(ctx);
        if (teep) {
          candidates.push({
            type: "teep",
            ctx,
            score: teep,
            limbKey: `ankle-${ctx.side}`,
            limbIndices: legLimbs,
          });
        }
        const knee = this.scoreKnee(ctx);
        if (knee) {
          candidates.push({
            type: "knee",
            ctx,
            score: knee,
            limbKey: `knee-${ctx.side}`,
            limbIndices: legLimbs,
          });
        }
      }
    }

    if (candidates.length === 0) return null;

    // Filter by cooldown + MIN_CONFIDENCE, pick best.
    const now = curr.timestamp;
    let best: (typeof candidates)[number] | null = null;
    for (const c of candidates) {
      if (c.score < DETECTION.MIN_CONFIDENCE) continue;
      const cooldownUntil = this.cooldowns[c.limbKey] ?? 0;
      if (now < cooldownUntil) continue;
      if (!best || c.score > best.score) best = c;
    }
    if (!best) return null;

    this.cooldowns[best.limbKey] = now + DETECTION.STRIKE_COOLDOWN_MS;

    return {
      type: best.type,
      side: best.ctx.side,
      confidence: best.score,
      timestamp: now,
      limbIndices: best.limbIndices,
    };
  }

  // ---------- Individual rule scorers ----------

  private scoreJab(ctx: CandidateContext): number {
    const velScore = pass(
      DETECTION.WRIST_VELOCITY_THRESHOLD,
      ctx.wristVel.magnitude
    );
    // Elbow extending: angle should be large (>155) in current frame.
    const extendScore = pass(155, ctx.elbowAngle);
    // Primarily Z-axis (toward camera). We look at the Z component directly.
    const axis = getPrimaryAxis(ctx.wristVel);
    const axisScore = axis === "z" ? 1 : 0.3;
    // Minimal hip rotation
    const hipScore = ctx.hipRotation < DETECTION.HIP_ROTATION_THRESHOLD ? 1 : 0.4;
    return velScore * 0.35 + extendScore * 0.3 + axisScore * 0.2 + hipScore * 0.15;
  }

  private scoreCross(ctx: CandidateContext): number {
    const velScore = pass(
      DETECTION.WRIST_VELOCITY_THRESHOLD * 1.05,
      ctx.wristVel.magnitude
    );
    const extendScore = pass(155, ctx.elbowAngle);
    const axis = getPrimaryAxis(ctx.wristVel);
    const axisScore = axis === "z" ? 1 : 0.35;
    // Significant hip rotation
    const hipScore = pass(20, ctx.hipRotation);
    return velScore * 0.3 + extendScore * 0.25 + axisScore * 0.2 + hipScore * 0.25;
  }

  private scoreHook(ctx: CandidateContext): number {
    const velScore = pass(
      DETECTION.WRIST_VELOCITY_THRESHOLD,
      ctx.wristVel.magnitude
    );
    // Elbow stays bent
    const elbowScore = inRange(ctx.elbowAngle, 75, 120);
    // Horizontal arc
    const axis = getPrimaryAxis(ctx.wristVel);
    const axisScore = axis === "x" ? 1 : 0.3;
    // Wrist near shoulder height
    const heightDiff = Math.abs(ctx.wrist.y - ctx.shoulder.y);
    const heightScore = heightDiff < 0.15 ? 1 : Math.max(0, 1 - heightDiff * 4);
    // Hip rotation
    const hipScore = pass(DETECTION.HIP_ROTATION_THRESHOLD, ctx.hipRotation);
    return (
      velScore * 0.3 +
      elbowScore * 0.25 +
      axisScore * 0.2 +
      heightScore * 0.1 +
      hipScore * 0.15
    );
  }

  private scoreUppercut(ctx: CandidateContext): number {
    const velScore = pass(
      DETECTION.WRIST_VELOCITY_THRESHOLD,
      ctx.wristVel.magnitude
    );
    // Primarily upward motion (negative y in image space = up)
    const axis = getPrimaryAxis(ctx.wristVel);
    const axisScore = axis === "y" && ctx.wristVel.y < 0 ? 1 : 0.2;
    // Elbow stays bent
    const elbowScore = inRange(ctx.elbowAngle, 70, 110);
    // Wrist ends at/above elbow height
    const heightScore = ctx.wrist.y <= ctx.elbow.y + 0.02 ? 1 : 0.3;
    return velScore * 0.3 + axisScore * 0.3 + elbowScore * 0.25 + heightScore * 0.15;
  }

  private scoreRoundhouse(ctx: CandidateContext): number {
    const velScore = pass(
      DETECTION.ANKLE_VELOCITY_THRESHOLD,
      ctx.ankleVel.magnitude
    );
    // Knee extending — angle opens
    const extendScore = pass(130, ctx.kneeAngle);
    // Horizontal arc
    const axis = getPrimaryAxis(ctx.ankleVel);
    const axisScore = axis === "x" ? 1 : 0.3;
    // Significant hip rotation
    const hipScore = pass(25, ctx.hipRotation);
    return velScore * 0.3 + extendScore * 0.2 + axisScore * 0.25 + hipScore * 0.25;
  }

  private scoreTeep(ctx: CandidateContext): number {
    const velScore = pass(
      DETECTION.ANKLE_VELOCITY_THRESHOLD,
      ctx.ankleVel.magnitude
    );
    // Primarily Z-axis (toward camera) — linear push
    const axis = getPrimaryAxis(ctx.ankleVel);
    const axisScore = axis === "z" ? 1 : 0.25;
    // Minimal hip rotation (linear, not rotational)
    const hipScore = ctx.hipRotation < 20 ? 1 : 0.3;
    // Knee should be extending (opening) — teep is a push
    const extendScore = pass(120, ctx.kneeAngle);
    return velScore * 0.3 + axisScore * 0.3 + hipScore * 0.2 + extendScore * 0.2;
  }

  private scoreKnee(ctx: CandidateContext): number {
    // Knee Y rises rapidly (negative y velocity).
    const upwardScore =
      ctx.kneeVel.y < 0
        ? pass(DETECTION.ANKLE_VELOCITY_THRESHOLD, Math.abs(ctx.kneeVel.y))
        : 0;
    // Leg stays folded — knee angle < 100
    const foldedScore = ctx.kneeAngle < 100 ? 1 : 0.2;
    // Ankle stays close to glute — small distance ankle->hip
    const foldDistance = distance(ctx.ankle, ctx.hip);
    const closeScore = foldDistance < 0.35 ? 1 : Math.max(0, 1 - foldDistance);
    return upwardScore * 0.45 + foldedScore * 0.35 + closeScore * 0.2;
  }

  private scoreElbow(ctx: CandidateContext): number {
    const velScore = pass(
      DETECTION.ELBOW_VELOCITY_THRESHOLD,
      ctx.elbowVel.magnitude
    );
    // Very acute angle — arm tightly folded
    const foldScore = ctx.elbowAngle < 70 ? 1 : Math.max(0, 1 - (ctx.elbowAngle - 70) / 40);
    // Wrist near shoulder / head
    const wristHead = Math.abs(ctx.wrist.y - ctx.shoulder.y);
    const wristScore = wristHead < 0.2 ? 1 : Math.max(0, 1 - wristHead * 3);
    // Some hip rotation
    const hipScore = pass(DETECTION.HIP_ROTATION_THRESHOLD, ctx.hipRotation);
    return velScore * 0.3 + foldScore * 0.3 + wristScore * 0.2 + hipScore * 0.2;
  }
}
