/**
 * Bar normalization + resampling. Pure functions, no chart/runtime dependency,
 * fully unit-testable.
 *
 * Generalized from a market-specific resampler: the trading-session open used
 * as the bucket-alignment anchor is now a parameter ({@link ResampleOptions}),
 * defaulting to UTC midnight (`0`). Intraday buckets align to the session open;
 * day buckets (`minutes >= 1440`) align to the session open of each calendar day.
 */

import type { Bar, Interval, ResampleOptions, Timestamp } from "./types";

/** Loose row that may carry null/NaN OHLC — what raw feeds typically emit. */
export interface RawBar {
  ts: Timestamp;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume?: number | null;
}

const isPosFinite = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

/**
 * Validate, sort, and dedupe raw rows into clean bars.
 *
 * Drops rows that would corrupt the chart: null / NaN / Infinity OHLC, and
 * zero-or-negative prices (a `0` in any OHLC slot is a missing-data sentinel
 * that would pin the price axis to `0..max` once autoscale ingests it).
 * lightweight-charts throws on unsorted or duplicate timestamps, so the output
 * is strictly ascending and de-duplicated by `ts`.
 */
export function toBars(rows: readonly RawBar[]): Bar[] {
  const out: Bar[] = [];
  for (const r of rows) {
    if (!Number.isFinite(r.ts)) continue;
    if (!isPosFinite(r.open) || !isPosFinite(r.high) || !isPosFinite(r.low) || !isPosFinite(r.close)) {
      continue;
    }
    out.push({
      ts: r.ts,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: Number.isFinite(r.volume as number) ? (r.volume as number) : 0,
    });
  }
  out.sort((a, b) => a.ts - b.ts);
  for (let i = out.length - 1; i > 0; i--) {
    if (out[i].ts === out[i - 1].ts) out.splice(i, 1);
  }
  return out;
}

/** Floor a timestamp to the start of its bucket for the given interval. */
export function floorToBucket(
  ts: Timestamp,
  intervalMinutes: number,
  opts: ResampleOptions = {},
): Timestamp {
  if (intervalMinutes <= 1) return ts;
  const sessionOpen = opts.sessionOpenMinutes ?? 0;
  const d = new Date(ts);

  if (intervalMinutes >= 1440) {
    return Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      Math.floor(sessionOpen / 60),
      sessionOpen % 60,
      0,
    );
  }

  const minOfDay = d.getUTCHours() * 60 + d.getUTCMinutes();
  const fromOpen = minOfDay - sessionOpen;
  const bucketStart = sessionOpen + Math.floor(fromOpen / intervalMinutes) * intervalMinutes;
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    Math.floor(bucketStart / 60),
    bucketStart % 60,
    0,
  );
}

/**
 * Aggregate base-resolution rows into `intervalMinutes` candles. `<= 1m` is a
 * pass-through to {@link toBars}. Day+ buckets (`>= 1440`) collapse by calendar
 * day; weekly/monthly cannot be produced by calendar bucketing here and should
 * be supplied pre-aggregated by the data source.
 */
export function resample(
  rows: readonly RawBar[],
  intervalMinutes: number,
  opts: ResampleOptions = {},
): Bar[] {
  if (intervalMinutes <= 1) return toBars(rows);
  const clean = toBars(rows);
  const buckets = new Map<Timestamp, Bar>();

  for (const r of clean) {
    const bucketTs = floorToBucket(r.ts, intervalMinutes, opts);
    const b = buckets.get(bucketTs);
    if (!b) {
      buckets.set(bucketTs, {
        ts: bucketTs,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume ?? 0,
      });
    } else {
      b.high = Math.max(b.high, r.high);
      b.low = Math.min(b.low, r.low);
      b.close = r.close;
      b.volume = (b.volume ?? 0) + (r.volume ?? 0);
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.ts - b.ts);
}

/** Convenience: resample by a resolved {@link Interval}. */
export function resampleInterval(
  rows: readonly RawBar[],
  interval: Interval,
  opts?: ResampleOptions,
): Bar[] {
  return resample(rows, interval.minutes, opts);
}
