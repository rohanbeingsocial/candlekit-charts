/**
 * Series primitive that paints every drawing + the in-progress draft + the
 * selection handles. Reads the model from a {@link DrawingEngine} and projects
 * data anchors to pixels via the chart time scale + series price scale.
 *
 * Off-screen anchors (time scrolled out of the data range) project to `null`
 * and that drawing is skipped for the frame — horizontal lines (price-only) and
 * the price axis always render.
 */

import type {
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  Time,
  IChartApi,
  ISeriesApi,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import { FIB_LEVELS, type Drawing } from "./types";
import type { DrawingEngine } from "./DrawingEngine";

interface Anchor {
  x: number | null;
  y: number | null;
}
interface Shape {
  drawing: Drawing;
  anchors: Anchor[];
  selected: boolean;
  draft: boolean;
}

type AnySeries = ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area">;

class Renderer implements IPrimitivePaneRenderer {
  constructor(private readonly shapes: Shape[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const { context: ctx, bitmapSize, horizontalPixelRatio: hpr, verticalPixelRatio: vpr } = scope;
      const W = bitmapSize.width;
      const H = bitmapSize.height;
      const BIG = (W + H) * 4;

      for (const s of this.shapes) {
        const { style, tool } = s.drawing;
        const a = s.anchors[0];
        const b = s.anchors[1];
        const ax = a?.x == null ? null : a.x * hpr;
        const ay = a?.y == null ? null : a.y * vpr;
        const bx = b?.x == null ? null : b.x * hpr;
        const by = b?.y == null ? null : b.y * vpr;

        ctx.save();
        ctx.strokeStyle = style.color;
        ctx.fillStyle = style.fill ?? "transparent";
        ctx.lineWidth = Math.max(1, style.width) * hpr;
        ctx.setLineDash(style.dashed ? [6 * hpr, 4 * hpr] : []);

        switch (tool) {
          case "HorizontalLine":
            if (ay != null) line(ctx, 0, ay, W, ay);
            break;
          case "VerticalLine":
            if (ax != null) line(ctx, ax, 0, ax, H);
            break;
          case "TrendLine":
            if (ax != null && ay != null && bx != null && by != null) line(ctx, ax, ay, bx, by);
            break;
          case "Arrow":
            if (ax != null && ay != null && bx != null && by != null) {
              line(ctx, ax, ay, bx, by);
              arrowHead(ctx, ax, ay, bx, by, 12 * hpr);
            }
            break;
          case "Ray":
            if (ax != null && ay != null && bx != null && by != null) {
              const d = norm(bx - ax, by - ay);
              line(ctx, ax, ay, ax + d.x * BIG, ay + d.y * BIG);
            }
            break;
          case "ExtendedLine":
            if (ax != null && ay != null && bx != null && by != null) {
              const d = norm(bx - ax, by - ay);
              line(ctx, ax - d.x * BIG, ay - d.y * BIG, ax + d.x * BIG, ay + d.y * BIG);
            }
            break;
          case "Rectangle":
            if (ax != null && ay != null && bx != null && by != null) {
              const x = Math.min(ax, bx);
              const y = Math.min(ay, by);
              const w = Math.abs(bx - ax);
              const h = Math.abs(by - ay);
              if (style.fill) {
                ctx.fillRect(x, y, w, h);
              }
              ctx.strokeRect(x, y, w, h);
            }
            break;
          case "Circle":
            if (ax != null && ay != null && bx != null && by != null) {
              const cx = (ax + bx) / 2;
              const cy = (ay + by) / 2;
              const rx = Math.abs(bx - ax) / 2;
              const ry = Math.abs(by - ay) / 2;
              ctx.beginPath();
              ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
              if (style.fill) ctx.fill();
              ctx.stroke();
            }
            break;
          case "FibRetracement":
            if (ax != null && ay != null && by != null) {
              ctx.font = `${10 * hpr}px ui-monospace, monospace`;
              ctx.fillStyle = style.color;
              for (const lvl of FIB_LEVELS) {
                const y = ay + (by - ay) * lvl;
                line(ctx, 0, y, W, y);
                ctx.fillText(`${(lvl * 100).toFixed(1)}%`, 4 * hpr, y - 2 * hpr);
              }
            }
            break;
          default:
            if (ax != null && ay != null && bx != null && by != null) line(ctx, ax, ay, bx, by);
        }
        ctx.restore();

        if (s.selected) {
          ctx.save();
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = style.color;
          ctx.lineWidth = 1.5 * hpr;
          const r = 4 * hpr;
          for (const an of [a, b]) {
            if (an?.x == null || an?.y == null) continue;
            ctx.beginPath();
            ctx.rect(an.x * hpr - r, an.y * vpr - r, r * 2, r * 2);
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    });
  }
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function norm(dx: number, dy: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function arrowHead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, size: number): void {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const a1 = ang + Math.PI - Math.PI / 7;
  const a2 = ang + Math.PI + Math.PI / 7;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 + Math.cos(a1) * size, y2 + Math.sin(a1) * size);
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 + Math.cos(a2) * size, y2 + Math.sin(a2) * size);
  ctx.stroke();
}

class PaneView implements IPrimitivePaneView {
  constructor(private readonly primitive: DrawingPrimitive) {}
  zOrder(): "top" {
    return "top";
  }
  renderer(): IPrimitivePaneRenderer {
    return new Renderer(this.primitive.shapes);
  }
}

export class DrawingPrimitive implements ISeriesPrimitive<Time> {
  shapes: Shape[] = [];

  private chart: IChartApi | null = null;
  private series: AnySeries | null = null;
  private requestUpdate: (() => void) | null = null;
  private readonly view = new PaneView(this);

  constructor(private readonly engine: DrawingEngine) {}

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series as AnySeries;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.view];
  }

  /** Ask the chart to repaint (call after engine mutations). */
  redraw(): void {
    this.requestUpdate?.();
  }

  updateAllViews(): void {
    if (!this.chart || !this.series) {
      this.shapes = [];
      return;
    }
    const selectedId = this.engine.getSelectedId();
    const list: Drawing[] = [...this.engine.getDrawings()];
    const draft = this.engine.getDraft();
    if (draft) list.push(draft);

    this.shapes = list.map((d) => ({
      drawing: d,
      anchors: d.points.map((p) => this.project(p)),
      selected: d.id === selectedId,
      draft: draft?.id === d.id,
    }));
  }

  private project(p: { time: number; price: number }): Anchor {
    if (!this.chart || !this.series) return { x: null, y: null };
    const x = this.chart.timeScale().timeToCoordinate(p.time as Time);
    const y = this.series.priceToCoordinate(p.price);
    return { x: x == null ? null : x, y: y == null ? null : y };
  }
}
