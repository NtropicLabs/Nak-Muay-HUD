"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CameraFeed } from "@/components/session/CameraFeed";
import { Button } from "@/components/ui/Button";
import { useCamera } from "@/hooks/useCamera";
import { DEFAULT_SESSION_CONFIG } from "@/lib/session/config";
import type { SessionConfig } from "@/lib/session/types";

const PENDING_CONFIG_KEY = "strike-protocol:pending-config";

export default function SessionPage() {
  const { videoRef, status, error } = useCamera(true);
  const [config, setConfig] = useState<SessionConfig>(DEFAULT_SESSION_CONFIG);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_CONFIG_KEY);
      if (raw) setConfig(JSON.parse(raw) as SessionConfig);
    } catch {}
  }, []);

  return (
    <div className="min-h-dvh flex flex-col bg-bg-primary">
      {/* ===== Top bar ===== */}
      <header className="bg-panel-bg border-b border-structural/30 flex justify-between items-center px-6 py-2 h-14 shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2 text-hazard hover:opacity-80"
        >
          <span className="font-headline uppercase tracking-[0.18em] font-bold text-sm">
            [ABORT]
          </span>
        </Link>
        <div className="font-headline uppercase tracking-[0.22em] font-bold text-[12px] text-text-primary">
          [ROUND 01/{formatRoundCount(config.roundCount)}]
        </div>
        <div className="flex flex-col items-end">
          <span className="font-mono text-[8px] text-structural uppercase tracking-widest">
            [TIME_REMAINING]
          </span>
          <span className="font-mono text-[28px] font-bold leading-none tracking-tighter text-hazard">
            {formatTime(config.roundLengthSec)}
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-3 p-3 overflow-hidden">
        <CameraFeed
          ref={videoRef}
          className="h-[55vh] min-h-[280px] flex-shrink-0"
          corners={
            <>
              <div className="absolute top-2 left-2 font-mono text-[9px] text-status tracking-tighter bg-status/10 px-2 py-1 border border-status/20">
                [POSE_CONFIDENCE: --]
              </div>
              <div className="absolute top-2 right-2 font-mono text-[9px] text-status tracking-tighter bg-status/10 px-2 py-1 border border-status/20">
                [FPS: --]
              </div>
            </>
          }
          overlay={
            status !== "active" ? (
              <div className="text-center px-4">
                <p className="font-mono text-status/60 text-sm tracking-widest">
                  {statusMessage(status, error)}
                </p>
              </div>
            ) : null
          }
        />

        {/* Placeholder telemetry strip — Phase 5 wires this up */}
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[9px] text-structural uppercase tracking-widest">
            [STRIKE_TELEMETRY]
          </h2>
          <div className="grid grid-cols-8 gap-1 h-16">
            {[
              "JAB",
              "CROSS",
              "HOOK",
              "UPPER",
              "KICK",
              "KNEE",
              "TEEP",
              "ELBOW",
            ].map((lbl) => (
              <div
                key={lbl}
                className="border border-structural/40 bg-panel-bg p-1.5 flex flex-col justify-between"
              >
                <span className="font-mono text-[7px] text-structural">
                  {lbl}
                </span>
                <span className="font-mono text-base font-bold text-text-primary">
                  00
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="p-3 grid grid-cols-2 gap-3 border-t border-structural/30 shrink-0">
        <Button variant="secondary">[ PAUSE ]</Button>
        <Link href="/" className="contents">
          <Button variant="danger">[ END SESSION ]</Button>
        </Link>
      </footer>
    </div>
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
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatRoundCount(count: number): string {
  if (!Number.isFinite(count)) return "∞";
  return String(count).padStart(2, "0");
}
