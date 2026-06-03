/**
 * Client-side tick → OHLC aggregator. Turns a tick/trade stream into bar
 * updates for one (symbol, interval), so a feed that only emits ticks can still
 * drive candle/bar/line series. Pure and synchronous: push a tick, get back the
 * current bar plus whether a prior bar just closed.
 *
 * Bucketing matches the resampler: bars align to `sessionOpenMinutes` past
 * midnight (UTC), default 0. Time is epoch ms throughout.
 */

import type { Bar, IntervalCode, SymbolId, Timestamp } from "../core/types";
import type { Tick, Trade, OHLCUpdate } from "./types";

export interface AggregatorOptions {
  symbol: SymbolId;
  interval: IntervalCode;
  /** Bucket width in minutes (e.g. 1, 5, 15, 60). */
  minutes: number;
  /** Session-open anchor in minutes past UTC midnight. Default 0. */
  sessionOpenMinutes?: number;
}

export interface AggregateResult {
  /** The (possibly new) current bar after applying the input. */
  bar: Bar;
  /** The bar that just closed, if this input opened a new bucket. */
  closed: Bar | null;
}

function bucketStart(ts: Timestamp, bucketMs: number, anchorMs: number): Timestamp {
  return ts - mod(ts - anchorMs, bucketMs);
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

export class TickAggregator {
  private readonly bucketMs: number;
  private readonly anchorMs: number;
  private current: Bar | null = null;

  constructor(private readonly opts: AggregatorOptions) {
    this.bucketMs = Math.max(1, Math.floor(opts.minutes)) * 60_000;
    this.anchorMs = (opts.sessionOpenMinutes ?? 0) * 60_000;
  }

  /** Seed the open bar from history so the first live tick extends it. */
  seed(lastBar: Bar | null): void {
    this.current = lastBar ? { ...lastBar } : null;
  }

  /** Apply a price+optional-size point. Returns the current + any closed bar. */
  apply(ts: Timestamp, price: number, size = 0): AggregateResult {
    if (!Number.isFinite(price) || price <= 0) {
      return { bar: this.current ?? emptyBar(ts, price), closed: null };
    }
    const start = bucketStart(ts, this.bucketMs, this.anchorMs);
    const cur = this.current;

    if (!cur || start > cur.ts) {
      const closed = cur ?? null;
      this.current = { ts: start, open: price, high: price, low: price, close: price, volume: size };
      return { bar: this.current, closed };
    }
    if (start < cur.ts) {
      // Out-of-order tick older than the open bar — ignore.
      return { bar: cur, closed: null };
    }
    cur.high = Math.max(cur.high, price);
    cur.low = Math.min(cur.low, price);
    cur.close = price;
    cur.volume = (cur.volume ?? 0) + size;
    return { bar: cur, closed: null };
  }

  /** Convenience: feed a {@link Tick}. */
  pushTick(t: Tick): AggregateResult {
    return this.apply(t.ts, t.ltp, 0);
  }

  /** Convenience: feed a {@link Trade}. */
  pushTrade(t: Trade): AggregateResult {
    return this.apply(t.ts, t.price, t.size ?? 0);
  }

  /** Emit the current bar as an {@link OHLCUpdate} (closed=false). */
  asUpdate(closed = false): OHLCUpdate | null {
    if (!this.current) return null;
    return { symbol: this.opts.symbol, interval: this.opts.interval, bar: { ...this.current }, closed };
  }

  getCurrent(): Bar | null {
    return this.current ? { ...this.current } : null;
  }
}

function emptyBar(ts: Timestamp, price: number): Bar {
  return { ts, open: price, high: price, low: price, close: price, volume: 0 };
}
