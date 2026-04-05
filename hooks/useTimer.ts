"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TimerPhase = "idle" | "countdown" | "round" | "rest" | "complete";

interface UseTimerOptions {
  /** Round length in seconds. Pass Infinity for "FREE" rounds (no countdown). */
  roundLengthSec: number;
  /** Number of rounds. Pass Infinity for unlimited. */
  roundCount: number;
  /** Rest interval in seconds. */
  restSec: number;
  /** Fired when a round ends naturally (timer hit 0 or manual end). */
  onRoundEnd?: (roundNumber: number) => void;
  /** Fired when the full session has ended. */
  onSessionEnd?: () => void;
}

interface UseTimerResult {
  phase: TimerPhase;
  currentRound: number;
  /** Remaining seconds in current phase. Infinity for FREE rounds. */
  remainingSec: number;
  /** Kick off the session from idle — starts round 1 immediately. */
  start: () => void;
  /** Pause / resume the current countdown. */
  pause: () => void;
  resume: () => void;
  paused: boolean;
  /** Skip current rest period, advancing to next round. */
  skipRest: () => void;
  /** End the session immediately (used by [END SESSION] button). */
  endSession: () => void;
  /** Force-end the current round (moves into rest or finishes session). */
  endRound: () => void;
}

/**
 * Round timer with rest periods. Phase state machine:
 *   idle -> round -> rest -> round -> ... -> complete
 * "FREE" rounds have Infinity length and only end via endRound()/endSession().
 */
export function useTimer({
  roundLengthSec,
  roundCount,
  restSec,
  onRoundEnd,
  onSessionEnd,
}: UseTimerOptions): UseTimerResult {
  const [phase, setPhase] = useState<TimerPhase>("idle");
  const [currentRound, setCurrentRound] = useState(0);
  const [remainingSec, setRemainingSec] = useState(roundLengthSec);
  const [paused, setPaused] = useState(false);

  const phaseRef = useRef(phase);
  const currentRoundRef = useRef(currentRound);
  const remainingRef = useRef(remainingSec);
  const pausedRef = useRef(paused);
  phaseRef.current = phase;
  currentRoundRef.current = currentRound;
  remainingRef.current = remainingSec;
  pausedRef.current = paused;

  const callbackRefs = useRef({ onRoundEnd, onSessionEnd });
  useEffect(() => {
    callbackRefs.current = { onRoundEnd, onSessionEnd };
  }, [onRoundEnd, onSessionEnd]);

  const enterRound = useCallback(
    (roundNumber: number) => {
      setCurrentRound(roundNumber);
      setPhase("round");
      setRemainingSec(roundLengthSec);
      setPaused(false);
    },
    [roundLengthSec]
  );

  const enterRest = useCallback(() => {
    setPhase("rest");
    setRemainingSec(restSec);
    setPaused(false);
  }, [restSec]);

  const finishSession = useCallback(() => {
    setPhase("complete");
    setPaused(false);
    setRemainingSec(0);
    callbackRefs.current.onSessionEnd?.();
  }, []);

  const advanceAfterRound = useCallback(() => {
    const round = currentRoundRef.current;
    callbackRefs.current.onRoundEnd?.(round);
    if (Number.isFinite(roundCount) && round >= roundCount) {
      finishSession();
      return;
    }
    if (restSec > 0) {
      enterRest();
    } else {
      enterRound(round + 1);
    }
  }, [roundCount, restSec, enterRest, enterRound, finishSession]);

  // Ticking loop — only runs during round/rest and when not paused and finite.
  useEffect(() => {
    if (phase !== "round" && phase !== "rest") return;
    if (paused) return;
    if (!Number.isFinite(remainingSec)) return; // FREE round
    const id = setInterval(() => {
      setRemainingSec((s) => {
        const next = s - 1;
        if (next <= 0) {
          // Advance on next tick to avoid calling setState during setState.
          queueMicrotask(() => {
            if (phaseRef.current === "round") {
              advanceAfterRound();
            } else if (phaseRef.current === "rest") {
              enterRound(currentRoundRef.current + 1);
            }
          });
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, paused, remainingSec, advanceAfterRound, enterRound]);

  const start = useCallback(() => {
    if (phase !== "idle") return;
    enterRound(1);
  }, [phase, enterRound]);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);

  const skipRest = useCallback(() => {
    if (phaseRef.current !== "rest") return;
    enterRound(currentRoundRef.current + 1);
  }, [enterRound]);

  const endSession = useCallback(() => {
    finishSession();
  }, [finishSession]);

  const endRound = useCallback(() => {
    if (phaseRef.current !== "round") return;
    advanceAfterRound();
  }, [advanceAfterRound]);

  return {
    phase,
    currentRound,
    remainingSec,
    start,
    pause,
    resume,
    paused,
    skipRest,
    endSession,
    endRound,
  };
}
