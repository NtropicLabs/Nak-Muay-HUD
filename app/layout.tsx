import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STRIKE PROTOCOL // MUAY THAI TELEMETRY",
  description: "Real-time Muay Thai strike detection and telemetry HUD.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0A0A0F",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Fonts loaded at runtime via stylesheet (build environment may not
            have outbound network access for next/font). CSS variables are
            wired up in globals.css. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap"
        />
      </head>
      <body className="bg-bg-primary text-text-primary font-mono antialiased min-h-dvh relative overflow-x-hidden">
        {/* CRT scanline overlay — fixed, covers entire viewport */}
        <div className="scanline-overlay" aria-hidden />
        {children}
      </body>
    </html>
  );
}
