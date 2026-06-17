/**
 * Echoes plugin ("market déjà vu"). Takes the most recent price window as a
 * query, finds similar non-overlapping windows in the loaded history, paints
 * them as translucent bands, and projects the median of what happened *after*
 * those windows forward from the last bar.
 *
 * The quant is all in {@link buildEchoScan} (pure). This controller only wires
 * it to the chart: bands via {@link MatchHighlightPrimitive}, the forward path
 * via a lightweight line series fed future-timestamped points.
 */

import { LineSeries, LineStyle, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import type { ChartPlugin, PluginContext } from "../plugins/types";
import type { Bar } from "../core/types";
import { buildEchoScan } from "./similarity";
import type { EchoScan } from "./types";
import { MatchHighlightPrimitive, type MatchHighlightColors } from "./MatchHighlightPrimitive";

export interface EchoesOptions {
  /** Query window length in bars (the recent shape to match). Default 30. */
  windowLen?: number;
  /** Aftermath horizon in bars (how far forward to study/project). Default 30. */
  horizon?: number;
  /** Max echoes to return. Default 8. */
  k?: number;
  /** Re-run automatically whenever the data set changes. Default false. */
  autoRerun?: boolean;
  /** Forward-projection line color. */
  projectionColor?: string;
  highlightColors?: Partial<MatchHighlightColors>;
  /** Called with each scan (null when cleared / not enough history). */
  onScan?: (scan: EchoScan | null) => void;
}

type AnySeries = ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area">;

export class EchoesController implements ChartPlugin {
  readonly id = "echoes";

  private chart: IChartApi | null = null;
  private series: AnySeries | null = null;
  private ctx: PluginContext | null = null;

  private readonly highlight: MatchHighlightPrimitive;
  private projection: ISeriesApi<"Line"> | null = null;

  private windowLen: number;
  private horizon: number;
  private k: number;
  private hasRun = false;

  private listeners = new Set<(s: EchoScan | null) => void>();
  private last: EchoScan | null = null;

  constructor(private readonly opts: EchoesOptions = {}) {
    this.windowLen = Math.max(2, Math.floor(opts.windowLen ?? 30));
    this.horizon = Math.max(1, Math.floor(opts.horizon ?? 30));
    this.k = Math.max(1, Math.floor(opts.k ?? 8));
    this.highlight = new MatchHighlightPrimitive(opts.highlightColors);
  }

  init(ctx: PluginContext): void {
    this.ctx = ctx;
    this.chart = ctx.chart;
    this.series = ctx.series;
    this.series.attachPrimitive(this.highlight);
  }

  destroy(): void {
    this.removeProjection();
    try {
      this.series?.detachPrimitive(this.highlight);
    } catch {
      /* already detached */
    }
    this.chart = null;
    this.series = null;
    this.ctx = null;
  }

  onData(): void {
    if (this.opts.autoRerun && this.hasRun) this.run();
  }

  /** Adjust the scan parameters; re-runs if a scan has already been shown. */
  setConfig(cfg: { windowLen?: number; horizon?: number; k?: number }): void {
    if (cfg.windowLen !== undefined) this.windowLen = Math.max(2, Math.floor(cfg.windowLen));
    if (cfg.horizon !== undefined) this.horizon = Math.max(1, Math.floor(cfg.horizon));
    if (cfg.k !== undefined) this.k = Math.max(1, Math.floor(cfg.k));
    if (this.hasRun) this.run();
  }

  /** Run a scan against the current data and render it. Returns the scan. */
  run(): EchoScan | null {
    const bars = this.ctx?.getBars() ?? [];
    const scan = buildEchoScan(bars, this.windowLen, this.horizon, this.k);
    this.hasRun = true;

    if (!scan) {
      this.highlight.clear();
      this.removeProjection();
      this.emit(null);
      return null;
    }

    this.highlight.setBands(
      scan.results.map((r, i) => ({
        startTime: (bars[r.match.startIndex].ts / 1000) as Time,
        endTime: (bars[r.match.endIndex].ts / 1000) as Time,
        rank: i,
        distance: r.match.distance,
      })),
    );

    this.drawProjection(bars, scan);
    this.emit(scan);
    return scan;
  }

  clear(): void {
    this.hasRun = false;
    this.highlight.clear();
    this.removeProjection();
    this.emit(null);
  }

  subscribe(cb: (s: EchoScan | null) => void): () => void {
    this.listeners.add(cb);
    cb(this.last);
    return () => this.listeners.delete(cb);
  }

  getScan(): EchoScan | null {
    return this.last;
  }

  // ── Forward projection ─────────────────────────────────────────────────────────

  private drawProjection(bars: readonly Bar[], scan: EchoScan): void {
    const last = bars[bars.length - 1];
    const spacing = medianBarSpacingMs(bars);
    if (!last || spacing <= 0 || scan.medianPathPct.length === 0) {
      this.removeProjection();
      return;
    }

    const base = last.close;
    const points: { time: Time; value: number }[] = [
      { time: (last.ts / 1000) as Time, value: base },
    ];
    for (let off = 1; off <= scan.medianPathPct.length; off++) {
      const ts = last.ts + off * spacing;
      points.push({ time: (ts / 1000) as Time, value: base * (1 + scan.medianPathPct[off - 1] / 100) });
    }

    if (!this.projection && this.chart) {
      this.projection = this.chart.addSeries(LineSeries, {
        color: this.opts.projectionColor ?? "#f5c85a",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });
    }
    this.projection?.setData(points);
  }

  private removeProjection(): void {
    if (this.projection && this.chart) {
      try {
        this.chart.removeSeries(this.projection);
      } catch {
        /* already removed */
      }
    }
    this.projection = null;
  }

  private emit(scan: EchoScan | null): void {
    this.last = scan;
    this.opts.onScan?.(scan);
    for (const cb of this.listeners) cb(scan);
    this.ctx?.bus.emit("echoScan" as never, scan as never);
  }
}

/** Median gap between consecutive bar timestamps (ms), over the last ~30 bars. */
function medianBarSpacingMs(bars: readonly Bar[]): number {
  const n = bars.length;
  if (n < 2) return 0;
  const start = Math.max(1, n - 30);
  const diffs: number[] = [];
  for (let i = start; i < n; i++) {
    const d = bars[i].ts - bars[i - 1].ts;
    if (d > 0) diffs.push(d);
  }
  if (diffs.length === 0) return 0;
  diffs.sort((a, b) => a - b);
  const mid = diffs.length >> 1;
  return diffs.length % 2 === 1 ? diffs[mid] : (diffs[mid - 1] + diffs[mid]) / 2;
}
