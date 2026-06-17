/**
 * Pattern-similarity core for the lab features.
 *
 * Pure math — no chart, DOM, or React. Two features sit on top of one engine:
 *
 *   - **Echoes**       — find historical windows that look like the most recent
 *                        price action, and study what happened next.
 *   - **Sketch Search** — the user draws a freehand shape; it is resampled to a
 *                        clean series and matched against history.
 *
 * Similarity is measured on z-normalized series (shape, not level/scale) with
 * plain euclidean distance, so look-alikes are found across different price
 * regimes. Everything uses flat loops and preallocated typed arrays so a large
 * history scans quickly.
 */

import type { Bar } from "../core/types";
import type { EchoResult, EchoScan, EchoStats, SimilarityMatch, StrokePoint } from "./types";

/**
 * Z-normalize: `(v - mean) / std` using the population standard deviation. This
 * strips the level and the scale so only the shape remains, which is what makes
 * euclidean distance comparable across price regimes.
 *
 * Degenerate inputs are deterministic: an empty array returns `[]`; a flat
 * series (std 0) or one with non-finite mean/std returns all zeros.
 */
export function zNormalize(values: number[]): number[] {
  const n = values.length;
  const out = new Array<number>(n);
  if (n === 0) return out;

  let sum = 0;
  for (let i = 0; i < n; i++) sum += values[i];
  const mean = sum / n;

  let varSum = 0;
  for (let i = 0; i < n; i++) {
    const d = values[i] - mean;
    varSum += d * d;
  }
  const std = Math.sqrt(varSum / n);

  if (!(std > 0) || !Number.isFinite(std) || !Number.isFinite(mean)) {
    for (let i = 0; i < n; i++) out[i] = 0;
    return out;
  }

  const inv = 1 / std;
  for (let i = 0; i < n; i++) out[i] = (values[i] - mean) * inv;
  return out;
}

/** Options for {@link findSimilar}. */
export interface FindSimilarOptions {
  /** Maximum number of matches to return. */
  k: number;
  /**
   * Minimum start-index gap between two accepted matches (greedy non-overlap).
   * Defaults to `query.length`, i.e. accepted windows never overlap.
   */
  minGap?: number;
  /**
   * Skip any window whose END index lies within the last `excludeTail` indices
   * of the haystack. Use it so "now" never matches itself and so each match has
   * room left for an aftermath. Default `0`.
   */
  excludeTail?: number;
}

/**
 * Slide a window the size of `query` over `haystackCloses` (stride 1) and return
 * the `k` most similar windows by z-normalized euclidean distance, best first.
 *
 * Complexity is O(n·m). Per-window mean/variance are maintained with rolling
 * sums (rebuilt periodically so floating-point drift can't accumulate), and the
 * normalized window is never materialized — each term is normalized inline in
 * the distance loop.
 *
 * Safety: a window touching non-finite source data gets distance `Infinity` and
 * is never selected; a flat window (std 0) normalizes to all zeros. Returns `[]`
 * when `k < 1`, the query is shorter than 2, the query has non-finite values, or
 * no window fits the haystack.
 */
