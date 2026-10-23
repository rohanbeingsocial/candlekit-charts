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
import {
  DRAWING_LEVEL_COLORS,
  FIB_LEVELS,
  FIB_EXT_LEVELS,
  type Drawing,
  type DrawingLevelStyle,
  type DrawingStyle,
} from "./types";
import type { DrawingEngine } from "./DrawingEngine";
import type { Bar } from "../core/types";

interface Anchor {
  x: number | null;
  y: number | null;
}
interface Shape {
  drawing: Drawing;
  anchors: Anchor[];
  selected: boolean;
  draft: boolean;
  anchoredVwapY: number | null;
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
        const c = s.anchors[2];
        const ax = a?.x == null ? null : a.x * hpr;
        const ay = a?.y == null ? null : a.y * vpr;
        const bx = b?.x == null ? null : b.x * hpr;
        const by = b?.y == null ? null : b.y * vpr;
        const cx = c?.x == null ? null : c.x * hpr;
        const cy = c?.y == null ? null : c.y * vpr;
        const pts = s.drawing.points;

        ctx.save();
        ctx.strokeStyle = style.color;
        ctx.fillStyle = style.fill ?? "transparent";
        ctx.lineWidth = Math.max(1, style.width) * hpr;
        ctx.setLineDash(style.dashed ? [6 * hpr, 4 * hpr] : []);

