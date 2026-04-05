/**
 * Strike detection thresholds. These WILL need tuning in real testing.
 * Kept as a mutable object so the debug panel (?debug=true) can adjust
 * them live at runtime without a rebuild.
 */
export const DETECTION: {
  WRIST_VELOCITY_THRESHOLD: number;
  ANKLE_VELOCITY_THRESHOLD: number;
  ELBOW_VELOCITY_THRESHOLD: number;
  HIP_ROTATION_THRESHOLD: number;
  STRIKE_COOLDOWN_MS: number;
  FRAME_BUFFER_SIZE: number;
  MIN_CONFIDENCE: number;
  STANCE_DETECTION_FRAMES: number;
} = {
  /** normalized units per second — MediaPipe coords are in [0,1] image space.
   *  Combined with the travel-distance gate in the classifier, this needs
   *  to be high enough to reject jitter but low enough that real punches
   *  from any camera distance clear it. */
  WRIST_VELOCITY_THRESHOLD: 1.6,
  ANKLE_VELOCITY_THRESHOLD: 1.4,
  ELBOW_VELOCITY_THRESHOLD: 1.2,
  /** degrees — torso rotation required for rotational strikes */
  HIP_ROTATION_THRESHOLD: 15,
  /** ms — same limb cannot fire twice within this window */
  STRIKE_COOLDOWN_MS: 450,
  /** rolling frame buffer length */
  FRAME_BUFFER_SIZE: 12,
  /** minimum classifier confidence to accept a strike */
  MIN_CONFIDENCE: 0.7,
  /** frames to observe before locking in stance */
  STANCE_DETECTION_FRAMES: 90,
};

export const POSE = {
  MIN_POSE_DETECTION_CONFIDENCE: 0.5,
  MIN_POSE_PRESENCE_CONFIDENCE: 0.5,
  MIN_TRACKING_CONFIDENCE: 0.5,
} as const;

export const CAMERA = {
  WIDTH: 640,
  HEIGHT: 480,
} as const;

/**
 * MediaPipe PoseLandmarker indices (33-landmark model).
 * See: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */
export const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;
