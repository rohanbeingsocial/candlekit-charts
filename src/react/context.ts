import { createContext, useContext } from "react";
import type { ChartController } from "../chart/ChartController";
import type { DrawingController } from "../drawing/DrawingController";
import type { IndicatorController } from "../indicators/IndicatorController";
import type { MeasurementController } from "../measurement/MeasurementController";

/** Handles surfaced by {@link ChartView} to its descendants + `onReady`. */
export interface ChartViewApi {
  controller: ChartController;
  drawing: DrawingController | null;
  indicators: IndicatorController | null;
  measurement: MeasurementController | null;
}

export const ChartContext = createContext<ChartViewApi | null>(null);

/** Access the enclosing {@link ChartView}'s API. Throws if used outside one. */
export function useChartApi(): ChartViewApi {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error("useChartApi must be used inside a <ChartView>");
  return ctx;
}

/** Like {@link useChartApi} but returns null instead of throwing. */
export function useChartApiOptional(): ChartViewApi | null {
  return useContext(ChartContext);
}
