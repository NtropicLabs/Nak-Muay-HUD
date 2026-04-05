"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

/**
 * STRIKE PROTOCOL button.
 * - primary: hazard hatch fill, orange border, bold uppercase (for the main CTA).
 * - secondary: 1px cyan border, transparent fill — for safe/secondary actions.
 * - ghost: 1px copper border, muted — for tertiary actions.
 * - danger: 1px hazard border — for abort/end session.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "secondary", fullWidth, className = "", children, ...rest },
    ref
  ) {
    const base =
      "relative font-headline font-bold uppercase tracking-widest2 text-xs leading-none " +
      "px-5 py-4 border select-none transition-none active:scale-[0.985] " +
      "disabled:opacity-40 disabled:pointer-events-none";

    const variants: Record<Variant, string> = {
      primary:
        "hazard-hatch border-2 border-hazard text-black text-sm tracking-widest3",
      secondary:
        "border-status text-status hover:bg-status/10 bg-transparent",
      ghost:
        "border-structural/60 text-text-secondary hover:border-structural hover:text-text-primary bg-transparent",
      danger:
        "border-hazard text-hazard hover:bg-hazard/10 bg-transparent",
    };

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
        {...rest}
      >
        <span className="relative z-10">{children}</span>
      </button>
    );
  }
);
