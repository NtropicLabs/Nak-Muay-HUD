"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StrikeClassifier, type DetectedStrike } from "@/lib/pose/classifier";
import type { PoseFrame } from "./usePoseDetection";
import type { Stance } from "@/lib/session/types";

interface UseStrikeDetectionOptions {
  /** When false, frames are ignored (e.g. during rest periods). */
  enabled: boolean;
  /** Optional callback fired every time a strike is emitted. */
  onStrike?: (strike: DetectedStrike) => void;
}

interface UseStrikeDetectionResult {
  /** Push a pose frame into the classifier. */
  pushFrame: (frame: PoseFrame) => void;
  /** The most recent strike (for UI flash effects). */
  lastStrike: DetectedStrike | null;
  /** Detected stance, null until classifier locks it in. */
  stance: Stance | null;
  /** Reset internal state — call between rounds. */
  reset: () => void;
  /** Debug telemetry snapshot from last frame (null before any). */
  debug: StrikeClassifier["lastDebug"];
}

export function useStrikeDetection({
  enabled,
  onStrike,
}: UseStrikeDetectionOptions): UseStrikeDetectionResult {
  const classifierRef = useRef<StrikeClassifier | null>(null);
  if (!classifierRef.current) classifierRef.current = new StrikeClassifier();
  const [lastStrike, setLastStrike] = useState<DetectedStrike | null>(null);
  const [stance, setStance] = useState<Stance | null>(null);
  const [debug, setDebug] = useState<StrikeClassifier["lastDebug"]>(null);

  const onStrikeRef = useRef(onStrike);
  useEffect(() => {
    onStrikeRef.current = onStrike;
  }, [onStrike]);

  return useMemo<UseStrikeDetectionResult>(() => {
    return {
      pushFrame: (frame: PoseFrame) => {
        if (!enabled) return;
        const classifier = classifierRef.current!;
        const strike = classifier.pushFrame({
          landmarks: frame.landmarks,
          worldLandmarks: frame.worldLandmarks,
          timestamp: frame.timestamp,
        });
        const nextStance = classifier.getStance();
        setStance((prev) => (prev === nextStance ? prev : nextStance));
        setDebug(classifier.lastDebug);
        if (strike) {
          setLastStrike(strike);
          onStrikeRef.current?.(strike);
          if (process.env.NODE_ENV !== "production") {
            console.log(
              `[STRIKE] ${strike.type.toUpperCase()} ${strike.side} conf=${strike.confidence.toFixed(2)}`
            );
          }
        }
      },
      lastStrike,
      stance,
      reset: () => {
        classifierRef.current?.reset();
        setLastStrike(null);
        setStance(null);
        setDebug(null);
      },
      debug,
    };
    // We intentionally recompute on any state change we want exposed.
  }, [enabled, lastStrike, stance, debug]);
}
