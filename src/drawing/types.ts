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
  | "VerticalLine"
  | "Rectangle"
  | "Circle"
  | "Arrow"
  | "FibRetracement"
  | (string & {});

/** Number of anchor points each tool needs. */
export const TOOL_POINTS: Record<string, number> = {
  TrendLine: 2,
  Ray: 2,
  ExtendedLine: 2,
  HorizontalLine: 1,
  VerticalLine: 1,
  Rectangle: 2,
  Circle: 2,
  Arrow: 2,
  FibRetracement: 2,
};

/** An anchor in data space: `time` is the lightweight-charts time (epoch seconds). */
export interface DrawingPoint {
  time: number;
  price: number;
}

export interface DrawingStyle {
  color: string;
  width: number;
  dashed: boolean;
  /** Fill (rect/circle/fib bands). `null` = no fill. */
  fill: string | null;
}

export interface Drawing {
  id: string;
  tool: DrawingToolId;
  points: DrawingPoint[];
  style: DrawingStyle;
}

export const DEFAULT_STYLE: DrawingStyle = {
  color: "#2962ff",
  width: 2,
  dashed: false,
  fill: "rgba(41,98,255,0.08)",
};

/** Fibonacci retracement levels (fraction of the leg). */
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
