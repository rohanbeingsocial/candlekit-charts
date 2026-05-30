/**
 * Indicator plugin. Manages the lifecycle of indicator series (overlay lines,
 * oscillator panes, histogram plots, horizontal price lines, and pattern
 * markers) on a chart, driven by an {@link IndicatorRegistry} and a set of
 * active indicators.
 *
 * Ported from the original React IndicatorManager into a framework-agnostic
 * controller: it reads bars from the plugin context (already at the active
 * interval) instead of resampling internally.
 */

import {
  LineSeries,
  HistogramSeries,
  LineStyle,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
} from "lightweight-charts";
import type { ChartPlugin, PluginContext } from "../plugins/types";
import type { Bar } from "../core/types";
import type { IndicatorRegistry } from "./registry";
import type { ActiveIndicator, IndicatorBar, IndicatorResult, PlotPoint } from "./types";

const HISTOGRAM_STYLES = new Set(["histogram", "columns"]);

interface Managed {
  plotSeries: Map<string, ISeriesApi<"Line" | "Histogram">>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pane: any | null;
  isPattern: boolean;
}

export class IndicatorController implements ChartPlugin {
  readonly id = "indicators";

  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area"> | null = null;
  private getBars: () => readonly Bar[] = () => [];
  private active = new Map<string, ActiveIndicator>();
  private managed = new Map<string, Managed>();
  private markers = new Map<string, SeriesMarker<Time>[]>();
  private markersPlugin: ISeriesMarkersPluginApi<Time> | null = null;
  private onChange?: (names: string[]) => void;

  constructor(
    private readonly registry: IndicatorRegistry,
    opts: { onChange?: (names: string[]) => void } = {},
  ) {
    this.onChange = opts.onChange;
  }

  init(ctx: PluginContext): void {
    this.chart = ctx.chart;
    this.candleSeries = ctx.series;
    this.getBars = ctx.getBars;
  }

  onData(): void {
    this.refresh();
  }

