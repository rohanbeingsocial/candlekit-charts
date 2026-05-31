/**
 * Pixel-space geometry helpers for hit-testing drawings. All inputs are CSS
 * pixels in the chart pane.
 */

export interface Pt {
  x: number;
  y: number;
}

/** Distance from point P to the finite segment AB. */
export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distance from P to the infinite line through A,B. */
export function distToLine(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

/** Distance from P to the ray starting at A through B (extends past B only). */
export function distToRay(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  if (t < 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distance to the nearest edge of the rectangle with opposite corners a,b. */
export function distToRectEdges(p: Pt, a: Pt, b: Pt): number {
  const x1 = Math.min(a.x, b.x);
  const x2 = Math.max(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const y2 = Math.max(a.y, b.y);
  const tl = { x: x1, y: y1 };
  const tr = { x: x2, y: y1 };
  const bl = { x: x1, y: y2 };
  const br = { x: x2, y: y2 };
  return Math.min(
    distToSegment(p, tl, tr),
    distToSegment(p, tr, br),
    distToSegment(p, br, bl),
    distToSegment(p, bl, tl),
  );
}

/** Distance from P to the ellipse boundary inscribed in the a,b bounding box. */
export function distToEllipse(p: Pt, a: Pt, b: Pt): number {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  if (rx === 0 || ry === 0) return Math.hypot(p.x - cx, p.y - cy);
  // Normalize to unit circle; approximate boundary distance.
  const nx = (p.x - cx) / rx;
  const ny = (p.y - cy) / ry;
  const r = Math.hypot(nx, ny);
  const avgR = (rx + ry) / 2;
  return Math.abs(r - 1) * avgR;
}

export function pointInRect(p: Pt, a: Pt, b: Pt): boolean {
  return (
    p.x >= Math.min(a.x, b.x) &&
    p.x <= Math.max(a.x, b.x) &&
    p.y >= Math.min(a.y, b.y) &&
    p.y <= Math.max(a.y, b.y)
  );
}
