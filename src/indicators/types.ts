/**
 * Indicator framework contracts. Declared locally so the core never imports the
 * optional `oakscriptjs` / `lightweight-charts-indicators` runtime; the shapes
 * are structurally compatible with those packages, so their indicator
 * definitions drop straight into this registry (see `oakscript.ts`).
 */

export type IndicatorCategory = "overlay" | "oscillator" | "pattern";

/** Bar passed to `calculate`. Time is epoch **seconds** (lightweight-charts unit). */
export interface IndicatorBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PlotPoint {
  time: number;
  value: number;
  color?: string;
}

export interface PlotConfig {
  id: string;
  title?: string;
  color?: string;
  lineWidth?: number;
  /** "line" (default), "histogram"/"columns" render as a histogram. */
  style?: string;
}

export interface HLineConfig {
  price: number;
  color?: string;
  linewidth?: number;
  linestyle?: "solid" | "dashed" | "dotted";
  title?: string;
}

export interface InputConfig {
  name: string;
  type?: "int" | "float" | "bool" | "string" | "source" | "color";
  defval?: unknown;
  options?: unknown[];
  title?: string;
  [key: string]: unknown;
}

export interface MarkerDef {
  time: number;
  position?: "aboveBar" | "belowBar" | "inBar";
  shape?: string;
  color?: string;
  text?: string;
}

export interface IndicatorResult {
  plots: Record<string, PlotPoint[]>;
  markers?: MarkerDef[];
}

/** A registry entry: metadata + a pure `calculate`. This is the extension point. */
export interface IndicatorDef {
  name: string;
  title: string;
  shortTitle: string;
  category: IndicatorCategory;
  calculate: (bars: IndicatorBar[], inputs?: Record<string, unknown>) => IndicatorResult;
  defaultInputs: Record<string, unknown>;
  inputConfig: InputConfig[];
  plotConfig: PlotConfig[];
  hlineConfig: HLineConfig[];
}

/** An indicator the user has switched on, with its resolved params. */
export interface ActiveIndicator {
  name: string;
  params: Record<string, unknown>;
}
