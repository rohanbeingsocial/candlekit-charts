/**
 * Lab types — pattern-similarity analytics ("Echoes" + "Sketch Search").
 *
 * Framework-agnostic value types only. No chart, DOM, or domain knowledge, so
 * the lab math can be unit-tested and reused independently of any renderer.
 */

/** A freehand stroke sample in pixel space (canvas coordinates). */
export interface StrokePoint {
  x: number;
  y: number;
}

/** One historical window that resembles a query pattern. */
export interface SimilarityMatch {
  /** Window start, as an index into the searched closes array. */
  startIndex: number;
  /** Window end (inclusive). */
  endIndex: number;
  /** Z-normalized euclidean distance to the query; lower = more similar. */
  distance: number;
}

/** A similar window plus what the market did over the following bars. */
export interface EchoResult {
  match: SimilarityMatch;
  /** Epoch ms of the matched window's last bar. */
  matchTime: number;
  /**
   * Percent change from the window's last close, per bar offset 1..horizon.
   * `null` when history ends before a full aftermath is available, or the base
   * close is zero / non-finite.
   */
  aftermathPct: number[] | null;
}

/** Aggregate outcome over every echo that has a full aftermath. */
export interface EchoStats {
  /** Echoes with a complete aftermath (the denominator for the rest). */
  count: number;
  /** Of those, how many ended above 0%. */
  upCount: number;
  /** Median end-of-horizon % change. */
  medianEndPct: number;
  /** Best end-of-horizon % change. */
  bestEndPct: number;
  /** Worst end-of-horizon % change. */
  worstEndPct: number;
  /** Horizon length in bars (echoed for convenience). */
  horizon: number;
}

/** Full result of an Echoes scan over a candle history. */
export interface EchoScan {
  windowLen: number;
  horizon: number;
  /** Matches sorted by distance, best first. */
  results: EchoResult[];
  stats: EchoStats;
  /** The query window expressed as % change from its first close (sparklines). */
  queryClosePct: number[];
  /**
   * Median aftermath path across all echoes, per bar offset 1..horizon (percent
   * change from the matched window's last close). Drives the forward projection.
   * Empty when no echo has a complete aftermath.
   */
  medianPathPct: number[];
}
