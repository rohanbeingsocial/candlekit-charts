/**
 * Framework-agnostic chart controller. Wraps a lightweight-charts instance and
 * exposes a small, stable surface: data, series type, theme, plugins, events.
 * The React bindings are a thin layer over this; vanilla JS uses it directly.
 *
 * Time unit note: the public API uses epoch **milliseconds** everywhere; this
 * controller converts to lightweight-charts' epoch-**seconds** at the boundary.
 */

import {
  createChart,
  CrosshairMode,
  LineStyle,
  CandlestickSeries,
  BarSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type DeepPartial,
  type ChartOptions,
} from "lightweight-charts";
import type { Bar, ChartTheme, SeriesType } from "../core/types";
import { resolveTheme, buildThemeOptions, type ThemeInput } from "../core/theme";
import { EventBus } from "../events/eventBus";
import type { ChartEventMap, ChartPlugin, PluginContext } from "../plugins/types";

export interface ChartControllerOptions {
  /** Initial theme. Default `"dark"`. */
  theme?: ThemeInput;
  /** Main series type. Default `"candlestick"`. */
  seriesType?: SeriesType;
  /** Render a volume histogram on an overlaid scale. Default `true`. */
  showVolume?: boolean;
  /** Auto-fit the time scale on the first non-empty data set. Default `true`. */
  autoFit?: boolean;
  /** Escape hatch: deep-merged into the lightweight-charts options. */
  chartOptions?: DeepPartial<ChartOptions>;
}

type MainSeries = ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area">;

export class ChartController {
  readonly bus = new EventBus<ChartEventMap>();

  private chart: IChartApi;
  private series: MainSeries;
  private volume: ISeriesApi<"Histogram"> | null = null;
  private theme: ChartTheme;
  private seriesType: SeriesType;
  private showVolume: boolean;
  private autoFit: boolean;
  private bars: Bar[] = [];
  private hadData = false;
  private plugins = new Map<string, ChartPlugin>();
  private destroyed = false;

  constructor(container: HTMLElement, opts: ChartControllerOptions = {}) {
    this.theme = resolveTheme(opts.theme ?? "dark");
    this.seriesType = opts.seriesType ?? "candlestick";
    this.showVolume = opts.showVolume ?? true;
    this.autoFit = opts.autoFit ?? true;

    this.chart = createChart(container, this.baseOptions(opts.chartOptions));
    this.series = this.createMainSeries(this.seriesType);
    if (this.showVolume) this.createVolumeSeries();

    this.chart.timeScale().subscribeVisibleTimeRangeChange((r) => {
      if (!r) {
        this.bus.emit("rangeChange", null);
        return;
      }
      this.bus.emit("rangeChange", {
        from: (r.from as number) * 1000,
        to: (r.to as number) * 1000,
      });
    });

    this.chart.subscribeCrosshairMove((p) => {
      if (p.time === undefined || p.point === undefined) {
        this.bus.emit("crosshairMove", null);
        return;
      }
      const price = this.series.coordinateToPrice(p.point.y);
      this.bus.emit("crosshairMove", {
        ts: (p.time as number) * 1000,
        price: price == null ? NaN : price,
      });
    });
  }

  // ── Public surface ─────────────────────────────────────────────────────────

  getChart(): IChartApi {
    return this.chart;
  }

  getSeries(): MainSeries {
    return this.series;
  }

  getBars(): readonly Bar[] {
    return this.bars;
  }

  /** Replace the full data set. */
  setData(bars: readonly Bar[]): void {
    if (this.destroyed) return;
    this.bars = bars.slice();
    this.applySeriesData();
    this.applyVolumeData();

    if (this.autoFit && !this.hadData && bars.length > 0) {
      this.chart.timeScale().fitContent();
    }
    this.hadData = bars.length > 0;

    this.bus.emit("data", { bars: this.bars });
    for (const p of this.plugins.values()) p.onData?.(this.bars);
  }

  /** Append or update the most recent bar (live tick). */
  updateBar(bar: Bar): void {
    if (this.destroyed) return;
    const last = this.bars[this.bars.length - 1];
    if (last && last.ts === bar.ts) this.bars[this.bars.length - 1] = bar;
    else if (!last || bar.ts > last.ts) this.bars.push(bar);
    else return; // out-of-order tick ignored

    const t = (bar.ts / 1000) as Time;
    if (this.seriesType === "candlestick" || this.seriesType === "ohlc") {
      (this.series as ISeriesApi<"Candlestick">).update({
        time: t,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      });
    } else {
      (this.series as ISeriesApi<"Line">).update({ time: t, value: bar.close });
    }
    if (this.volume) {
      this.volume.update({
        time: t,
        value: bar.volume ?? 0,
        color: bar.close >= bar.open ? this.theme.volumeUp : this.theme.volumeDown,
      });
    }
  }

  setSeriesType(type: SeriesType): void {
    if (this.destroyed || type === this.seriesType) return;
    this.chart.removeSeries(this.series);
    this.seriesType = type;
    this.series = this.createMainSeries(type);
    this.applySeriesData();
    // Re-init plugins that hold a series reference.
    for (const p of this.plugins.values()) {
      p.destroy();
      p.init(this.pluginContext());
    }
  }

