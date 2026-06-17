// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement as h, act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ChartContext, type ChartViewApi } from "../src/react/context";
import { EchoesPanel } from "../src/react/EchoesPanel";
import { SketchSearchButton } from "../src/react/SketchSearchButton";
import type { EchoScan } from "../src/lab/types";
import type { SketchSearchResult } from "../src/lab/SketchSearchController";

// react-dom/client + act require this flag in React 18.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SCAN: EchoScan = {
  windowLen: 3,
  horizon: 2,
  results: [
    { match: { startIndex: 0, endIndex: 2, distance: 0 }, matchTime: 120_000, aftermathPct: [10, 20] },
    { match: { startIndex: 5, endIndex: 7, distance: 1.5 }, matchTime: 420_000, aftermathPct: [-5, -8] },
  ],
  stats: { count: 2, upCount: 1, medianEndPct: 6, bestEndPct: 20, worstEndPct: -8, horizon: 2 },
  queryClosePct: [0, 5, 10],
  medianPathPct: [2.5, 6],
};

class FakeEchoes {
  scan: EchoScan | null = null;
  cb: ((s: EchoScan | null) => void) | null = null;
  setConfig = vi.fn();
  run = vi.fn();
  clear = vi.fn(() => this.emit(null));
  getScan() {
    return this.scan;
  }
  subscribe(cb: (s: EchoScan | null) => void) {
    this.cb = cb;
    cb(this.scan);
    return () => {
      this.cb = null;
    };
  }
  emit(s: EchoScan | null) {
    this.scan = s;
    this.cb?.(s);
  }
}

class FakeSketch {
  active = false;
  cb: ((r: SketchSearchResult | null) => void) | null = null;
  setActive = vi.fn((a: boolean) => {
    this.active = a;
    if (!a) this.emit(null);
  });
  subscribe(cb: (r: SketchSearchResult | null) => void) {
    this.cb = cb;
    cb(null);
    return () => {
      this.cb = null;
    };
  }
  emit(r: SketchSearchResult | null) {
    this.cb?.(r);
  }
}

function api(partial: Partial<ChartViewApi>): ChartViewApi {
  return {
    controller: null,
    drawing: null,
    indicators: null,
    measurement: null,
    pointMarker: null,
    sketch: null,
    echoes: null,
    ...partial,
  } as unknown as ChartViewApi;
}

let container: HTMLDivElement;
let root: Root;

function render(node: ReactElement, value: ChartViewApi) {
  act(() => {
    root.render(h(ChartContext.Provider, { value }, node));
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("EchoesPanel", () => {
  it("renders nothing when echoes is disabled", () => {
    render(h(EchoesPanel), api({ echoes: null }));
    expect(container.innerHTML).toBe("");
  });

  it("shows the control row but no stats before a scan", () => {
    const echoes = new FakeEchoes();
    render(h(EchoesPanel), api({ echoes: echoes as never }));
    expect(container.textContent).toContain("Scan");
    expect(container.textContent).toContain("Clear");
    expect(container.textContent).not.toContain("Echoes");
    expect(container.querySelector("polyline")).toBeNull();
  });

  it("renders stats, projection, and per-echo sparklines once a scan arrives", () => {
    const echoes = new FakeEchoes();
    render(h(EchoesPanel), api({ echoes: echoes as never }));
    act(() => echoes.emit(SCAN));

    const text = container.textContent ?? "";
    expect(text).toContain("Echoes");
    expect(text).toContain("50%"); // up-rate 1/2
    expect(text).toContain("+6.00%"); // median
    expect(text).toContain("+20.00%"); // best + first echo end
    expect(text).toContain("-8.00%"); // worst + second echo end
    expect(text).toContain("Projected median path");
    expect(text).toContain("#1");
    expect(text).toContain("#2");
    expect(text).toContain("d 1.50"); // distance of 2nd echo

    // 1 projection + 2 aftermath sparklines.
    expect(container.querySelectorAll("polyline").length).toBe(3);
  });

  it("Scan button configures + runs the controller (first run)", () => {
    const echoes = new FakeEchoes();
    render(h(EchoesPanel, { defaultWindowLen: 25, defaultHorizon: 40 }), api({ echoes: echoes as never }));
    const btn = container.querySelector(".ck-lab-run") as HTMLButtonElement;
    act(() => btn.click());
    expect(echoes.setConfig).toHaveBeenCalledWith({ windowLen: 25, horizon: 40 });
    expect(echoes.run).toHaveBeenCalledTimes(1);
  });

  it("Scan does not double-run once a scan already exists", () => {
    const echoes = new FakeEchoes();
    render(h(EchoesPanel), api({ echoes: echoes as never }));
    act(() => echoes.emit(SCAN)); // scan now exists
    const btn = container.querySelector(".ck-lab-run") as HTMLButtonElement;
    act(() => btn.click());
    expect(echoes.setConfig).toHaveBeenCalledTimes(1);
    expect(echoes.run).not.toHaveBeenCalled(); // setConfig reruns internally
  });

  it("Clear button clears the controller", () => {
    const echoes = new FakeEchoes();
    render(h(EchoesPanel), api({ echoes: echoes as never }));
    act(() => echoes.emit(SCAN));
    const btn = container.querySelector(".ck-lab-clear") as HTMLButtonElement;
    act(() => btn.click());
    expect(echoes.clear).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("Echoes"); // stats gone after clear
  });
});

describe("SketchSearchButton", () => {
  it("renders nothing when sketch is disabled", () => {
    render(h(SketchSearchButton), api({ sketch: null }));
    expect(container.innerHTML).toBe("");
  });

  it("renders an unpressed toggle with its label", () => {
    const sketch = new FakeSketch();
    render(h(SketchSearchButton), api({ sketch: sketch as never }));
    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(btn.textContent).toContain("Sketch");
  });

  it("arms the controller and reflects pressed state on click", () => {
    const sketch = new FakeSketch();
    render(h(SketchSearchButton), api({ sketch: sketch as never }));
    const btn = container.querySelector("button") as HTMLButtonElement;
    act(() => btn.click());
    expect(sketch.setActive).toHaveBeenCalledWith(true);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("shows a match-count badge when results arrive", () => {
    const sketch = new FakeSketch();
    render(h(SketchSearchButton), api({ sketch: sketch as never }));
    act(() => sketch.emit({ query: [], matches: [{ startIndex: 0, endIndex: 4, distance: 0, startTime: 0, endTime: 1 }, { startIndex: 6, endIndex: 10, distance: 1, startTime: 2, endTime: 3 }] }));
    expect(container.querySelector(".ck-badge")?.textContent).toBe("2");
  });
});
