import { describe, it, expect } from "vitest";
import { toBars, resample, floorToBucket, type RawBar } from "../src/core/data";

const MIN = 60_000;
// 2024-01-02 (a Tuesday) 09:30 UTC as the base.
const base = Date.parse("2024-01-02T09:30:00Z");

function row(minOffset: number, close: number, volume = 1): RawBar {
  const ts = base + minOffset * MIN;
  return { ts, open: close, high: close + 1, low: close - 1, close, volume };
}

describe("toBars", () => {
  it("drops null/NaN/zero/negative OHLC", () => {
    const rows: RawBar[] = [
      row(0, 100),
      { ts: base + MIN, open: null, high: 1, low: 1, close: 1 },
      { ts: base + 2 * MIN, open: 0, high: 1, low: 1, close: 1 },
      { ts: base + 3 * MIN, open: 5, high: 5, low: -1, close: 5 },
      { ts: base + 4 * MIN, open: NaN, high: 1, low: 1, close: 1 },
    ];
    const bars = toBars(rows);
    expect(bars).toHaveLength(1);
    expect(bars[0].close).toBe(100);
  });

  it("sorts ascending and dedupes by ts", () => {
    const bars = toBars([row(2, 102), row(0, 100), row(2, 999)]);
    expect(bars.map((b) => b.ts)).toEqual([base, base + 2 * MIN]);
    // Last-wins dedupe keeps the earlier one after stable sort + splice.
    expect(bars).toHaveLength(2);
  });

  it("defaults missing volume to 0", () => {
    const bars = toBars([{ ts: base, open: 1, high: 1, low: 1, close: 1 }]);
    expect(bars[0].volume).toBe(0);
  });
});

describe("resample", () => {
  it("buckets into 5-minute candles aggregating OHLCV", () => {
    const rows = [row(0, 100, 1), row(1, 105, 2), row(4, 102, 3), row(5, 110, 4)];
    const out = resample(rows, 5);
    expect(out).toHaveLength(2);
    expect(out[0].open).toBe(100);
    expect(out[0].close).toBe(102);
    expect(out[0].high).toBe(106); // 105 + 1
    expect(out[0].volume).toBe(6); // 1+2+3
    expect(out[1].open).toBe(110);
  });

  it("aligns intraday buckets to sessionOpenMinutes", () => {
    // session open 09:30 == 570 min past midnight; a 15m bucket starting here.
    const rows = [row(0, 100), row(14, 101)];
    const out = resample(rows, 15, { sessionOpenMinutes: 9 * 60 + 30 });
    expect(out).toHaveLength(1);
    expect(new Date(out[0].ts).toISOString()).toBe("2024-01-02T09:30:00.000Z");
  });

  it("collapses day buckets for intervals >= 1440", () => {
    const rows = [row(0, 100), row(60, 110), row(120, 90)];
    const out = resample(rows, 1440, { sessionOpenMinutes: 9 * 60 + 30 });
    expect(out).toHaveLength(1);
    expect(out[0].open).toBe(100);
    expect(out[0].close).toBe(90);
  });

  it("passes through for <= 1m", () => {
    const rows = [row(0, 100), row(1, 101)];
    expect(resample(rows, 1)).toEqual(toBars(rows));
  });
});

describe("floorToBucket", () => {
  it("floors to the session-aligned bucket start", () => {
    const ts = base + 7 * MIN; // 09:37
    const floored = floorToBucket(ts, 5, { sessionOpenMinutes: 9 * 60 + 30 });
    expect(new Date(floored).toISOString()).toBe("2024-01-02T09:35:00.000Z");
  });

  it("returns ts unchanged for <= 1m", () => {
    expect(floorToBucket(base, 1)).toBe(base);
  });
});
