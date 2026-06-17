/**
 * Series primitive that paints translucent vertical bands over historical
 * windows that matched a query (Echoes or Sketch Search). Each band spans the
 * full pane height between its start and end times; lower-ranked matches fade.
 *
 * Pure renderer — it knows nothing about how the matches were found.
 */

import type {
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";

/** One window to highlight, in chart time (lightweight-charts seconds). */
export interface MatchBand {
  startTime: Time;
  endTime: Time;
  /** 0 = best match; higher ranks fade. */
  rank: number;
  distance: number;
}

export interface MatchHighlightColors {
  /** Base fill (alpha applied per-rank on top of this). */
  fill: string;
  /** Vertical edge lines at the window bounds. */
  border: string;
  /** Rank label text. */
  label: string;
}

const DEFAULT_COLORS: MatchHighlightColors = {
  fill: "rgba(91, 156, 246, 1)",
  border: "rgba(91, 156, 246, 0.9)",
  label: "rgba(173, 201, 247, 0.95)",
};

interface BandPixels {
  x1: number;
  x2: number;
  rank: number;
}

/** Alpha for a band fill, fading with rank but never invisible. */
function fillAlphaForRank(rank: number): number {
  return Math.max(0.05, 0.28 - rank * 0.035);
}

class HighlightRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly bands: BandPixels[],
    private readonly colors: MatchHighlightColors,
    private readonly showLabels: boolean,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    if (this.bands.length === 0) return;

    target.useBitmapCoordinateSpace((scope) => {
      const { context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr, bitmapSize } = scope;
      const height = bitmapSize.height;

      ctx.save();
      for (const band of this.bands) {
        const bx1 = Math.min(band.x1, band.x2) * hpr;
        const bx2 = Math.max(band.x1, band.x2) * hpr;
        const w = Math.max(1, bx2 - bx1);

        ctx.fillStyle = withAlpha(this.colors.fill, fillAlphaForRank(band.rank));
        ctx.fillRect(bx1, 0, w, height);

        ctx.strokeStyle = this.colors.border;
        ctx.lineWidth = 1 * hpr;
        ctx.beginPath();
        ctx.moveTo(bx1, 0);
        ctx.lineTo(bx1, height);
        ctx.moveTo(bx2, 0);
        ctx.lineTo(bx2, height);
        ctx.stroke();

        if (this.showLabels) {
          ctx.fillStyle = this.colors.label;
          ctx.font = `${11 * vpr}px sans-serif`;
          ctx.textBaseline = "top";
          ctx.fillText(`#${band.rank + 1}`, bx1 + 3 * hpr, 3 * vpr);
        }
      }
      ctx.restore();
    });
  }
}

class HighlightPaneView implements IPrimitivePaneView {
  constructor(private readonly primitive: MatchHighlightPrimitive) {}
  zOrder(): "bottom" {
    // Sit below candles so the bands tint the background, not the bars.
    return "bottom";
  }
  renderer(): IPrimitivePaneRenderer | null {
    return new HighlightRenderer(this.primitive.pixels, this.primitive.colors, this.primitive.showLabels);
  }
}

export class MatchHighlightPrimitive implements ISeriesPrimitive<Time> {
  readonly colors: MatchHighlightColors;
  showLabels = true;
  pixels: BandPixels[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private chart: any | null = null;
  private requestUpdate: (() => void) | null = null;
  private bands: MatchBand[] = [];
  private readonly view: HighlightPaneView;

  constructor(colors: Partial<MatchHighlightColors> = {}) {
    this.colors = { ...DEFAULT_COLORS, ...colors };
    this.view = new HighlightPaneView(this);
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.requestUpdate = null;
    this.pixels = [];
    this.bands = [];
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.view];
  }

  updateAllViews(): void {
    if (!this.chart || this.bands.length === 0) {
      this.pixels = [];
      return;
    }
    const ts = this.chart.timeScale();
    const out: BandPixels[] = [];
    for (const band of this.bands) {
      const x1 = ts.timeToCoordinate(band.startTime);
      const x2 = ts.timeToCoordinate(band.endTime);
      if (x1 === null || x2 === null) continue; // window scrolled out of view
      out.push({ x1, x2, rank: band.rank });
    }
    this.pixels = out;
  }

  setBands(bands: MatchBand[]): void {
    this.bands = bands;
    this.requestUpdate?.();
  }

  clear(): void {
    this.bands = [];
    this.pixels = [];
    this.requestUpdate?.();
  }
}

/** Apply an alpha to a `#rgb`/`#rrggbb`/`rgb()`/`rgba()` color string. */
function withAlpha(color: string, alpha: number): string {
  const c = color.trim();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(c);
  if (rgb) {
    const parts = rgb[1].split(",").map((p) => p.trim());
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return c;
}
