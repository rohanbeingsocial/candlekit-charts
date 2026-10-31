/**
 * Drawing framework contracts. This is an original, MIT-licensed drawing engine
 * rendered on lightweight-charts canvas primitives — no third-party drawing
 * runtime. New tools are added by extending {@link DrawingToolId} + the renderer
 * and hit-test switch; the model below is the stable, serializable surface.
 */

/** Built-in tool ids. Open-ended so you can add custom tools. */
export type DrawingToolId =
  | "TrendLine"
  | "Ray"
  | "ExtendedLine"
  | "HorizontalLine"
  | "HorizontalRay"
  | "VerticalLine"
  | "CrossLine"
  | "Rectangle"
  | "Circle"
  | "Triangle"
  | "ParallelChannel"
  | "Arrow"
  | "PriceRange"
  | "DateRange"
  | "FibRetracement"
  | "FibExtension"
  | "InfoLine"
  | "TrendAngle"
  | "FibChannel"
  | "DisjointChannel"
  | "FlatTopBottom"
  | "RegressionChannel"
  | "Pitchfork"
  | "SchiffPitchfork"
  | "ModifiedSchiffPitchfork"
  | "InsidePitchfork"
  | "FibTimeZone"
  | "FibFan"
  | "FibExtensionTwoPoint"
  | "FibSpeedResistanceFan"
  | "TrendFibTime"
  | "FibCircles"
  | "FibSpeedResistanceArcs"
  | "FibWedge"
  | "FibSpiral"
  | "GannFan"
  | "GannBox"
  | "GannSquare"
  | "RotatedRectangle"
  | "Ellipse"
  | "Path"
  | "Polyline"
  | "Arc"
  | "Curve"
  | "DoubleCurve"
  | "CyclicLines"
  | "TimeCycles"
  | "SineLine"
  | "XABCDPattern"
  | "ABCDPattern"
  | "HeadShoulders"
  | "ElliottImpulse"
  | "ElliottCorrection"
  | "Gartley"
  | "Bat"
  | "Butterfly"
  | "Crab"
  | "Shark"
  | "Cypher"
  | "LongPosition"
  | "ShortPosition"
  | "Forecast"
  | "Measure"
  | "Text"
  | "PriceLabel"
  | "Callout"
  | "Note"
  | "Balloon"
  | "Comment"
  | "FlagMark"
  | "IconStamp"
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "Brush"
  | "Highlighter"
  | "AnchoredVWAP"
  | (string & {});

/** Number of anchor points each tool needs. */
export const TOOL_POINTS: Record<string, number> = {
  TrendLine: 2,
  Ray: 2,
  ExtendedLine: 2,
  HorizontalLine: 1,
  HorizontalRay: 1,
  VerticalLine: 1,
  CrossLine: 1,
  Rectangle: 2,
  Circle: 2,
  Triangle: 3,
  ParallelChannel: 3,
  Arrow: 2,
  PriceRange: 2,
  DateRange: 2,
  FibRetracement: 2,
  FibExtension: 3,
  InfoLine: 2,
  TrendAngle: 2,
  FibChannel: 3,
  DisjointChannel: 3,
  FlatTopBottom: 2,
  RegressionChannel: 3,
  Pitchfork: 3,
  SchiffPitchfork: 3,
  ModifiedSchiffPitchfork: 3,
  InsidePitchfork: 3,
  FibTimeZone: 2,
  FibFan: 2,
  FibExtensionTwoPoint: 2,
  FibSpeedResistanceFan: 2,
  TrendFibTime: 2,
  FibCircles: 2,
  FibSpeedResistanceArcs: 2,
  FibWedge: 3,
  FibSpiral: 2,
  GannFan: 2,
  GannBox: 2,
  GannSquare: 2,
  RotatedRectangle: 3,
  Ellipse: 2,
  Path: 3,
  Polyline: 3,
  Arc: 3,
  Curve: 3,
  DoubleCurve: 3,
  CyclicLines: 2,
  TimeCycles: 2,
  SineLine: 2,
  XABCDPattern: 5,
  ABCDPattern: 4,
  HeadShoulders: 5,
  ElliottImpulse: 6,
  ElliottCorrection: 4,
  Gartley: 5,
  Bat: 5,
  Butterfly: 5,
  Crab: 5,
  Shark: 5,
  Cypher: 5,
  LongPosition: 2,
  ShortPosition: 2,
  Forecast: 2,
  Measure: 2,
  Text: 1,
  PriceLabel: 1,
  Callout: 2,
  Note: 2,
  Balloon: 2,
  Comment: 2,
  FlagMark: 1,
  IconStamp: 1,
  ArrowUp: 1,
  ArrowDown: 1,
  ArrowLeft: 1,
  ArrowRight: 1,
  Brush: 3,
  Highlighter: 3,
  AnchoredVWAP: 1,
};

