import { HTMLAttributes, ReactNode } from "react";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
  trailing?: ReactNode;
  children: ReactNode;
  noPad?: boolean;
}

/**
 * Panel — a bracketed HUD section with a [LABEL] header,
 * 1px structural border, flat panel background.
 */
export function Panel({
  label,
  trailing,
  children,
  noPad = false,
  className = "",
  ...rest
}: PanelProps) {
  return (
    <section className={`flex flex-col gap-2 ${className}`} {...rest}>
      {(label || trailing) && (
        <div className="flex items-end justify-between gap-4">
          {label && (
            <h2 className="font-mono text-[10px] text-structural tracking-widest uppercase">
              [{label}]
            </h2>
          )}
          {trailing}
        </div>
      )}
      <div
        className={
          "bg-panel-bg border border-structural " +
          (noPad ? "" : "p-4 ") +
          "relative"
        }
      >
        {children}
      </div>
    </section>
  );
}
