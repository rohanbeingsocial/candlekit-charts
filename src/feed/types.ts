/**
 * Broker-agnostic market-data + broker contracts.
 *
 * The charting layer never imports a specific broker. A consumer implements
 * (or installs) an adapter that satisfies these interfaces and passes it in.
 * Everything here is transport-free (no HTTP/WS code) and dependency-free — an
 * adapter brings its own transport.
 *
 * Layering:
 *   HistoricalFeed   — ranged + day-addressable bar history (backfill, replay)
 *   RealtimeFeed     — live tick/quote/trade/bar stream with subscriptions
 *   MarketDataProvider — a named bundle of the two + capabilities
 *   BrokerProvider   — MarketDataProvider + optional account/trading surface
 */

import type { Bar, IntervalCode, SymbolId, Timestamp } from "../core/types";

// ── Realtime message shapes ──────────────────────────────────────────────────

/** Last-trade print. `size` is contracts/shares; optional on index feeds. */
export interface Trade {
  symbol: SymbolId;
  ts: Timestamp;
  price: number;
  size?: number;
  /** Aggressor side when the venue reports it. */
  side?: "buy" | "sell";
}

/** Top-of-book quote. */
export interface Quote {
  symbol: SymbolId;
  ts: Timestamp;
  bid: number;
  ask: number;
  bidSize?: number;
  askSize?: number;
}

/** A lightweight LTP tick — the lowest common denominator across feeds. */
export interface Tick {
  symbol: SymbolId;
  ts: Timestamp;
  /** Last traded price. */
  ltp: number;
  /** Cumulative day volume when the feed provides it. */
  volume?: number;
}

/** A server-aggregated OHLC update for an (symbol, interval) — replaces the
 *  current bar or appends a new one. `closed` marks bar finalization. */
export interface OHLCUpdate {
  symbol: SymbolId;
  interval: IntervalCode;
  bar: Bar;
  closed: boolean;
}

/** Discriminated union of everything a realtime feed can emit. */
export type FeedMessage =
  | ({ kind: "tick" } & Tick)
  | ({ kind: "trade" } & Trade)
  | ({ kind: "quote" } & Quote)
  | ({ kind: "ohlc" } & OHLCUpdate);

// ── Connection lifecycle ─────────────────────────────────────────────────────

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed"
  | "error";

export interface FeedStatus {
  state: ConnectionState;
  /** Monotonic attempt counter (resets to 0 on a clean connect). */
  attempt: number;
  /** Last error message, if any. */
  error?: string;
  /** Epoch ms of the last successfully received message. */
  lastMessageAt?: Timestamp;
}

/** What a provider can do — lets UI hide unsupported features without probing. */
export interface FeedCapabilities {
  history: boolean;
  /** Day-addressable history (enables the replay engine). */
  replayHistory: boolean;
  realtime: boolean;
  trades: boolean;
  quotes: boolean;
  /** Server-side OHLC aggregation (vs client-side from ticks). */
  serverOhlc: boolean;
  /** Intervals the provider serves natively for history. */
  intervals: IntervalCode[];
  /** Hard rate limits the adapter advertises (for the pacer). */
  rateLimit?: RateLimit;
}

export interface RateLimit {
  /** Max requests per window. */
  requests: number;
  /** Window length in ms. */
  windowMs: number;
  /** Min spacing between requests in ms (e.g. Dhan optionchain = 3000). */
  minSpacingMs?: number;
}

// ── Historical ───────────────────────────────────────────────────────────────

export interface HistoryRequest {
  symbol: SymbolId;
  interval: IntervalCode;
  /** Inclusive epoch-ms lower bound. Omit for the most recent page. */
  from?: Timestamp;
  /** Inclusive epoch-ms upper bound. */
  to?: Timestamp;
  /** Soft cap on bars returned. */
  limit?: number;
}

/**
 * Ranged + day-addressable history. The day methods feed the replay engine
 * (see {@link ReplayDataSource}); a provider with only ranged history can derive
 * them, or set `capabilities.replayHistory = false`.
 */
export interface HistoricalFeed {
  getBars(req: HistoryRequest): Promise<Bar[]>;
  /** Bars for one calendar day (`YYYY-MM-DD`). Optional — replay only. */
  getDay?(symbol: SymbolId, interval: IntervalCode, date: string): Promise<Bar[]>;
  /** Up to `n` trading dates strictly before `date`, nearest first. */
  listDatesBefore?(symbol: SymbolId, interval: IntervalCode, date: string, n: number): Promise<string[]>;
  /** Up to `n` trading dates strictly after `date`, nearest first. */
  listDatesAfter?(symbol: SymbolId, interval: IntervalCode, date: string, n: number): Promise<string[]>;
}

// ── Realtime ─────────────────────────────────────────────────────────────────

export interface SubscribeOptions {
  /** Message kinds to receive. Default: all the feed supports. */
  kinds?: Array<FeedMessage["kind"]>;
  /** Interval for server-side OHLC subscriptions. */
  interval?: IntervalCode;
}

/**
 * Live stream. `subscribe` returns an unsubscribe fn. The feed owns its own
 * connection; {@link withReconnect} wraps any implementation with resilient
 * reconnect + resubscribe so adapters stay simple.
 */
export interface RealtimeFeed {
  connect(): Promise<void>;
  disconnect(): void;
  getStatus(): FeedStatus;
  onStatus(cb: (s: FeedStatus) => void): () => void;
  /** Subscribe one symbol; returns an unsubscribe fn. */
  subscribe(symbol: SymbolId, onMessage: (m: FeedMessage) => void, opts?: SubscribeOptions): () => void;
}

// ── Provider bundles ─────────────────────────────────────────────────────────

/** A named market-data source = history + (optional) realtime + capabilities. */
export interface MarketDataProvider {
  readonly id: string;
  readonly capabilities: FeedCapabilities;
  readonly history?: HistoricalFeed;
  readonly realtime?: RealtimeFeed;
}

// ── Broker (optional trading surface) ────────────────────────────────────────

export interface BrokerPosition {
  symbol: SymbolId;
  quantity: number;
  avgPrice: number;
}

export interface BrokerOrder {
  id: string;
  symbol: SymbolId;
  side: "buy" | "sell";
  quantity: number;
  type: "market" | "limit";
  limitPrice?: number;
  status: "new" | "filled" | "partial" | "cancelled" | "rejected";
}

/**
 * Optional trading layer. The chart never calls this; a host app does. Kept here
 * so a single adapter can expose data + execution behind one object.
 */
export interface BrokerProvider extends MarketDataProvider {
  getPositions?(): Promise<BrokerPosition[]>;
  getOrders?(): Promise<BrokerOrder[]>;
  placeOrder?(o: Omit<BrokerOrder, "id" | "status">): Promise<BrokerOrder>;
  cancelOrder?(id: string): Promise<void>;
}
