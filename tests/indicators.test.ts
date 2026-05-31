import { describe, it, expect } from "vitest";
import { createBuiltinRegistry, BUILTIN_INDICATORS } from "../src/indicators/builtin";
import type { IndicatorBar } from "../src/indicators/types";

const bars: IndicatorBar[] = Array.from({ length: 120 }, (_, i) => {
  const base = 100 + 10 * Math.sin(i / 8) + i * 0.05;
  return { time: 1_700_000_000 + i * 60, open: base, high: base + 1, low: base - 1, close: base, volume: 100 + i };
});

describe("built-in indicator registry", () => {
  it("registers the full catalog grouped by category", () => {
    const reg = createBuiltinRegistry();
    expect(reg.list().length).toBe(BUILTIN_INDICATORS.length);
    const cats = reg.byCategory();
    expect(cats.overlay.map((d) => d.name)).toContain("SMA");
    expect(cats.oscillator.map((d) => d.name)).toContain("RSI");
  });

  it("SMA matches a hand-computed window", () => {
    const sma = createBuiltinRegistry().get("SMA")!;
    const res = sma.calculate(bars, { length: 5 });
    const pts = res.plots.sma;
    // First SMA point is at index 4 = mean of closes[0..4].
    const expected = (bars.slice(0, 5).reduce((s, b) => s + b.close, 0)) / 5;
    expect(pts[0].value).toBeCloseTo(expected, 6);
    expect(pts[0].time).toBe(bars[4].time);
  });

  it("RSI stays within [0,100]", () => {
    const rsi = createBuiltinRegistry().get("RSI")!;
    const pts = rsi.calculate(bars, { length: 14 }).plots.rsi;
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) {
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(100);
    }
  });

  it("MACD returns macd, signal, and a colored histogram", () => {
    const macd = createBuiltinRegistry().get("MACD")!;
    const res = macd.calculate(bars, { fast: 12, slow: 26, signal: 9 });
    expect(res.plots.macd.length).toBeGreaterThan(0);
    expect(res.plots.signal.length).toBeGreaterThan(0);
    expect(res.plots.hist.length).toBeGreaterThan(0);
    expect(res.plots.hist[0].color).toBeTruthy();
  });

  it("Bollinger yields upper >= basis >= lower", () => {
    const bb = createBuiltinRegistry().get("Bollinger")!;
    const res = bb.calculate(bars, { length: 20, mult: 2 });
    const n = res.plots.basis.length - 1;
    expect(res.plots.upper[n].value).toBeGreaterThanOrEqual(res.plots.basis[n].value);
    expect(res.plots.basis[n].value).toBeGreaterThanOrEqual(res.plots.lower[n].value);
  });

  it("every indicator computes finite values", () => {
    const reg = createBuiltinRegistry();
    for (const def of reg.list()) {
      const res = def.calculate(bars, def.defaultInputs);
      for (const series of Object.values(res.plots)) {
        for (const p of series) expect(Number.isFinite(p.value)).toBe(true);
      }
    }
  });
});
