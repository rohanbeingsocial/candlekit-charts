/**
 * Replay engine contracts. Deterministic playback over historical bars: the
 * cursor timestamp is the single source of truth — wall-clock time is never
 * consulted by replay calculations (only by the tick scheduler to pace UI).
 */

import type { Bar, IntervalCode, SymbolId, Timestamp } from "../core/types";
import type { ReplayDataSource } from "../data-source/types";

export interface ReplaySeriesSpec {
  symbol: SymbolId;
  interval: IntervalCode;
}

export interface ReplayManifest {
  id: string;
  series: readonly ReplaySeriesSpec[];
  start: Timestamp;
  end: Timestamp;
  source: ReplayDataSource;
}

export interface ReplayEngineOptions {
  /** Max days kept in memory per (symbol, interval). LRU evicted. */
  cacheDays: number;
  /** Days prefetched backward when the session starts. */
  prefetchBackwardDays: number;
  /** When the cursor enters the last N% of the current day, prefetch the next. */
  prefetchForwardOnTailPct: number;
}

export interface ReplayCursor {
  ts: Timestamp;
  /** Monotonic sequence within the session; increments every tick. */
  seq: number;
}

export type ReplayState =
  | { status: "idle" }
  | { status: "loading"; manifest: ReplayManifest }
  | {
      status: "ready";
      manifest: ReplayManifest;
      cursor: ReplayCursor;
      speed: number;
      playing: boolean;
      window: { from: Timestamp; to: Timestamp };
      activeSeries: readonly ReplaySeriesSpec[];
      dataVersion: number;
    }
  | { status: "error"; manifest: ReplayManifest; error: string };

export interface ReplayBarEvent {
  ts: Timestamp;
  seq: number;
  symbol: SymbolId;
  interval: IntervalCode;
  bar: Bar;
}

export interface ReplayController {
  getState(): ReplayState;
  subscribe(cb: (s: ReplayState) => void): () => void;
  onBar(cb: (e: ReplayBarEvent) => void): () => void;

  load(manifest: ReplayManifest): Promise<void>;
  unload(): void;

  play(): void;
  pause(): void;
  step(direction: 1 | -1): void;
  seek(ts: Timestamp): void;
  setSpeed(multiplier: number): void;

  /** Bars up to and including the cursor for one series. */
  getBarsUpToCursor(symbol: SymbolId, interval: IntervalCode): readonly Bar[];
  /** Materialize a (symbol, interval) mid-session. Idempotent. */
  ensureSeries(symbol: SymbolId, interval: IntervalCode): Promise<void>;
}
