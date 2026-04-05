"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CameraFeed } from "@/components/session/CameraFeed";
import { PoseOverlay } from "@/components/session/PoseOverlay";
import { StrikeCounters } from "@/components/session/StrikeCounters";
import { StrikeFeed } from "@/components/session/StrikeFeed";
import { StrikeFlash } from "@/components/session/StrikeFlash";
import { Timer } from "@/components/session/Timer";
import { Button } from "@/components/ui/Button";
import { useCamera } from "@/hooks/useCamera";
import { usePoseDetection, type PoseFrame } from "@/hooks/usePoseDetection";
import { useSession } from "@/hooks/useSession";
import { useStrikeDetection } from "@/hooks/useStrikeDetection";
import { useTimer } from "@/hooks/useTimer";
import { DEFAULT_SESSION_CONFIG } from "@/lib/session/config";
import { DETECTION, LM } from "@/lib/constants";
import type { DetectedStrike } from "@/lib/pose/classifier";
import type { SessionConfig, StrikeType } from "@/lib/session/types";

const PENDING_CONFIG_KEY = "strike-protocol:pending-config";
const LAST_SESSION_KEY = "strike-protocol:last-session";
const SUMMARY_KEY = "strike-protocol:summary-data";

type Stage = "setup" | "body-check" | "countdown" | "active" | "complete";

export default function SessionPage() {
  return (
    <Suspense fallback={null}>
      <SessionPageInner />
    </Suspense>
  );
}

function SessionPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDebug = searchParams.get("debug") === "true";

  const [config, setConfig] = useState<SessionConfig>(DEFAULT_SESSION_CONFIG);
  const [configLoaded, setConfigLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_CONFIG_KEY);
      if (raw) setConfig(JSON.parse(raw) as SessionConfig);
    } catch {}
    setConfigLoaded(true);
  }, []);

  const { videoRef, status: cameraStatus, error: cameraError } =
    useCamera(true);

  // Stage machine: setup -> body-check -> countdown -> active -> complete
  const [stage, setStage] = useState<Stage>("setup");
  const [countdown, setCountdown] = useState(3);

  const session = useSession(config);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const timer = useTimer({
    roundLengthSec: config.roundLengthSec,
    roundCount: config.roundCount,
    restSec: config.restSec,
    onRoundEnd: () => {
      sessionRef.current.endRound();
    },
    onSessionEnd: () => {
      // Persist data and navigate to summary.
      finalizeAndGoToSummary();
    },
  });
  const timerRef = useRef(timer);
  timerRef.current = timer;

  // When a new round begins in the timer, tell the session to start tracking it.
  useEffect(() => {
    if (timer.phase === "round") {
      sessionRef.current.beginRound(timer.currentRound);
    }
  }, [timer.phase, timer.currentRound]);

  // Strike detection active only during rounds (not during rest/countdown/setup).
  const strikeEnabled = stage === "active" && timer.phase === "round" && !timer.paused;
  const [lastStrikeForFlash, setLastStrikeForFlash] = useState<number | null>(null);
  const [strikeTick, setStrikeTick] = useState(0);
  const [lastStruckType, setLastStruckType] = useState<StrikeType | null>(null);
  const [highlightedLimbs, setHighlightedLimbs] = useState<ReadonlySet<number>>(
    new Set()
  );
  const highlightTimeoutRef = useRef<number | null>(null);

  const handleStrike = useCallback((strike: DetectedStrike) => {
    sessionRef.current.recordStrike(strike);
    setLastStrikeForFlash(strike.timestamp);
    setLastStruckType(strike.type);
    setStrikeTick((t) => t + 1);
    setHighlightedLimbs(new Set(strike.limbIndices));
    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedLimbs(new Set());
    }, 300);
  }, []);

  const strikeDetection = useStrikeDetection({
    enabled: strikeEnabled,
    onStrike: handleStrike,
  });

  // Propagate stance from classifier into session state.
  useEffect(() => {
    if (strikeDetection.stance) {
      sessionRef.current.setStance(strikeDetection.stance);
    }
  }, [strikeDetection.stance]);

  // Feed pose frames into the classifier.
  const handlePoseFrame = useCallback(
    (frame: PoseFrame) => {
      strikeDetection.pushFrame(frame);
    },
    [strikeDetection]
  );

  const { ready: poseReady, fps, confidence, lastFrame } = usePoseDetection({
    videoRef,
    enabled: cameraStatus === "active" && stage !== "complete",
    onFrame: handlePoseFrame,
  });

  // ---- Body check → countdown → active progression ----
  // Require a few frames of decent confidence before moving off body-check.
  const stageRef = useRef(stage);
  stageRef.current = stage;
  useEffect(() => {
    if (stage !== "setup") return;
    if (cameraStatus === "active" && poseReady) setStage("body-check");
  }, [stage, cameraStatus, poseReady]);

  // Require ALL key landmarks (head, shoulders, hips, ankles) to be
  // visible with visibility >= 0.5 before leaving body-check. This is a
  // stricter proxy for "full body in frame" than average confidence.
  const bodyCheckPassed = useMemo(() => {
    if (!lastFrame) return false;
    const required = [
      LM.NOSE,
      LM.LEFT_SHOULDER,
      LM.RIGHT_SHOULDER,
      LM.LEFT_HIP,
      LM.RIGHT_HIP,
      LM.LEFT_ANKLE,
      LM.RIGHT_ANKLE,
    ];
    for (const i of required) {
      const lm = lastFrame.landmarks[i];
      if (!lm) return false;
      const vis = lm.visibility ?? 0;
      if (vis < 0.5) return false;
      // Also require the point to actually fall inside the frame.
      if (lm.x < 0 || lm.x > 1 || lm.y < 0 || lm.y > 1) return false;
    }
    return true;
  }, [lastFrame]);

  const bodyCheckHoldRef = useRef(0);
  useEffect(() => {
    if (stage !== "body-check") {
      bodyCheckHoldRef.current = 0;
      return;
    }
    if (bodyCheckPassed) {
      bodyCheckHoldRef.current += 1;
      // ~10 frames (~0.3s at 30fps) of sustained full-body visibility
      if (bodyCheckHoldRef.current >= 10) {
        setStage("countdown");
        setCountdown(3);
      }
    } else {
      bodyCheckHoldRef.current = 0;
    }
  }, [stage, bodyCheckPassed, lastFrame]);

  useEffect(() => {
    if (stage !== "countdown") return;
    const id = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(id);
          setStage("active");
          sessionRef.current.startSession();
          timerRef.current.start();
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [stage]);

  // ---- Finalization ----
  const finalizeAndGoToSummary = useCallback(() => {
    // Ensure current round's duration is captured if user ended mid-round.
    if (timerRef.current.phase === "round") {
      sessionRef.current.endRound();
    }
    const data = sessionRef.current.buildSessionData();
    try {
      sessionStorage.setItem(SUMMARY_KEY, JSON.stringify(data));
      localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(data));
    } catch {}
    router.push("/summary");
  }, [router]);

  const handleEndSession = useCallback(() => {
    timerRef.current.endSession();
    // onSessionEnd callback will finalize + navigate.
  }, []);

  // ---- Memoised derived UI bits ----
  const isPoseStale = useMemo(() => {
    if (!lastFrame) return true;
    return performance.now() - lastFrame.timestamp > 2000;
  }, [lastFrame]);

  const [, forceStaleCheck] = useState(0);
  useEffect(() => {
    if (stage !== "active") return;
    const id = setInterval(() => forceStaleCheck((t) => (t + 1) & 0xff), 500);
    return () => clearInterval(id);
  }, [stage]);

  if (!configLoaded) return null;

  return (
    <div className="min-h-dvh flex flex-col bg-bg-primary relative">
      <StrikeFlash trigger={lastStrikeForFlash} />

      {/* ===== Top bar ===== */}
      <header className="bg-panel-bg border-b border-structural/30 flex justify-between items-center px-4 py-2 h-14 shrink-0 z-20">
        <button
          onClick={handleEndSession}
          className="flex items-center gap-2 text-hazard hover:opacity-80 font-headline uppercase tracking-[0.18em] font-bold text-sm"
        >
          [ABORT]
        </button>
        <div className="font-headline uppercase tracking-[0.22em] font-bold text-[12px] text-text-primary">
          [ROUND {formatRound(timer.currentRound)}/{formatRoundCount(config.roundCount)}]
        </div>
        <Timer
          remainingSec={timer.remainingSec}
          label={timer.phase === "rest" ? "REST_INTERVAL" : "TIME_REMAINING"}
        />
      </header>

      <main className="flex-1 flex flex-col gap-3 p-3 overflow-hidden">
        <CameraFeed
          ref={videoRef}
          className="h-[55vh] min-h-[280px] flex-shrink-0"
          corners={
            <>
              <div className="absolute top-2 left-2 font-mono text-[9px] text-status tracking-tighter bg-status/10 px-2 py-1 border border-status/20 z-10">
                [POSE_CONFIDENCE: {confidence.toFixed(2)}]
              </div>
              <div className="absolute top-2 right-2 font-mono text-[9px] text-status tracking-tighter bg-status/10 px-2 py-1 border border-status/20 z-10">
                [FPS: {fps.toFixed(0).padStart(2, "0")}]
              </div>
              {strikeDetection.stance && (
                <div className="absolute bottom-2 right-2 font-mono text-[9px] text-status tracking-tighter bg-status/10 px-2 py-1 border border-status/20 z-10">
                  [STANCE: {strikeDetection.stance.toUpperCase()}]
                </div>
              )}
              {timer.phase === "rest" && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 text-center pointer-events-auto">
                  <div className="font-mono text-[10px] text-structural tracking-widest uppercase mb-1">
                    [REST_INTERVAL]
                  </div>
                  <div className="font-mono text-6xl font-bold text-status text-glow-cyan tracking-tighter">
                    {formatTime(timer.remainingSec)}
                  </div>
                  <button
                    onClick={timerRef.current.skipRest}
                    className="mt-3 border border-hazard px-4 py-2 font-headline font-bold text-xs uppercase tracking-widest2 text-hazard hover:bg-hazard/10"
                  >
                    [ SKIP REST ]
                  </button>
                </div>
              )}
            </>
          }
          overlay={
            cameraStatus !== "active" ? (
              <div className="text-center px-4">
                <p className="font-mono text-status/60 text-sm tracking-widest">
                  {statusMessage(cameraStatus, cameraError)}
                </p>
              </div>
            ) : stage === "setup" || !poseReady ? (
              <div className="text-center px-4">
                <p className="font-mono text-status/60 text-sm tracking-widest animate-pulse-hud">
                  [LOADING_POSE_ENGINE]
                </p>
              </div>
            ) : stage === "body-check" ? (
              <div className="text-center px-4">
                <p className="font-mono text-hazard text-sm tracking-widest animate-pulse-hud">
                  [BODY_CHECK // AWAITING_FULL_FRAME]
                </p>
                <p className="font-mono text-structural text-[10px] tracking-widest mt-2">
                  {bodyCheckPassed
                    ? "[LOCKED_IN] HOLD STEADY…"
                    : "[STEP_BACK] HEAD + HIPS + ANKLES MUST BE VISIBLE"}
                </p>
              </div>
            ) : stage === "countdown" ? (
              <div className="text-center px-4">
                <p className="font-mono text-structural text-[10px] tracking-widest uppercase">
                  [ENGAGE_IN]
                </p>
                <div className="font-mono text-8xl font-bold text-hazard text-glow-orange animate-countdown-flash">
                  {countdown}
                </div>
              </div>
            ) : stage === "active" && timer.phase === "round" && isPoseStale ? (
              <div className="text-center px-4">
                <p className="font-mono text-hazard text-sm tracking-widest animate-pulse-hud">
                  [STEP_INTO_FRAME]
                </p>
              </div>
            ) : null
          }
        >
          <PoseOverlay
            landmarks={lastFrame?.landmarks ?? null}
            highlightedIndices={highlightedLimbs}
          />
        </CameraFeed>

        {/* ===== Telemetry ===== */}
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[9px] text-structural uppercase tracking-widest">
            [STRIKE_TELEMETRY]
          </h2>
          <StrikeCounters
            counters={session.counters}
            lastStruck={lastStruckType}
            strikeTick={strikeTick}
          />
        </section>

        <StrikeFeed strikes={session.recent} />

        {isDebug && <DebugPanel debug={strikeDetection.debug} />}
      </main>

      <footer className="p-3 grid grid-cols-2 gap-3 border-t border-structural/30 shrink-0">
        <Button
          variant="secondary"
          onClick={() => (timer.paused ? timer.resume() : timer.pause())}
        >
          {timer.paused ? "[ RESUME ]" : "[ PAUSE ]"}
        </Button>
        <Button variant="danger" onClick={handleEndSession}>
          [ END SESSION ]
        </Button>
      </footer>
    </div>
  );
}

