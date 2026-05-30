/**
 * Series primitive that paints the measurement ruler (diagonal leg, price-range
 * fill, dashed bounds, endpoint ticks/dots). Ported unchanged in behaviour from
 * the source implementation; colors are configurable.
 */

import type {
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { MeasurementPoint } from "./types";

export interface RulerColors {
  up: string;
  down: string;
  flat: string;
  fillUp: string;
  fillDown: string;
  fillFlat: string;
}

const DEFAULT_COLORS: RulerColors = {
  up: "#26a69a",
  down: "#ef5350",
  flat: "#6b7280",
  fillUp: "rgba(38,166,154,0.07)",
  fillDown: "rgba(239,83,80,0.07)",
  fillFlat: "rgba(107,114,128,0.05)",
};

interface RulerPixels {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  direction: "up" | "down" | "flat";
}

class RulerRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly pixels: RulerPixels | null,
    private readonly colors: RulerColors,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    if (!this.pixels) return;
    const { x1, y1, x2, y2, direction } = this.pixels;

    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
      const bx1 = x1 * hpr;
      const by1 = y1 * vpr;
      const bx2 = x2 * hpr;
      const by2 = y2 * vpr;

      const color = direction === "up" ? this.colors.up : direction === "down" ? this.colors.down : this.colors.flat;
      const fill =
        direction === "up" ? this.colors.fillUp : direction === "down" ? this.colors.fillDown : this.colors.fillFlat;

      const minX = Math.min(bx1, bx2);
      const maxX = Math.max(bx1, bx2);
      const minY = Math.min(by1, by2);
      const maxY = Math.max(by1, by2);

      ctx.save();

      ctx.fillStyle = fill;
      ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

      ctx.strokeStyle = color;

      ctx.lineWidth = 1 * hpr;
      ctx.setLineDash([4 * hpr, 3 * hpr]);
      ctx.beginPath();
      ctx.moveTo(minX, by1);
      ctx.lineTo(maxX, by1);
      ctx.moveTo(minX, by2);
      ctx.lineTo(maxX, by2);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.lineWidth = 1.5 * hpr;
      ctx.beginPath();
      ctx.moveTo(bx1, by1);
      ctx.lineTo(bx2, by2);
      ctx.stroke();

      const tickH = 6 * vpr;
      ctx.beginPath();
      ctx.moveTo(bx1, by1 - tickH / 2);
      ctx.lineTo(bx1, by1 + tickH / 2);
      ctx.moveTo(bx2, by2 - tickH / 2);
      ctx.lineTo(bx2, by2 + tickH / 2);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(bx2, by2, 3.5 * hpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx1, by1, 2.5 * hpr, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }
}

class RulerPaneView implements IPrimitivePaneView {
  constructor(private readonly primitive: RulerPrimitive) {}
  zOrder(): "top" {
    return "top";
  }
  renderer(): IPrimitivePaneRenderer | null {
    return new RulerRenderer(this.primitive.pixels, this.primitive.colors);
  }
}

export class RulerPrimitive implements ISeriesPrimitive<Time> {
  readonly colors: RulerColors;
  /** Pixel coords recomputed each render. */
  pixels: RulerPixels | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private chart: any | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private series: any | null = null;
  private requestUpdate: (() => void) | null = null;
  private startPoint: MeasurementPoint | null = null;
  private endPoint: MeasurementPoint | null = null;
  private readonly view: RulerPaneView;

  constructor(colors: Partial<RulerColors> = {}) {
    this.colors = { ...DEFAULT_COLORS, ...colors };
    this.view = new RulerPaneView(this);
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
    this.pixels = null;
    this.startPoint = null;
    this.endPoint = null;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.view];
  }

  updateAllViews(): void {
    if (!this.chart || !this.series || !this.startPoint || !this.endPoint) {
      this.pixels = null;
      return;
    }
    const x1 = this.chart.timeScale().timeToCoordinate(this.startPoint.time);
    const y1 = this.series.priceToCoordinate(this.startPoint.price);
    const x2 = this.chart.timeScale().timeToCoordinate(this.endPoint.time);
    const y2 = this.series.priceToCoordinate(this.endPoint.price);
    if (x1 === null || y1 === null || x2 === null || y2 === null) {
      this.pixels = null;
      return;
    }
    const diff = this.endPoint.price - this.startPoint.price;
    const direction = diff > 0.0001 ? "up" : diff < -0.0001 ? "down" : "flat";
    this.pixels = { x1, y1, x2, y2, direction };
  }

  update(start: MeasurementPoint, end: MeasurementPoint): void {
    this.startPoint = start;
    this.endPoint = end;
    this.requestUpdate?.();
  }

  clear(): void {
    this.startPoint = null;
    this.endPoint = null;
    this.pixels = null;
    this.requestUpdate?.();
  }
}
