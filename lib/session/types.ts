export type StrikeType =
  | "jab"
  | "cross"
  | "hook"
  | "uppercut"
  | "kick"
  | "knee"
  | "teep"
  | "elbow";

export const STRIKE_TYPES: readonly StrikeType[] = [
  "jab",
  "cross",
  "hook",
  "uppercut",
  "kick",
  "knee",
  "teep",
  "elbow",
] as const;

export const STRIKE_LABELS: Record<StrikeType, string> = {
  jab: "JAB",
  cross: "CROSS",
  hook: "HOOK",
  uppercut: "UPPER",
  kick: "KICK",
  knee: "KNEE",
  teep: "TEEP",
  elbow: "ELBOW",
};

export type Side = "left" | "right";
export type Stance = "orthodox" | "southpaw";

export interface StrikeEvent {
  type: StrikeType;
  side: Side;
  confidence: number;
  /** ms since session start */
  timestamp: number;
  round: number;
}

export interface RoundData {
  roundNumber: number;
  strikes: StrikeEvent[];
  /** actual duration in seconds */
  duration: number;
  strikesPerMinute: number;
}

export interface SessionConfig {
  /** round length in seconds; Infinity for "FREE" */
  roundLengthSec: number;
  /** round count; Infinity for "∞" */
  roundCount: number;
  /** rest interval in seconds */
  restSec: number;
}

export interface SessionData {
  startTime: string; // ISO — serializable for storage
  config: SessionConfig;
  rounds: RoundData[];
  totalStrikes: number;
  strikeBreakdown: Record<StrikeType, number>;
  /** total active duration in seconds */
  totalDuration: number;
  averageStrikesPerMinute: number;
  /** strike rate decline % from round 1 to last round (positive = fatigue) */
  fatiguePercent: number;
  stance: Stance;
  dominantStrike: StrikeType | null;
}
