interface CoreMetricsProps {
  totalStrikes: number;
  durationSec: number;
  strikeRate: number;
}

export function CoreMetrics({
  totalStrikes,
  durationSec,
  strikeRate,
}: CoreMetricsProps) {
  return (
    <div className="grid grid-cols-3 border border-structural/40">
      <Cell label="TOTAL_STRIKES" value={String(totalStrikes)} accent />
      <Cell label="DURATION" value={formatDuration(durationSec)} />
      <Cell label="STRIKE_RATE" value={strikeRate.toFixed(1)} last />
    </div>
  );
}

function Cell({
  label,
  value,
  accent = false,
  last = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={
        "bg-panel-bg p-4 flex flex-col items-center justify-center " +
        (last ? "" : "border-r border-structural/40")
      }
    >
      <span className="font-mono text-[10px] text-structural mb-1 uppercase tracking-wider">
        [{label}]
      </span>
      <span
        className={
          "font-mono font-bold text-[32px] leading-none tracking-tighter " +
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
