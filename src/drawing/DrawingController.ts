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
import { ownerWindowOf } from "../dom/ownerWindow";
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
    this.primitive = new DrawingPrimitive(this.engine, ctx.getBars);
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
    // The chart element's OWN window. A chart rendered into a second browser
    // window (a detached panel, a popout) receives mouseup / keydown THERE
    // only: binding the module-scope `window` would leave a drag latched and
    // kill Escape / Delete for every drawing in that window.
    const win = ownerWindowOf(el);
    el.addEventListener("mousedown", down, true);
    el.addEventListener("mousemove", move);
    win.addEventListener("mouseup", up);
    win.addEventListener("keydown", key);
    this.cleanup.push(() => el.removeEventListener("mousedown", down, true));
    this.cleanup.push(() => el.removeEventListener("mousemove", move));
    this.cleanup.push(() => win.removeEventListener("mouseup", up));
    this.cleanup.push(() => win.removeEventListener("keydown", key));
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

  onData(): void {
    this.primitive?.redraw();
  }

  onBar(): void {
    this.primitive?.redraw();
  }

  /**
   * Report whether a local chart coordinate belongs to a drawing gesture.
   * Hosts that implement their own chart panning can use this before starting
   * a pan, so an anchor/body drag remains exclusively owned by the drawing
   * controller.
   */
  handlesPointerAt(x: number, y: number): boolean {
    if (this.engine.isLocked()) return false;
    if (this.engine.getActiveTool()) return true;
    return this.hitTest(x, y) !== null;
  }

  // ── pointer / keyboard ───────────────────────────────────────────────────────

  private onDown(e: MouseEvent): void {
    if (this.engine.isLocked()) return;
    const point = this.localPoint(e);
    if (!point) return;
    const dp = this.unproject(point.x, point.y);
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
          style: this.engine.getDefaultStyle(tool),
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
    const hit = this.hitTest(point.x, point.y);
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
    const point = this.localPoint(e);
    if (!point) return;
    const dp = this.unproject(point.x, point.y);
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

  /**
   * Convert a browser event to coordinates relative to the chart element.
   *
   * `offsetX`/`offsetY` are relative to the event target. Lightweight Charts
   * renders several nested canvas elements, so the target can change between
   * the grid, series, and overlay canvases. Passing those target-relative
   * values to the chart coordinate APIs produces a position offset that varies
   * with the canvas receiving the event. Client coordinates normalized against
   * the chart element are stable across all of those canvases and use the same
   * CSS-pixel coordinate system as Lightweight Charts.
   */
  private localPoint(e: MouseEvent): { x: number; y: number } | null {
    const element = this.el;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

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
    const allPoints = d.points
      .map((point) => this.project(point))
      .filter((point): point is Pt => !!point);
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
      case "InfoLine":
      case "TrendAngle":
        return !!b && distToSegment(p, a, b) <= t;
      case "FibChannel":
      case "RegressionChannel":
      case "DisjointChannel":
      case "Pitchfork":
      case "SchiffPitchfork":
      case "ModifiedSchiffPitchfork":
      case "InsidePitchfork":
        return !!b && (distToSegment(p, a, b) <= t || (!!c && distToSegment(p, b, c) <= t));
      case "FlatTopBottom":
        return !!b && (Math.abs(p.y - a.y) <= t || Math.abs(p.y - b.y) <= t || Math.abs(p.x - a.x) <= t || Math.abs(p.x - b.x) <= t);
      case "FibTimeZone":
      case "TrendFibTime":
      case "CyclicLines":
      case "TimeCycles":
        return Math.abs(p.x - a.x) <= t || (!!b && Math.abs(p.x - b.x) <= t);
      case "FibFan":
      case "FibSpeedResistanceFan":
      case "GannFan":
        return !!b && distToRay(p, a, b) <= t;
      case "FibExtensionTwoPoint":
        return !!b && (Math.abs(p.y - a.y) <= t || Math.abs(p.y - b.y) <= t);
      case "FibCircles":
      case "FibSpeedResistanceArcs":
      case "FibSpiral":
      case "Ellipse":
        return !!b && distToEllipse(p, a, b) <= t;
      case "FibWedge":
      case "RotatedRectangle":
        return !!b && (!!c && (distToSegment(p, a, b) <= t || distToSegment(p, b, c) <= t || distToSegment(p, c, a) <= t));
      case "GannBox":
      case "GannSquare":
        return !!b && (distToRectEdges(p, a, b) <= t || pointInRect(p, a, b));
      case "Path":
      case "Polyline":
      case "Brush":
      case "Highlighter":
      case "XABCDPattern":
      case "ABCDPattern":
      case "HeadShoulders":
      case "ElliottImpulse":
      case "ElliottCorrection":
      case "Gartley":
      case "Bat":
      case "Butterfly":
      case "Crab":
      case "Shark":
      case "Cypher": {
        return allPoints.slice(1).some((point, index) => distToSegment(p, allPoints[index]!, point) <= t);
      }
      case "Arc":
      case "Curve":
      case "DoubleCurve":
      case "SineLine":
        return !!b && !!c && (distToSegment(p, a, b) <= t || distToSegment(p, b, c) <= t);
      case "LongPosition":
      case "ShortPosition":
      case "Measure":
      case "Forecast":
      case "Callout":
      case "Note":
      case "Balloon":
      case "Comment":
        return !!b && (distToRectEdges(p, a, b) <= t || pointInRect(p, a, b) || distToSegment(p, a, b) <= t);
      case "Text":
      case "PriceLabel":
      case "FlagMark":
      case "IconStamp":
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
      case "AnchoredVWAP":
        return Math.hypot(p.x - a.x, p.y - a.y) <= this.tol * 2 || Math.abs(p.y - a.y) <= t || Math.abs(p.x - a.x) <= t;
      default:
        return !!b && distToSegment(p, a, b) <= t;
    }
  }
}
