/**
 * @candlekit/charts — broker-agnostic live feed + broker data layer.
 *
 * Transport-free contracts (MarketDataProvider / RealtimeFeed / HistoricalFeed /
 * BrokerProvider), a client-side tick→OHLC aggregator, a resilient reconnect
 * wrapper, and a synthetic MockFeed. Real adapters (Alpaca, Binance, Dhan,
 * Zerodha, …) live in consumer land or sibling packages and bring their own
 * transport — the chart only ever sees these interfaces.
 */

export * from "./types";
export * from "./aggregator";
export * from "./reconnect";
export * from "./MockFeed";