        switch (tool) {
          case "HorizontalLine":
            if (ay != null) line(ctx, 0, ay, W, ay);
            break;
          case "HorizontalRay":
            if (ax != null && ay != null) line(ctx, ax, ay, W, ay);
            break;
          case "VerticalLine":
            if (ax != null) line(ctx, ax, 0, ax, H);
            break;
          case "CrossLine":
            if (ax != null && ay != null) {
              line(ctx, 0, ay, W, ay);
              line(ctx, ax, 0, ax, H);
            }
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
              const ecx = (ax + bx) / 2;
              const ecy = (ay + by) / 2;
              const rx = Math.abs(bx - ax) / 2;
              const ry = Math.abs(by - ay) / 2;
              ctx.beginPath();
              ctx.ellipse(ecx, ecy, rx, ry, 0, 0, Math.PI * 2);
              if (style.fill) ctx.fill();
              ctx.stroke();
            }
            break;
          case "Triangle":
            if (ax != null && ay != null && bx != null && by != null && cx != null && cy != null) {
              ctx.beginPath();
              ctx.moveTo(ax, ay);
              ctx.lineTo(bx, by);
              ctx.lineTo(cx, cy);
              ctx.closePath();
              if (style.fill) ctx.fill();
              ctx.stroke();
            }
            break;
          case "ParallelChannel":
            if (ax != null && ay != null && bx != null && by != null && cx != null && cy != null) {
              const c2x = cx + (bx - ax);
              const c2y = cy + (by - ay);
              if (style.fill) {
                ctx.beginPath();
                ctx.moveTo(ax, ay);
                ctx.lineTo(bx, by);
                ctx.lineTo(c2x, c2y);
                ctx.lineTo(cx, cy);
                ctx.closePath();
                ctx.fill();
              }
              line(ctx, ax, ay, bx, by);
              line(ctx, cx, cy, c2x, c2y);
            }
            break;
          case "PriceRange":
            if (ax != null && ay != null && bx != null && by != null) {
              const x = Math.min(ax, bx);
              const y = Math.min(ay, by);
              const w = Math.abs(bx - ax);
              const h = Math.abs(by - ay);
              if (style.fill) ctx.fillRect(x, y, w, h);
              ctx.strokeRect(x, y, w, h);
              const p0 = pts[0]?.price;
              const p1 = pts[1]?.price;
              if (p0 != null && p1 != null) {
                const dPrice = p1 - p0;
                const pct = p0 !== 0 ? (dPrice / p0) * 100 : 0;
                ctx.font = `${11 * hpr}px ui-monospace, monospace`;
                ctx.fillStyle = style.color;
                ctx.fillText(
                  `${dPrice >= 0 ? "+" : ""}${dPrice.toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`,
                  x + 4 * hpr,
                  y + 13 * hpr,
                );
              }
            }
            break;
          case "DateRange":
            if (ax != null && bx != null) {
              const x1 = Math.min(ax, bx);
              const x2 = Math.max(ax, bx);
              if (style.fill) ctx.fillRect(x1, 0, x2 - x1, H);
              line(ctx, ax, 0, ax, H);
              line(ctx, bx, 0, bx, H);
              const t0 = pts[0]?.time;
              const t1 = pts[1]?.time;
              if (t0 != null && t1 != null) {
                const mins = Math.abs(t1 - t0) / 60;
                ctx.font = `${11 * hpr}px ui-monospace, monospace`;
                ctx.fillStyle = style.color;
                ctx.fillText(`${mins.toFixed(0)}m`, (x1 + x2) / 2 - 8 * hpr, 14 * hpr);
              }
            }
            break;
          case "FibRetracement":
            if (ax != null && ay != null && by != null) {
              const levels = styledLevels(style, FIB_LEVELS);
              if (style.fill) {
                for (let i = 0; i < levels.length - 1; i++) {
                  const y1 = ay + (by - ay) * levels[i].ratio;
                  const y2 = ay + (by - ay) * levels[i + 1].ratio;
                  ctx.fillStyle = colorWithOpacity(levels[i].color, fillOpacity(style.fill));
                  ctx.fillRect(0, Math.min(y1, y2), W, Math.abs(y2 - y1));
                }
              }
              ctx.font = `${10 * hpr}px ui-monospace, monospace`;
              for (const level of levels) {
                const y = ay + (by - ay) * level.ratio;
                styledLine(ctx, 0, y, W, y, level, style, hpr);
                drawLabel(ctx, `${(level.ratio * 100).toFixed(1)}%`, 0, y, hpr, level.color);
              }
            }
            break;
          case "FibExtension":
            if (ax != null && ay != null && by != null && cy != null) {
              if (bx != null) line(ctx, ax, ay, bx, by); // guide leg a→b
              const levels = styledLevels(style, FIB_EXT_LEVELS);
              ctx.font = `${10 * hpr}px ui-monospace, monospace`;
              const legY = by - ay;
              if (style.fill) {
                for (let i = 0; i < levels.length - 1; i++) {
                  const y1 = cy + legY * levels[i].ratio;
                  const y2 = cy + legY * levels[i + 1].ratio;
                  ctx.fillStyle = colorWithOpacity(levels[i].color, fillOpacity(style.fill));
                  ctx.fillRect(0, Math.min(y1, y2), W, Math.abs(y2 - y1));
                }
              }
              for (const level of levels) {
                const y = cy + legY * level.ratio;
                styledLine(ctx, 0, y, W, y, level, style, hpr);
                drawLabel(ctx, `${(level.ratio * 100).toFixed(1)}%`, 0, y, hpr, level.color);
              }
            }
            break;
          case "InfoLine":
            if (ax != null && ay != null && bx != null && by != null) {
              line(ctx, ax, ay, bx, by);
              const p0 = pts[0];
              const p1 = pts[1];
              const delta = p1 && p0 ? p1.price - p0.price : 0;
              const pct = p0?.price ? (delta / p0.price) * 100 : 0;
              drawLabel(ctx, `${delta >= 0 ? "+" : ""}${delta.toFixed(2)} (${pct.toFixed(2)}%)`, (ax + bx) / 2, (ay + by) / 2, hpr, style.color);
            }
            break;
          case "TrendAngle":
            if (ax != null && ay != null && bx != null && by != null) {
              line(ctx, ax, ay, bx, by);
              const angle = Math.atan2(-(by - ay), bx - ax) * 180 / Math.PI;
              drawLabel(ctx, `${angle.toFixed(1)}°`, bx, by, hpr, style.color);
            }
            break;
          case "FibChannel":
            if (ax != null && ay != null && bx != null && by != null && cx != null && cy != null) {
              drawFibChannel(ctx, ax, ay, bx, by, cx - ax, cy - ay, styledLevels(style, FIB_LEVELS), W, BIG, style, hpr);
            }
            break;
          case "DisjointChannel":
            if (ax != null && ay != null && bx != null && by != null && cx != null && cy != null) {
              line(ctx, ax, ay, bx, by);
              line(ctx, bx, by, cx, cy);
              const dx = bx - ax;
              const dy = by - ay;
              line(ctx, cx, cy, cx + dx, cy + dy);
            }
            break;
          case "FlatTopBottom":
            if (ax != null && ay != null && bx != null && by != null) {
              line(ctx, 0, ay, W, ay);
              line(ctx, 0, by, W, by);
              line(ctx, ax, Math.min(ay, by), ax, Math.max(ay, by));
              line(ctx, bx, Math.min(ay, by), bx, Math.max(ay, by));
            }
            break;
          case "RegressionChannel":
            if (ax != null && ay != null && bx != null && by != null && cx != null && cy != null) {
              const offset = cy - (ay + (by - ay) * ((cx - ax) / ((bx - ax) || 1)));
              drawParallelLines(ctx, ax, ay, bx, by, offset, W, BIG);
            }
            break;
          case "Pitchfork":
          case "SchiffPitchfork":
          case "ModifiedSchiffPitchfork":
          case "InsidePitchfork":
            if (ax != null && ay != null && bx != null && by != null && cx != null && cy != null) {
              drawPitchfork(ctx, tool, ax, ay, bx, by, cx, cy, BIG);
            }
            break;
          case "FibTimeZone":
          case "TrendFibTime":
          case "CyclicLines":
          case "TimeCycles":
            if (ax != null && bx != null) {
              drawTimeLevels(ctx, ax, bx, W, H, hpr, style);
            }
            break;
          case "FibFan":
          case "FibSpeedResistanceFan":
          case "GannFan":
            if (ax != null && ay != null && bx != null && by != null) {
              const ratios = tool === "GannFan" ? [0.25, 0.5, 1, 2, 4] : FIB_LEVELS;
              drawFan(ctx, ax, ay, bx, by, BIG, styledLevels(style, ratios), style, hpr);
            }
            break;
          case "FibExtensionTwoPoint":
            if (ay != null && by != null) drawHorizontalLevels(ctx, ay, by, W, hpr, style);
            break;
          case "FibCircles":
          case "FibSpeedResistanceArcs":
          case "FibSpiral":
            if (ax != null && ay != null && bx != null && by != null) {
              drawConcentricArcs(ctx, ax, ay, bx, by, H, hpr, tool === "FibSpiral", style);
            }
            break;
          case "FibWedge":
            if (ax != null && ay != null && bx != null && by != null && cx != null && cy != null) {
              line(ctx, ax, ay, bx, by);
              line(ctx, ax, ay, cx, cy);
              line(ctx, bx, by, cx, cy);
            }
            break;
          case "GannBox":
          case "GannSquare":
            if (ax != null && ay != null && bx != null && by != null) {
              const side = tool === "GannSquare" ? Math.max(Math.abs(bx - ax), Math.abs(by - ay)) : null;
              const x2 = side == null ? bx : ax + Math.sign(bx - ax || 1) * side;
              const y2 = side == null ? by : ay + Math.sign(by - ay || 1) * side;
              const x = Math.min(ax, x2);
              const y = Math.min(ay, y2);
              const w = Math.abs(x2 - ax);
              const h = Math.abs(y2 - ay);
              ctx.strokeRect(x, y, w, h);
              line(ctx, ax, ay, x2, y2);
              line(ctx, ax, y2, x2, ay);
            }
            break;
          case "RotatedRectangle":
            if (ax != null && ay != null && bx != null && by != null && cx != null && cy != null) {
              const dx = bx - ax;
              const dy = by - ay;
              polygon(ctx, [{ x: ax, y: ay }, { x: bx, y: by }, { x: cx + dx, y: cy + dy }, { x: cx, y: cy }], style.fill);
            }
            break;
          case "Ellipse":
            if (ax != null && ay != null && bx != null && by != null) {
              ellipse(ctx, ax, ay, bx, by, style.fill);
            }
            break;
          case "Path":
          case "Polyline":
          case "Brush":
          case "Highlighter":
            drawAnchoredPath(ctx, s.anchors, hpr, vpr);
            break;
          case "Arc":
          case "Curve":
          case "DoubleCurve":
            if (ax != null && ay != null && bx != null && by != null && cx != null && cy != null) {
              ctx.beginPath();
              ctx.moveTo(ax, ay);
              ctx.quadraticCurveTo(bx, by, cx, cy);
              if (tool === "DoubleCurve") {
                ctx.moveTo(ax, ay + (cy - ay) * 0.35);
                ctx.quadraticCurveTo(bx, by + (cy - ay) * 0.35, cx, cy + (cy - ay) * 0.35);
              }
              ctx.stroke();
            }
            break;
          case "SineLine":
            if (ax != null && ay != null && bx != null && by != null) {
              drawSine(ctx, ax, ay, bx, by, hpr);
            }
            break;
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
          case "Cypher":
            drawAnchoredPath(ctx, s.anchors, hpr, vpr);
            if (a?.x != null && a.y != null) drawLabel(ctx, tool, a.x * hpr, a.y * vpr, hpr, style.color);
            break;
          case "LongPosition":
          case "ShortPosition":
            if (ax != null && ay != null && bx != null && by != null) {
              drawPosition(ctx, tool === "LongPosition", ax, ay, bx, by, style.fill, style.color, W);
            }
            break;
          case "Forecast":
            if (ax != null && ay != null && bx != null && by != null) {
              line(ctx, ax, ay, bx, by);
              const d = norm(bx - ax, by - ay);
              line(ctx, bx, by, bx + d.x * BIG, by + d.y * BIG);
            }
            break;
          case "Measure":
            if (ax != null && ay != null && bx != null && by != null) {
              line(ctx, ax, ay, bx, by);
              drawLabel(ctx, `${Math.abs((pts[1]?.price ?? 0) - (pts[0]?.price ?? 0)).toFixed(2)}`, (ax + bx) / 2, (ay + by) / 2, hpr, style.color);
            }
            break;
          case "Text":
          case "PriceLabel":
          case "Callout":
          case "Note":
          case "Balloon":
          case "Comment":
            if (ax != null && ay != null) {
              const text = s.drawing.text?.value || tool;
              drawAnnotation(ctx, text, ax, ay, hpr, style.color, style.fill, tool !== "Text");
            }
            break;
          case "FlagMark":
            if (ax != null && ay != null) {
              line(ctx, ax, ay, ax, ay - 24 * hpr);
              ctx.beginPath();
              ctx.moveTo(ax, ay - 24 * hpr);
              ctx.lineTo(ax + 18 * hpr, ay - 18 * hpr);
              ctx.lineTo(ax, ay - 12 * hpr);
              ctx.closePath();
              ctx.fill();
            }
            break;
          case "IconStamp":
            if (ax != null && ay != null) {
              ctx.beginPath();
              ctx.arc(ax, ay, 8 * hpr, 0, Math.PI * 2);
              ctx.stroke();
              drawLabel(ctx, "★", ax - 5 * hpr, ay + 4 * hpr, hpr, style.color);
            }
            break;
          case "ArrowUp":
          case "ArrowDown":
          case "ArrowLeft":
          case "ArrowRight":
            if (ax != null && ay != null) drawDirectionArrow(ctx, tool, ax, ay, hpr);
            break;
          case "AnchoredVWAP":
            if (ax != null && ay != null) {
              line(ctx, ax, 0, ax, H);
              if (s.anchoredVwapY != null) {
                line(ctx, ax, s.anchoredVwapY * vpr, W, s.anchoredVwapY * vpr);
                drawLabel(ctx, "AVWAP", ax + 4 * hpr, s.anchoredVwapY * vpr, hpr, style.color);
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
          for (const an of s.anchors) {
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

function drawLabel(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  hpr: number,
  color: string,
): void {
  ctx.save();
  ctx.font = `${11 * hpr}px ui-monospace, monospace`;
  ctx.fillStyle = color;
  ctx.fillText(value, x + 4 * hpr, y - 4 * hpr);
  ctx.restore();
}

function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  hpr: number,
  color: string,
  background: string | null,
  callout: boolean,
): void {
  ctx.save();
  ctx.font = `${12 * hpr}px sans-serif`;
  const width = ctx.measureText(value).width + 10 * hpr;
  const height = 20 * hpr;
  if (background || callout) {
    ctx.fillStyle = background ?? "rgba(15,23,42,0.88)";
    ctx.fillRect(x, y - height, width, height);
  }
  ctx.fillStyle = color;
  ctx.fillText(value, x + 5 * hpr, y - 6 * hpr);
  ctx.restore();
}

function styledLevels(style: DrawingStyle, ratios: readonly number[]): DrawingLevelStyle[] {
  return ratios.map((ratio, index) => {
    const configured = style.levels?.find((level) => Math.abs(level.ratio - ratio) < 1e-9);
    return {
      ratio,
      color: configured?.color ?? DRAWING_LEVEL_COLORS[index % DRAWING_LEVEL_COLORS.length] ?? style.color,
      width: configured?.width ?? style.width,
      dashed: configured?.dashed ?? style.dashed,
    };
  });
}

function styledLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  level: DrawingLevelStyle,
  fallback: DrawingStyle,
  hpr: number,
): void {
  ctx.strokeStyle = level.color || fallback.color;
  ctx.lineWidth = Math.max(1, level.width ?? fallback.width) * hpr;
  ctx.setLineDash((level.dashed ?? fallback.dashed) ? [6 * hpr, 4 * hpr] : []);
  line(ctx, x1, y1, x2, y2);
}

function fillOpacity(fill: string): number {
  const rgba = fill.match(/^rgba?\(\s*[^,]+\s*,\s*[^,]+\s*,\s*[^,]+(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgba?.[1] != null) return Math.max(0, Math.min(1, Number(rgba[1])));
  const hex = fill.trim().replace(/^#/, "");
  if (hex.length === 8) return parseInt(hex.slice(6), 16) / 255;
  return 1;
}

function colorWithOpacity(color: string, opacity: number): string {
  const normalized = color.trim();
  const rgba = normalized.match(/^rgba?\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)(?:\s*,\s*[^)]+)?\s*\)$/i);
  if (rgba) return `rgba(${rgba[1]},${rgba[2]},${rgba[3]},${opacity})`;

  const hex = normalized.replace(/^#/, "");
  const expanded = hex.length === 3
    ? hex.split("").map((part) => part + part).join("")
    : hex.slice(0, 6);
  if (/^[\da-f]{6}$/i.test(expanded)) {
    const red = parseInt(expanded.slice(0, 2), 16);
    const green = parseInt(expanded.slice(2, 4), 16);
    const blue = parseInt(expanded.slice(4, 6), 16);
    return `rgba(${red},${green},${blue},${opacity})`;
  }
  return color;
}

function drawFibChannel(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  offsetX: number,
  offsetY: number,
  levels: readonly DrawingLevelStyle[],
  width: number,
  big: number,
  style: DrawingStyle,
  hpr: number,
): void {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.max(width, big);
  for (const level of levels) {
    const ox = offsetX * level.ratio;
    const oy = offsetY * level.ratio;
    const sx = ax + ox;
    const sy = ay + oy;
    styledLine(
      ctx,
      sx - dx / (Math.abs(dx) || 1) * length,
      sy - dy / (Math.abs(dx) || 1) * length,
      sx + dx / (Math.abs(dx) || 1) * length,
      sy + dy / (Math.abs(dx) || 1) * length,
      level,
      style,
      hpr,
    );
  }
  ctx.strokeStyle = style.color;
  ctx.lineWidth = Math.max(1, style.width) * hpr;
  ctx.setLineDash(style.dashed ? [6 * hpr, 4 * hpr] : []);
  line(ctx, ax, ay, bx, by);
}

function drawParallelLines(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  offset: number,
  width: number,
  big: number,
): void {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.max(width, big);
  const scale = length / (Math.abs(dx) || 1);
  line(ctx, ax - dx * scale, ay - dy * scale, bx + dx * scale, by + dy * scale);
  line(ctx, ax - dx * scale, ay + offset - dy * scale, bx + dx * scale, by + offset + dy * scale);
  line(ctx, ax - dx * scale, ay - offset - dy * scale, bx + dx * scale, by - offset + dy * scale);
}

function drawPitchfork(
  ctx: CanvasRenderingContext2D,
  tool: string,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  big: number,
): void {
  const midpoint = { x: (bx + cx) / 2, y: (by + cy) / 2 };
  const origin = tool === "SchiffPitchfork"
    ? { x: (ax + bx) / 2, y: (ay + by) / 2 }
    : tool === "ModifiedSchiffPitchfork"
      ? { x: (ax + cx) / 2, y: (ay + cy) / 2 }
      : { x: ax, y: ay };
  const d = norm(midpoint.x - origin.x, midpoint.y - origin.y);
  line(ctx, origin.x, origin.y, origin.x + d.x * big, origin.y + d.y * big);
  for (const p of tool === "InsidePitchfork" ? [bx, cx].map((x, i) => ({ x, y: i ? cy : by })) : [{ x: bx, y: by }, { x: cx, y: cy }]) {
    const direction = norm(p.x - origin.x, p.y - origin.y);
    line(ctx, p.x, p.y, p.x + direction.x * big, p.y + direction.y * big);
  }
}

function drawTimeLevels(ctx: CanvasRenderingContext2D, ax: number, bx: number, width: number, height: number, hpr: number, style: DrawingStyle): void {
  const period = Math.abs(bx - ax) || 1;
  const levels = styledLevels(style, [0, 1, 2, 3, 5, 8, 13, 21]);
  for (const level of levels) {
    const x = ax + (bx >= ax ? 1 : -1) * period * level.ratio;
    if (x < -20 || x > width + 20) continue;
    styledLine(ctx, x, 0, x, height, level, style, hpr);
    if (level.ratio > 0) drawLabel(ctx, String(level.ratio), x, 14 * hpr, hpr, level.color);
  }
}

function drawFan(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, big: number, levels: readonly DrawingLevelStyle[], style: DrawingStyle, hpr: number): void {
  const dx = bx - ax || 1;
  const slope = (by - ay) / dx;
  const direction = dx < 0 ? -1 : 1;
  for (const level of levels) {
    styledLine(ctx, ax, ay, ax + direction * big, ay + slope * level.ratio * direction * big, level, style, hpr);
  }
}

function drawHorizontalLevels(ctx: CanvasRenderingContext2D, ay: number, by: number, width: number, hpr: number, style: DrawingStyle): void {
  const levels = styledLevels(style, [0, 0.236, 0.382, 0.5, 0.618, 1, 1.272, 1.618]);
  for (const level of levels) {
    const y = ay + (by - ay) * level.ratio;
    styledLine(ctx, 0, y, width, y, level, style, hpr);
    drawLabel(ctx, `${(level.ratio * 100).toFixed(1)}%`, 4 * hpr, y, hpr, level.color);
  }
}

function drawConcentricArcs(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, height: number, hpr: number, spiral: boolean, style: DrawingStyle): void {
  const rx = Math.max(4 * hpr, Math.abs(bx - ax));
  const ry = Math.max(4 * hpr, Math.abs(by - ay));
  const levels = styledLevels(style, spiral ? [0.5, 1, 1.5, 2, 2.5, 3] : [0.236, 0.382, 0.5, 0.618, 1, 1.618]);
  for (const level of levels) {
    ctx.strokeStyle = level.color;
    ctx.lineWidth = Math.max(1, level.width ?? style.width) * hpr;
    ctx.setLineDash((level.dashed ?? style.dashed) ? [6 * hpr, 4 * hpr] : []);
    ctx.beginPath();
    ctx.ellipse(ax, ay, rx * level.ratio, Math.min(height * 2, ry * level.ratio), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function polygon(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>, fill: string | null): void {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  if (fill) ctx.fill();
  ctx.stroke();
}

function ellipse(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, fill: string | null): void {
  ctx.beginPath();
  ctx.ellipse((ax + bx) / 2, (ay + by) / 2, Math.abs(bx - ax) / 2, Math.abs(by - ay) / 2, 0, 0, Math.PI * 2);
  if (fill) ctx.fill();
  ctx.stroke();
}

function drawAnchoredPath(ctx: CanvasRenderingContext2D, anchors: Anchor[], hpr: number, vpr: number): void {
  const points = anchors.filter((p): p is { x: number; y: number } => p.x != null && p.y != null);
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x * hpr, points[0].y * vpr);
  for (const p of points.slice(1)) ctx.lineTo(p.x * hpr, p.y * vpr);
  ctx.stroke();
}

function drawSine(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, hpr: number): void {
  const width = bx - ax;
  const amplitude = Math.max(10 * hpr, Math.abs(by - ay) / 2);
  const center = (ay + by) / 2;
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    const x = ax + width * t;
    const y = center + Math.sin(t * Math.PI * 4) * amplitude;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawPosition(ctx: CanvasRenderingContext2D, long: boolean, ax: number, ay: number, bx: number, by: number, fill: string | null, color: string, width: number): void {
  const x1 = Math.min(ax, bx);
  const x2 = Math.max(ax, bx);
  const entry = ay;
  const target = by;
  const top = Math.min(entry, target);
  const bottom = Math.max(entry, target);
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = fill ?? (long ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)");
  ctx.fillRect(x1, top, x2 - x1, bottom - top);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color || (long ? "#22c55e" : "#ef4444");
  line(ctx, x1, entry, width, entry);
  line(ctx, x1, target, width, target);
  ctx.restore();
}

function drawDirectionArrow(ctx: CanvasRenderingContext2D, tool: string, x: number, y: number, hpr: number): void {
  const size = 13 * hpr;
  const vectors: Record<string, { x: number; y: number }> = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
  };
  const v = vectors[tool] ?? { x: 1, y: 0 };
  line(ctx, x - v.x * size, y - v.y * size, x + v.x * size, y + v.y * size);
  arrowHead(ctx, x - v.x * size, y - v.y * size, x + v.x * size, y + v.y * size, 7 * hpr);
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

  constructor(
    private readonly engine: DrawingEngine,
    private readonly getBars: () => readonly Bar[] = () => [],
  ) {}

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
      anchoredVwapY: d.tool === "AnchoredVWAP" && d.points[0]
        ? this.projectPrice(anchoredVwapPrice(d.points[0].time, this.getBars()))
        : null,
    }));
  }

  private project(p: { time: number; price: number }): Anchor {
    if (!this.chart || !this.series) return { x: null, y: null };
    const x = this.chart.timeScale().timeToCoordinate(p.time as Time);
    const y = this.series.priceToCoordinate(p.price);
    return { x: x == null ? null : x, y: y == null ? null : y };
  }

  private projectPrice(price: number | null): number | null {
    if (!this.series || price == null) return null;
    return this.series.priceToCoordinate(price);
  }
}

function anchoredVwapPrice(anchorSeconds: number, bars: readonly Bar[]): number | null {
  const anchorMs = anchorSeconds * 1000;
  let volumeTotal = 0;
  let weightedTotal = 0;
  let simpleTotal = 0;
  let count = 0;
  for (const bar of bars) {
    if (bar.ts < anchorMs) continue;
    const typical = (bar.high + bar.low + bar.close) / 3;
    const volume = bar.volume ?? 0;
    weightedTotal += typical * volume;
    volumeTotal += volume;
    simpleTotal += typical;
    count += 1;
  }
  if (!count) return null;
  return volumeTotal > 0 ? weightedTotal / volumeTotal : simpleTotal / count;
}
