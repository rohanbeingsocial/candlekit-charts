/**
 * ML / AI overlay contracts. Pattern detection, signal generation, prediction
 * overlays, anomaly/regime detection, and AI chart markings all plug in through
 * the same small surface — and run *off* the chart's critical path.
 *
 * Performance contract: feature generation + inference must not run on the
 * render thread for large inputs. A {@link FeatureGenerator} is expected to be
 * backed by a Worker or WASM module; the chart only consumes the resulting
 * {@link Signal}s / {@link Annotation}s, which are cheap to render.
 *
 * Replay contract: every consumer receives bars *up to the cursor* — never
 * future bars — so live and replay produce identical output (no look-ahead).
 */

import type { Bar, Timestamp } from "../core/types";
import type { ChartPlugin } from "../plugins/types";

// ── Features ─────────────────────────────────────────────────────────────────

/** Columnar feature frame: `names[c]` is column c, `rows[r][c]` its value at
 *  bar r. Columnar layout maps cleanly onto typed arrays / WASM memory. */
export interface FeatureMatrix {
  /** Bar timestamps, one per row (epoch ms). */
  ts: Timestamp[];
  names: string[];
  /** `rows.length === ts.length`; each row has `names.length` values. */
  rows: Float64Array[];
}

export interface FeatureGenerator {
  readonly id: string;
  /** Column names this generator emits (stable for a given config). */
  readonly columns: string[];
  /** Compute features for the given window. May be async (Worker/WASM). */
  compute(bars: readonly Bar[]): Promise<FeatureMatrix> | FeatureMatrix;
}

// ── Signals + predictions ────────────────────────────────────────────────────

export type SignalKind = "buy" | "sell" | "alert" | "pattern" | "anomaly" | "regime";

export interface Signal {
  ts: Timestamp;
  kind: SignalKind;
  /** Free-form label, e.g. "Bullish engulfing", "Vol regime: high". */
  label: string;
  /** Model confidence [0..1] when available. */
  confidence?: number;
  /** Optional price anchor for placement; defaults to the bar close. */
  price?: number;
  /** Arbitrary model payload (kept opaque to the chart). */
  meta?: Record<string, unknown>;
}

export interface SignalProvider {
  readonly id: string;
  /** Derive signals from bars (and optionally precomputed features). */
  generate(bars: readonly Bar[], features?: FeatureMatrix): Promise<Signal[]> | Signal[];
}

/** A forward-looking series (e.g. predicted price band) drawn ahead of the
 *  last bar. `upper`/`lower` enable a confidence band. */
export interface Prediction {
  ts: Timestamp;
  value: number;
  upper?: number;
  lower?: number;
}

// ── Chart-facing render payloads ─────────────────────────────────────────────

/** A lightweight chart marking emitted by an ML plugin — rendered by the host
 *  via markers/primitives, never by computing on the render thread. */
export interface Annotation {
  ts: Timestamp;
  price?: number;
  text?: string;
  shape?: "arrowUp" | "arrowDown" | "circle" | "flag" | "label";
  color?: string;
}

/** Output of an ML plugin pass, ready to render. */
export interface MLResult {
  signals?: Signal[];
  annotations?: Annotation[];
  predictions?: Prediction[];
}

/**
 * A hot-swappable ML overlay. It is a {@link ChartPlugin} (so it mounts/unmounts
 * with the chart and shares the bus + theme), plus an async `run` that produces
 * render-ready output from cursor-bounded bars. The host pipes `run` output to
 * an overlay renderer; `run` itself should offload heavy work to a Worker/WASM.
 */
export interface MLPlugin extends ChartPlugin {
  /** Compute overlay output for the current (cursor-bounded) bars. */
  run(bars: readonly Bar[]): Promise<MLResult> | MLResult;
  /** Optional cheap predicate to skip a run (e.g. throttle by bar count). */
  shouldRun?(bars: readonly Bar[]): boolean;
}

/** What a prediction overlay renderer must accept. */
export interface PredictionOverlay {
  readonly id: string;
  setPredictions(predictions: Prediction[]): void;
  clear(): void;
}
