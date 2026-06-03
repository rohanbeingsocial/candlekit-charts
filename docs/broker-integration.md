# Broker integration

candlekit never talks to a broker directly. You implement a small adapter that
satisfies the contracts in [`src/feed/`](../src/feed/) and pass it to your app;
the chart only ever sees the interfaces. This keeps `lightweight-charts` the only
runtime dependency and lets any data source — Alpaca, Interactive Brokers,
Zerodha, Upstox, Dhan, Angel One, Binance, Bybit, Coinbase, Polygon, TwelveData,
Tradier, or a custom WS/REST feed — drop in behind the same shape.

## The contracts

```ts
import type {
  MarketDataProvider, HistoricalFeed, RealtimeFeed, BrokerProvider,
  FeedMessage, FeedStatus, FeedCapabilities,
} from "@getcandlekit/charts";
```

- **`HistoricalFeed`** — `getBars(req)` for ranged history; optional
  `getDay` / `listDatesBefore` / `listDatesAfter` enable the replay engine.
- **`RealtimeFeed`** — `connect` / `disconnect` / `subscribe(symbol, onMessage)`;
  emits a `FeedMessage` union (`tick | trade | quote | ohlc`) + a `FeedStatus`
  stream.
- **`MarketDataProvider`** — bundles history + realtime + `capabilities`.
- **`BrokerProvider`** — adds an optional trading surface (positions / orders).

Helpers you get for free:

- **`withReconnect(factory)`** — wraps any `RealtimeFeed` with exponential-backoff
  reconnect, transparent resubscribe, and a unified status stream. Your adapter
  stays a thin connect/subscribe/emit shell.
- **`TickAggregator`** — folds a tick/trade stream into OHLC bars client-side
  (session-anchored), for feeds that only push ticks.
- **`MockFeed`** — a synthetic provider for local dev/tests.

## Wiring it up

```ts
import { withReconnect, TickAggregator } from "@getcandlekit/charts";

const provider = new MyBrokerFeed(creds);          // implements MarketDataProvider

// history → chart
const bars = await provider.history!.getBars({ symbol: "AAPL", interval: "1m", limit: 500 });
api.controller.setData(toBars(bars));

// live → chart (tick feed → client-side OHLC → updateBar)
const agg = new TickAggregator({ symbol: "AAPL", interval: "1m", minutes: 1 });
agg.seed(bars.at(-1) ?? null);
const live = withReconnect(() => provider.realtime!);
await live.connect();
live.subscribe("AAPL", (m) => {
  if (m.kind !== "tick") return;
  const { bar } = agg.apply(m.ts, m.ltp, 0);
  api.controller.updateBar(bar);           // O(1) per tick; fires onBar → indicators
});
```

For server-OHLC feeds, skip the aggregator and forward `m.bar` from `ohlc`
messages straight to `updateBar`.

## Example: a Dhan adapter (sketch)

Dhan v2 is a WebSocket (live ticks) + REST (history, option chain) API. Auth is a
`clientId` + `accessToken` (~30-day TTL). The option-chain REST endpoint is rate
limited (≈1 req / 3 s per client), so advertise that in `capabilities.rateLimit`
and pace requests. This is a representative skeleton — fill in the transport with
the official `dhanhq` SDK or raw WS/REST.

```ts
import type {
  MarketDataProvider, HistoricalFeed, RealtimeFeed,
  FeedCapabilities, FeedMessage, FeedStatus, HistoryRequest,
} from "@getcandlekit/charts";
import type { Bar, SymbolId } from "@getcandlekit/charts";

interface DhanCreds { clientId: string; accessToken: string; }

class DhanFeed implements MarketDataProvider, HistoricalFeed, RealtimeFeed {
  readonly id = "dhan";
  readonly capabilities: FeedCapabilities = {
    history: true, replayHistory: true, realtime: true,
    trades: false, quotes: false, serverOhlc: false,
    intervals: ["1m", "5m", "15m", "60m", "1d"],
    rateLimit: { requests: 1, windowMs: 3000, minSpacingMs: 3000 },
  };
  readonly history = this;
  readonly realtime = this;

  private ws: WebSocket | null = null;
  private status: FeedStatus = { state: "idle", attempt: 0 };
  private statusSubs = new Set<(s: FeedStatus) => void>();
  private handlers = new Map<SymbolId, (m: FeedMessage) => void>();

  constructor(private creds: DhanCreds) {}

  // ── HistoricalFeed ──────────────────────────────────────────────
  async getBars(req: HistoryRequest): Promise<Bar[]> {
    // POST Dhan /charts/intraday (or /historical) with securityId + from/to.
    const rows = await dhanIntraday(this.creds, req);  // your REST call
    return rows.map((r) => ({
      ts: r.timestamp * 1000,               // → epoch ms (candlekit's unit)
      open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume,
    }));
  }
  // getDay / listDatesBefore / listDatesAfter: map onto the same REST,
  // one IST trading day at a time, to drive the replay engine.

  // ── RealtimeFeed ────────────────────────────────────────────────
  async connect(): Promise<void> {
    this.ws = new WebSocket(dhanWsUrl(this.creds));
    this.setStatus({ state: "connecting", attempt: 0 });
    await new Promise<void>((res, rej) => {
      this.ws!.onopen = () => { this.setStatus({ state: "connected", attempt: 0 }); res(); };
      this.ws!.onerror = () => { this.setStatus({ state: "error", attempt: 0, error: "ws error" }); rej(new Error("ws")); };
      this.ws!.onclose = () => this.setStatus({ state: "closed", attempt: 0 });
      this.ws!.onmessage = (ev) => this.onPacket(ev.data);
    });
  }
  disconnect(): void { this.ws?.close(); this.ws = null; }
  getStatus(): FeedStatus { return this.status; }
  onStatus(cb: (s: FeedStatus) => void): () => void {
    this.statusSubs.add(cb); return () => this.statusSubs.delete(cb);
  }
  subscribe(symbol: SymbolId, onMessage: (m: FeedMessage) => void): () => void {
    this.handlers.set(symbol, onMessage);
    this.ws?.send(dhanSubscribePacket(symbol));      // Dhan binary subscribe
    return () => { this.handlers.delete(symbol); this.ws?.send(dhanUnsubscribePacket(symbol)); };
  }

  private onPacket(data: unknown): void {
    const t = parseDhanTick(data);                    // → { symbol, ts(ms), ltp }
    if (!t) return;
    this.setStatus({ lastMessageAt: t.ts });
    this.handlers.get(t.symbol)?.({ kind: "tick", symbol: t.symbol, ts: t.ts, ltp: t.ltp });
  }
  private setStatus(p: Partial<FeedStatus>): void {
    this.status = { ...this.status, ...p };
    for (const cb of this.statusSubs) cb(this.status);
  }
}
```

Wrap it with `withReconnect(() => dhan)` so a dropped socket reconnects and
re-subscribes automatically. Because the chart only depends on the interfaces,
swapping Dhan for Binance is a new adapter file — no chart changes.

## Testing checklist

- `getBars` returns ascending `Bar[]` with `ts` in **epoch ms** (not seconds).
- Live ticks flow `tick → TickAggregator.apply → updateBar` and the candle
  extends/rolls correctly across the minute boundary.
- `withReconnect` recovers after a forced socket close (status goes
  `reconnecting → connected`, subscriptions resume).
- Replay: `getDay` + `listDatesBefore/After` return IST trading days so the
  cursor can walk history deterministically.
