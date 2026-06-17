import { describe, it, expect } from "vitest";
import { zNormalize, findSimilar, buildEchoScan, resampleStroke } from "../src/lab/similarity";
import type { Bar } from "../src/core/types";

describe("zNormalize", () => {
  it("returns [] for empty input", () => {
    expect(zNormalize([])).toEqual([]);
  });

  it("maps a flat series to all zeros (std 0)", () => {
    expect(zNormalize([5, 5, 5, 5])).toEqual([0, 0, 0, 0]);
  });

  it("maps a single value to [0]", () => {
    expect(zNormalize([42])).toEqual([0]);
  });

  it("returns all zeros when input has non-finite values", () => {
    expect(zNormalize([1, NaN, 3])).toEqual([0, 0, 0]);
    expect(zNormalize([1, Infinity, 3])).toEqual([0, 0, 0]);
  });

  it("produces mean 0 and unit population std", () => {
    const z = zNormalize([1, 2, 3, 4, 5]);
    const mean = z.reduce((a, b) => a + b, 0) / z.length;
    const std = Math.sqrt(z.reduce((a, b) => a + (b - mean) ** 2, 0) / z.length);
    expect(mean).toBeCloseTo(0, 12);
    expect(std).toBeCloseTo(1, 12);
  });

  it("is scale + level invariant (shape only)", () => {
    const a = zNormalize([1, 2, 3, 4, 5]);
    const b = zNormalize([102, 104, 106, 108, 110]); // shifted + scaled
    for (let i = 0; i < a.length; i++) expect(b[i]).toBeCloseTo(a[i], 12);
  });
});

describe("findSimilar", () => {
  it("finds an identical-shape window at distance ~0", () => {
    // window 0 is the same shape scaled; window 6 is identical.
    const hay = [2, 4, 6, 8, 10, 100, 1, 2, 3, 4, 5];
    const matches = findSimilar(hay, [1, 2, 3, 4, 5], { k: 2 });
    expect(matches.length).toBe(2);
    expect(matches[0].distance).toBeCloseTo(0, 9);
    expect(matches[1].distance).toBeCloseTo(0, 9);
    expect(matches.map((m) => m.startIndex).sort((a, b) => a - b)).toEqual([0, 6]);
    expect(matches[0].endIndex).toBe(matches[0].startIndex + 4);
  });

  it("returns matches sorted best-first", () => {
    const hay = [1, 2, 3, 4, 5, 1, 2, 3, 9, 1];
    const matches = findSimilar(hay, [1, 2, 3, 4, 5], { k: 3, minGap: 1 });
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i].distance).toBeGreaterThanOrEqual(matches[i - 1].distance);
    }
  });

  it("honors k", () => {
    const hay = Array.from({ length: 50 }, (_, i) => Math.sin(i));
    expect(findSimilar(hay, [0, 1, 0], { k: 2, minGap: 1 }).length).toBeLessThanOrEqual(2);
  });

  it("enforces non-overlap via default minGap (= query length)", () => {
    const hay = [1, 2, 3, 1, 2, 3, 1, 2, 3];
    const matches = findSimilar(hay, [1, 2, 3], { k: 5 });
    const starts = matches.map((m) => m.startIndex).sort((a, b) => a - b);
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(3);
    }
  });

  it("excludes windows ending inside the tail", () => {
    const hay = [1, 2, 3, 1, 2];
    const matches = findSimilar(hay, [1, 2], { k: 5, minGap: 1, excludeTail: 1 });
    // window starting at 3 ends at index 4 (within the last 1 index) -> excluded.
    expect(matches.every((m) => m.startIndex !== 3)).toBe(true);
  });

  it("never selects a window touching non-finite data", () => {
    const hay = [1, 2, NaN, 4, 1, 2, 3, 4];
    const matches = findSimilar(hay, [1, 2, 3, 4], { k: 5, minGap: 1 });
    expect(matches.some((m) => m.startIndex === 0)).toBe(false);
    expect(matches[0].startIndex).toBe(4);
    expect(matches[0].distance).toBeCloseTo(0, 9);
  });

  it("returns [] for degenerate args", () => {
    expect(findSimilar([1, 2, 3], [1], { k: 5 })).toEqual([]); // query < 2
    expect(findSimilar([1, 2, 3], [1, 2], { k: 0 })).toEqual([]); // k < 1
    expect(findSimilar([1, 2], [1, 2, 3], { k: 1 })).toEqual([]); // no window fits
    expect(findSimilar([1, 2, 3], [1, NaN], { k: 1 })).toEqual([]); // bad query
  });
});

