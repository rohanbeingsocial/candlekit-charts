/**
 * Sketch Search plugin. Arm it (e.g. from a toolbar toggle), draw a freehand
 * shape across the chart, and on release it resamples the stroke and finds the
 * historical windows whose price shape looks most like it — painting them as
 * translucent bands and emitting the ranked matches.
 *
 * Framework-agnostic, mirroring {@link MeasurementController}: pass `onResult`
 * or use {@link SketchSearchController.subscribe}. The geometry is pure pixel
 * space (shape only), so the stroke is never mapped to price/time.
 */

import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type { ChartPlugin, PluginContext } from "../plugins/types";
import { findSimilar, resampleStroke } from "./similarity";
import type { StrokePoint } from "./types";
import { MatchHighlightPrimitive, type MatchHighlightColors } from "./MatchHighlightPrimitive";
import { SketchStrokePrimitive } from "./SketchStrokePrimitive";

/** One historical window that matched the sketched shape. */
export interface SketchMatch {
  startIndex: number;
  endIndex: number;
  distance: number;
  /** Epoch ms of the window's first / last bar. */
  startTime: number;
  endTime: number;
}

export interface SketchSearchResult {
  /** The resampled query shape (length = effective query length). */
  query: number[];
  matches: SketchMatch[];
}

export interface SketchSearchOptions {
  /** Resample resolution / query length. Default 48 (clamped to fit history). */
  queryLength?: number;
  /** Max matches to return. Default 10. */
  k?: number;
  /**
   * Minimum shape-similarity (correlation, `[-1, 1]`) a window must reach to be
   * shown. Raise it for stricter matching; a sketch that resembles nothing then
   * returns no bands. Default `0.7`.
   */
  minScore?: number;
  /**
   * Reject strokes that backtrack horizontally — a circle/scribble goes right
   * *then* left, which is not a left-to-right price shape. Value is the minimum
   * ratio of net horizontal span to total horizontal travel, in `[0, 1]`: a
   * clean left-to-right drag ≈ 1, a closed loop ≈ 0.5. Default `0.7`.
   */
  minHorizontalProgress?: number;
  /** Stroke + highlight colors. */
  strokeColor?: string;
  highlightColors?: Partial<MatchHighlightColors>;
  /** Called on every result (null when cleared / no match). */
  onResult?: (result: SketchSearchResult | null) => void;
}

type AnySeries = ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area">;

export class SketchSearchController implements ChartPlugin {
  readonly id = "sketch-search";

  private chart: IChartApi | null = null;
  private series: AnySeries | null = null;
  private el: HTMLElement | null = null;
  private ctx: PluginContext | null = null;

  private readonly highlight: MatchHighlightPrimitive;
  private readonly stroke: SketchStrokePrimitive;

  private active = false;
  private drawing = false;
  private points: StrokePoint[] = [];
  private rect: DOMRect | null = null;

  private cleanup: Array<() => void> = [];
  private listeners = new Set<(r: SketchSearchResult | null) => void>();
  private last: SketchSearchResult | null = null;

  constructor(private readonly opts: SketchSearchOptions = {}) {
    this.highlight = new MatchHighlightPrimitive(opts.highlightColors);
    this.stroke = new SketchStrokePrimitive(opts.strokeColor);
  }