export function findSimilar(
  haystackCloses: number[],
  query: number[],
  opts: FindSimilarOptions,
): SimilarityMatch[] {
  const m = query.length;
  const n = haystackCloses.length;
  const k = Math.floor(opts.k);
  const minGap = Math.max(1, Math.floor(opts.minGap ?? m));
  const excludeTail = Math.max(0, Math.floor(opts.excludeTail ?? 0));

  if (k < 1 || m < 2) return [];

  // A window starting at s spans [s, s + m - 1]. Its end must avoid the last
  // `excludeTail` indices: end <= n - excludeTail - 1, i.e. s <= n - excludeTail - m.
  const lastStart = n - excludeTail - m;
  if (lastStart < 0) return [];
  const windowCount = lastStart + 1;

  // A query with non-finite values has no meaningful shape — reject it before
  // normalizing (zNormalize would otherwise fold it to a flat all-zeros series).
  for (let j = 0; j < m; j++) {
    if (!Number.isFinite(query[j])) return [];
  }
  const zq = zNormalize(query);

  // Copy the haystack into a typed array and build a prefix count of non-finite
  // values, so any window touching bad data is rejected in O(1). Bad values are
  // stored as 0 to keep the rolling sums finite; those windows are dropped anyway.
  const clean = new Float64Array(n);
  const badPrefix = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) {
    const v = haystackCloses[i];
    if (Number.isFinite(v)) {
      clean[i] = v;
      badPrefix[i + 1] = badPrefix[i];
    } else {
      clean[i] = 0;
      badPrefix[i + 1] = badPrefix[i] + 1;
    }
  }

  const distances = new Float64Array(windowCount);

  // Rebuild the rolling sums from scratch every REBUILD windows to bound drift.
  const REBUILD = 1024;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < m; i++) {
    const v = clean[i];
    sum += v;
    sumSq += v * v;
  }

  for (let s = 0; s < windowCount; s++) {
    if (s > 0) {
      if (s % REBUILD === 0) {
        sum = 0;
        sumSq = 0;
        for (let i = 0; i < m; i++) {
          const v = clean[s + i];
          sum += v;
          sumSq += v * v;
        }
      } else {
        const out = clean[s - 1];
        const inc = clean[s + m - 1];
        sum += inc - out;
        sumSq += inc * inc - out * out;
      }
    }

    if (badPrefix[s + m] - badPrefix[s] > 0) {
      distances[s] = Infinity;
      continue;
    }

    const mean = sum / m;
    let variance = sumSq / m - mean * mean;
    if (variance < 0) variance = 0; // clamp tiny negative rounding artifacts
    const std = Math.sqrt(variance);

    let d2 = 0;
    if (std > 0) {
      const inv = 1 / std;
      for (let j = 0; j < m; j++) {
        const diff = (clean[s + j] - mean) * inv - zq[j];
        d2 += diff * diff;
      }
    } else {
      // Flat window normalizes to all zeros; distance is just |zq|.
      for (let j = 0; j < m; j++) d2 += zq[j] * zq[j];
    }
    distances[s] = Number.isFinite(d2) ? Math.sqrt(d2) : Infinity;
  }

  // Rank every window by distance (total order — Infinity ties compare equal).
  const order = new Array<number>(windowCount);
  for (let i = 0; i < windowCount; i++) order[i] = i;
  order.sort((a, b) => {
    const da = distances[a];
    const db = distances[b];
    if (da === db) return 0;
    return da < db ? -1 : 1;
  });

  // Greedy pick, best distance first, enforcing minGap between accepted starts.
  const picked: SimilarityMatch[] = [];
  const takenStarts: number[] = [];
  for (let i = 0; i < windowCount && picked.length < k; i++) {
    const s = order[i];
    const d = distances[s];
    if (!Number.isFinite(d)) break; // Infinity sorts last; nothing usable left
    let ok = true;
    for (let t = 0; t < takenStarts.length; t++) {
      if (Math.abs(s - takenStarts[t]) < minGap) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    takenStarts.push(s);
    picked.push({ startIndex: s, endIndex: s + m - 1, distance: d });
  }
  return picked;
}

/**
 * Run a full Echoes scan: use the last `windowLen` closes as the query, find up
 * to `k` similar non-overlapping historical windows, and record what happened
 * over the `horizon` bars after each.
 *
 * The search excludes the tail (`excludeTail = windowLen + horizon`) so the
 * query can't match itself and matches leave room for an aftermath. Returns
 * `null` when the parameters are nonsensical (`windowLen < 2`, `horizon < 1`,
 * `k < 1`) or there isn't enough history to be meaningful (`< windowLen * 3`).
 */