describe("buildEchoScan", () => {
  const mk = (closes: number[]): Bar[] =>
    closes.map((c, i) => ({ ts: i * 60_000, open: c, high: c, low: c, close: c, volume: 0 }));

  it("returns null for nonsensical params", () => {
    const bars = mk(Array(20).fill(1));
    expect(buildEchoScan(bars, 1, 2, 3)).toBeNull(); // windowLen < 2
    expect(buildEchoScan(bars, 3, 0, 3)).toBeNull(); // horizon < 1
    expect(buildEchoScan(bars, 3, 2, 0)).toBeNull(); // k < 1
  });

  it("returns null without enough history (< windowLen * 3)", () => {
    expect(buildEchoScan(mk([1, 2, 3, 4, 5, 6, 7, 8]), 3, 2, 5)).toBeNull();
  });

  it("scans echoes and aggregates their aftermath", () => {
    // two identical [1,2,3] windows (idx 0-2, 5-7), each followed by an up move,
    // and the same shape as the trailing query window (idx 10-12).
    const bars = mk([1, 2, 3, 5, 6, 1, 2, 3, 9, 9, 1, 2, 3]);
    const scan = buildEchoScan(bars, 3, 2, 5)!;
    expect(scan).not.toBeNull();
    expect(scan.windowLen).toBe(3);
    expect(scan.horizon).toBe(2);
    expect(scan.results.length).toBe(2);

    // both matches are exact-shape (distance ~0), best first.
    expect(scan.results[0].match.distance).toBeCloseTo(0, 9);

    // aftermath stats over both echoes: ends +100% and +200%.
    expect(scan.stats.count).toBe(2);
    expect(scan.stats.upCount).toBe(2);
    expect(scan.stats.medianEndPct).toBeCloseTo(150, 9);
    expect(scan.stats.bestEndPct).toBeCloseTo(200, 9);
    expect(scan.stats.worstEndPct).toBeCloseTo(100, 9);

    // query window as % from its first close.
    expect(scan.queryClosePct.map((v) => Math.round(v))).toEqual([0, 100, 200]);

    // median aftermath path: per-offset median across both echoes.
    expect(scan.medianPathPct.length).toBe(2);
    expect(scan.medianPathPct[0]).toBeCloseTo(((5 / 3 - 1) * 100 + 200) / 2, 6); // off 1
    expect(scan.medianPathPct[1]).toBeCloseTo(150, 9); // off 2 (median of 100, 200)

    // matchTime is the matched window's last-bar ts.
    const ends = scan.results.map((r) => r.matchTime).sort((a, b) => a - b);
    expect(ends).toEqual([2 * 60_000, 7 * 60_000]);
  });
});

describe("resampleStroke", () => {
  it("throws for n < 2 or non-integer n", () => {
    expect(() => resampleStroke([{ x: 0, y: 0 }, { x: 1, y: 1 }], 1)).toThrow();
    expect(() => resampleStroke([{ x: 0, y: 0 }, { x: 1, y: 1 }], 2.5)).toThrow();
  });

  it("throws with fewer than 2 distinct x values", () => {
    expect(() => resampleStroke([{ x: 0, y: 0 }], 2)).toThrow();
    expect(() => resampleStroke([{ x: 3, y: 0 }, { x: 3, y: 9 }], 2)).toThrow();
  });

  it("inverts y (canvas-down to price-up) and returns n samples", () => {
    const out = resampleStroke([{ x: 0, y: 0 }, { x: 10, y: -10 }], 2);
    expect(out).toEqual([0, 10]);
  });

  it("linearly interpolates between stroke points", () => {
    const out = resampleStroke([{ x: 0, y: 0 }, { x: 10, y: 10 }], 3);
    expect(out.length).toBe(3);
    expect(out[0]).toBeCloseTo(0, 9);
    expect(out[1]).toBeCloseTo(-5, 9); // midpoint, y inverted
    expect(out[2]).toBeCloseTo(-10, 9);
  });

  it("keeps the latest sample when a stroke revisits an x", () => {
    const out = resampleStroke([{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 5, y: 99 }], 2);
    expect(out).toEqual([0, -99]);
  });

  it("handles right-to-left strokes (sorted by x)", () => {
    const out = resampleStroke([{ x: 10, y: 10 }, { x: 0, y: 0 }], 2);
    expect(out).toEqual([0, -10]);
  });
});
