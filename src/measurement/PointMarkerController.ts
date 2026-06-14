/**
 * Point-marker plugin ("catch point"). Ctrl + left-click on the chart drops a
 * transparent vertical marker at that instant and (optionally) recenters the
 * viewport on it, preserving the current bar spacing. Ctrl-clicking the existing
 * marker clears it; Escape clears it too.
 *
 * The marker is purely in-memory — it is not part of the serialized drawing
 * model and never persists. The caught timestamp is reported (epoch ms) via the
 * `onCatch` callback, `subscribe`, and the chart bus event `"pointMarker"`, so a
 * host can mirror it across linked charts (e.g. through a SyncEngine group).
 *
 * Framework-agnostic: usable from vanilla JS or any framework. Public API is
 * epoch milliseconds; conversion to lightweight-charts' epoch-seconds happens at
 * this boundary.
 */

import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type { ChartPlugin, PluginContext } from "../plugins/types";
import { PointMarkerPrimitive, type PointMarkerColors } from "./PointMarkerPrimitive";

export interface PointMarkerOptions {
  /** Modifier key that arms the catch gesture. Default `"ctrl"`. */
  modifier?: "shift" | "alt" | "ctrl" | "meta";
  /** Recenter the viewport on the caught point (keeps bar spacing). Default `true`. */
  centerOnCatch?: boolean;
  /** Marker color overrides. */
  colors?: Partial<PointMarkerColors>;
  /** Called whenever the marker moves (epoch ms) or is cleared (`null`). */
  onCatch?: (ts: number | null) => void;
}

type AnySeries = ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area">;

const MS = 1000;

export class PointMarkerController implements ChartPlugin {
  readonly id = "point-marker";

  private chart: IChartApi | null = null;
  private series: AnySeries | null = null;
  private container: HTMLElement | null = null;
  private marker: PointMarkerPrimitive;
  private ctx: PluginContext | null = null;
  private cleanup: Array<() => void> = [];
  private listeners = new Set<(ts: number | null) => void>();
  private last: number | null = null;

  constructor(private readonly opts: PointMarkerOptions = {}) {
    this.marker = new PointMarkerPrimitive(opts.colors);
  }

  init(ctx: PluginContext): void {
    this.ctx = ctx;
    this.chart = ctx.chart;
    this.series = ctx.series;
    this.container = ctx.chart.chartElement();
    this.series.attachPrimitive(this.marker);

    const el = this.container;
    // Capture phase so the gesture lands before the chart's own pan/click logic.
    const onClick = (e: MouseEvent) => this.onClick(e);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") this.clear();
    };
    el.addEventListener("click", onClick, { capture: true });
    window.addEventListener("keydown", onKey);
    this.cleanup.push(() => el.removeEventListener("click", onClick, { capture: true } as EventListenerOptions));
    this.cleanup.push(() => window.removeEventListener("keydown", onKey));
  }

  destroy(): void {
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
    try {
      this.series?.detachPrimitive(this.marker);
    } catch {
      /* already detached */
    }
    this.chart = null;
    this.series = null;
    this.container = null;
  }

  private modifierHeld(e: MouseEvent): boolean {
    switch (this.opts.modifier ?? "ctrl") {
      case "alt":
        return e.altKey;
      case "shift":
        return e.shiftKey;
      case "meta":
        return e.metaKey;
      default:
        return e.ctrlKey;
    }
  }

  /**
   * Subscribe to marker changes (epoch ms, `null` when cleared). Fires
   * immediately with the current value. Returns an unsubscribe fn.
   */
  subscribe(cb: (ts: number | null) => void): () => void {
    this.listeners.add(cb);
    cb(this.last);
    return () => this.listeners.delete(cb);
  }

  /** Current marker timestamp (epoch ms) or `null`. */
  getPoint(): number | null {
    return this.last;
  }

  /**
   * Place (or move) the marker at `ts` (epoch ms). Pass `null` to clear. This is
   * the programmatic entry a host uses to mirror a sibling chart's caught point;
   * it does NOT re-emit `onCatch`/bus (no broadcast loop) but does notify local
   * `subscribe` listeners so UI stays in sync.
   */
  setPoint(ts: number | null, options: { center?: boolean } = {}): void {
    if (ts == null) {
      this.marker.clear();
      this.last = null;
      for (const cb of this.listeners) cb(null);
      return;
    }
    this.marker.set(ts / MS);
    if (options.center ?? this.opts.centerOnCatch ?? true) this.centerOn(ts / MS);
    this.last = ts;
    for (const cb of this.listeners) cb(ts);
  }

  /** Clear the marker locally and emit the cleared state. */
  clear(): void {
    if (this.last == null) return;
    this.marker.clear();
    this.emit(null);
  }

  private emit(ts: number | null): void {
    this.last = ts;
    this.opts.onCatch?.(ts);
    for (const cb of this.listeners) cb(ts);
    this.ctx?.bus.emit("pointMarker" as never, ts as never);
  }

  private centerOn(tsSec: number): void {
    const chart = this.chart;
    if (!chart) return;
    const scale = chart.timeScale();
    const lr = scale.getVisibleLogicalRange();
    const x = scale.timeToCoordinate(tsSec as Time);
    if (lr && x != null) {
      const tl = scale.coordinateToLogical(x);
      if (tl != null) {
        const width = lr.to - lr.from;
        scale.setVisibleLogicalRange({ from: tl - width / 2, to: tl + width / 2 });
        return;
      }
    }
    const vr = scale.getVisibleRange();
    if (vr) {
      const span = (Number(vr.to) - Number(vr.from)) / 2;
      try {
        scale.setVisibleRange({ from: (tsSec - span) as Time, to: (tsSec + span) as Time });
      } catch {
        /* out of bounds */
      }
    }
  }

  private onClick(e: MouseEvent): void {
    if (!this.chart || e.button !== 0 || !this.modifierHeld(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const scale = this.chart.timeScale();
    const rect = this.container!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = scale.coordinateToTime(x);
    if (t == null) return;
    const tsSec = Number(t);

    // Catching on/near the existing marker clears it.
    const cur = this.marker.getTimeSec();
    if (cur != null) {
      const curX = scale.timeToCoordinate(cur as Time);
      if (curX != null && Math.abs(curX - x) <= 6) {
        this.marker.clear();
        this.emit(null);
        return;
      }
    }

    this.marker.set(tsSec);
    if (this.opts.centerOnCatch ?? true) this.centerOn(tsSec);
    this.emit(tsSec * MS);
  }
}
