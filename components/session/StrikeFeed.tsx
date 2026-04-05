import { STRIKE_LABELS, type StrikeEvent } from "@/lib/session/types";

interface StrikeFeedProps {
  strikes: StrikeEvent[];
}

/**
 * The last 3 strikes, newest first, in a dotted-leader list.
 * Newest row is brighter; older rows fade into structural muted.
 */
export function StrikeFeed({ strikes }: StrikeFeedProps) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-mono text-[9px] text-structural uppercase tracking-widest">
        [STRIKE_FEED // LAST_3]
      </h2>
      <div className="space-y-1 font-mono text-[11px] min-h-[72px]">
        {strikes.length === 0 && (
          <div className="text-structural/60 text-[10px] tracking-widest">
            [NO_STRIKES_LOGGED]
          </div>
        )}
        {strikes.map((s, idx) => {
          const mmss = formatStamp(s.timestamp);
          const sideLabel = s.side === "left" ? "L" : "R";
          const conf = Math.round(s.confidence * 7);
          const bar = "▮".repeat(conf) + "░".repeat(7 - conf);
          const dim = idx > 0;
          return (
            <div
              key={`${s.timestamp}-${idx}`}
              className={
                "flex items-center gap-3 " +
                (dim ? "text-structural" : "text-text-primary")
              }
            >
              <span className={dim ? "" : "text-status/80"}>{mmss}</span>
              <span
                className={
                  "flex-1 border-b border-dotted " +
                  (dim ? "border-structural/20" : "border-structural/60")
                }
              />
              <span className={dim ? "" : "font-bold"}>
                {sideLabel}.{STRIKE_LABELS[s.type]}
              </span>
              <span
                className={
                  "flex-1 border-b border-dotted " +
                  (dim ? "border-structural/20" : "border-structural/60")
                }
              />
              <span className={dim ? "text-structural/50" : "text-status"}>
                {bar}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatStamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
