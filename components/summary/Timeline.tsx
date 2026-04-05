import type { RoundData, StrikeEvent } from "@/lib/session/types";

interface TimelineProps {
  rounds: RoundData[];
}

/**
 * Visual dot timeline of session activity. Each bucket maps to one dot
 * whose intensity reflects strike density. Round dividers mark round
 * boundaries.
 */
export function Timeline({ rounds }: TimelineProps) {
  const strikes: StrikeEvent[] = rounds.flatMap((r) => r.strikes);
  const totalDuration =
    rounds.reduce((a, r) => a + r.duration, 0) || 1;
  const BUCKETS = 32;
  const buckets = new Array(BUCKETS).fill(0);
  for (const s of strikes) {
    const frac = Math.min(0.9999, s.timestamp / 1000 / totalDuration);
    const idx = Math.floor(frac * BUCKETS);
    buckets[idx] += 1;
  }
  const maxBucket = Math.max(1, ...buckets);

  // Compute divider positions as cumulative fraction of duration.
  const dividers: number[] = [];
  let acc = 0;
  for (let i = 0; i < rounds.length - 1; i++) {
    acc += rounds[i].duration;
    dividers.push(acc / totalDuration);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="font-mono text-xs text-text-primary tracking-widest">
          [TIMELINE_FLOW]
        </span>
        <div className="flex-grow h-px bg-structural/30" />
      </div>
      <div className="relative h-12 w-full flex items-center bg-panel-bg border border-structural/30 px-2">
        <div className="absolute left-2 right-2 h-px bg-structural/40" />
        {/* Dots */}
        <div className="relative flex-1 flex justify-between items-center">
          {buckets.map((count, i) => {
            const intensity = count / maxBucket;
            const dim = intensity === 0;
            return (
              <div
                key={i}
                className="w-1 h-1 bg-status"
                style={{
                  opacity: dim ? 0.12 : 0.3 + intensity * 0.7,
                  boxShadow: dim
                    ? "none"
                    : `0 0 ${4 + intensity * 6}px rgba(199,255,240,${0.4 + intensity * 0.4})`,
                }}
              />
            );
          })}
        </div>
        {/* Round dividers */}
        {dividers.map((frac, i) => (
          <div
            key={i}
            className="absolute h-8 w-px bg-hazard"
            style={{
              left: `calc(${(frac * 100).toFixed(2)}% )`,
              boxShadow: "0 0 8px #ff5f1f",
            }}
          />
        ))}
      </div>
    </section>
  );
}