function DebugPanel({
  debug,
}: {
  debug: ReturnType<typeof useStrikeDetection>["debug"];
}) {
  // Local state mirrors DETECTION so the sliders re-render this component.
  const [thresholds, setThresholds] = useState({
    WRIST_VELOCITY_THRESHOLD: DETECTION.WRIST_VELOCITY_THRESHOLD,
    ANKLE_VELOCITY_THRESHOLD: DETECTION.ANKLE_VELOCITY_THRESHOLD,
    ELBOW_VELOCITY_THRESHOLD: DETECTION.ELBOW_VELOCITY_THRESHOLD,
    HIP_ROTATION_THRESHOLD: DETECTION.HIP_ROTATION_THRESHOLD,
    MIN_CONFIDENCE: DETECTION.MIN_CONFIDENCE,
    STRIKE_COOLDOWN_MS: DETECTION.STRIKE_COOLDOWN_MS,
  });

  const setThreshold = <K extends keyof typeof thresholds>(
    key: K,
    value: number
  ) => {
    (DETECTION as unknown as Record<string, number>)[key as string] = value;
    setThresholds((t) => ({ ...t, [key]: value }));
  };

  return (
    <section className="border border-structural p-3 bg-panel-bg font-mono text-[10px] text-structural">
      <div className="text-hazard mb-2">[DEBUG_PANEL]</div>
      {debug ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-3">
          <span>WRIST_V_L: {debug.wristVelL.toFixed(2)}</span>
          <span>WRIST_V_R: {debug.wristVelR.toFixed(2)}</span>
          <span>ANKLE_V_L: {debug.ankleVelL.toFixed(2)}</span>
          <span>ANKLE_V_R: {debug.ankleVelR.toFixed(2)}</span>
          <span>HIP_ROT: {debug.hipRotation.toFixed(1)}°</span>
          <span>ELBOW_L/R: {debug.elbowAngleL.toFixed(0)}°/{debug.elbowAngleR.toFixed(0)}°</span>
        </div>
      ) : (
        <div className="mb-3">[AWAITING_DATA]</div>
      )}
      <div className="border-t border-structural/30 pt-2 space-y-1">
        <DebugSlider
          label="WRIST_THR"
          min={0.5}
          max={6}
          step={0.1}
          value={thresholds.WRIST_VELOCITY_THRESHOLD}
          onChange={(v) => setThreshold("WRIST_VELOCITY_THRESHOLD", v)}
        />
        <DebugSlider
          label="ANKLE_THR"
          min={0.5}
          max={6}
          step={0.1}
          value={thresholds.ANKLE_VELOCITY_THRESHOLD}
          onChange={(v) => setThreshold("ANKLE_VELOCITY_THRESHOLD", v)}
        />
        <DebugSlider
          label="ELBOW_THR"
          min={0.3}
          max={5}
          step={0.1}
          value={thresholds.ELBOW_VELOCITY_THRESHOLD}
          onChange={(v) => setThreshold("ELBOW_VELOCITY_THRESHOLD", v)}
        />
        <DebugSlider
          label="HIP_ROT_THR"
          min={5}
          max={60}
          step={1}
          value={thresholds.HIP_ROTATION_THRESHOLD}
          onChange={(v) => setThreshold("HIP_ROTATION_THRESHOLD", v)}
        />
        <DebugSlider
          label="MIN_CONF"
          min={0.3}
          max={0.95}
          step={0.05}
          value={thresholds.MIN_CONFIDENCE}
          onChange={(v) => setThreshold("MIN_CONFIDENCE", v)}
        />
        <DebugSlider
          label="COOLDOWN_MS"
          min={100}
          max={1200}
          step={50}
          value={thresholds.STRIKE_COOLDOWN_MS}
          onChange={(v) => setThreshold("STRIKE_COOLDOWN_MS", v)}
        />
      </div>
    </section>
  );
}

function DebugSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[9px]">
      <span className="w-20 text-structural">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-hazard"
      />
      <span className="w-10 text-right text-text-primary">
        {Number.isInteger(step) ? value.toFixed(0) : value.toFixed(2)}
      </span>
    </label>
  );
}

function statusMessage(status: string, error: string | null): string {
  switch (status) {
    case "idle":
      return "[STANDBY]";
    case "requesting":
      return "[REQUESTING_CAMERA_ACCESS]";
    case "active":
      return "[AWAITING_POSE_DATA]";
    case "denied":
      return error ?? "[CAMERA_ACCESS_DENIED]";
    case "no-camera":
      return error ?? "[NO_CAMERA_DETECTED]";
    default:
      return error ?? "[CAMERA_ERROR]";
  }
}

function formatTime(totalSec: number): string {
  if (!Number.isFinite(totalSec)) return "FREE";
  const m = Math.floor(Math.max(0, totalSec) / 60);
  const s = Math.floor(Math.max(0, totalSec) % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatRound(currentRound: number): string {
  return String(Math.max(1, currentRound)).padStart(2, "0");
}

function formatRoundCount(count: number): string {
  if (!Number.isFinite(count)) return "∞";
  return String(count).padStart(2, "0");
}
