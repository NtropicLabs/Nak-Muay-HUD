"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CoreMetrics } from "@/components/summary/CoreMetrics";
import { RoundTable } from "@/components/summary/RoundTable";
import { StrikeBreakdown } from "@/components/summary/StrikeBreakdown";
import { Timeline } from "@/components/summary/Timeline";
import { Button } from "@/components/ui/Button";
import type { SessionData } from "@/lib/session/types";

const SUMMARY_KEY = "strike-protocol:summary-data";
const LAST_SESSION_KEY = "strike-protocol:last-session";

export default function SummaryPage() {
  const router = useRouter();
  const [data, setData] = useState<SessionData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw =
        sessionStorage.getItem(SUMMARY_KEY) ??
        localStorage.getItem(LAST_SESSION_KEY);
      if (raw) setData(JSON.parse(raw) as SessionData);
    } catch {}
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  if (!data) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-6">
        <div className="text-center font-mono text-structural space-y-4">
          <div className="text-hazard tracking-widest">[NO_SESSION_DATA]</div>
          <Link href="/" className="text-status underline">
            [RETURN_HOME]
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-bg-primary">
      <header className="bg-panel-bg border-b border-structural/30 flex justify-between items-center px-6 py-2 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <span className="font-headline uppercase tracking-[0.18em] font-bold text-sm text-hazard">
            [STRIKE_PROTOCOL]
          </span>
        </div>
        <div className="font-headline uppercase tracking-[0.15em] font-bold text-xs text-hazard">
          V1.0
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto p-4 md:p-8 space-y-8 pb-16 flex-1">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-hazard font-headline font-bold text-2xl tracking-widest3 uppercase">
            [SESSION_COMPLETE]
          </h1>
          <p className="font-mono text-structural text-xs tracking-widest">
            [{formatDateLong(data.startTime)}]
          </p>
          <div className="h-px w-full bg-structural/30 mt-4" />
        </div>

        <CoreMetrics
          totalStrikes={data.totalStrikes}
          durationSec={data.totalDuration}
          strikeRate={data.averageStrikesPerMinute}
        />

        <StrikeBreakdown
          breakdown={data.strikeBreakdown}
          dominant={data.dominantStrike}
        />

        <RoundTable
          rounds={data.rounds}
          fatiguePercent={data.fatiguePercent}
        />

        <Timeline rounds={data.rounds} />

        {/* Meta */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-text-primary tracking-widest">
              [SESSION_META]
            </span>
            <div className="flex-grow h-px bg-structural/30" />
          </div>
          <div className="bg-panel-bg border border-structural/40 p-4 font-mono text-[10px] text-structural grid grid-cols-2 gap-y-1 gap-x-4">
            <div>STANCE: <span className="text-text-primary">{data.stance.toUpperCase()}</span></div>
            <div>
              ROUND_LENGTH:{" "}
              <span className="text-text-primary">
                {Number.isFinite(data.config.roundLengthSec)
                  ? `${data.config.roundLengthSec}s`
                  : "FREE"}
              </span>
            </div>
            <div>
              ROUND_COUNT:{" "}
              <span className="text-text-primary">
                {Number.isFinite(data.config.roundCount)
                  ? data.config.roundCount
                  : "∞"}
              </span>
            </div>
            <div>
              REST_INTERVAL:{" "}
              <span className="text-text-primary">{data.config.restSec}s</span>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button
              variant="primary"
              fullWidth
              onClick={() => router.push("/session")}
            >
              [ NEW SESSION ]
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => router.push("/")}
            >
              [ RETURN HOME ]
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function formatDateLong(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en", { month: "short" }).toUpperCase();
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} // ${hh}:${mm}`;
}
