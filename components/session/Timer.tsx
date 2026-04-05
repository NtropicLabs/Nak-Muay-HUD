interface TimerProps {
  remainingSec: number;
  label?: string;
  warning?: boolean;
}

/**
 * Round countdown display. Orange when <30s remaining, cyan otherwise.
 * "FREE" rounds (Infinity) show a static ∞ instead of a countdown.
 */
export function Timer({
  remainingSec,
  label = "TIME_REMAINING",
  warning,
}: TimerProps) {
  const isFree = !Number.isFinite(remainingSec);
  const isWarn = warning ?? (!isFree && remainingSec > 0 && remainingSec <= 30);
  const display = isFree
    ? "∞"
    : `${Math.floor(Math.max(0, remainingSec) / 60)}:${String(
        Math.floor(Math.max(0, remainingSec) % 60)
      ).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-end">
      <span className="font-mono text-[8px] text-structural uppercase tracking-widest">
        [{label}]
      </span>
      <span
        className={
          "font-mono text-[28px] font-bold leading-none tracking-tighter " +
          (isWarn
            ? "text-hazard animate-pulse-hud text-glow-orange"
            : "text-status text-glow-cyan")
        }
      >
        {display}
      </span>
    </div>
  );
}
