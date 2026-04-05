/**
 * Landmark math utilities. Coordinates come from MediaPipe in normalized
 * [0,1] image space for X/Y, and a relative depth for Z (negative = closer
 * to camera). All velocities are in "units per second".
 */

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface VelocityVector extends Vector3 {
  magnitude: number;
}

/** Angle at point B (in degrees) formed by A-B-C. */
export function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const abz = a.z - b.z;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const cbz = c.z - b.z;
  const dot = abx * cbx + aby * cby + abz * cbz;
  const magAB = Math.hypot(abx, aby, abz);
  const magCB = Math.hypot(cbx, cby, cbz);
  if (magAB === 0 || magCB === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Per-axis + magnitude velocity between two landmark samples. dt in seconds. */
export function calculateVelocity(
  current: Landmark,
  previous: Landmark,
  dt: number
): VelocityVector {
  if (dt <= 0) return { x: 0, y: 0, z: 0, magnitude: 0 };
  const x = (current.x - previous.x) / dt;
  const y = (current.y - previous.y) / dt;
  const z = (current.z - previous.z) / dt;
  return { x, y, z, magnitude: Math.hypot(x, y, z) };
}

/** Which axis has the largest absolute velocity component. */
export function getPrimaryAxis(velocity: Vector3): "x" | "y" | "z" {
  const ax = Math.abs(velocity.x);
  const ay = Math.abs(velocity.y);
  const az = Math.abs(velocity.z);
  if (ax >= ay && ax >= az) return "x";
  if (ay >= ax && ay >= az) return "y";
  return "z";
}

/**
 * Torso rotation in degrees — uses the angle between the shoulder line
 * and hip line when projected to the XZ plane (top-down view). A perfectly
 * square stance returns ~0; a twisted torso returns a larger value.
 */
export function getHipRotation(
  shoulders: [Landmark, Landmark],
  hips: [Landmark, Landmark]
): number {
  const [ls, rs] = shoulders;
  const [lh, rh] = hips;
  const shoulderAngle = Math.atan2(rs.z - ls.z, rs.x - ls.x);
  const hipAngle = Math.atan2(rh.z - lh.z, rh.x - lh.x);
  let diff = ((shoulderAngle - hipAngle) * 180) / Math.PI;
  // Normalize to [-180, 180]
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return Math.abs(diff);
}

/**
 * Stance detection — compares Z-depth of ankles. The forward foot is the
 * one closer to the camera (more negative z). Orthodox = left forward.
 */
export function getStance(
  leftAnkle: Landmark,
  rightAnkle: Landmark
): "orthodox" | "southpaw" {
  return leftAnkle.z < rightAnkle.z ? "orthodox" : "southpaw";
}

/**
 * Exponential moving average smoothing on a rolling buffer of frames.
 * Returns a smoothed version of the most recent frame. Alpha near 1 = trust
 * new data (responsive); alpha near 0 = heavy smoothing (laggy).
 */
export function smoothLandmarks(
  buffer: Landmark[][],
  alpha = 0.6
): Landmark[] {
  if (buffer.length === 0) return [];
  if (buffer.length === 1) return buffer[0];
  const latest = buffer[buffer.length - 1];
  const result: Landmark[] = new Array(latest.length);
  for (let i = 0; i < latest.length; i++) {
    let x = buffer[0][i]?.x ?? 0;
    let y = buffer[0][i]?.y ?? 0;
    let z = buffer[0][i]?.z ?? 0;
    for (let f = 1; f < buffer.length; f++) {
      const lm = buffer[f][i];
      if (!lm) continue;
      x = alpha * lm.x + (1 - alpha) * x;
      y = alpha * lm.y + (1 - alpha) * y;
      z = alpha * lm.z + (1 - alpha) * z;
    }
    result[i] = { x, y, z, visibility: latest[i].visibility };
  }
  return result;
}

/** Euclidean distance between two landmarks. */
export function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
