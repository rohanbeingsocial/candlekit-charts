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

  /**
   * Live/replay tick: refresh only the newest point of each active indicator.
   * Recompute is O(bars) but we `update()` just the last LWC point instead of
   * re-`setData`-ing the whole series, so streaming stays cheap. Newly-toggled
   * indicators are materialized by `add()` → `refresh()`, not here.
   */
  onBar(): void {
    const chart = this.chart;
    const candle = this.candleSeries;
    if (!chart || !candle || this.managed.size === 0) return;
    const bars = this.bars();
    if (bars.length === 0) return;

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
        const filtered = filterValid(raw);
        const last = filtered[filtered.length - 1];
        if (!last) continue;
        const pc = def.plotConfig.find((c) => c.id === plotId);
        const color = resolveColor(act.colors, plotId, pc?.color);
        if (HISTOGRAM_STYLES.has(pc?.style ?? "")) {
          (s as ISeriesApi<"Histogram">).update({ time: last.time as Time, value: last.value, color: last.color ?? color });
        } else {
          (s as ISeriesApi<"Line">).update({ time: last.time as Time, value: last.value });
        }
      }
    }
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

  /** The active indicator (name + resolved params), or undefined if off. */
  getActive(name: string): ActiveIndicator | undefined {
    return this.active.get(name);
  }

  /** Turn every active indicator off. */
  clear(): void {
    if (this.active.size === 0) return;
    this.active.clear();
    this.refresh();
    this.onChange?.(this.activeNames());
  }

  /** Turn an indicator on (or update its params). Preserves color overrides. */
  add(name: string, params: Record<string, unknown> = {}): void {
    const def = this.registry.get(name);
    if (!def) return;
    const prev = this.active.get(name);
    this.active.set(name, {
      name,
      params: { ...def.defaultInputs, ...params },
      colors: prev?.colors ?? {},
    });
    this.refresh();
    this.onChange?.(this.activeNames());
  }

  /**
   * Override the per-plot colors of an active indicator. Colors do not affect
   * computed values, so this re-applies series options in place rather than
   * re-running `refresh()` — line series take `applyOptions({ color })`,
   * histogram series are re-`setData`'d (per-point colors win where present).
   * No-op if the indicator is not active.
   */
  setColors(name: string, colors: Record<string, string>): void {
    const act = this.active.get(name);
    if (!act) return;
    this.active.set(name, { ...act, colors });
    this.applyColors(name);
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

  // ── State snapshot ───────────────────────────────────────────────────────────

  /**
   * Snapshot the active indicators as plain, serializable data. The returned
   * array fully describes the indicator set — `{ name, params, colors }` per
   * entry — and is deep-copied so mutating it cannot reach back into live state.
   * Feed it through `JSON.stringify` for persistence; restore with
   * {@link loadState}. Output is purely a function of this snapshot (indicators
   * compute via a pure `calculate`), so a round-trip never changes what renders.
   */
  toState(): ActiveIndicator[] {
    return [...this.active.values()].map((a) => ({
      name: a.name,
      params: { ...a.params },
      colors: { ...a.colors },
    }));
  }

  /**
   * Replace the active set with a snapshot from {@link toState}. Unknown
   * indicator names (not in the registry) are skipped; params are re-resolved
   * against the def's defaults so a stale snapshot still yields valid inputs.
   * Triggers a single refresh.
   */
  loadState(state: readonly ActiveIndicator[]): void {
    this.active.clear();
    for (const a of state) {
      const def = this.registry.get(a.name);
      if (!def) continue;
      this.active.set(a.name, {
        name: a.name,
        params: { ...def.defaultInputs, ...a.params },
        colors: { ...(a.colors ?? {}) },
      });
    }
    this.refresh();
    this.onChange?.(this.activeNames());
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
        const color = resolveColor(act.colors, plotId, pc?.color);
        const isHist = HISTOGRAM_STYLES.has(pc?.style ?? "");
        const filtered = filterValid(raw);
        if (isHist) {
          (s as ISeriesApi<"Histogram">).setData(
            filtered.map((d) => ({ time: d.time as Time, value: d.value, color: d.color ?? color })),
          );
        } else {
          (s as ISeriesApi<"Line">).applyOptions({ color });
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
        const color = resolveColor(act.colors, plotId, pc?.color);
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

  /**
   * Re-style an active indicator's existing series from its current color
   * overrides, without recomputing values. Patterns have no plot series.
   */
  private applyColors(name: string): void {
    const m = this.managed.get(name);
    const def = this.registry.get(name);
    const act = this.active.get(name);
    if (!m || !def || !act || m.isPattern) return;
    let res: IndicatorResult;
    try {
      res = def.calculate(this.bars(), act.params);
    } catch {
      return;
    }
    for (const [plotId, s] of m.plotSeries) {
      const pc = def.plotConfig.find((c) => c.id === plotId);
      const color = resolveColor(act.colors, plotId, pc?.color);
      if (HISTOGRAM_STYLES.has(pc?.style ?? "")) {
        const raw = res.plots[plotId];
        if (!raw) continue;
        (s as ISeriesApi<"Histogram">).setData(
          filterValid(raw).map((d) => ({ time: d.time as Time, value: d.value, color: d.color ?? color })),
        );
      } else {
        (s as ISeriesApi<"Line">).applyOptions({ color });
      }
    }
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function filterValid(data: PlotPoint[]): PlotPoint[] {
  return data.filter((d) => d.value != null && !Number.isNaN(d.value));
}

/** Per-plot user override wins, then the plot's configured color, then grey. */
function resolveColor(colors: Record<string, string> | undefined, plotId: string, fallback?: string): string {
  return colors?.[plotId] ?? fallback ?? "#888";
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
