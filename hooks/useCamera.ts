"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CAMERA } from "@/lib/constants";

export type CameraStatus =
  | "idle"
  | "requesting"
  | "active"
  | "denied"
  | "no-camera"
  | "error";

interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  status: CameraStatus;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Requests the user-facing (selfie) camera and binds it to a <video> element.
 * Mirroring is done purely via CSS on the consumer side.
 */
export function useCamera(autoStart = true): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setStatus("no-camera");
      setError("[NO_CAMERA_DETECTED]");
      return;
    }
    setStatus("requesting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: CAMERA.WIDTH },
          height: { ideal: CAMERA.HEIGHT },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // iOS Safari: playsInline + muted are required for inline playback.
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        try {
          await videoRef.current.play();
        } catch {
          // autoplay rejection is rare with muted; ignore and let UI handle
        }
      }
      setStatus("active");
    } catch (e) {
      const err = e as DOMException;
      if (err.name === "NotAllowedError" || err.name === "SecurityError") {
        setStatus("denied");
        setError(
          "[CAMERA_ACCESS_DENIED] — Enable camera in your browser settings"
        );
      } else if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
        setStatus("no-camera");
        setError("[NO_CAMERA_DETECTED]");
      } else {
        setStatus("error");
        setError(`[CAMERA_ERROR] ${err.message || "unknown"}`);
      }
    }
  }, []);

  useEffect(() => {
    if (autoStart) void start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { videoRef, status, error, start, stop };
}
