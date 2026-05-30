/**
 * Core atomic types. Framework-agnostic, no domain knowledge (no symbol class,
 * broker, or exchange concepts). Every other module imports from here so the
 * package never forms an import cycle.
 */

/** Epoch milliseconds. The single time unit used across the public API. */
export type Timestamp = number;

/** Opaque instrument id. The consumer owns its format (e.g. "AAPL", "BTC-USD"). */
export type SymbolId = string;

/** Interval code, e.g. "1m" | "5m" | "1h" | "1d". The consumer owns the vocabulary. */
export type IntervalCode = string;

/** Stable id for a chart instance / panel. */
export type ChartId = string;

/** OHLCV bar. `volume` optional. `ts` is epoch ms. */
export interface Bar {
  ts: Timestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** A single value point on a line/area series. */
export interface PricePoint {
  ts: Timestamp;
  value: number;
}

/** The price series the main chart renders. */
export type SeriesType = "candlestick" | "ohlc" | "line" | "area";

/** A resolved interval used by the resampler. `minutes` drives bucketing. */
export interface Interval {
  /** Display label, e.g. "5m". */
  label: string;
  /** Bucket width in minutes. `>= 1440` buckets by calendar day. */
  minutes: number;
}

/** Options controlling session-aware bucketing (see {@link resample}). */
export interface ResampleOptions {
  /**
   * Minutes past midnight that the trading session opens, used as the bucket
   * alignment anchor. Default `0` (UTC midnight) — standard 24h markets.
   * Set e.g. `9 * 60 + 30` for a 09:30 session open.
   */
  sessionOpenMinutes?: number;
}

/** Resolved color palette a chart reads at mount / on theme change. */
export interface ChartTheme {
  mode: "light" | "dark";
  background: string;
  text: string;
  grid: string;
  axis: string;
  crosshair: string;
  crosshairLabelBg: string;
  /** Up/bull candle + line color. */
  up: string;
  /** Down/bear candle color. */
  down: string;
  /** Default line/area series color. */
  line: string;
  /** Volume histogram up/down (with alpha baked in). */
  volumeUp: string;
  volumeDown: string;
  fontFamily: string;
  fontSize: number;
}
