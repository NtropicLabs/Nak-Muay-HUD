"use client";

import { DETECTION, LM } from "@/lib/constants";
import type { Stance, StrikeType, Side } from "@/lib/session/types";
import {
  calculateAngle,
  calculateVelocity,
  distance,
  getHipRotation,
  getStance,
  type Landmark,
  type VelocityVector,
} from "./landmarks";

/**
 * Strike classification engine — V1.1 (motion-delta aware).
 *
 * V1.0 scored strikes purely from instantaneous posture/velocity, which
 * meant a stationary person was permanently "mid-teep" because their knees
 * and elbows are already extended at rest. Any MediaPipe jitter would tip
 * the velocity gate and fire a strike.
 *
 * V1.1 instead looks at the ROLLING BUFFER and requires actual motion
 * deltas:
 *   - Extension strikes (jab/cross/kick/teep): the joint angle must have
 *     OPENED by a meaningful amount across the window.
 *   - Folded strikes (hook/uppercut/knee/elbow): the joint must have
 *     STAYED bent throughout the window AND the limb endpoint must have
 *     actually travelled a meaningful distance.
 * Plus: a global cooldown caps the max strike rate across the whole body,
 * and the z-axis is no longer used as a distinguishing signal because it's
 * fundamentally noisy on single-camera MediaPipe.
 *
 * Thresholds still live in lib/constants.ts and remain tunable at runtime
 * via ?debug=true.
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

/** How many ms of history to sample for motion-delta tests. */
const WINDOW_MS = 220;
/** Minimum angle delta (degrees) to count a joint as "extending". */
const EXTEND_DELTA_MIN = 35;
/** Minimum normalized distance the wrist/ankle must travel over the window. */
const WRIST_TRAVEL_MIN = 0.12;
const ANKLE_TRAVEL_MIN = 0.10;
/** Global cooldown across all limbs (ms) — caps max strike rate. */
const GLOBAL_COOLDOWN_MS = 180;

interface CandidateContext {
  side: Side;
  wrist: Landmark;
  elbow: Landmark;
  shoulder: Landmark;
  hip: Landmark;
  ankle: Landmark;
  knee: Landmark;
  /** Instant velocities (this frame vs previous). */
  wristVel: VelocityVector;
  ankleVel: VelocityVector;
  kneeVel: VelocityVector;
  elbowVel: VelocityVector;
  /** Current joint angles. */
  elbowAngle: number;
  kneeAngle: number;
  /** Angles from the START of the sliding window. */
  elbowAngleStart: number;
  kneeAngleStart: number;
  /** Minimum angle seen across the window (used for "stayed bent" checks). */
  elbowAngleMin: number;
  elbowAngleMax: number;
  kneeAngleMin: number;
  kneeAngleMax: number;
  /** Total travel distance of the striking endpoint across the window. */
  wristTravel: number;
  ankleTravel: number;
  /** Net displacement (end - start) of the striking endpoint. */
  wristDisp: { x: number; y: number; z: number };
  ankleDisp: { x: number; y: number; z: number };
  hipRotation: number;
  /** Max hip rotation seen across the window. */
  hipRotationMax: number;
  /** Lead vs rear side per stance. */
  isLead: boolean;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Hard gate: 0 below threshold, 1 at/above. No soft partial credit. */
function gate(value: number, threshold: number): number {
  return value >= threshold ? 1 : 0;
}

/** Soft ramp from zero at `floor` to one at `target`. */
function ramp(value: number, floor: number, target: number): number {
  if (value <= floor) return 0;
  if (value >= target) return 1;
  return (value - floor) / (target - floor);
}

function inRange(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 1;
  const span = max - min;
  const softPad = span * 0.15;
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
  private cooldowns: Partial<Record<string, number>> = {};
  private lastStrikeAt = 0;

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
    this.lastStrikeAt = 0;
    this.lastDebug = null;
  }

  getStance(): Stance | null {
    return this.stance;
  }

  pushFrame(frame: ClassifierFrame): DetectedStrike | null {
    this.buffer.push(frame);
    if (this.buffer.length > DETECTION.FRAME_BUFFER_SIZE) this.buffer.shift();
    if (this.buffer.length < 4) return null;

    const curr = frame;
    const prev = this.buffer[this.buffer.length - 2];
    const dt = Math.max(0.001, (curr.timestamp - prev.timestamp) / 1000);

    // Find the frame that is >= WINDOW_MS back (for delta analysis).
    let startIdx = 0;
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (curr.timestamp - this.buffer[i].timestamp >= WINDOW_MS) {
        startIdx = i;
        break;
      }
    }
    const startFrame = this.buffer[startIdx];
    const lms = curr.landmarks;
    const prevLms = prev.landmarks;
    const startLms = startFrame.landmarks;

