import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// lightweight-charts is only needed for the LineSeries definition + LineStyle
// enum that EchoesController hands to a (faked) chart. Stub them so the suite
// runs in the "node" test environment without loading the real chart runtime.
vi.mock("lightweight-charts", () => ({
  LineSeries: {},
  LineStyle: { Solid: 0, Dotted: 1, Dashed: 2, LargeDashed: 3, SparseDotted: 4 },
}));

import { EchoesController } from "../src/lab/EchoesController";
import { SketchSearchController } from "../src/lab/SketchSearchController";
import { EventBus } from "../src/events/eventBus";
import type { Bar } from "../src/core/types";
import type { ChartEventMap, PluginContext } from "../src/plugins/types";

const mk = (closes: number[]): Bar[] =>
  closes.map((c, i) => ({ ts: i * 60_000, open: c, high: c, low: c, close: c, volume: 0 }));

interface FakeLineSeries {
  data: { time: number; value: number }[] | null;
  setData(d: { time: number; value: number }[]): void;
}

function makeEchoCtx(bars: Bar[]) {
  const added: FakeLineSeries[] = [];
  const removeSeries = vi.fn();
  const bus = new EventBus<ChartEventMap>();
  const chart = {
    addSeries: () => {
      const s: FakeLineSeries = { data: null, setData(d) { this.data = d; } };
      added.push(s);
      return s;
    },
    removeSeries,
    chartElement: () => ({}) as HTMLElement,
    applyOptions: () => {},
    timeScale: () => ({ timeToCoordinate: () => null }),
  };
  const series = { attachPrimitive() {}, detachPrimitive() {} };
  const ctx = { chart, series, bus, theme: {}, getBars: () => bars } as unknown as PluginContext;
  return { ctx, added, removeSeries, bus };
}

describe("EchoesController", () => {
  it("scans, sets bands, and projects the median path forward", () => {
    const bars = mk([1, 2, 3, 5, 6, 1, 2, 3, 9, 9, 1, 2, 3]);
    const { ctx, added } = makeEchoCtx(bars);
    const c = new EchoesController({ windowLen: 3, horizon: 2, k: 5 });

    let pushed: unknown = "unset";
    c.subscribe((s) => (pushed = s));
    c.init(ctx);

    const scan = c.run();
    expect(scan).not.toBeNull();
    expect(scan!.results.length).toBe(2);
    expect(pushed).toBe(scan); // subscribers get the scan

    // one projection line series, anchored at the last bar then 2 future points.
    expect(added.length).toBe(1);
    const pts = added[0].data!;
    expect(pts.length).toBe(3);
    expect(pts.map((p) => p.time)).toEqual([720, 780, 840]); // last ts 720s, +60s spacing
    // strictly increasing time (lightweight-charts requires it)
    for (let i = 1; i < pts.length; i++) expect(pts[i].time).toBeGreaterThan(pts[i - 1].time);
    expect(pts[0].value).toBeCloseTo(3, 9); // last close
    expect(pts[1].value).toBeCloseTo(7, 9); // 3 * (1 + medianPath[0]/100)
    expect(pts[2].value).toBeCloseTo(7.5, 9); // 3 * (1 + 150/100)
  });

  it("emits the scan on the bus too", () => {
    const bars = mk([1, 2, 3, 5, 6, 1, 2, 3, 9, 9, 1, 2, 3]);
    const { ctx, bus } = makeEchoCtx(bars);
    const c = new EchoesController({ windowLen: 3, horizon: 2, k: 5 });
    let busScan: unknown = "unset";
    bus.on("echoScan" as keyof ChartEventMap, (s) => (busScan = s));
    c.init(ctx);
    const scan = c.run();
    expect(busScan).toBe(scan);
  });

  it("returns null and draws no projection without enough history", () => {
    const { ctx, added } = makeEchoCtx(mk([1, 2, 3, 4, 5, 6, 7, 8]));
    const c = new EchoesController({ windowLen: 3, horizon: 2, k: 5 });
    c.init(ctx);
    expect(c.run()).toBeNull();
    expect(added.length).toBe(0);
  });

  it("clears the projection and notifies null", () => {
    const bars = mk([1, 2, 3, 5, 6, 1, 2, 3, 9, 9, 1, 2, 3]);
    const { ctx, removeSeries } = makeEchoCtx(bars);
    const c = new EchoesController({ windowLen: 3, horizon: 2, k: 5 });
    let pushed: unknown = "unset";
    c.subscribe((s) => (pushed = s));
    c.init(ctx);
    c.run();
    c.clear();
    expect(removeSeries).toHaveBeenCalledTimes(1);
    expect(pushed).toBeNull();
  });

  it("re-runs on setConfig once a scan has been shown", () => {
    const bars = mk([1, 2, 3, 5, 6, 1, 2, 3, 9, 9, 1, 2, 3]);
    const { ctx } = makeEchoCtx(bars);
    const c = new EchoesController({ windowLen: 3, horizon: 2, k: 5 });
    const onScan = vi.fn();
    c.subscribe(onScan);
    c.init(ctx);
    onScan.mockClear();
    c.run();
    const afterRun = onScan.mock.calls.length;
    c.setConfig({ k: 4 });
    expect(onScan.mock.calls.length).toBeGreaterThan(afterRun); // re-ran
  });
});

// ── SketchSearchController needs a minimal DOM (window + chart element). ─────────

