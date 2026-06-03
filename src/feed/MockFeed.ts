/**
 * Synthetic in-memory provider for demos and tests. Implements the full
 * {@link MarketDataProvider} surface (history + realtime) with a random walk —
 * zero transport, zero deps. Swap it for a real adapter without touching the
 * chart.
 */

import { generateBars, toBars } from "../core/data";
import type { Bar, IntervalCode, SymbolId } from "../core/types";
import type {
  FeedCapabilities,
  FeedMessage,
  FeedStatus,
  HistoricalFeed,
  HistoryRequest,
  MarketDataProvider,
  RealtimeFeed,
  SubscribeOptions,
} from "./types";

export interface MockFeedOptions {
  /** Starting price for the synthetic walk. Default 100. */
  startPrice?: number;
  /** Live tick spacing in ms. Default 1000. */
  tickMs?: number;
  /** Per-step volatility (price units). Default 0.4. */
  volatility?: number;
}

export class MockFeed implements MarketDataProvider, HistoricalFeed, RealtimeFeed {
  readonly id = "mock";
  readonly capabilities: FeedCapabilities = {
    history: true,
    replayHistory: true,
    realtime: true,
    trades: true,
    quotes: false,
    serverOhlc: false,
    intervals: ["1m", "5m", "15m", "1h"],
  };
  readonly history = this;
  readonly realtime = this;

  private status: FeedStatus = { state: "idle", attempt: 0 };
  private statusSubs = new Set<(s: FeedStatus) => void>();
  private timers = new Set<ReturnType<typeof setInterval>>();
  private last = new Map<SymbolId, number>();

  constructor(private readonly opts: MockFeedOptions = {}) {}

  // ── HistoricalFeed ─────────────────────────────────────────────────────────

  async getBars(req: HistoryRequest): Promise<Bar[]> {
    const span = req.from && req.to ? Math.max(1, Math.round((req.to - req.from) / 60_000)) : 375;
    const count = Math.min(req.limit ?? span, 5000);
    const start = req.from ?? Date.now() - count * 60_000;
    return toBars(generateBars(count, this.opts.startPrice ?? 100, start));
  }

  async getDay(_symbol: SymbolId, _interval: IntervalCode, date: string): Promise<Bar[]> {
    const start = new Date(`${date}T09:15:00Z`).getTime();
    return toBars(generateBars(375, this.opts.startPrice ?? 100, start));
  }

  async listDatesBefore(_s: SymbolId, _i: IntervalCode, date: string, n: number): Promise<string[]> {
    return walkDays(date, -1, n);
  }

  async listDatesAfter(_s: SymbolId, _i: IntervalCode, date: string, n: number): Promise<string[]> {
    return walkDays(date, 1, n);
  }

  // ── RealtimeFeed ───────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    this.setStatus({ state: "connected", attempt: 0 });
  }

  disconnect(): void {
    for (const t of this.timers.values()) clearInterval(t);
    this.timers.clear();
    this.setStatus({ state: "closed", attempt: 0 });
  }

  getStatus(): FeedStatus {
    return this.status;
  }

  onStatus(cb: (s: FeedStatus) => void): () => void {
    this.statusSubs.add(cb);
    return () => this.statusSubs.delete(cb);
  }

  subscribe(symbol: SymbolId, onMessage: (m: FeedMessage) => void, _opts?: SubscribeOptions): () => void {
    const vol = this.opts.volatility ?? 0.4;
    const timer = setInterval(() => {
      const prev = this.last.get(symbol) ?? this.opts.startPrice ?? 100;
      const next = Math.max(1, prev + (Math.random() - 0.5) * 2 * vol);
      this.last.set(symbol, next);
      const ts = Date.now();
      this.setStatus({ lastMessageAt: ts });
      onMessage({ kind: "tick", symbol, ts, ltp: next });
    }, this.opts.tickMs ?? 1000);
    this.timers.add(timer);
    return () => {
      clearInterval(timer);
      this.timers.delete(timer);
    };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private setStatus(next: Partial<FeedStatus>): void {
    this.status = { ...this.status, ...next };
    for (const cb of this.statusSubs) {
      try {
        cb(this.status);
      } catch {
        /* isolated */
      }
    }
  }
}

function walkDays(date: string, dir: 1 | -1, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${date}T00:00:00Z`);
  while (out.length < n) {
    d.setUTCDate(d.getUTCDate() + dir);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