    if (!lms[LM.LEFT_WRIST] || !lms[LM.RIGHT_ANKLE]) return null;

    // Stance detection — vote across first N frames.
    if (
      this.stanceFramesCollected < DETECTION.STANCE_DETECTION_FRAMES &&
      lms[LM.LEFT_ANKLE] &&
      lms[LM.RIGHT_ANKLE]
    ) {
      const vote = getStance(lms[LM.LEFT_ANKLE], lms[LM.RIGHT_ANKLE]);
      this.stanceVotes[vote] += 1;
      this.stanceFramesCollected += 1;
      this.stance =
        this.stanceVotes.orthodox >= this.stanceVotes.southpaw
          ? "orthodox"
          : "southpaw";
    }
    const stance: Stance = this.stance ?? "orthodox";

    // ---- Global kinematic context ----
    const shoulders: [Landmark, Landmark] = [
      lms[LM.LEFT_SHOULDER],
      lms[LM.RIGHT_SHOULDER],
    ];
    const hips: [Landmark, Landmark] = [lms[LM.LEFT_HIP], lms[LM.RIGHT_HIP]];
    const hipRotation = getHipRotation(shoulders, hips);

    // Max hip rotation over the window.
    let hipRotationMax = 0;
    for (let i = startIdx; i < this.buffer.length; i++) {
      const f = this.buffer[i];
      const r = getHipRotation(
        [f.landmarks[LM.LEFT_SHOULDER], f.landmarks[LM.RIGHT_SHOULDER]],
        [f.landmarks[LM.LEFT_HIP], f.landmarks[LM.RIGHT_HIP]]
      );
      if (r > hipRotationMax) hipRotationMax = r;
    }

