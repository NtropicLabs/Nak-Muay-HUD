"use client";

import { forwardRef, ReactNode } from "react";

interface CameraFeedProps {
  /** Empty-state content shown over the feed when no pose/camera yet. */
  overlay?: ReactNode;
  /** HUD corner widgets (FPS, confidence, etc). */
  corners?: ReactNode;
  /** Bottom bar widgets. */
  footer?: ReactNode;
  /** Children rendered in an absolutely positioned layer above the video (e.g. canvas). */
  children?: ReactNode;
  mirrored?: boolean;
  className?: string;
}

/**
 * CameraFeed renders a bordered HUD panel containing a <video> element.
 * The video is mirrored horizontally via CSS to create the selfie effect.
 * Consumers pass a ref (forwarded) that will be wired to the <video>.
 */
export const CameraFeed = forwardRef<HTMLVideoElement, CameraFeedProps>(
  function CameraFeed(
    { overlay, corners, footer, children, mirrored = true, className = "" },
    ref
  ) {
    return (
      <section
        className={
          "relative w-full bg-panel-bg border border-panel-border overflow-hidden " +
          className
        }
      >
        <video
          ref={ref}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            transform: mirrored ? "scaleX(-1)" : undefined,
          }}
        />
        {/* Children layer (canvas overlay, skeleton, etc.) */}
        {children}

        {/* Corner crosshairs */}
        <div className="pointer-events-none absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-structural/70" />
        <div className="pointer-events-none absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-structural/70" />
        <div className="pointer-events-none absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-structural/70" />
        <div className="pointer-events-none absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-structural/70" />

        {corners}
        {overlay && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {overlay}
          </div>
        )}
        {footer && (
          <div className="absolute left-0 right-0 bottom-0">{footer}</div>
        )}
      </section>
    );
  }
);
