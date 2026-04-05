"use client";

interface PillOption<T extends string | number> {
  value: T;
  label: string;
}

interface PillSelectProps<T extends string | number> {
  label: string;
  value: T;
  options: ReadonlyArray<PillOption<T>>;
  onChange: (value: T) => void;
}

/**
 * Segmented pill selector for session config.
 * Renders as a row of bracketed equal-width buttons within a 1px
 * structural border. Active = cyan fill at 20% + cyan text. Inactive
 * = muted copper text, hover fades in hazard tint.
 */
export function PillSelect<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: PillSelectProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] text-text-secondary tracking-widest uppercase">
        [{label}]
      </span>
      <div
        className="grid border border-structural"
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        }}
      >
        {options.map((opt, idx) => {
          const active = opt.value === value;
          const isLast = idx === options.length - 1;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              className={
                "py-3 text-[12px] font-mono uppercase tracking-wider transition-colors " +
                (isLast ? "" : "border-r border-structural ") +
                (active
                  ? "bg-status/20 text-status"
                  : "text-structural hover:bg-hazard/10 hover:text-hazard")
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
