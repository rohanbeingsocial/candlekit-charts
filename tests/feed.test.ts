import { describe, it, expect } from "vitest";
import { TickAggregator } from "../src/feed/aggregator";

const MIN = 60_000;
const base = Date.parse("2024-01-02T09:30:00Z");

function agg(minutes = 1) {
  return new TickAggregator({ symbol: "X", interval: `${minutes}m`, minutes });
}

describe("TickAggregator", () => {
  it("builds one bar from ticks inside a bucket (OHLC correct)", () => {
    const a = agg(1);
    expect(a.apply(base + 1_000, 100).closed).toBeNull();
    a.apply(base + 2_000, 103);
    a.apply(base + 3_000, 98);
    const { bar, closed } = a.apply(base + 4_000, 101);
    expect(closed).toBeNull();
    expect(bar).toMatchObject({ ts: base, open: 100, high: 103, low: 98, close: 101 });
  });

  it("opens a new bucket and reports the closed bar", () => {
    const a = agg(1);
    a.apply(base + 1_000, 100);
    a.apply(base + 30_000, 105);
    const { bar, closed } = a.apply(base + MIN + 1_000, 106);
    expect(closed).toMatchObject({ ts: base, open: 100, high: 105, low: 100, close: 105 });
    expect(bar).toMatchObject({ ts: base + MIN, open: 106, close: 106 });
  });

  it("aligns to the bucket width (5m)", () => {
    const a = agg(5);
    const r1 = a.apply(base + 1 * MIN, 100); // 09:31 → bucket 09:30
    const r2 = a.apply(base + 4 * MIN, 110); // 09:34 → same bucket
    const r3 = a.apply(base + 6 * MIN, 120); // 09:36 → bucket 09:35
    expect(r1.bar.ts).toBe(base);
    expect(r2.closed).toBeNull();
    expect(r3.closed?.ts).toBe(base);
    expect(r3.bar.ts).toBe(base + 5 * MIN);
  });

  it("ignores out-of-order ticks older than the open bar", () => {
    const a = agg(1);
    a.apply(base + 30_000, 100);
    const { bar, closed } = a.apply(base - 30_000, 999);
    expect(closed).toBeNull();
    expect(bar.close).toBe(100);
  });

  it("rejects non-positive / non-finite prices", () => {
    const a = agg(1);
    a.apply(base + 1_000, 100);
    expect(a.apply(base + 2_000, 0).bar.close).toBe(100);
    expect(a.apply(base + 2_000, NaN).bar.close).toBe(100);
  });

  it("accumulates volume within a bucket", () => {
    const a = agg(1);
    a.apply(base + 1_000, 100, 10);
    const { bar } = a.apply(base + 2_000, 101, 5);
    expect(bar.volume).toBe(15);
  });

  it("seed lets the first tick extend the prior bar", () => {
    const a = agg(1);
    a.seed({ ts: base, open: 100, high: 100, low: 100, close: 100, volume: 0 });
    const { bar, closed } = a.apply(base + 10_000, 104);
    expect(closed).toBeNull();
    expect(bar).toMatchObject({ ts: base, open: 100, high: 104, close: 104 });
  });
});
