import {
  STRIKE_LABELS,
  STRIKE_TYPES,
  type StrikeType,
} from "@/lib/session/types";

interface StrikeBreakdownProps {
  breakdown: Record<StrikeType, number>;
  dominant: StrikeType | null;
}

/**
 * Horizontal bars per strike type, sorted by count (descending). The
 * dominant bar gets hazard-hatch overlay + "DOMINANT" marker.
 */
export function StrikeBreakdown({
  breakdown,
  dominant,
}: StrikeBreakdownProps) {
  const rows = STRIKE_TYPES.map((t) => ({ type: t, count: breakdown[t] })).sort(
    (a, b) => b.count - a.count
  );
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="font-mono text-xs text-text-primary tracking-widest">
          [STRIKE_ANALYSIS]
        </span>
        <div className="flex-grow h-px bg-structural/30" />
      </div>
      <div className="space-y-3 font-mono text-[11px]">
        {rows.map(({ type, count }) => {
          const pct = Math.max(2, Math.round((count / max) * 100));
          const isDominant = type === dominant && count > 0;
          return (
            <div
              key={type}
              className={
                "grid grid-cols-12 items-center gap-4 " +
                (isDominant ? "" : "opacity-70")
              }
            >
              <div
                className={
                  "col-span-2 uppercase tracking-tight " +
                  (isDominant ? "text-hazard" : "text-structural")
                }
              >
                {STRIKE_LABELS[type]}
              </div>
              <div className="col-span-8">
                <div
                  className={
                    "relative " +
                    (isDominant
                      ? "h-4 bg-panel-border"
                      : "h-3 bg-panel-border")
                  }
                >
                  <div
                    className={
                      "h-full relative " +
                      (isDominant ? "bg-hazard" : "bg-status")
                    }
                    style={{ width: `${pct}%` }}
                  >
                    {isDominant && (
                      <div className="absolute inset-0 hazard-hatch-subtle" />
                    )}
                  </div>
                </div>
              </div>
              <div className="col-span-2 flex items-center justify-between gap-2">
                <span className="text-text-primary">{count}</span>
                {isDominant && (
                  <span className="text-hazard text-[9px] font-bold">
                    ◄ DOMINANT
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