describe("SketchSearchController", () => {
  let winHandlers: Record<string, (e: unknown) => void>;
  let elHandlers: Record<string, (e: unknown) => void>;

  beforeEach(() => {
    winHandlers = {};
    (globalThis as unknown as { window: unknown }).window = {
      addEventListener: (t: string, fn: (e: unknown) => void) => (winHandlers[t] = fn),
      removeEventListener: () => {},
    };
  });
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  function makeSketchCtx(bars: Bar[]) {
    elHandlers = {};
    const el = {
      addEventListener: (t: string, fn: (e: unknown) => void) => (elHandlers[t] = fn),
      removeEventListener: () => {},
      style: {} as Record<string, string>,
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
    };
    const chart = {
      chartElement: () => el as unknown as HTMLElement,
      applyOptions: () => {},
      timeScale: () => ({ timeToCoordinate: () => null }),
    };
    const series = { attachPrimitive() {}, detachPrimitive() {} };
    const bus = new EventBus<ChartEventMap>();
    const ctx = { chart, series, bus, theme: {}, getBars: () => bars } as unknown as PluginContext;
    return { ctx, el };
  }

  const down = (x: number, y: number) =>
    elHandlers.mousedown({ button: 0, clientX: x, clientY: y, preventDefault() {}, stopPropagation() {} });
  const move = (x: number, y: number) => winHandlers.mousemove({ clientX: x, clientY: y });
  const up = () => winHandlers.mouseup(undefined);

  it("captures a stroke and returns ranked matches mapped to bar times", () => {
    const bars = mk(Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 3) * 10));
    const { ctx } = makeSketchCtx(bars);
    const c = new SketchSearchController({ queryLength: 48, k: 10, minScore: 0 }); // gate off: this asserts mapping, not strictness
    let res: { query: number[]; matches: { startIndex: number; endIndex: number; startTime: number; endTime: number }[] } | null = null;
    c.subscribe((r) => (res = r as typeof res));
    c.init(ctx);

    c.setActive(true);
    down(10, 30);
    move(20, 10);
    move(30, 25);
    move(40, 5);
    up();

    expect(res).not.toBeNull();
    expect(res!.query.length).toBe(48); // resampled to requested length
    expect(res!.matches.length).toBeGreaterThanOrEqual(1);
    const m = res!.matches[0];
    expect(m.startIndex).toBeLessThan(m.endIndex);
    expect(m.endTime).toBeGreaterThan(m.startTime);
    expect(m.startTime).toBe(bars[m.startIndex].ts);
  });

  it("rejects a loopy / circular stroke (backtracks horizontally)", () => {
    const bars = mk(Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 3) * 10));
    const { ctx } = makeSketchCtx(bars);
    const c = new SketchSearchController({ minScore: 0 });
    let res: unknown = "unset";
    c.subscribe((r) => (res = r));
    c.init(ctx);
    c.setActive(true);
    // right, then back left → a closed loop, net span / travel ≈ 0.5 < 0.7.
    down(10, 30);
    move(40, 20);
    move(70, 30);
    move(40, 40);
    move(10, 30);
    up();
    expect(res).toBeNull();
  });

  it("returns no matches when nothing clears the similarity gate", () => {
    const bars = mk(Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 10));
    const { ctx } = makeSketchCtx(bars);
    const c = new SketchSearchController({ queryLength: 40, minScore: 0.999 }); // near-impossible bar
    let res: { matches: unknown[] } | null = null;
    c.subscribe((r) => (res = r as typeof res));
    c.init(ctx);
    c.setActive(true);
    down(10, 30);
    move(40, 12);
    move(70, 28);
    move(100, 8);
    up();
    expect(res).not.toBeNull(); // a query was formed (valid stroke)
    expect(res!.matches.length).toBe(0); // but the gate rejected every window
  });

  it("clamps the query length to the available history", () => {
    const bars = mk(Array.from({ length: 10 }, (_, i) => 100 + i));
    const { ctx } = makeSketchCtx(bars);
    const c = new SketchSearchController({ queryLength: 48 });
    let res: { query: number[] } | null = null;
    c.subscribe((r) => (res = r as typeof res));
    c.init(ctx);
    c.setActive(true);
    down(0, 5);
    move(5, 2);
    move(9, 8);
    up();
    expect(res).not.toBeNull();
    expect(res!.query.length).toBe(9); // min(48, bars.length - 1)
  });

  it("yields null for a stroke with fewer than 2 points", () => {
    const bars = mk(Array.from({ length: 50 }, (_, i) => 100 + i));
    const { ctx } = makeSketchCtx(bars);
    const c = new SketchSearchController();
    let res: unknown = "unset";
    c.subscribe((r) => (res = r));
    c.init(ctx);
    c.setActive(true);
    down(10, 10);
    up(); // no move → single point
    expect(res).toBeNull();
  });

  it("ignores pointer input when not active", () => {
    const bars = mk(Array.from({ length: 50 }, (_, i) => 100 + i));
    const { ctx } = makeSketchCtx(bars);
    const c = new SketchSearchController();
    const onResult = vi.fn();
    c.subscribe(onResult);
    c.init(ctx); // not active
    onResult.mockClear();
    down(10, 10);
    move(20, 20);
    up();
    expect(onResult).not.toHaveBeenCalled();
  });

  it("clears matches when disarmed", () => {
    const bars = mk(Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 3) * 10));
    const { ctx } = makeSketchCtx(bars);
    const c = new SketchSearchController({ queryLength: 48 });
    let res: unknown = "unset";
    c.subscribe((r) => (res = r));
    c.init(ctx);
    c.setActive(true);
    down(10, 30);
    move(20, 10);
    move(40, 5);
    up();
    expect(res).not.toBeNull();
    c.setActive(false);
    expect(res).toBeNull();
  });
});