export function buildEchoScan(
  bars: readonly Bar[],
  windowLen: number,
  horizon: number,
  k: number,
): EchoScan | null {
  if (windowLen < 2 || horizon < 1 || k < 1) return null;
  const n = bars.length;
  if (n < windowLen * 3) return null;

  const closes = new Array<number>(n);
  for (let i = 0; i < n; i++) closes[i] = bars[i].close;

  const query = closes.slice(n - windowLen);

  const matches = findSimilar(closes, query, {
    k,
    minGap: windowLen,
    excludeTail: windowLen + horizon,
  });

  const results: EchoResult[] = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const end = match.endIndex;
    const base = closes[end];

    let aftermathPct: number[] | null = null;
    if (end + horizon < n && Number.isFinite(base) && base !== 0) {
      const arr = new Array<number>(horizon);
      let valid = true;
      for (let off = 1; off <= horizon; off++) {
        const pct = (closes[end + off] / base - 1) * 100;
        if (!Number.isFinite(pct)) {
          valid = false;
          break;
        }
        arr[off - 1] = pct;
      }
      if (valid) aftermathPct = arr;
    }

    results.push({ match, matchTime: bars[end].ts, aftermathPct });
  }

  // Outcome stats over echoes with a complete aftermath.
  const endPcts: number[] = [];
  let upCount = 0;
  for (let i = 0; i < results.length; i++) {
    const aftermath = results[i].aftermathPct;
    if (aftermath === null) continue;
    const endPct = aftermath[horizon - 1];
    endPcts.push(endPct);
    if (endPct > 0) upCount++;
  }
  endPcts.sort((a, b) => a - b);
  const count = endPcts.length;

  let medianEndPct = 0;
  if (count > 0) {
    const mid = count >> 1;
    medianEndPct = count % 2 === 1 ? endPcts[mid] : (endPcts[mid - 1] + endPcts[mid]) / 2;
  }

  const stats: EchoStats = {
    count,
    upCount,
    medianEndPct,
    bestEndPct: count > 0 ? endPcts[count - 1] : 0,
    worstEndPct: count > 0 ? endPcts[0] : 0,
    horizon,
  };

  // Median aftermath path: per bar offset, the median across every echo that
  // has a complete aftermath. Empty when none do.
  const medianPathPct: number[] = [];
  if (count > 0) {
    for (let off = 0; off < horizon; off++) {
      const col: number[] = [];
      for (let i = 0; i < results.length; i++) {
        const aftermath = results[i].aftermathPct;
        if (aftermath !== null) col.push(aftermath[off]);
      }
      col.sort((a, b) => a - b);
      const mid = col.length >> 1;
      medianPathPct.push(
        col.length % 2 === 1 ? col[mid] : (col[mid - 1] + col[mid]) / 2,
      );
    }
  }

  // Query window as % change from its first close (for the query sparkline).
  const first = query[0];
  const queryClosePct = new Array<number>(windowLen);
  const firstOk = Number.isFinite(first) && first !== 0;
  for (let i = 0; i < windowLen; i++) {
    if (firstOk) {
      const pct = (query[i] / first - 1) * 100;
      queryClosePct[i] = Number.isFinite(pct) ? pct : 0;
    } else {
      queryClosePct[i] = 0;
    }
  }

  return { windowLen, horizon, results, stats, queryClosePct, medianPathPct };
}

/**
 * Turn a freehand pixel stroke into a clean series of `n` values usable as a
 * {@link findSimilar} query.
 *
 * Steps:
 *  1. Make the stroke x-monotonic — when it revisits an x (a vertical segment or
 *     a leftward backtrack), the latest sample at that x wins; points are then
 *     ordered by ascending x. Non-finite points are dropped. Right-to-left
 *     strokes therefore work naturally.
 *  2. Sample `n` evenly spaced x positions across [minX, maxX], linearly
 *     interpolating y between the surrounding stroke points.
 *  3. Invert y (canvas y grows downward, price grows upward). The caller
 *     z-normalizes, so only the shape matters.
 *
 * Throws when `n < 2` (or non-integer) or fewer than 2 distinct finite x values
 * remain.
 */
export function resampleStroke(points: StrokePoint[], n: number): number[] {
  if (!Number.isInteger(n) || n < 2) {
    throw new Error(`resampleStroke: n must be an integer >= 2 (got ${n})`);
  }

  // Latest sample wins per x; insertion order is irrelevant — xs are sorted next.
  const latestYByX = new Map<number, number>();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) latestYByX.set(p.x, p.y);
  }
  if (latestYByX.size < 2) {
    throw new Error("resampleStroke: need at least 2 points with distinct x");
  }

  const m = latestYByX.size;
  const xs = new Float64Array(m);
  let w = 0;
  for (const x of latestYByX.keys()) xs[w++] = x;
  xs.sort();
  const ys = new Float64Array(m);
  for (let i = 0; i < m; i++) ys[i] = latestYByX.get(xs[i]) as number;

  const minX = xs[0];
  const maxX = xs[m - 1];
  const span = maxX - minX; // > 0: at least 2 distinct finite x values

  const out = new Array<number>(n);
  let seg = 0; // segment [xs[seg], xs[seg+1]] containing the current sample
  for (let i = 0; i < n; i++) {
    const x = minX + (span * i) / (n - 1);
    while (seg < m - 2 && xs[seg + 1] < x) seg++;
    const x0 = xs[seg];
    const x1 = xs[seg + 1];
    let t = (x - x0) / (x1 - x0); // x1 > x0 guaranteed (strictly increasing xs)
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    const y = ys[seg] + t * (ys[seg + 1] - ys[seg]);
    const v = -y; // canvas-y down -> price-up
    out[i] = v === 0 ? 0 : v; // normalize -0 -> 0 for clean output
  }
  return out;
}
