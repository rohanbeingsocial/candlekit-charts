/**
 * Series primitive that paints a single vertical "point marker" — a thin,
 * low-opacity dashed line at one timestamp with a small cap-dot near the top
 * edge. Used by the {@link PointMarkerController} "catch point" gesture.
 *
 * Same canvas mechanism as {@link RulerPrimitive}: an `ISeriesPrimitive` painted
 * directly on the pane, so it is purely in-memory and:
 *   - is visible but non-intrusive (thin, translucent grey, dashed),
 *   - is NOT part of the serialized drawing model — it never persists,
 *   - does NOT capture pointer events, so crosshair / pan / zoom are untouched.
 *
 * Time is the lightweight-charts pane domain (epoch seconds — the same `Time`
 * the controller converts to from the public epoch-ms API at its boundary).
 */

import type {
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";

export interface PointMarkerColors {
  /** Vertical dashed line. */
  line: string;
  /** Solid cap-dot at the top edge. */
  dot: string;
}

const DEFAULT_COLORS: PointMarkerColors = {
  line: "rgba(148,163,184,0.55)",
  dot: "rgba(148,163,184,0.85)",
};

class PointMarkerRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly x: number | null,
    private readonly colors: PointMarkerColors,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    const x = this.x;
    if (x == null) return;
    target.useBitmapCoordinateSpace(({ context: ctx, bitmapSize, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
      const bx = Math.round(x * hpr) + 0.5;
      ctx.save();
      // Translucent so it reads as a guide, not a drawn line the user must manage.
      ctx.strokeStyle = this.colors.line;
      ctx.lineWidth = 1 * hpr;
      ctx.setLineDash([5 * vpr, 4 * vpr]);
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx, bitmapSize.height);
      ctx.stroke();
      // A subtle solid cap-dot at the top edge so the marker is locatable even
      // when the dashes fall outside the visible price band.
      ctx.setLineDash([]);
      ctx.fillStyle = this.colors.dot;
      ctx.beginPath();
      ctx.arc(bx, 4 * vpr, 2.5 * hpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
}

class PointMarkerPaneView implements IPrimitivePaneView {
  constructor(private readonly primitive: PointMarkerPrimitive) {}
  zOrder(): "top" {
    return "top";
  }
  renderer(): IPrimitivePaneRenderer | null {
    return new PointMarkerRenderer(this.primitive.x, this.primitive.colors);
  }
}

export class PointMarkerPrimitive implements ISeriesPrimitive<Time> {
  readonly colors: PointMarkerColors;
  /** Pixel x recomputed each render pass. */
  x: number | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private chart: any | null = null;
  private requestUpdate: (() => void) | null = null;
  /** Marker time in the pane domain (epoch seconds). null = hidden. */
  private timeSec: number | null = null;
  private readonly view: PointMarkerPaneView;

  constructor(colors: Partial<PointMarkerColors> = {}) {
    this.colors = { ...DEFAULT_COLORS, ...colors };
    this.view = new PointMarkerPaneView(this);
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.requestUpdate = null;
    this.timeSec = null;
    this.x = null;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.view];
  }

  updateAllViews(): void {
    if (!this.chart || this.timeSec == null) {
      this.x = null;
      return;
    }
    const x = this.chart.timeScale().timeToCoordinate(this.timeSec as Time);
    this.x = x == null ? null : x;
  }

  /** Place (or move) the marker. `timeSec` = pane-domain epoch seconds. */
  set(timeSec: number): void {
    this.timeSec = timeSec;
    this.requestUpdate?.();
  }

  /** Whether a marker is currently set. */
  isSet(): boolean {
    return this.timeSec != null;
  }

  /** Current marker time (epoch seconds) or null. */
  getTimeSec(): number | null {
    return this.timeSec;
  }

  clear(): void {
    this.timeSec = null;
    this.x = null;
    this.requestUpdate?.();
  }
}