  setTheme(input: ThemeInput): void {
    if (this.destroyed) return;
    this.theme = resolveTheme(input);
    this.chart.applyOptions(buildThemeOptions(this.theme) as DeepPartial<ChartOptions>);
    this.styleSeries();
    this.applyVolumeData();
    this.bus.emit("theme", { theme: this.theme });
    for (const p of this.plugins.values()) p.onThemeChange?.(this.theme);
  }

  getTheme(): ChartTheme {
    return this.theme;
  }

  /** Register a plugin (drawing, indicators, measurement, custom). Idempotent by id. */
  use(plugin: ChartPlugin): this {
    if (this.destroyed || this.plugins.has(plugin.id)) return this;
    this.plugins.set(plugin.id, plugin);
    plugin.init(this.pluginContext());
    return this;
  }

  remove(pluginId: string): void {
    const p = this.plugins.get(pluginId);
    if (!p) return;
    p.destroy();
    this.plugins.delete(pluginId);
  }

  fitContent(): void {
    this.chart.timeScale().fitContent();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const p of this.plugins.values()) p.destroy();
    this.plugins.clear();
    this.bus.clear();
    this.chart.remove();
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private pluginContext(): PluginContext {
    return {
      chart: this.chart,
      series: this.series,
      bus: this.bus,
      theme: this.theme,
      getBars: () => this.bars,
    };
  }

  private baseOptions(override?: DeepPartial<ChartOptions>): DeepPartial<ChartOptions> {
    const themed = buildThemeOptions(this.theme) as DeepPartial<ChartOptions>;
    const base: DeepPartial<ChartOptions> = {
      autoSize: true,
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        autoScale: true,
        scaleMargins: { top: 0.1, bottom: this.showVolume ? 0.22 : 0.1 },
        // Fixed gutter so stacked synced charts align their plot regions.
        minimumWidth: 64,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        // New bars must not auto-scroll the viewport during replay.
        shiftVisibleRangeOnNewBar: false,
        // Resize must not refit — preserves user pan/zoom across layout changes.
        lockVisibleTimeRangeOnResize: true,
        rightOffset: 5,
      },
      handleScale: {
        axisPressedMouseMove: { time: false, price: true },
        axisDoubleClickReset: { time: true, price: true },
      },
    };
    return deepMerge(deepMerge(base, themed), override ?? {});
  }

  private createMainSeries(type: SeriesType): MainSeries {
    const { up, down, line } = this.theme;
    switch (type) {
      case "candlestick":
        return this.chart.addSeries(CandlestickSeries, {
          upColor: up,
          downColor: down,
          borderUpColor: up,
          borderDownColor: down,
          wickUpColor: up,
          wickDownColor: down,
        });
      case "ohlc":
        return this.chart.addSeries(BarSeries, { upColor: up, downColor: down });
      case "line":
        return this.chart.addSeries(LineSeries, { color: line, lineWidth: 2 });
      case "area":
        return this.chart.addSeries(AreaSeries, {
          lineColor: line,
          topColor: hexToRgba(line, 0.25),
          bottomColor: hexToRgba(line, 0.02),
          lineWidth: 2,
        });
    }
  }

  private createVolumeSeries(): void {
    this.volume = this.chart.addSeries(HistogramSeries, {
      color: this.theme.volumeUp,
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    this.chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
  }

  private styleSeries(): void {
    const { up, down, line } = this.theme;
    if (this.seriesType === "candlestick") {
      (this.series as ISeriesApi<"Candlestick">).applyOptions({
        upColor: up,
        downColor: down,
        borderUpColor: up,
        borderDownColor: down,
        wickUpColor: up,
        wickDownColor: down,
      });
    } else if (this.seriesType === "ohlc") {
      (this.series as ISeriesApi<"Bar">).applyOptions({ upColor: up, downColor: down });
    } else if (this.seriesType === "line") {
      (this.series as ISeriesApi<"Line">).applyOptions({ color: line });
    } else {
      (this.series as ISeriesApi<"Area">).applyOptions({
        lineColor: line,
        topColor: hexToRgba(line, 0.25),
        bottomColor: hexToRgba(line, 0.02),
      });
    }
  }

  private applySeriesData(): void {
    if (this.seriesType === "candlestick" || this.seriesType === "ohlc") {
      (this.series as ISeriesApi<"Candlestick">).setData(
        this.bars.map((b) => ({
          time: (b.ts / 1000) as Time,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        })),
      );
    } else {
      (this.series as ISeriesApi<"Line">).setData(
        this.bars.map((b) => ({ time: (b.ts / 1000) as Time, value: b.close })),
      );
    }
  }

  private applyVolumeData(): void {
    if (!this.volume) return;
    this.volume.setData(
      this.bars.map((b) => ({
        time: (b.ts / 1000) as Time,
        value: b.volume ?? 0,
        color: b.close >= b.open ? this.theme.volumeUp : this.theme.volumeDown,
      })),
    );
  }
}

// ── Small local helpers (kept internal to avoid extra deps) ───────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepMerge<T extends Record<string, unknown>>(a: T, b: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (isObject(v) && isObject(out[k])) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

/** Convert `#rrggbb` to `rgba(...)`. Pass-through for already-rgba/named colors. */
function hexToRgba(color: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export { LineStyle };
