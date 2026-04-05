"use client";

import { useEffect, useRef, useState } from "react";
import {
  STRIKE_LABELS,
  STRIKE_TYPES,
  type StrikeType,
} from "@/lib/session/types";

interface StrikeCountersProps {
  counters: Record<StrikeType, number>;
  /** Most recently detected strike type — triggers a brief bump animation. */
  lastStruck?: StrikeType | null;
  /** Monotonically-increasing tick, changes whenever lastStruck should re-flash. */
  strikeTick?: number;
}

/**
 * Horizontal strip of 8 strike-type cells with live counters and a
 * segmented "saturation" bar underneath (fills proportional to max count).
 */
export function StrikeCounters({
  counters,
  lastStruck,
  strikeTick,
}: StrikeCountersProps) {
  const max = Math.max(1, ...STRIKE_TYPES.map((t) => counters[t]));
  return (
    <div className="grid grid-cols-8 gap-1 h-20">
      {STRIKE_TYPES.map((t) => (
        <CounterCell
          key={t}
          type={t}
          count={counters[t]}
          max={max}
          active={lastStruck === t}
          tick={strikeTick ?? 0}
        />
      ))}
    </div>
  );
}

function CounterCell({
  type,
  count,
  max,
  active,
  tick,
}: {
  type: StrikeType;
  count: number;
  max: number;
  active: boolean;
  tick: number;
}) {
  const [animKey, setAnimKey] = useState(0);
  const lastTickRef = useRef(tick);
  useEffect(() => {
    if (active && tick !== lastTickRef.current) {
      lastTickRef.current = tick;
      setAnimKey((k) => k + 1);
    }
  }, [active, tick]);

  // Segmented bar: 4 cells, fill based on count/max.
  const ratio = count / max;
  const segments = 4;
  const filled = Math.min(segments, Math.ceil(ratio * segments));

  return (
    <div
      className={
        "flex flex-col justify-between p-2 bg-panel-bg transition-colors " +
        (active
          ? "border border-hazard border-l-2"
          : "border border-structural/40")
      }
    >
      <span
        className={
          "font-mono text-[8px] uppercase tracking-tight " +
          (active ? "text-hazard" : "text-structural")
        }
      >
        {STRIKE_LABELS[type]}
      </span>
      <span
        key={animKey}
        className={
          "font-mono text-xl font-bold leading-none " +
          (active ? "animate-counter-bump text-text-primary" : "text-text-primary")
        }
      >
        {String(count).padStart(2, "0")}
      </span>
      <div className="flex gap-0.5 h-1">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={
              "w-1/4 " + (i < filled ? "bg-status" : "bg-status/20")
            }
          />
        ))}
      </div>
    </div>
  );
}
