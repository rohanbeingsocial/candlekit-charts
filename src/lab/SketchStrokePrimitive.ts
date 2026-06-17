/**
 * Series primitive that paints the user's freehand sketch stroke as it is drawn.
 *
 * Works purely in pane pixel space — the stroke is a shape, not anchored to any
 * time/price, so it never needs coordinate conversion. The controller feeds it
 * CSS-pixel points and clears it once the search runs.
 */

import type {
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { StrokePoint } from "./types";

class StrokeRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly points: StrokePoint[],
    private readonly color: string,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    if (this.points.length < 2) return;
    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
      ctx.save();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2 * hpr;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(this.points[0].x * hpr, this.points[0].y * vpr);
      for (let i = 1; i < this.points.length; i++) {
        ctx.lineTo(this.points[i].x * hpr, this.points[i].y * vpr);
      }
      ctx.stroke();
      ctx.restore();
    });
  }
}

class StrokePaneView implements IPrimitivePaneView {
  constructor(private readonly primitive: SketchStrokePrimitive) {}
  zOrder(): "top" {
    return "top";
  }
  renderer(): IPrimitivePaneRenderer | null {
    return new StrokeRenderer(this.primitive.points, this.primitive.color);
  }
}

export class SketchStrokePrimitive implements ISeriesPrimitive<Time> {
  points: StrokePoint[] = [];
  color: string;

  private requestUpdate: (() => void) | null = null;
  private readonly view: StrokePaneView;

  constructor(color = "rgba(245, 200, 90, 0.95)") {
    this.color = color;
    this.view = new StrokePaneView(this);
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
    this.points = [];
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.view];
  }

  updateAllViews(): void {
    /* points are already in pixel space — nothing to recompute on pan/zoom */
  }

  setPoints(points: StrokePoint[]): void {
    this.points = points;
    this.requestUpdate?.();
  }

  clear(): void {
    this.points = [];
    this.requestUpdate?.();
  }
}
