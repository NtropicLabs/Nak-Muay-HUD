import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Core surfaces
        "bg-primary": "#0A0A0F",
        "bg-secondary": "#131316",
        "panel-bg": "#0E0E12",
        "panel-border": "#1E1E24",
        // Accents
        "hazard": "#FF5F1F",
        "hazard-dim": "#561700",
        "status": "#00F5D4",
        "caution": "#D4AF37",
        "structural": "#5B4138",
        // Text
        "text-primary": "#FFFFFF",
        "text-secondary": "#6A6A7A",
        "text-muted": "#4A4A5A",
        "danger": "#E63946",
      },
      fontFamily: {
        headline: ["var(--font-space-grotesk)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      letterSpacing: {
        widest2: "0.2em",
        widest3: "0.25em",
      },
      borderRadius: {
        DEFAULT: "0px",
        none: "0px",
        sm: "0px",
        md: "0px",
        lg: "0px",
        xl: "0px",
        full: "9999px",
      },
      transitionDuration: {
        "0": "0ms",
      },
    },
  },
  plugins: [],
};

export default config;