/**
 * An anchor in data space. `time` is the lightweight-charts time (epoch
 * seconds). `logical` is an optional continuous bar index captured when the
 * anchor was placed in whitespace between loaded bars. It is a rendering
 * fallback, not a second data source, and remains backward-compatible with
 * persisted points that only contain `time` and `price`.
 */
export interface DrawingPoint {
  time: number;
  price: number;
  logical?: number;
}

/** Styling for one generated level in ladder-style drawing tools. */
export interface DrawingLevelStyle {
  ratio: number;
  color: string;
  width?: number;
  dashed?: boolean;
}

export interface DrawingStyle {
  color: string;
  width: number;
  dashed: boolean;
  /** Fill (rect/circle/fib bands). `null` = no fill. */
  fill: string | null;
  /** Optional per-level colors for Fibonacci/Gann/time-based tools. */
  levels?: DrawingLevelStyle[];
}

export interface DrawingText {
  value: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  background?: string | null;
}

export interface Drawing {
  id: string;
  tool: DrawingToolId;
  points: DrawingPoint[];
  style: DrawingStyle;
  /** Optional annotation payload used by text and label tools. */
  text?: DrawingText;
}

export const DEFAULT_STYLE: DrawingStyle = {
  color: "#2962ff",
  width: 2,
  dashed: false,
  fill: "rgba(41,98,255,0.08)",
};

/** TradingView/OpenAlgo-inspired palette used by ladder-style tools. */
export const DRAWING_LEVEL_COLORS = [
  "#787b86",
  "#f23645",
  "#ff9800",
  "#4caf50",
  "#089981",
  "#00bcd4",
  "#787b86",
] as const;

const levelStyles = (ratios: readonly number[]): DrawingLevelStyle[] =>
  ratios.map((ratio, index) => ({
    ratio,
    color: DRAWING_LEVEL_COLORS[index % DRAWING_LEVEL_COLORS.length],
  }));

/** Fibonacci retracement levels (fraction of the leg). */
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/** Fibonacci extension/projection levels (fraction of the leg). */
export const FIB_EXT_LEVELS = [0, 0.618, 1, 1.272, 1.618, 2, 2.618];

/**
 * Tool-specific defaults. Existing drawings remain valid because all fields
 * are optional at runtime and the renderer falls back to the drawing's main
 * color when no level configuration was persisted.
 */
export const DEFAULT_TOOL_STYLES: Partial<Record<DrawingToolId, Partial<DrawingStyle>>> = {
  FibRetracement: {
    color: "#787b86",
    width: 1,
    fill: "rgba(120,123,134,0.06)",
    levels: levelStyles(FIB_LEVELS),
  },
  FibExtension: {
    color: "#787b86",
    width: 1,
    fill: "rgba(120,123,134,0.06)",
    levels: levelStyles(FIB_EXT_LEVELS),
  },
  FibChannel: {
    color: "#787b86",
    width: 1,
    fill: "rgba(120,123,134,0.06)",
    levels: levelStyles(FIB_LEVELS),
  },
  FibFan: {
    color: "#787b86",
    width: 1,
    fill: null,
    levels: levelStyles(FIB_LEVELS),
  },
  FibSpeedResistanceFan: {
    color: "#787b86",
    width: 1,
    fill: null,
    levels: levelStyles(FIB_LEVELS),
  },
  FibCircles: {
    color: "#787b86",
    width: 1,
    fill: null,
    levels: levelStyles([0.236, 0.382, 0.5, 0.618, 1, 1.618]),
  },
  FibSpeedResistanceArcs: {
    color: "#787b86",
    width: 1,
    fill: null,
    levels: levelStyles([0.236, 0.382, 0.5, 0.618, 1, 1.618]),
  },
  LongPosition: {
    color: "#26a69a",
    fill: "rgba(38,166,154,0.12)",
  },
  ShortPosition: {
    color: "#ef5350",
    fill: "rgba(239,83,80,0.12)",
  },
};
