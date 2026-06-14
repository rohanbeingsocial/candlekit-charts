import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { DeepPartial, ChartOptions } from "lightweight-charts";
import type { Bar, SeriesType } from "../core/types";
import { resample, toBars, type RawBar } from "../core/data";
import type { ResampleOptions } from "../core/types";
import type { ThemeInput } from "../core/theme";
import { DrawingController, type DrawingControllerOptions } from "../drawing/DrawingController";
import type { IndicatorController } from "../indicators/IndicatorController";
import { MeasurementController, type MeasurementOptions } from "../measurement/MeasurementController";
import { PointMarkerController, type PointMarkerOptions } from "../measurement/PointMarkerController";
import { useChartController } from "./hooks/useChartController";
import { ChartContext, type ChartViewApi } from "./context";

export interface ChartViewProps {
  /** Bars to render. Pass raw rows (nulls tolerated) or clean bars. */
  data: readonly RawBar[] | readonly Bar[];
  /** Resample `data` to this bucket width before render. Omit to render as-is. */
  resampleMinutes?: number;
  resampleOptions?: ResampleOptions;

  seriesType?: SeriesType;
  theme?: ThemeInput;
  showVolume?: boolean;
  autoFit?: boolean;
  chartOptions?: DeepPartial<ChartOptions>;

  /**
   * Enable drawing tools. `true` for defaults, an options object (e.g.
   * `{ storageKey }`), or a pre-built {@link DrawingController}.
   */
  drawing?: boolean | DrawingControllerOptions | DrawingController | null;
  /** Indicator controller (build with an `IndicatorRegistry`). */
  indicators?: IndicatorController | null;
  /** Enable Shift-drag measurement. `true` for defaults, or pass options. */
  measurement?: boolean | MeasurementOptions;
  /** Enable Ctrl-click point marker ("catch point"). `true` for defaults, or pass options. */
  pointMarker?: boolean | PointMarkerOptions;

  /** Fired once the chart + plugins are live. */
  onReady?: (api: ChartViewApi) => void;

  className?: string;
  style?: CSSProperties;
  /** Overlay UI (toolbars, pickers, controls) rendered above the canvas. */
  children?: ReactNode;
}

const FILL: CSSProperties = { position: "relative", width: "100%", height: "100%", minHeight: 0 };
const CANVAS: CSSProperties = { width: "100%", height: "100%" };

export function ChartView({
  data,
  resampleMinutes,
  resampleOptions,
  seriesType = "candlestick",
  theme = "dark",
  showVolume = true,
  autoFit = true,
  chartOptions,
  drawing,
  indicators,
  measurement,
  pointMarker,
  onReady,
  className,
  style,
  children,
}: ChartViewProps) {
  const { containerRef, controller } = useChartController({
    theme,
    seriesType,
    showVolume,
    autoFit,
    chartOptions,
  });

  const [api, setApi] = useState<ChartViewApi | null>(null);

  // Resample / normalize data once per input change.
  const bars = useMemo<Bar[]>(() => {
    const rows = data as readonly RawBar[];
    return resampleMinutes && resampleMinutes > 1
      ? resample(rows, resampleMinutes, resampleOptions)
      : toBars(rows);
  }, [data, resampleMinutes, resampleOptions]);

  // Resolve the drawing prop to a controller. Pass a stable value (boolean or a
  // memoized instance) to avoid re-initializing on every render.
  const drawingCtl = useMemo<DrawingController | null>(() => {
    if (!drawing) return null;
    if (drawing instanceof DrawingController) return drawing;
    return new DrawingController(typeof drawing === "object" ? drawing : {});
  }, [drawing]);

  // Register plugins + publish API.
  useEffect(() => {
    if (!controller) return;
    let measurementCtl: MeasurementController | null = null;
    let pointMarkerCtl: PointMarkerController | null = null;

    if (drawingCtl) controller.use(drawingCtl);
    if (indicators) controller.use(indicators);
    if (measurement) {
      measurementCtl = new MeasurementController(typeof measurement === "object" ? measurement : {});
      controller.use(measurementCtl);
    }
    if (pointMarker) {
      pointMarkerCtl = new PointMarkerController(typeof pointMarker === "object" ? pointMarker : {});
      controller.use(pointMarkerCtl);
    }

    const next: ChartViewApi = {
      controller,
      drawing: drawingCtl,
      indicators: indicators ?? null,
      measurement: measurementCtl,
      pointMarker: pointMarkerCtl,
    };
    setApi(next);
    onReady?.(next);

    return () => {
      if (drawingCtl) controller.remove(drawingCtl.id);
      if (indicators) controller.remove(indicators.id);
      if (measurementCtl) controller.remove(measurementCtl.id);
      if (pointMarkerCtl) controller.remove(pointMarkerCtl.id);
    };
    // onReady intentionally excluded from deps — callers pass inline fns.
  }, [controller, drawingCtl, indicators, measurement, pointMarker]);

  // Data.
  useEffect(() => {
    controller?.setData(bars);
  }, [controller, bars]);

  // Theme.
  useEffect(() => {
    controller?.setTheme(theme);
  }, [controller, theme]);

  // Series type.
  useEffect(() => {
    controller?.setSeriesType(seriesType);
  }, [controller, seriesType]);

  return (
    <div className={className} style={{ ...FILL, ...style }}>
      <div ref={containerRef} style={CANVAS} />
      {api && <ChartContext.Provider value={api}>{children}</ChartContext.Provider>}
    </div>
  );
}
