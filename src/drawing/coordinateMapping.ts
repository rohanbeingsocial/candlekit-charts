/**
 * Maps drawing anchors between lightweight-charts' continuous logical
 * coordinate space and the persisted epoch-second representation.
 *
 * `timeToCoordinate()` only resolves timestamps that belong to an actual
 * series item. Drawings, however, are allowed to live in whitespace between
 * (or just outside) loaded bars. These helpers keep the drawing layer on the
 * logical scale without adding placeholder bars or another price series.
 */

import type { Logical, Time } from "lightweight-charts";
import type { Bar } from "../core/types";
import type { DrawingPoint } from "./types";

export interface DrawingTimeScale {
  timeToCoordinate(time: Time): number | null;
  logicalToCoordinate(logical: Logical): number | null;
}

/** Return the logical index corresponding to an epoch-second timestamp. */
export function logicalForDrawingTime(time: number, bars: readonly Bar[]): number | null {
  if (!Number.isFinite(time) || bars.length === 0) return null;
  if (bars.length === 1) return 0;

  const timeMs = time * 1000;

  const first = bars[0];
  const second = bars[1];
  const last = bars[bars.length - 1];
  const beforeLast = bars[bars.length - 2];
  if (!first || !second || !last || !beforeLast) return null;

  if (timeMs <= first.ts) return interpolate(timeMs, first.ts, second.ts, 0, 1);
  if (timeMs >= last.ts) return interpolate(timeMs, beforeLast.ts, last.ts, bars.length - 2, bars.length - 1);

  let low = 0;
  let high = bars.length - 1;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    const bar = bars[middle];
    if (!bar || bar.ts > timeMs) high = middle;
    else low = middle;
  }

  const left = bars[low];
  const right = bars[high];
  if (!left || !right || right.ts === left.ts) return low;
  return interpolate(timeMs, left.ts, right.ts, low, high);
}

/** Return an epoch-second timestamp corresponding to a logical index. */
export function drawingTimeForLogical(logical: number, bars: readonly Bar[]): number | null {
  if (!Number.isFinite(logical) || bars.length === 0) return null;
  if (bars.length === 1) return bars[0] ? bars[0].ts / 1000 : null;

  const first = bars[0];
  const second = bars[1];
  const last = bars[bars.length - 1];
  const beforeLast = bars[bars.length - 2];
  if (!first || !second || !last || !beforeLast) return null;

  if (logical <= 0) return interpolate(logical, 0, 1, first.ts, second.ts) / 1000;
  if (logical >= bars.length - 1) {
    return interpolate(logical, bars.length - 2, bars.length - 1, beforeLast.ts, last.ts) / 1000;
  }

  const leftIndex = Math.floor(logical);
  const rightIndex = Math.ceil(logical);
  const left = bars[leftIndex];
  const right = bars[rightIndex];
  if (!left || !right) return null;
  if (leftIndex === rightIndex || right.ts === left.ts) return left.ts / 1000;
  return interpolate(logical, leftIndex, rightIndex, left.ts, right.ts) / 1000;
}

/** Project a drawing point without requiring its timestamp to be a bar time. */
export function drawingXForPoint(
  point: DrawingPoint,
  timeScale: DrawingTimeScale,
  bars: readonly Bar[],
): number | null {
  const exact = timeScale.timeToCoordinate(point.time as Time);
  if (exact != null) return exact;

  const logical = logicalForDrawingTime(point.time, bars) ?? finiteLogical(point.logical);
  return logical == null ? null : timeScale.logicalToCoordinate(logical as Logical);
}

function finiteLogical(value: number | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function interpolate(value: number, leftValue: number, rightValue: number, leftResult: number, rightResult: number): number {
  if (rightValue === leftValue) return leftResult;
  return leftResult + ((value - leftValue) / (rightValue - leftValue)) * (rightResult - leftResult);
}
