import type { IChartApiBase, ISeriesApi, SeriesType, Time } from "lightweight-charts";
import type { MeasurementPoint, MeasurementResult, RiskReward } from "./types";

/** Resolve a pixel coordinate to a {@link MeasurementPoint}, or null off-scale. */
export function resolvePoint(
  chart: IChartApiBase<Time>,
  series: ISeriesApi<SeriesType, Time>,
  x: number,
  y: number,
): MeasurementPoint | null {
  const price = series.coordinateToPrice(y);
  const time = chart.timeScale().coordinateToTime(x);
  const logical = chart.timeScale().coordinateToLogical(x);
  if (price === null || time === null || logical === null) return null;
  return { x, y, price: price as number, time, logical: logical as number };
}

/** Compute all measurement metrics for a measured leg. */
export function computeMeasurement(
  start: MeasurementPoint,
  end: MeasurementPoint,
): MeasurementResult {
  const priceDiff = end.price - start.price;
  const pricePct = start.price !== 0 ? (priceDiff / start.price) * 100 : 0;
  const barCount = Math.abs(end.logical - start.logical);
  const timeDiffSeconds = Math.abs(Number(end.time) - Number(start.time));
  const direction = priceDiff > 0.0001 ? "up" : priceDiff < -0.0001 ? "down" : "flat";
  return { start, end, priceDiff, pricePct, barCount, timeDiffSeconds, direction };
}

/**
 * Risk/reward from an entry, a stop, and a target. Sign-agnostic: works for both
 * long (target above entry) and short (target below) setups.
 */
export function computeRiskReward(entry: number, stop: number, target: number): RiskReward {
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  const ratio = risk > 0 ? reward / risk : 0;
  return { risk, reward, ratio };
}