  destroy(): void {
    if (this.chart) {
      for (const m of this.managed.values()) {
        for (const s of m.plotSeries.values()) {
          try {
            this.chart.removeSeries(s);
          } catch {
            /* */
          }
        }
      }
    }
    this.managed.clear();
    this.markers.clear();
    this.markersPlugin = null;
    this.chart = null;
    this.candleSeries = null;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** List indicators available in the registry, grouped by category. */
  available() {
    return this.registry.byCategory();
  }

  /** Currently active indicator names. */
  activeNames(): string[] {
    return [...this.active.keys()];
  }

  /** Turn an indicator on (or update its params). */
  add(name: string, params: Record<string, unknown> = {}): void {
    const def = this.registry.get(name);
    if (!def) return;
    this.active.set(name, { name, params: { ...def.defaultInputs, ...params } });
    this.refresh();
    this.onChange?.(this.activeNames());
  }

  /** Turn an indicator off. */
  remove(name: string): void {
    this.active.delete(name);
    this.refresh();
    this.onChange?.(this.activeNames());
  }

  toggle(name: string): void {
    if (this.active.has(name)) this.remove(name);
    else this.add(name);
  }

  // ── Lifecycle reconciliation ─────────────────────────────────────────────────

  private bars(): IndicatorBar[] {
    return this.getBars().map((b) => ({
      time: Math.floor(b.ts / 1000),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume ?? 0,
    }));
  }

  private refresh(): void {
    const chart = this.chart;
    const candle = this.candleSeries;
    if (!chart || !candle) return;

    if (!this.markersPlugin) this.markersPlugin = createSeriesMarkers(candle);
    const bars = this.bars();

    // 1. Remove deactivated.
    for (const [name, m] of this.managed) {
      if (this.active.has(name)) continue;
      for (const s of m.plotSeries.values()) {
        try {
          chart.removeSeries(s);
        } catch {
          /* */
        }
      }
      if (m.pane) {
        const idx = chart.panes().indexOf(m.pane);
        if (idx > 0) {
          try {
            chart.removePane(idx);
          } catch {
            /* */
          }
        }
      }
      if (m.isPattern) {
        this.markers.delete(name);
        this.flushMarkers();
      }
      this.managed.delete(name);
    }

    // 2. Update still-active.
    for (const [name, m] of this.managed) {
      const def = this.registry.get(name);
      const act = this.active.get(name);
      if (!def || !act) continue;
      let res: IndicatorResult;
      try {
        res = def.calculate(bars, act.params);
      } catch {
        continue;
      }
      if (m.isPattern) {
        this.markers.set(name, buildMarkers(res));
        this.flushMarkers();
        continue;
      }
      for (const [plotId, raw] of Object.entries(res.plots)) {
        const s = m.plotSeries.get(plotId);
        if (!s) continue;
        const pc = def.plotConfig.find((c) => c.id === plotId);
        const isHist = HISTOGRAM_STYLES.has(pc?.style ?? "");
        const filtered = filterValid(raw);
        if (isHist) {
          (s as ISeriesApi<"Histogram">).setData(
            filtered.map((d) => ({ time: d.time as Time, value: d.value, color: d.color ?? pc?.color ?? "#888" })),
          );
        } else {
          (s as ISeriesApi<"Line">).setData(filtered.map((d) => ({ time: d.time as Time, value: d.value })));
        }
      }
    }

    // 3. Add newly activated.
    for (const [name, act] of this.active) {
      if (this.managed.has(name)) continue;
      const def = this.registry.get(name);
      if (!def) continue;
      let res: IndicatorResult;
      try {
        res = def.calculate(bars, act.params);
      } catch {
        continue;
      }

      if (def.category === "pattern") {
        this.markers.set(name, buildMarkers(res));
        this.flushMarkers();
        this.managed.set(name, { plotSeries: new Map(), pane: null, isPattern: true });
        continue;
      }

      const isOverlay = def.category === "overlay";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let pane: any = null;
      let paneIndex = 0;
      if (!isOverlay) {
        pane = chart.addPane();
        pane.setHeight(140);
        paneIndex = chart.panes().length - 1;
      }

      const plotSeries = new Map<string, ISeriesApi<"Line" | "Histogram">>();
      for (const [plotId, raw] of Object.entries(res.plots)) {
        const pc = def.plotConfig.find((c) => c.id === plotId);
        const color = pc?.color ?? "#888";
        const lineWidth = clampWidth(pc?.lineWidth ?? 1);
        const isHist = HISTOGRAM_STYLES.has(pc?.style ?? "");
        const filtered = filterValid(raw);
        if (isHist) {
          const s = chart.addSeries(HistogramSeries, { color, priceLineVisible: false, lastValueVisible: false }, paneIndex);
          s.setData(filtered.map((d) => ({ time: d.time as Time, value: d.value, color: d.color ?? color })));
          plotSeries.set(plotId, s);
        } else {
          const s = chart.addSeries(LineSeries, { color, lineWidth, priceLineVisible: false, lastValueVisible: false }, paneIndex);
          s.setData(filtered.map((d) => ({ time: d.time as Time, value: d.value })));
          plotSeries.set(plotId, s);
        }
      }

      const first = [...plotSeries.values()][0];
      if (first && def.hlineConfig.length > 0) {
        for (const hl of def.hlineConfig) {
          try {
            first.createPriceLine({
              price: hl.price,
              color: hl.color ?? "#888",
              lineWidth: clampWidth(hl.linewidth ?? 1),
              lineStyle:
                hl.linestyle === "dashed"
                  ? LineStyle.Dashed
                  : hl.linestyle === "dotted"
                    ? LineStyle.Dotted
                    : LineStyle.Solid,
              axisLabelVisible: false,
              title: hl.title ?? "",
            });
          } catch {
            /* */
          }
        }
      }
      this.managed.set(name, { plotSeries, pane, isPattern: false });
    }
  }

  private flushMarkers(): void {
    if (!this.markersPlugin) return;
    const all = [...this.markers.values()].flat();
    all.sort((a, b) => (a.time as number) - (b.time as number));
    this.markersPlugin.setMarkers(all);
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function filterValid(data: PlotPoint[]): PlotPoint[] {
  return data.filter((d) => d.value != null && !Number.isNaN(d.value));
}

function clampWidth(w: number): 1 | 2 | 3 | 4 {
  return Math.max(1, Math.min(4, Math.round(w))) as 1 | 2 | 3 | 4;
}

function mapShape(shape: string): "arrowUp" | "arrowDown" | "circle" | "square" {
  if (shape === "arrowUp" || shape === "arrowDown" || shape === "circle" || shape === "square") return shape;
  const l = shape.toLowerCase();
  if (l.includes("up") || l.includes("bull")) return "arrowUp";
  if (l.includes("down") || l.includes("bear")) return "arrowDown";
  return "circle";
}

function buildMarkers(res: IndicatorResult): SeriesMarker<Time>[] {
  const out = (res.markers ?? []).map((m) => ({
    time: m.time as Time,
    position: (m.position ?? "aboveBar") as "aboveBar" | "belowBar" | "inBar",
    shape: mapShape(m.shape ?? "circle"),
    color: m.color ?? "#2196F3",
    text: m.text ?? "",
  }));
  return out as unknown as SeriesMarker<Time>[];
}
