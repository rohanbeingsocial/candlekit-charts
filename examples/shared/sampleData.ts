/**
 * Synthetic OHLCV generator — no network, no production data. Produces a random
 * walk of 1-minute bars suitable for every example.
 */
import type { RawBar } from "@candlekit/charts";

export function generateBars(count = 500, startPrice = 100, startTs = Date.UTC(2024, 0, 2, 9, 30)): RawBar[] {
  const bars: RawBar[] = [];
  let price = startPrice;
  let ts = startTs;
  for (let i = 0; i < count; i++) {
    const drift = (Math.random() - 0.5) * 1.5;
    const open = price;
    const close = Math.max(1, open + drift);
    const high = Math.max(open, close) + Math.random() * 0.8;
    const low = Math.min(open, close) - Math.random() * 0.8;
    const volume = Math.round(500 + Math.random() * 2000);
    bars.push({ ts, open, high, low, close, volume });
    price = close;
    ts += 60_000;
  }
  return bars;
}

/** Group flat 1-minute bars by calendar day → for the replay data source. */
export function byDay(bars: RawBar[]): Record<string, RawBar[]> {
  const out: Record<string, RawBar[]> = {};
  for (const b of bars) {
    const date = new Date(b.ts).toISOString().slice(0, 10);
    (out[date] ??= []).push(b);
  }
  return out;
}
