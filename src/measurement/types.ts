import type { Time } from "lightweight-charts";

export type RulerState = "idle" | "measuring" | "complete";

export interface MeasurementPoint {
  /** CSS pixel x within the chart pane. */
  x: number;
  /** CSS pixel y within the chart pane. */
  y: number;
  price: number;
  time: Time;
  /** Logical bar index. */
  logical: number;
}

export interface MeasurementResult {
  start: MeasurementPoint;
  end: MeasurementPoint;
  /** Signed `end.price - start.price` (price measurement). */
  priceDiff: number;
  /** Signed percentage change (percentage measurement). */
  pricePct: number;
  /** Bar count between endpoints (distance measurement). */
  barCount: number;
  /** Absolute time delta in seconds (time measurement). */
  timeDiffSeconds: number;
  direction: "up" | "down" | "flat";
}

/** Risk/reward derived from a measured leg and an entry/stop. */
export interface RiskReward {
  risk: number;
  reward: number;
  ratio: number;
}
