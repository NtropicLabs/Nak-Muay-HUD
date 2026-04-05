"use client";

import Link from "next/link";

// Phase 5 placeholder — full summary implemented in Phase 6.
export default function SummaryPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center">
      <div className="text-center font-mono text-structural">
        [SUMMARY_PLACEHOLDER] —{" "}
        <Link href="/" className="text-hazard">
          [RETURN_HOME]
        </Link>
      </div>
    </div>
  );
}