    const mkCtx = (side: Side): CandidateContext => {
      const isLeft = side === "left";
      const wrist = lms[isLeft ? LM.LEFT_WRIST : LM.RIGHT_WRIST];
      const prevWrist =
        prevLms[isLeft ? LM.LEFT_WRIST : LM.RIGHT_WRIST] ?? wrist;
      const startWrist =
        startLms[isLeft ? LM.LEFT_WRIST : LM.RIGHT_WRIST] ?? wrist;
      const elbow = lms[isLeft ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW];
      const prevElbow =
        prevLms[isLeft ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW] ?? elbow;
      const shoulder = lms[isLeft ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER];
      const hip = lms[isLeft ? LM.LEFT_HIP : LM.RIGHT_HIP];
      const ankle = lms[isLeft ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE];
      const prevAnkle =
        prevLms[isLeft ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE] ?? ankle;
      const startAnkle =
        startLms[isLeft ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE] ?? ankle;
      const knee = lms[isLeft ? LM.LEFT_KNEE : LM.RIGHT_KNEE];
      const prevKnee =
        prevLms[isLeft ? LM.LEFT_KNEE : LM.RIGHT_KNEE] ?? knee;

      const wristVel = calculateVelocity(wrist, prevWrist, dt);
      const ankleVel = calculateVelocity(ankle, prevAnkle, dt);
      const kneeVel = calculateVelocity(knee, prevKnee, dt);
      const elbowVel = calculateVelocity(elbow, prevElbow, dt);

      const elbowAngle = calculateAngle(shoulder, elbow, wrist);
      const kneeAngle = calculateAngle(hip, knee, ankle);

      // Compute angle extrema + start values across the window for this side.
      let elbowAngleMin = Infinity;
      let elbowAngleMax = -Infinity;
      let kneeAngleMin = Infinity;
      let kneeAngleMax = -Infinity;
      let elbowAngleStart = elbowAngle;
      let kneeAngleStart = kneeAngle;
      let wristTravel = 0;
      let ankleTravel = 0;
      let prevWristSample: Landmark | null = null;
      let prevAnkleSample: Landmark | null = null;

      for (let i = startIdx; i < this.buffer.length; i++) {
        const f = this.buffer[i];
        const s = f.landmarks[isLeft ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER];
        const e = f.landmarks[isLeft ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW];
        const w = f.landmarks[isLeft ? LM.LEFT_WRIST : LM.RIGHT_WRIST];
        const h = f.landmarks[isLeft ? LM.LEFT_HIP : LM.RIGHT_HIP];
        const k = f.landmarks[isLeft ? LM.LEFT_KNEE : LM.RIGHT_KNEE];
        const a = f.landmarks[isLeft ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE];
        if (!s || !e || !w || !h || !k || !a) continue;
        const eAng = calculateAngle(s, e, w);
        const kAng = calculateAngle(h, k, a);
        if (i === startIdx) {
          elbowAngleStart = eAng;
          kneeAngleStart = kAng;
        }
        if (eAng < elbowAngleMin) elbowAngleMin = eAng;
        if (eAng > elbowAngleMax) elbowAngleMax = eAng;
        if (kAng < kneeAngleMin) kneeAngleMin = kAng;
        if (kAng > kneeAngleMax) kneeAngleMax = kAng;
        if (prevWristSample) wristTravel += distance(w, prevWristSample);
        if (prevAnkleSample) ankleTravel += distance(a, prevAnkleSample);
        prevWristSample = w;
        prevAnkleSample = a;
      }

      const wristDisp = {
        x: wrist.x - startWrist.x,
        y: wrist.y - startWrist.y,
        z: wrist.z - startWrist.z,
      };
      const ankleDisp = {
        x: ankle.x - startAnkle.x,
        y: ankle.y - startAnkle.y,
        z: ankle.z - startAnkle.z,
      };

      const isLead =
        (stance === "orthodox" && isLeft) ||
        (stance === "southpaw" && !isLeft);

      return {
        side,
        wrist,
        elbow,
        shoulder,
        hip,
        ankle,
        knee,
        wristVel,
        ankleVel,
        kneeVel,
        elbowVel,
        elbowAngle,
        kneeAngle,
        elbowAngleStart,
        kneeAngleStart,
        elbowAngleMin: Number.isFinite(elbowAngleMin) ? elbowAngleMin : elbowAngle,
        elbowAngleMax: Number.isFinite(elbowAngleMax) ? elbowAngleMax : elbowAngle,
        kneeAngleMin: Number.isFinite(kneeAngleMin) ? kneeAngleMin : kneeAngle,
        kneeAngleMax: Number.isFinite(kneeAngleMax) ? kneeAngleMax : kneeAngle,
        wristTravel,
        ankleTravel,
        wristDisp,
        ankleDisp,
        hipRotation,
        hipRotationMax,
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

    // ---- Candidate generation with HARD prerequisites ----
    const candidates: {
      type: StrikeType;
      ctx: CandidateContext;
      score: number;
      limbKey: string;
      limbIndices: number[];
    }[] = [];

    for (const ctx of [leftCtx, rightCtx]) {
      const armLimbs = [
        ctx.side === "left" ? LM.LEFT_WRIST : LM.RIGHT_WRIST,
        ctx.side === "left" ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW,
      ];
      const legLimbs = [
        ctx.side === "left" ? LM.LEFT_KNEE : LM.RIGHT_KNEE,
        ctx.side === "left" ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE,
      ];

      // ==== ARM STRIKES ====
      // Hard gate: wrist must have travelled enough across the window AND
      // instantaneous wrist velocity must clear the threshold.
      if (
        ctx.wristTravel >= WRIST_TRAVEL_MIN &&
        ctx.wristVel.magnitude >= DETECTION.WRIST_VELOCITY_THRESHOLD
      ) {
        const elbowExtended = ctx.elbowAngleMax - ctx.elbowAngleStart >= EXTEND_DELTA_MIN &&
          ctx.elbowAngleMax >= 150;
        const elbowStayedBent = ctx.elbowAngleMax <= 125 && ctx.elbowAngleMin >= 55;

        if (elbowExtended) {
          // JAB or CROSS depending on lead/rear + hip rotation
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
        } else if (elbowStayedBent) {
          // HOOK or UPPERCUT — distinguish by dominant movement axis (x vs y).
          const absDx = Math.abs(ctx.wristDisp.x);
          const absDy = Math.abs(ctx.wristDisp.y);
          if (absDx > absDy) {
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
          } else if (ctx.wristDisp.y < -0.05) {
            // Upward motion = uppercut
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
        }
      }

      // ==== ELBOW STRIKE ====
      if (
        ctx.elbowVel.magnitude >= DETECTION.ELBOW_VELOCITY_THRESHOLD &&
        ctx.elbowAngleMin < 70 &&
        ctx.elbowAngleMax < 95
      ) {
        const elbowStrike = this.scoreElbow(ctx);
        if (elbowStrike) {
          candidates.push({
            type: "elbow",
            ctx,
            score: elbowStrike,
            limbKey: `elbow-${ctx.side}`,
            limbIndices: armLimbs,
          });
        }
      }

      // ==== LEG STRIKES ====
      if (
        ctx.ankleTravel >= ANKLE_TRAVEL_MIN &&
        ctx.ankleVel.magnitude >= DETECTION.ANKLE_VELOCITY_THRESHOLD
      ) {
        const kneeExtended = ctx.kneeAngleMax - ctx.kneeAngleStart >= EXTEND_DELTA_MIN &&
          ctx.kneeAngleMax >= 140;
        const kneeStayedBent = ctx.kneeAngleMax <= 110 && ctx.kneeAngleMin >= 40;

        if (kneeExtended) {
          // KICK (rotational) vs TEEP (linear/push)
          const absDx = Math.abs(ctx.ankleDisp.x);
          const absDy = Math.abs(ctx.ankleDisp.y);
          if (ctx.hipRotationMax >= 25 && absDx > absDy) {
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
          } else {
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
          }
        } else if (kneeStayedBent && ctx.ankleDisp.y < -0.06) {
          // Knee strike — leg folded, rising
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
    }

    if (candidates.length === 0) return null;

    const now = curr.timestamp;
    // Global cooldown — caps strike rate across the whole body.
    if (now - this.lastStrikeAt < GLOBAL_COOLDOWN_MS) return null;

    let best: (typeof candidates)[number] | null = null;
    for (const c of candidates) {
      if (c.score < DETECTION.MIN_CONFIDENCE) continue;
      const cooldownUntil = this.cooldowns[c.limbKey] ?? 0;
      if (now < cooldownUntil) continue;
      if (!best || c.score > best.score) best = c;
    }
    if (!best) return null;

    this.cooldowns[best.limbKey] = now + DETECTION.STRIKE_COOLDOWN_MS;
    this.lastStrikeAt = now;

    return {
      type: best.type,
      side: best.ctx.side,
      confidence: best.score,
      timestamp: now,
      limbIndices: best.limbIndices,
    };
  }

  // ---------- Individual rule scorers ----------
  // Each scorer assumes its hard prerequisites have already been gated
  // (wrist/ankle travelled enough, angle delta satisfied, etc). The score
  // here refines confidence within the matching family.

  private scoreJab(ctx: CandidateContext): number {
    const velScore = gate(ctx.wristVel.magnitude, DETECTION.WRIST_VELOCITY_THRESHOLD);
    const travelScore = ramp(ctx.wristTravel, WRIST_TRAVEL_MIN, WRIST_TRAVEL_MIN * 2);
    const extendScore = clamp01(
      (ctx.elbowAngleMax - ctx.elbowAngleStart) / 70
    );
    // Jab has minimal hip rotation
    const hipScore = ctx.hipRotationMax < 20 ? 1 : Math.max(0, 1 - (ctx.hipRotationMax - 20) / 20);
    return velScore * 0.3 + travelScore * 0.3 + extendScore * 0.25 + hipScore * 0.15;
  }

  private scoreCross(ctx: CandidateContext): number {
    const velScore = gate(ctx.wristVel.magnitude, DETECTION.WRIST_VELOCITY_THRESHOLD);
    const travelScore = ramp(ctx.wristTravel, WRIST_TRAVEL_MIN, WRIST_TRAVEL_MIN * 2.2);
    const extendScore = clamp01(
      (ctx.elbowAngleMax - ctx.elbowAngleStart) / 70
    );
    // Cross has significant hip rotation
    const hipScore = ramp(ctx.hipRotationMax, DETECTION.HIP_ROTATION_THRESHOLD, 35);
    return velScore * 0.25 + travelScore * 0.25 + extendScore * 0.25 + hipScore * 0.25;
  }

  private scoreHook(ctx: CandidateContext): number {
    const velScore = gate(ctx.wristVel.magnitude, DETECTION.WRIST_VELOCITY_THRESHOLD);
    const travelScore = ramp(ctx.wristTravel, WRIST_TRAVEL_MIN, WRIST_TRAVEL_MIN * 2);
    // Elbow stayed bent in the 75-120 range
    const bentScore = inRange(
      (ctx.elbowAngleMin + ctx.elbowAngleMax) / 2,
      70,
      120
    );
    // Horizontal displacement dominance
    const absDx = Math.abs(ctx.wristDisp.x);
    const absDy = Math.abs(ctx.wristDisp.y);
    const horizScore = absDx > 0 ? clamp01((absDx - absDy) / 0.08 + 0.5) : 0;
    // Near shoulder height
    const heightDiff = Math.abs(ctx.wrist.y - ctx.shoulder.y);
    const heightScore = heightDiff < 0.15 ? 1 : Math.max(0, 1 - heightDiff * 4);
    const hipScore = ramp(ctx.hipRotationMax, 10, 25);
    return (
      velScore * 0.25 +
      travelScore * 0.2 +
      bentScore * 0.2 +
      horizScore * 0.15 +
      heightScore * 0.1 +
      hipScore * 0.1
    );
  }

  private scoreUppercut(ctx: CandidateContext): number {
    const velScore = gate(ctx.wristVel.magnitude, DETECTION.WRIST_VELOCITY_THRESHOLD);
    const travelScore = ramp(ctx.wristTravel, WRIST_TRAVEL_MIN, WRIST_TRAVEL_MIN * 2);
    // Upward net displacement
    const upScore = ctx.wristDisp.y < 0 ? clamp01(-ctx.wristDisp.y / 0.12) : 0;
    const bentScore = inRange(
      (ctx.elbowAngleMin + ctx.elbowAngleMax) / 2,
      65,
      115
    );
    return velScore * 0.3 + travelScore * 0.25 + upScore * 0.3 + bentScore * 0.15;
  }

  private scoreRoundhouse(ctx: CandidateContext): number {
    const velScore = gate(ctx.ankleVel.magnitude, DETECTION.ANKLE_VELOCITY_THRESHOLD);
    const travelScore = ramp(ctx.ankleTravel, ANKLE_TRAVEL_MIN, ANKLE_TRAVEL_MIN * 2);
    const extendScore = clamp01(
      (ctx.kneeAngleMax - ctx.kneeAngleStart) / 70
    );
    // Horizontal arc
    const absDx = Math.abs(ctx.ankleDisp.x);
    const absDy = Math.abs(ctx.ankleDisp.y);
    const horizScore = absDx > absDy ? 1 : 0.3;
    const hipScore = ramp(ctx.hipRotationMax, 25, 45);
    return velScore * 0.25 + travelScore * 0.2 + extendScore * 0.25 + horizScore * 0.15 + hipScore * 0.15;
  }

  private scoreTeep(ctx: CandidateContext): number {
    const velScore = gate(ctx.ankleVel.magnitude, DETECTION.ANKLE_VELOCITY_THRESHOLD);
    const travelScore = ramp(ctx.ankleTravel, ANKLE_TRAVEL_MIN, ANKLE_TRAVEL_MIN * 2);
    const extendScore = clamp01(
      (ctx.kneeAngleMax - ctx.kneeAngleStart) / 70
    );
    // Minimal hip rotation (linear push)
    const hipScore = ctx.hipRotationMax < 20 ? 1 : Math.max(0, 1 - (ctx.hipRotationMax - 20) / 20);
    // Teep is typically at waist/hip height or higher — ankle should lift.
    const liftScore = ctx.ankleDisp.y < -0.04 ? 1 : 0.3;
    return velScore * 0.25 + travelScore * 0.2 + extendScore * 0.25 + hipScore * 0.15 + liftScore * 0.15;
  }

  private scoreKnee(ctx: CandidateContext): number {
    const velScore = gate(ctx.kneeVel.magnitude, DETECTION.ANKLE_VELOCITY_THRESHOLD * 0.9);
    // Rising knee (net upward displacement of the knee joint)
    const kneeRise =
      ctx.knee.y < this.buffer[0].landmarks[ctx.side === "left" ? LM.LEFT_KNEE : LM.RIGHT_KNEE].y
        ? 1
        : 0.3;
    // Leg stays folded
    const foldedScore = ctx.kneeAngleMax < 110 ? 1 : 0.2;
    // Ankle close to glute
    const foldDistance = distance(ctx.ankle, ctx.hip);
    const closeScore = foldDistance < 0.38 ? 1 : Math.max(0, 1 - (foldDistance - 0.38) * 3);
    return velScore * 0.25 + kneeRise * 0.3 + foldedScore * 0.25 + closeScore * 0.2;
  }

  private scoreElbow(ctx: CandidateContext): number {
    const velScore = gate(ctx.elbowVel.magnitude, DETECTION.ELBOW_VELOCITY_THRESHOLD);
    const foldScore = ctx.elbowAngleMax < 80 ? 1 : Math.max(0, 1 - (ctx.elbowAngleMax - 80) / 30);
    const wristHead = Math.abs(ctx.wrist.y - ctx.shoulder.y);
    const wristScore = wristHead < 0.25 ? 1 : Math.max(0, 1 - wristHead * 3);
    const hipScore = ramp(ctx.hipRotationMax, 10, 25);
    return velScore * 0.3 + foldScore * 0.3 + wristScore * 0.2 + hipScore * 0.2;
  }
}
