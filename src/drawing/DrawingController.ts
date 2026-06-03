/**
 * Drawing plugin: wires pointer + keyboard interaction to a {@link DrawingEngine}
 * and attaches a {@link DrawingPrimitive} for rendering. Implements
 * {@link ChartPlugin} so `controller.use(new DrawingController())` is all that's
 * needed — no third-party drawing runtime, no async loading.
 *
 *   - Active tool → click to place (one click for h/v lines, two for the rest;
 *     the second point previews as you move).
 *   - Idle → click a drawing to select; drag its body to move or a handle to
 *     reshape. Delete/Backspace removes the selection; Escape cancels/deselects.
 */

import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type { ChartPlugin, PluginContext } from "../plugins/types";
import { DrawingEngine } from "./DrawingEngine";
import { DrawingPrimitive } from "./DrawingPrimitive";
import { localStorageKV, saveDrawings, loadDrawings, type KVStore } from "./persistence";
import { FIB_LEVELS, FIB_EXT_LEVELS, type Drawing, type DrawingPoint } from "./types";
import { distToSegment, distToLine, distToRay, distToRectEdges, distToEllipse, pointInRect, type Pt } from "./geometry";

export interface DrawingControllerOptions {
  /** Provide your own engine (e.g. shared). Defaults to a fresh one. */
  engine?: DrawingEngine;
  /** Persist drawings under this KV key. `null`/omit disables. */
  storageKey?: string | null;
  /** KV backend. Default localStorage. */
  kv?: KVStore;
  /** Hit-test tolerance in px. Default 6. */
  hitTolerance?: number;
}

type AnySeries = ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area">;
type DragMode = { id: string; kind: "move" | "anchor"; anchorIndex: number; last: DrawingPoint };

export class DrawingController implements ChartPlugin {
  readonly id = "drawing";
  readonly engine: DrawingEngine;

  private chart: IChartApi | null = null;
  private series: AnySeries | null = null;
  private el: HTMLElement | null = null;
  private primitive: DrawingPrimitive | null = null;
  private drag: DragMode | null = null;
  private cleanup: Array<() => void> = [];
  private readonly tol: number;
  private readonly storageKey: string | null;
  private readonly kv: KVStore;

  constructor(opts: DrawingControllerOptions = {}) {
    this.engine = opts.engine ?? new DrawingEngine();
    this.tol = opts.hitTolerance ?? 6;
    this.storageKey = opts.storageKey ?? null;
    this.kv = opts.kv ?? localStorageKV;
  }

  init(ctx: PluginContext): void {
    this.chart = ctx.chart;
    this.series = ctx.series;
    this.el = ctx.chart.chartElement();
    this.primitive = new DrawingPrimitive(this.engine);
    this.series.attachPrimitive(this.primitive);

    if (this.storageKey) loadDrawings(this.engine, this.storageKey, this.kv);

    const offChange = this.engine.onChange(() => {
      this.primitive?.redraw();
      if (this.storageKey) saveDrawings(this.engine, this.storageKey, this.kv);
      ctx.bus.emit("drawingChange", { count: this.engine.getDrawings().length });
    });
    this.cleanup.push(offChange);

    const el = this.el;
    const down = (e: MouseEvent) => this.onDown(e);
    const move = (e: MouseEvent) => this.onMove(e);
    const up = () => this.onUp();
    const key = (e: KeyboardEvent) => this.onKey(e);
    el.addEventListener("mousedown", down, true);
    el.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("keydown", key);
    this.cleanup.push(() => el.removeEventListener("mousedown", down, true));
    this.cleanup.push(() => el.removeEventListener("mousemove", move));
    this.cleanup.push(() => window.removeEventListener("mouseup", up));
    this.cleanup.push(() => window.removeEventListener("keydown", key));
  }

  destroy(): void {
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
    if (this.series && this.primitive) {
      try {
        this.series.detachPrimitive(this.primitive);
      } catch {
        /* already detached */
      }
    }
    this.engine.destroy();
    this.chart = null;
    this.series = null;
    this.el = null;
    this.primitive = null;
  }

  // ── pointer / keyboard ───────────────────────────────────────────────────────

  private onDown(e: MouseEvent): void {
    if (this.engine.isLocked()) return;
    const dp = this.unproject(e.offsetX, e.offsetY);
    const tool = this.engine.getActiveTool();

    if (tool) {
      if (!dp) return;
      e.preventDefault();
      e.stopPropagation();
      this.suppressPan(true);
      const need = this.engine.pointsNeeded(tool);
      if (need === 1) {
        this.engine.commit({
          id: this.engine.newDrawingId(),
          tool,
          points: [dp],
          style: this.engine.getDefaultStyle(),
        });
        this.suppressPan(false);
      } else if (!this.engine.getDraft()) {
        // First click: anchor + live preview ([p, p]).
        this.engine.beginDraft(tool, dp);
      } else {
        const draft = this.engine.getDraft()!;
        // Lock the current preview point to dp.
        const fixed = draft.points.slice(0, -1).concat(dp);
        if (fixed.length >= need) {
          this.engine.commit({ ...draft, points: fixed });
          this.suppressPan(false);
        } else {
          // More anchors to place — start previewing the next one.
          this.engine.appendDraftPoint(dp);
        }
      }
      return;
    }

    // Idle: hit-test for selection / drag.
    const hit = this.hitTest(e.offsetX, e.offsetY);
    if (hit && dp) {
      e.preventDefault();
      e.stopPropagation();
      this.engine.select(hit.id);
      this.drag = { id: hit.id, kind: hit.kind, anchorIndex: hit.anchorIndex, last: dp };
      this.suppressPan(true);
    } else {
      this.engine.select(null); // let the chart pan
    }
  }

