"use client";

import { useCallback, useMemo, useReducer } from "react";
import {
  STRIKE_TYPES,
  type RoundData,
  type SessionConfig,
  type SessionData,
  type Stance,
  type StrikeEvent,
  type StrikeType,
} from "@/lib/session/types";
import type { DetectedStrike } from "@/lib/pose/classifier";

interface SessionState {
  startedAt: number | null;
  startedAtISO: string | null;
  currentRound: number;
  strikes: StrikeEvent[];
  /** Per-round active seconds, filled on round end. */
  roundDurations: number[];
  /** perf.now() when current round started, to compute duration. */
  roundStartedAt: number | null;
  stance: Stance | null;
  config: SessionConfig;
  ended: boolean;
}

type Action =
  | { type: "START"; config: SessionConfig }
  | { type: "BEGIN_ROUND"; round: number; at: number }
  | {
      type: "RECORD_STRIKE";
      strike: DetectedStrike;
      round: number;
      sessionStart: number;
    }
  | { type: "END_ROUND"; at: number }
  | { type: "SET_STANCE"; stance: Stance }
  | { type: "END_SESSION" }
  | { type: "RESET"; config: SessionConfig };

function initialState(config: SessionConfig): SessionState {
  return {
    startedAt: null,
    startedAtISO: null,
    currentRound: 0,
    strikes: [],
    roundDurations: [],
    roundStartedAt: null,
    stance: null,
    config,
    ended: false,
  };
}

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case "START": {
      return {
        ...initialState(action.config),
        startedAt: performance.now(),
        startedAtISO: new Date().toISOString(),
      };
    }
    case "BEGIN_ROUND":
      return {
        ...state,
        currentRound: action.round,
        roundStartedAt: action.at,
      };
    case "RECORD_STRIKE": {
      const evt: StrikeEvent = {
        type: action.strike.type,
        side: action.strike.side,
        confidence: action.strike.confidence,
        timestamp: action.strike.timestamp - action.sessionStart,
        round: action.round,
      };
      return { ...state, strikes: [...state.strikes, evt] };
    }
    case "END_ROUND": {
      if (state.roundStartedAt == null) return state;
      const dur = (action.at - state.roundStartedAt) / 1000;
      return {
        ...state,
        roundDurations: [...state.roundDurations, dur],
        roundStartedAt: null,
      };
    }
    case "SET_STANCE":
      return state.stance === action.stance
        ? state
        : { ...state, stance: action.stance };
    case "END_SESSION":
      return { ...state, ended: true };
    case "RESET":
      return initialState(action.config);
    default:
      return state;
  }
}

interface UseSessionResult {
  state: SessionState;
  startSession: () => void;
  beginRound: (round: number) => void;
  endRound: () => void;
  recordStrike: (strike: DetectedStrike) => void;
  setStance: (stance: Stance) => void;
  endSession: () => void;
  buildSessionData: () => SessionData;
  /** Live per-type counters reflecting current strikes array. */
  counters: Record<StrikeType, number>;
  /** The 3 most recent strikes (newest first). */
  recent: StrikeEvent[];
}

export function useSession(config: SessionConfig): UseSessionResult {
  const [state, dispatch] = useReducer(reducer, config, initialState);

  const startSession = useCallback(() => {
    dispatch({ type: "START", config });
  }, [config]);

  const beginRound = useCallback((round: number) => {
    dispatch({ type: "BEGIN_ROUND", round, at: performance.now() });
  }, []);

  const endRound = useCallback(() => {
    dispatch({ type: "END_ROUND", at: performance.now() });
  }, []);

  const recordStrike = useCallback(
    (strike: DetectedStrike) => {
      if (!state.startedAt || state.currentRound === 0) return;
      dispatch({
        type: "RECORD_STRIKE",
        strike,
        round: state.currentRound,
        sessionStart: state.startedAt,
      });
    },
    [state.startedAt, state.currentRound]
  );

  const setStance = useCallback((stance: Stance) => {
    dispatch({ type: "SET_STANCE", stance });
  }, []);

  const endSession = useCallback(() => {
    dispatch({ type: "END_SESSION" });
  }, []);

  const counters = useMemo<Record<StrikeType, number>>(() => {
    const c = STRIKE_TYPES.reduce(
      (acc, t) => {
        acc[t] = 0;
        return acc;
      },
      {} as Record<StrikeType, number>
    );
    for (const s of state.strikes) c[s.type] += 1;
    return c;
  }, [state.strikes]);

  const recent = useMemo(() => {
    return state.strikes.slice(-3).reverse();
  }, [state.strikes]);

  const buildSessionData = useCallback((): SessionData => {
    const rounds: RoundData[] = [];
    // Group strikes by round
    const byRound = new Map<number, StrikeEvent[]>();
    for (const s of state.strikes) {
      const arr = byRound.get(s.round) ?? [];
      arr.push(s);
      byRound.set(s.round, arr);
    }
    const totalRoundsPlayed = state.roundDurations.length;
    for (let i = 0; i < totalRoundsPlayed; i++) {
      const roundNumber = i + 1;
      const strikes = byRound.get(roundNumber) ?? [];
      const duration = state.roundDurations[i];
      const strikesPerMinute =
        duration > 0 ? (strikes.length / duration) * 60 : 0;
      rounds.push({ roundNumber, strikes, duration, strikesPerMinute });
    }

    const totalDuration = state.roundDurations.reduce((a, b) => a + b, 0);
    const totalStrikes = state.strikes.length;
    const averageStrikesPerMinute =
      totalDuration > 0 ? (totalStrikes / totalDuration) * 60 : 0;

    const strikeBreakdown = { ...counters };
    let dominantStrike: StrikeType | null = null;
    let maxCount = 0;
    for (const type of STRIKE_TYPES) {
      if (strikeBreakdown[type] > maxCount) {
        maxCount = strikeBreakdown[type];
        dominantStrike = type;
      }
    }

    let fatiguePercent = 0;
    if (rounds.length >= 2) {
      const first = rounds[0].strikesPerMinute;
      const last = rounds[rounds.length - 1].strikesPerMinute;
      if (first > 0) fatiguePercent = ((first - last) / first) * 100;
    }

    return {
      startTime: state.startedAtISO ?? new Date().toISOString(),
      config: state.config,
      rounds,
      totalStrikes,
      strikeBreakdown,
      totalDuration,
      averageStrikesPerMinute,
      fatiguePercent,
      stance: state.stance ?? "orthodox",
      dominantStrike,
    };
  }, [state, counters]);

  return {
    state,
    startSession,
    beginRound,
    endRound,
    recordStrike,
    setStance,
    endSession,
    buildSessionData,
    counters,
    recent,
  };
}
