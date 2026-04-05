"use client";

import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { POSE } from "@/lib/constants";

/**
 * MediaPipe PoseLandmarker wrapper. WASM + model assets are loaded from
 * the official Google CDN at runtime — no build-time download required.
 */

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

export async function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    return PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: POSE.MIN_POSE_DETECTION_CONFIDENCE,
      minPosePresenceConfidence: POSE.MIN_POSE_PRESENCE_CONFIDENCE,
      minTrackingConfidence: POSE.MIN_TRACKING_CONFIDENCE,
      outputSegmentationMasks: false,
    });
  })().catch(async (gpuErr) => {
    // GPU delegate can fail on some browsers/devices — fall back to CPU.
    console.warn("[POSE] GPU delegate failed, falling back to CPU:", gpuErr);
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    return PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: POSE.MIN_POSE_DETECTION_CONFIDENCE,
      minPosePresenceConfidence: POSE.MIN_POSE_PRESENCE_CONFIDENCE,
      minTrackingConfidence: POSE.MIN_TRACKING_CONFIDENCE,
      outputSegmentationMasks: false,
    });
  });
  return landmarkerPromise;
}

export type { PoseLandmarkerResult };

/**
 * Pose connections for drawing the skeleton — standard MediaPipe 33-landmark
 * upper + lower body topology (subset suitable for Muay Thai telemetry).
 */
export const POSE_CONNECTIONS: ReadonlyArray<[number, number]> = [
  // Face (minimal)
  [0, 2], [0, 5], [2, 7], [5, 8],
  // Shoulders
  [11, 12],
  // Left arm
  [11, 13], [13, 15],
  // Right arm
  [12, 14], [14, 16],
  // Torso
  [11, 23], [12, 24], [23, 24],
  // Left leg
  [23, 25], [25, 27], [27, 29], [27, 31],
  // Right leg
  [24, 26], [26, 28], [28, 30], [28, 32],
] as const;
