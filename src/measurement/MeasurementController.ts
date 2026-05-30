/**
 * Measurement plugin. Hold Shift and drag on the chart to measure a leg; the
 * ruler primitive paints the overlay and a {@link MeasurementResult} is emitted
 * (price, percentage, bar-distance, time delta, direction). Risk/reward is
 * derivable from the result via {@link computeRiskReward}.
 *
 * Framework-agnostic: replaces the original React MeasurementManager with a
 * controller usable from vanilla JS or any framework. Pass an `onMeasure`
 * callback or subscribe to the chart bus event `"measure"`.
 */

import type { IChartApi, ISeriesApi, MouseEventParams, Time } from "lightweight-charts";
import type { ChartPlugin, PluginContext } from "../plugins/types";
import { RulerPrimitive, type RulerColors } from "./RulerPrimitive";
import { resolvePoint, computeMeasurement } from "./ChartCoordinateUtils";
import type { MeasurementPoint, MeasurementResult, RulerState } from "./types";

export interface MeasurementOptions {
  /** Modifier key that arms measurement. Default `"shift"`. */
  modifier?: "shift" | "alt" | "ctrl" | "meta";
  /** Ruler color overrides. */
  colors?: Partial<RulerColors>;
  /** Called on every measurement update + completion. */
  onMeasure?: (result: MeasurementResult | null) => void;
}

type AnySeries = ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area">;

export class MeasurementController implements ChartPlugin {
  readonly id = "measurement";

  private chart: IChartApi | null = null;
  private series: AnySeries | null = null;
  private container: HTMLElement | null = null;
  private ruler = new RulerPrimitive();
  private state: RulerState = "idle";
  private start: MeasurementPoint | null = null;
  private ctx: PluginContext | null = null;
  private cleanup: Array<() => void> = [];

  constructor(private readonly opts: MeasurementOptions = {}) {
    this.ruler = new RulerPrimitive(opts.colors);
  }

  init(ctx: PluginContext): void {
    this.ctx = ctx;
    this.chart = ctx.chart;
    this.series = ctx.series;
    this.container = ctx.chart.chartElement();
    this.series.attachPrimitive(this.ruler);

    const onCrosshair = (p: MouseEventParams<Time>) => this.onCrosshairMove(p);
    this.chart.subscribeCrosshairMove(onCrosshair);
    this.cleanup.push(() => this.chart?.unsubscribeCrosshairMove(onCrosshair));

    const el = this.container;
    const onDown = (e: MouseEvent) => this.onMouseDown(e);
    const onUp = () => this.onMouseUp();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") this.clear();
    };
    el.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("keydown", onKey);
    this.cleanup.push(() => el.removeEventListener("mousedown", onDown));
    this.cleanup.push(() => window.removeEventListener("mouseup", onUp));
    this.cleanup.push(() => window.removeEventListener("keydown", onKey));
  }

  destroy(): void {
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
    try {
      this.series?.detachPrimitive(this.ruler);
    } catch {
      /* already detached */
    }
    this.chart = null;
    this.series = null;
    this.container = null;
  }

  private modifierHeld(e: MouseEvent): boolean {
    switch (this.opts.modifier ?? "shift") {
      case "alt":
        return e.altKey;
      case "ctrl":
        return e.ctrlKey;
      case "meta":
        return e.metaKey;
      default:
        return e.shiftKey;
    }
  }

  private emit(result: MeasurementResult | null): void {
    this.opts.onMeasure?.(result);
    // Custom event on the shared bus for plugins/UI that want it.
    this.ctx?.bus.emit("measure" as never, result as never);
  }

  private onMouseDown(e: MouseEvent): void {
    if (!this.chart || !this.series) return;
    if (!this.modifierHeld(e)) {
      if (this.state === "complete") this.clear();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const start = resolvePoint(this.chart, this.series, e.offsetX, e.offsetY);
    if (!start) return;
    this.chart.applyOptions({ handleScroll: { pressedMouseMove: false } });
    this.start = start;
    this.state = "measuring";
    this.ruler.clear();
    this.emit(null);
  }

  private onMouseUp(): void {
    if (this.state === "measuring") {
      this.state = "complete";
      this.chart?.applyOptions({ handleScroll: { pressedMouseMove: true } });
    }
  }

  private onCrosshairMove(param: MouseEventParams<Time>): void {
    if (this.state !== "measuring" || !param.point || !this.chart || !this.series || !this.start) return;
    const end = resolvePoint(this.chart, this.series, param.point.x, param.point.y);
    if (!end) return;
    this.ruler.update(this.start, end);
    this.emit(computeMeasurement(this.start, end));
  }

  clear(): void {
    this.state = "idle";
    this.start = null;
    this.ruler.clear();
    this.chart?.applyOptions({ handleScroll: { pressedMouseMove: true } });
    this.emit(null);
  }
}
