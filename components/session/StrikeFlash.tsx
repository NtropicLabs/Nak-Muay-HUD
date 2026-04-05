"use client";

import { useEffect, useState } from "react";

interface StrikeFlashProps {
  /** Changes whenever a strike is detected (use strike timestamp). */
  trigger: number | null;
}

/**
 * Full-viewport orange flash pulse that fires briefly whenever `trigger`
 * changes. Stacks below the scanline overlay so scanlines still show.
 */
export function StrikeFlash({ trigger }: StrikeFlashProps) {
  const [flashKey, setFlashKey] = useState(0);

  useEffect(() => {
    if (trigger == null) return;
    setFlashKey((k) => k + 1);
  }, [trigger]);

  if (flashKey === 0) return null;

  return (
    <div
      key={flashKey}
      className="pointer-events-none fixed inset-0 z-[90] animate-strike-flash"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(255,95,31,0.28) 0%, rgba(255,95,31,0) 70%)",
        mixBlendMode: "screen",
      }}
      aria-hidden
    />
  );
}
