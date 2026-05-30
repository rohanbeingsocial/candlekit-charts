import { describe, it, expect, vi } from "vitest";
import { SyncEngineImpl } from "../src/sync/SyncEngine";
import type { SyncMember, ChartViewport } from "../src/sync/types";

function member(id: string, apply = vi.fn()): SyncMember {
  const viewport: ChartViewport = {
    getVisibleLogicalRange: () => null,
    setVisibleLogicalRange: () => {},
    setCrosshairAtTime: () => {},
  };
  return { panelId: id, viewport, getSession: () => ({ symbol: "X", interval: "1m" }), apply };
}

describe("SyncEngineImpl", () => {
  it("broadcasts to members except the source", () => {
    const eng = new SyncEngineImpl();
    const g = eng.createGroup({ name: "g", flags: new Set(["crosshair"]) });
    const a = member("a");
    const b = member("b");
    eng.attach(g, a);
    eng.attach(g, b);
    eng.broadcast(g, { kind: "crosshair", ts: 1000, sourcePanelId: "a" });
    expect(a.apply).not.toHaveBeenCalled();
    expect(b.apply).toHaveBeenCalledOnce();
  });

  it("gates by group flags", () => {
    const eng = new SyncEngineImpl();
    const g = eng.createGroup({ name: "g", flags: new Set(["crosshair"]) });
    const b = member("b");
    eng.attach(g, b);
    eng.broadcast(g, { kind: "timeRange", from: 0, to: 10, sourcePanelId: "a" });
    expect(b.apply).not.toHaveBeenCalled();
  });

  it("guards re-entrancy within a broadcast", () => {
    const eng = new SyncEngineImpl();
    const g = eng.createGroup({ name: "g", flags: new Set(["crosshair"]) });
    const reentrant = member(
      "b",
      vi.fn(() => {
        // attempt to re-broadcast on the same group mid-apply
        eng.broadcast(g, { kind: "crosshair", ts: 2000, sourcePanelId: "b" });
      }),
    );
    const c = member("c");
    eng.attach(g, reentrant);
    eng.attach(g, c);
    eng.broadcast(g, { kind: "crosshair", ts: 1000, sourcePanelId: "a" });
    // c receives the original broadcast once; the nested broadcast is suppressed.
    expect(c.apply).toHaveBeenCalledOnce();
  });

  it("detach stops delivery and updates membership", () => {
    const eng = new SyncEngineImpl();
    const g = eng.createGroup({ name: "g", flags: new Set(["symbol"]) });
    const b = member("b");
    const off = eng.attach(g, b);
    off();
    eng.broadcast(g, { kind: "symbol", symbol: "Y", sourcePanelId: "a" });
    expect(b.apply).not.toHaveBeenCalled();
  });
});
