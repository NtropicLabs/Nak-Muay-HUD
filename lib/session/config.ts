import type { SessionConfig } from "./types";

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  roundLengthSec: 180, // 3:00
  roundCount: 3,
  restSec: 60,
};

export const ROUND_LENGTH_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
}> = [
  { value: 120, label: "2:00" },
  { value: 180, label: "3:00" },
  { value: 300, label: "5:00" },
  { value: Number.POSITIVE_INFINITY, label: "FREE" },
] as const;

export const ROUND_COUNT_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
}> = [
  { value: 1, label: "1" },
  { value: 3, label: "3" },
  { value: 5, label: "5" },
  { value: Number.POSITIVE_INFINITY, label: "∞" },
] as const;

export const REST_INTERVAL_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
}> = [
  { value: 30, label: "0:30" },
  { value: 60, label: "1:00" },
  { value: 90, label: "1:30" },
] as const;