  private onMove(e: MouseEvent): void {
    const dp = this.unproject(e.offsetX, e.offsetY);
    if (!dp) return;

    // Placement preview.
    if (this.engine.getActiveTool() && this.engine.getDraft()) {
      this.engine.updateDraftEnd(dp);
      return;
    }

    // Drag.
    if (!this.drag) return;
    const d = this.engine.getById(this.drag.id);
    if (!d) return;
    if (this.drag.kind === "anchor") {
      const points = d.points.slice();
      points[this.drag.anchorIndex] = dp;
      this.engine.setPoints(this.drag.id, points);
    } else {
      const dt = dp.time - this.drag.last.time;
      const dpr = dp.price - this.drag.last.price;
      const points = d.points.map((p) => ({ time: p.time + dt, price: p.price + dpr }));
      this.engine.setPoints(this.drag.id, points);
    }
    this.drag.last = dp;
  }

  private onUp(): void {
    if (this.drag) {
      this.drag = null;
      this.suppressPan(false);
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (this.engine.getSelectedId()) {
        e.preventDefault();
        this.engine.removeSelected();
      }
    } else if (e.key === "Escape") {
      if (this.engine.getActiveTool() || this.engine.getDraft()) this.engine.cancelDraft();
      else this.engine.select(null);
      this.suppressPan(false);
    }
  }

  // ── geometry / projection ──────────────────────────────────────────────────────

  private suppressPan(on: boolean): void {
    this.chart?.applyOptions({ handleScroll: { pressedMouseMove: !on } });
  }

  private unproject(x: number, y: number): DrawingPoint | null {
    if (!this.chart || !this.series) return null;
    const time = this.chart.timeScale().coordinateToTime(x);
    const price = this.series.coordinateToPrice(y);
    if (time == null || price == null) return null;
    return { time: time as number, price: price as number };
  }

  private project(p: DrawingPoint): Pt | null {
    if (!this.chart || !this.series) return null;
    const x = this.chart.timeScale().timeToCoordinate(p.time as Time);
    const y = this.series.priceToCoordinate(p.price);
    if (x == null || y == null) return null;
    return { x, y };
  }

  private hitTest(px: number, py: number): { id: string; kind: "move" | "anchor"; anchorIndex: number } | null {
    const p: Pt = { x: px, y: py };
    const list = this.engine.getDrawings();
    const selId = this.engine.getSelectedId();

    // Selected drawing's handles take priority.
    if (selId) {
      const sel = this.engine.getById(selId);
      if (sel) {
        for (let i = 0; i < sel.points.length; i++) {
          const pt = this.project(sel.points[i]);
          if (pt && Math.hypot(pt.x - px, pt.y - py) <= this.tol + 3) {
            return { id: selId, kind: "anchor", anchorIndex: i };
          }
        }
      }
    }

    // Body hit, topmost first.
    for (let i = list.length - 1; i >= 0; i--) {
      if (this.bodyHit(list[i], p)) return { id: list[i].id, kind: "move", anchorIndex: 0 };
    }
    return null;
  }

  private bodyHit(d: Drawing, p: Pt): boolean {
    const a = this.project(d.points[0]);
    if (!a) return false;
    const b = d.points[1] ? this.project(d.points[1]) : null;
    const c = d.points[2] ? this.project(d.points[2]) : null;
    const t = this.tol;
    switch (d.tool) {
      case "HorizontalLine":
        return Math.abs(p.y - a.y) <= t;
      case "HorizontalRay":
        return Math.abs(p.y - a.y) <= t && p.x >= a.x - t;
      case "VerticalLine":
        return Math.abs(p.x - a.x) <= t;
      case "CrossLine":
        return Math.abs(p.y - a.y) <= t || Math.abs(p.x - a.x) <= t;
      case "TrendLine":
      case "Arrow":
        return !!b && distToSegment(p, a, b) <= t;
      case "Ray":
        return !!b && distToRay(p, a, b) <= t;
      case "ExtendedLine":
        return !!b && distToLine(p, a, b) <= t;
      case "Rectangle":
      case "PriceRange":
        return !!b && (distToRectEdges(p, a, b) <= t || pointInRect(p, a, b));
      case "DateRange":
        return !!b && (Math.abs(p.x - a.x) <= t || Math.abs(p.x - b.x) <= t);
      case "Circle":
        return !!b && distToEllipse(p, a, b) <= t;
      case "Triangle":
        return (
          !!b &&
          !!c &&
          (distToSegment(p, a, b) <= t || distToSegment(p, b, c) <= t || distToSegment(p, c, a) <= t)
        );
      case "ParallelChannel": {
        if (!b || !c) return false;
        const c2 = { x: c.x + (b.x - a.x), y: c.y + (b.y - a.y) };
        return distToSegment(p, a, b) <= t || distToSegment(p, c, c2) <= t;
      }
      case "FibRetracement":
        return !!b && FIB_LEVELS.some((lvl) => Math.abs(p.y - (a.y + (b.y - a.y) * lvl)) <= t);
      case "FibExtension":
        return !!b && !!c && FIB_EXT_LEVELS.some((lvl) => Math.abs(p.y - (c.y + (b.y - a.y) * lvl)) <= t);
      default:
        return !!b && distToSegment(p, a, b) <= t;
    }
  }
}