  init(ctx: PluginContext): void {
    this.ctx = ctx;
    this.chart = ctx.chart;
    this.series = ctx.series;
    this.el = ctx.chart.chartElement();
    this.series.attachPrimitive(this.highlight);
    this.series.attachPrimitive(this.stroke);

    const el = this.el;
    const onDown = (e: MouseEvent) => this.onDown(e);
    const onMove = (e: MouseEvent) => this.onMove(e);
    const onUp = () => this.onUp();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") this.clear();
    };
    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("keydown", onKey);
    this.cleanup.push(() => el.removeEventListener("mousedown", onDown));
    this.cleanup.push(() => window.removeEventListener("mousemove", onMove));
    this.cleanup.push(() => window.removeEventListener("mouseup", onUp));
    this.cleanup.push(() => window.removeEventListener("keydown", onKey));
  }

  destroy(): void {
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
    try {
      this.series?.detachPrimitive(this.highlight);
      this.series?.detachPrimitive(this.stroke);
    } catch {
      /* already detached */
    }
    this.chart = null;
    this.series = null;
    this.el = null;
  }

  /** Arm / disarm sketch capture. Disarming clears any drawn stroke + matches. */
  setActive(active: boolean): void {
    this.active = active;
    if (this.el) this.el.style.cursor = active ? "crosshair" : "";
    if (!active) this.clear();
  }

  isActive(): boolean {
    return this.active;
  }

  /** Subscribe to results (fires immediately with the current value). */
  subscribe(cb: (r: SketchSearchResult | null) => void): () => void {
    this.listeners.add(cb);
    cb(this.last);
    return () => this.listeners.delete(cb);
  }

  getResult(): SketchSearchResult | null {
    return this.last;
  }

  clear(): void {
    this.drawing = false;
    this.points = [];
    this.stroke.clear();
    this.highlight.clear();
    this.restoreScroll();
    this.emit(null);
  }

  // ── Pointer capture ──────────────────────────────────────────────────────────

  private onDown(e: MouseEvent): void {
    if (!this.active || !this.el || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    this.rect = this.el.getBoundingClientRect();
    this.drawing = true;
    this.points = [{ x: e.clientX - this.rect.left, y: e.clientY - this.rect.top }];
    this.highlight.clear();
    this.stroke.setPoints(this.points);
    this.chart?.applyOptions({ handleScroll: { pressedMouseMove: false } });
  }

  private onMove(e: MouseEvent): void {
    if (!this.drawing || !this.rect) return;
    this.points.push({ x: e.clientX - this.rect.left, y: e.clientY - this.rect.top });
    this.stroke.setPoints(this.points.slice());
  }

  private onUp(): void {
    if (!this.drawing) return;
    this.drawing = false;
    this.restoreScroll();
    this.runSearch();
  }

  private restoreScroll(): void {
    this.chart?.applyOptions({ handleScroll: { pressedMouseMove: true } });
  }

  // ── Search ─────────────────────────────────────────────────────────────────────

  private runSearch(): void {
    const bars = this.ctx?.getBars() ?? [];
    if (this.points.length < 2 || bars.length < 3) {
      this.stroke.clear();
      this.emit(null);
      return;
    }

    // Reject loops / scribbles: a left-to-right price shape makes net horizontal
    // progress, whereas a circle goes right then back (ratio ≈ 0.5). Measured on
    // the raw stroke, before resampleStroke collapses the backtracking.
    const minProgress = this.opts.minHorizontalProgress ?? 0.7;
    let travelX = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < this.points.length; i++) {
      const x = this.points[i].x;
      if (i > 0) travelX += Math.abs(x - this.points[i - 1].x);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    const progress = travelX > 0 ? (maxX - minX) / travelX : 0;
    if (progress < minProgress) {
      this.stroke.clear();
      this.emit(null);
      return;
    }

    // Query length: requested, but clamped so at least one window fits history.
    const requested = Math.max(2, Math.floor(this.opts.queryLength ?? 48));
    const n = Math.min(requested, bars.length - 1);
    if (n < 2) {
      this.stroke.clear();
      this.emit(null);
      return;
    }

    let query: number[];
    try {
      query = resampleStroke(this.points, n);
    } catch {
      this.stroke.clear();
      this.emit(null);
      return;
    }

    const closes = new Array<number>(bars.length);
    for (let i = 0; i < bars.length; i++) closes[i] = bars[i].close;

    const k = Math.max(1, Math.floor(this.opts.k ?? 10));
    const minScore = this.opts.minScore ?? 0.7;
    const raw = findSimilar(closes, query, { k, minGap: n, minScore });

    const matches: SketchMatch[] = raw.map((m) => ({
      startIndex: m.startIndex,
      endIndex: m.endIndex,
      distance: m.distance,
      startTime: bars[m.startIndex].ts,
      endTime: bars[m.endIndex].ts,
    }));

    this.highlight.setBands(
      matches.map((m, i) => ({
        startTime: (m.startTime / 1000) as Time,
        endTime: (m.endTime / 1000) as Time,
        rank: i,
        distance: m.distance,
      })),
    );
    // Drop the freehand stroke now that the matched bands are shown.
    this.stroke.clear();

    this.emit({ query, matches });
  }

  private emit(result: SketchSearchResult | null): void {
    this.last = result;
    this.opts.onResult?.(result);
    for (const cb of this.listeners) cb(result);
    this.ctx?.bus.emit("sketchSearch" as never, result as never);
  }
}
