"use client";

import { useEffect, useRef } from "react";
import type { Landmark } from "@/lib/pose/landmarks";
import { POSE_CONNECTIONS } from "@/lib/pose/detector";

interface PoseOverlayProps {
  landmarks: Landmark[] | null;
  /** Indices of landmarks whose edges should currently be highlighted (orange). */
  highlightedIndices?: ReadonlySet<number>;
  mirrored?: boolean;
}

/**
 * Canvas that draws the pose skeleton on top of the video. The canvas is
 * sized to its parent container and landmarks (normalised 0..1) are mapped
 * onto it. We mirror the canvas horizontally to match the mirrored video.
 */
export function PoseOverlay({
  landmarks,
  highlightedIndices,
  mirrored = true,
}: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const landmarksRef = useRef<Landmark[] | null>(landmarks);
  const highlightedRef = useRef<ReadonlySet<number> | undefined>(
    highlightedIndices
  );

  landmarksRef.current = landmarks;
  highlightedRef.current = highlightedIndices;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const lms = landmarksRef.current;
      const highlighted = highlightedRef.current;
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      if (lms && lms.length > 0) {
        // Connections
        ctx.lineWidth = 2;
        for (const [a, b] of POSE_CONNECTIONS) {
          const la = lms[a];
          const lb = lms[b];
          if (!la || !lb) continue;
          const isHot =
            !!highlighted && (highlighted.has(a) || highlighted.has(b));
          ctx.strokeStyle = isHot
            ? "rgba(255, 95, 31, 0.95)"
            : "rgba(0, 245, 212, 0.6)";
          ctx.beginPath();
          ctx.moveTo(la.x * rect.width, la.y * rect.height);
          ctx.lineTo(lb.x * rect.width, lb.y * rect.height);
          ctx.stroke();
        }
        // Joints
        for (let i = 0; i < lms.length; i++) {
          const lm = lms[i];
          const hot = !!highlighted && highlighted.has(i);
          ctx.fillStyle = hot
            ? "rgba(255, 95, 31, 1)"
            : "rgba(0, 245, 212, 0.9)";
          ctx.beginPath();
          ctx.arc(lm.x * rect.width, lm.y * rect.height, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ transform: mirrored ? "scaleX(-1)" : undefined }}
    />
  );
}
