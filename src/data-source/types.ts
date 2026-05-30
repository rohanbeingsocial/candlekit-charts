/**
 * Extensible data-source layer. The library never fetches data itself; the
 * consumer implements one of these interfaces and the chart / replay engine
 * pulls through it. This keeps the package free of any transport (HTTP, WS,
 * file) and any backend coupling.
 */

import type { Bar, IntervalCode, SymbolId, Timestamp } from "../core/types";

/** A request for a contiguous range of bars. */
export interface BarRequest {
  symbol: SymbolId;
  interval: IntervalCode;
  /** Inclusive lower bound (epoch ms). Omit to fetch the most recent page. */
  from?: Timestamp;
  /** Inclusive upper bound (epoch ms). */
  to?: Timestamp;
  /** Soft cap on returned bars (the source may return fewer). */
  limit?: number;
}

/** Minimal pull source: ranged history fetch. Sufficient for static charts. */
export interface BarDataSource {
  fetchBars(req: BarRequest): Promise<Bar[]>;
}

/** A live update callback registration. Return value unsubscribes. */
export type LiveSubscribe = (
  symbol: SymbolId,
  interval: IntervalCode,
  onBar: (bar: Bar) => void,
) => () => void;

/** Pull source + live append stream. */
export interface StreamingDataSource extends BarDataSource {
  subscribe: LiveSubscribe;
}

/**
 * Day-addressable source used by the replay engine: it caches per trading day
 * and walks neighbouring days, so it asks the source for whole days and for the
 * dates adjacent to a given date (calendar gaps / holidays handled by you).
 */
export interface ReplayDataSource {
  /** Bars for a single calendar day (`YYYY-MM-DD`). */
  fetchDay(symbol: SymbolId, interval: IntervalCode, date: string): Promise<Bar[]>;
  /** Up to `n` trading dates strictly before `date`, nearest first. */
  listDatesBefore(symbol: SymbolId, interval: IntervalCode, date: string, n: number): Promise<string[]>;
  /** Up to `n` trading dates strictly after `date`, nearest first. */
  listDatesAfter(symbol: SymbolId, interval: IntervalCode, date: string, n: number): Promise<string[]>;
}
