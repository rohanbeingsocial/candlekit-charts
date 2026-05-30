/**
 * Theme presets + a builder that maps a {@link ChartTheme} onto the
 * lightweight-charts options object. Consumers can pass a full theme, a partial
 * override, or just a mode ("light" | "dark").
 */

import type { ChartTheme } from "./types";

const FONT = "ui-monospace, SFMono-Regular, Menlo, monospace";

export const lightTheme: ChartTheme = {
  mode: "light",
  background: "transparent",
  text: "#1f2937",
  grid: "#e5e7eb",
  axis: "rgba(31,41,55,0.18)",
  crosshair: "#374151",
  crosshairLabelBg: "#1f2937",
  up: "#26a69a",
  down: "#ef5350",
  line: "#2962ff",
  volumeUp: "rgba(38,166,154,0.35)",
  volumeDown: "rgba(239,83,80,0.35)",
  fontFamily: FONT,
  fontSize: 11,
};

export const darkTheme: ChartTheme = {
  mode: "dark",
  background: "transparent",
  text: "#e5e7eb",
  grid: "rgba(148,163,184,0.12)",
  axis: "rgba(148,163,184,0.25)",
  crosshair: "#9ca3af",
  crosshairLabelBg: "#363a45",
  up: "#26a69a",
  down: "#ef5350",
  line: "#4f8cff",
  volumeUp: "rgba(38,166,154,0.35)",
  volumeDown: "rgba(239,83,80,0.35)",
  fontFamily: FONT,
  fontSize: 11,
};

export type ThemeInput = "light" | "dark" | ChartTheme | Partial<ChartTheme>;

/** Resolve any accepted theme input to a complete {@link ChartTheme}. */
export function resolveTheme(input: ThemeInput = "dark"): ChartTheme {
  if (input === "light") return lightTheme;
  if (input === "dark") return darkTheme;
  const base = input.mode === "light" ? lightTheme : darkTheme;
  return { ...base, ...input };
}

/**
 * Build the subset of lightweight-charts `ChartOptions` driven by the theme.
 * Kept as a plain object (no LWC import) so the core stays free of the chart
 * runtime; the chart controller spreads it into `createChart` / `applyOptions`.
 */
export function buildThemeOptions(theme: ChartTheme): Record<string, unknown> {
  return {
    layout: {
      background: { type: "solid", color: theme.background },
      textColor: theme.text,
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
    },
    grid: {
      vertLines: { color: theme.grid },
      horzLines: { color: theme.grid },
    },
    crosshair: {
      vertLine: { color: theme.crosshair, labelBackgroundColor: theme.crosshairLabelBg },
      horzLine: { color: theme.crosshair, labelBackgroundColor: theme.crosshairLabelBg },
    },
    rightPriceScale: { borderColor: theme.axis },
    timeScale: { borderColor: theme.axis },
  };
}
