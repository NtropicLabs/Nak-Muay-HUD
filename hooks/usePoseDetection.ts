"use client";

import { useEffect, useRef, useState } from "react";
import { getPoseLandmarker } from "@/lib/pose/detector";
import type { Landmark } from "@/lib/pose/landmarks";

export interface PoseFrame {
  landmarks: Landmark[];
  /** World landmarks have real-scale coordinates, better for angles/depth. */
  worldLandmarks: Landmark[];
  /** Timestamp in ms since session start (perf.now based). */
  timestamp: number;
}

interface UsePoseDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  enabled: boolean;
  onFrame?: (frame: PoseFrame) => void;
}

interface UsePoseDetectionResult {
  ready: boolean;
  error: string | null;
  fps: number;
  lastFrame: PoseFrame | null;
  /** Latest presence / detection confidence from MediaPipe (0..1). */
  confidence: number;
}

/**
 * Runs PoseLandmarker on a <video> in a requestAnimationFrame loop while
 * `enabled` is true. Reports FPS, confidence, and the latest landmarks.
 */
export function usePoseDetection({
  videoRef,
  enabled,
  onFrame,
}: UsePoseDetectionOptions): UsePoseDetectionResult {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const lastFrameRef = useRef<PoseFrame | null>(null);
  const [, setTick] = useState(0);

  // Stable ref to the latest callback so the RAF loop doesn't need to
  // resubscribe whenever the parent re-renders.
  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    if (!enabled) return;
    let rafId: number | null = null;
    let cancelled = false;
    let lastVideoTime = -1;
    let frameCount = 0;
    let fpsWindowStart = performance.now();

    (async () => {
      try {
        const landmarker = await getPoseLandmarker();
        if (cancelled) return;
        setReady(true);

        const loop = () => {
          if (cancelled) return;
          const video = videoRef.current;
          if (!video || video.readyState < 2) {
            rafId = requestAnimationFrame(loop);
            return;
          }
          // Only process on new frames
          if (video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            const now = performance.now();
            try {
              const result = landmarker.detectForVideo(video, now);
              if (result.landmarks && result.landmarks.length > 0) {
                const lms = result.landmarks[0] as Landmark[];
                const worldLms = (result.worldLandmarks?.[0] ??
                  lms) as Landmark[];
                // Average visibility as a pragmatic proxy for pose confidence
                let visSum = 0;
                let visCount = 0;
                for (const lm of lms) {
                  if (typeof lm.visibility === "number") {
                    visSum += lm.visibility;
                    visCount += 1;
                  }
                }
                const conf = visCount > 0 ? visSum / visCount : 1;
                setConfidence(conf);
                const frame: PoseFrame = {
                  landmarks: lms,
                  worldLandmarks: worldLms,
                  timestamp: now,
                };
                lastFrameRef.current = frame;
                onFrameRef.current?.(frame);
                setTick((t) => (t + 1) & 0xffff);
              } else {
                setConfidence(0);
              }
            } catch (e) {
              // Individual frame failures are non-fatal; log and continue.
              console.warn("[POSE] detectForVideo failed:", e);
            }

            frameCount += 1;
            if (now - fpsWindowStart >= 500) {
              const nextFps = (frameCount * 1000) / (now - fpsWindowStart);
              setFps(nextFps);
              frameCount = 0;
              fpsWindowStart = now;
            }
          }
          rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(`[POSE_INIT_FAILED] ${msg}`);
      }
    })();

    return () => {
      cancelled = true;
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [enabled, videoRef]);

  return {
    ready,
    error,
    fps,
    confidence,
    lastFrame: lastFrameRef.current,
  };
}
