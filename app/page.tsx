"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PillSelect } from "@/components/ui/PillSelect";
import {
  DEFAULT_SESSION_CONFIG,
  ROUND_LENGTH_OPTIONS,
  ROUND_COUNT_OPTIONS,
  REST_INTERVAL_OPTIONS,
} from "@/lib/session/config";
import type { SessionConfig, SessionData } from "@/lib/session/types";
import { STRIKE_LABELS } from "@/lib/session/types";

const SESSION_CONFIG_KEY = "strike-protocol:config";
const LAST_SESSION_KEY = "strike-protocol:last-session";
const PENDING_CONFIG_KEY = "strike-protocol:pending-config";

export default function HomePage() {
  const router = useRouter();
  const [config, setConfig] = useState<SessionConfig>(DEFAULT_SESSION_CONFIG);
  const [lastSession, setLastSession] = useState<SessionData | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem(SESSION_CONFIG_KEY);
      if (savedConfig) setConfig(JSON.parse(savedConfig) as SessionConfig);
      const savedLast = localStorage.getItem(LAST_SESSION_KEY);
      if (savedLast) setLastSession(JSON.parse(savedLast) as SessionData);
    } catch {
      // ignore corrupted storage — use defaults
    }
    setHydrated(true);
  }, []);

  const updateConfig = (patch: Partial<SessionConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    try {
      localStorage.setItem(SESSION_CONFIG_KEY, JSON.stringify(next));
    } catch {}
  };

  const initiate = () => {
    try {
      sessionStorage.setItem(PENDING_CONFIG_KEY, JSON.stringify(config));
    } catch {}
    router.push("/session");
  };

  return (
    <div className="min-h-dvh flex flex-col">
      {/* ===== Top header ===== */}
      <header className="bg-panel-bg border-b border-structural/30 px-6 py-2 flex items-center justify-between sticky top-0 z-40">
        <div className="flex flex-col">
          <span className="font-headline uppercase tracking-[0.18em] font-bold text-sm text-hazard">
            [STRIKE_PROTOCOL]
          </span>
          <span className="font-mono text-[9px] text-structural">V1.0</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-status animate-pulse-hud" />
          <span className="font-mono text-[10px] text-status">
            [SYSTEM_ONLINE]
          </span>
        </div>
      </header>

      {/* ===== Telemetry strip ===== */}
      <div className="bg-panel-bg border-b border-structural/30 px-6 py-1">
        <p className="font-mono text-[10px] text-structural whitespace-nowrap overflow-hidden">
          <span className="text-status">[SYS]</span> CAMERA:{" "}
          <span className="text-text-primary">STANDBY</span> | POSE_ENGINE:{" "}
          <span className="text-text-primary">READY</span> | BUFF:{" "}
          <span className="text-text-primary">OK</span> | MODE:{" "}
          <span className="text-status">NOMINAL</span>
        </p>
      </div>

      <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* ===== Last session panel ===== */}
        {hydrated && lastSession && (
          <section className="flex flex-col gap-2">
            <h2 className="font-mono text-[11px] text-structural tracking-widest uppercase">
              [LAST_SESSION // {formatDateShort(lastSession.startTime)}]
            </h2>
            <div className="bg-panel-bg border border-structural p-4 flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-4">
                <MetricCell
                  label="STRIKES"
                  value={String(lastSession.totalStrikes)}
                  accent
                />
                <MetricCell
                  label="DURATION"
                  value={formatDuration(lastSession.totalDuration)}
                  borderRight
                />
                <MetricCell
                  label="STR/MIN"
                  value={lastSession.averageStrikesPerMinute.toFixed(1)}
                />
              </div>
              {lastSession.dominantStrike && (
                <div className="pt-2 border-t border-structural/30 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-hazard" />
                  <span className="font-mono text-[10px] text-structural">
                    TOP_STRIKE:{" "}
                    <span className="text-text-primary">
                      {STRIKE_LABELS[lastSession.dominantStrike]}
                    </span>{" "}
                    —{" "}
                    <span className="text-hazard">
                      {lastSession.strikeBreakdown[lastSession.dominantStrike]}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ===== Session config ===== */}
        <section className="flex flex-col gap-4">
          <h2 className="font-mono text-[11px] text-structural tracking-widest uppercase">
            [SESSION_CONFIG]
          </h2>
          <PillSelect
            label="ROUND_LENGTH"
            value={config.roundLengthSec}
            options={ROUND_LENGTH_OPTIONS}
            onChange={(v) => updateConfig({ roundLengthSec: v })}
          />
          <PillSelect
            label="ROUND_COUNT"
            value={config.roundCount}
            options={ROUND_COUNT_OPTIONS}
            onChange={(v) => updateConfig({ roundCount: v })}
          />
          <PillSelect
            label="REST_INTERVAL"
            value={config.restSec}
            options={REST_INTERVAL_OPTIONS}
            onChange={(v) => updateConfig({ restSec: v })}
          />
        </section>

        {/* ===== Primary action ===== */}
        <div className="mt-2">
          <Button variant="primary" fullWidth onClick={initiate}>
            [ INITIATE SESSION ]
          </Button>
        </div>

        {/* ===== Footer decor ===== */}
        <div className="flex justify-between items-end mt-4 pb-8">
          <div className="w-24 h-24 border-l border-b border-structural p-2 flex flex-col justify-end">
            <span className="font-mono text-[8px] text-structural leading-tight">
              REF_491-B
              <br />
              POS_X: 0.12
              <br />
              POS_Y: 0.88
            </span>
          </div>
          <div className="flex-grow mx-4 mb-2 h-px bg-structural/30" />
          <div className="text-right">
            <span className="font-mono text-[8px] text-structural uppercase">
              STRIKE_PROTOCOL // MUAY_THAI_TELEMETRY // V1.0
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

function MetricCell({
  label,
  value,
  accent = false,
  borderRight = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  borderRight?: boolean;
}) {
  return (
    <div
      className={
        "flex flex-col gap-1 " +
        (borderRight ? "border-r border-structural/30 pr-4 " : "")
      }
    >
      <span className="font-mono text-[9px] text-structural">{label}</span>
      <span
        className={
          "font-headline text-2xl font-bold " +
          (accent ? "text-status text-glow-cyan" : "text-text-primary")
        }
      >
        {value}
      </span>
    </div>
  );
}

function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = d
    .toLocaleString("en", { month: "short" })
    .toUpperCase();
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}
