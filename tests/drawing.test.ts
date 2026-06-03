import { describe, it, expect } from "vitest";
import { DrawingEngine } from "../src/drawing/DrawingEngine";
import { TOOL_POINTS } from "../src/drawing/types";

const p = (time: number, price: number) => ({ time, price });

describe("TOOL_POINTS", () => {
  it("registers the multi-point tools with the right anchor counts", () => {
    expect(TOOL_POINTS.CrossLine).toBe(1);
    expect(TOOL_POINTS.HorizontalRay).toBe(1);
    expect(TOOL_POINTS.PriceRange).toBe(2);
    expect(TOOL_POINTS.DateRange).toBe(2);
    expect(TOOL_POINTS.Triangle).toBe(3);
    expect(TOOL_POINTS.ParallelChannel).toBe(3);
    expect(TOOL_POINTS.FibExtension).toBe(3);
  });
});

describe("DrawingEngine N-point placement", () => {
  it("appendDraftPoint locks the preview and starts a new one", () => {
    const e = new DrawingEngine();
    e.startTool("Triangle");
    e.beginDraft("Triangle", p(1, 10)); // [a, preview]
    expect(e.getDraft()?.points).toHaveLength(2);

    e.appendDraftPoint(p(2, 20)); // lock b, new preview → [a, b, preview]
    expect(e.getDraft()?.points).toHaveLength(3);
    expect(e.getDraft()?.points[1]).toEqual(p(2, 20));

    e.updateDraftEnd(p(3, 30)); // move preview
    expect(e.getDraft()?.points[2]).toEqual(p(3, 30));
  });

  it("commit promotes the draft to a finished 3-anchor drawing", () => {
    const e = new DrawingEngine();
    e.beginDraft("ParallelChannel", p(1, 10));
    e.appendDraftPoint(p(2, 20));
    const draft = e.getDraft()!;
    e.commit({ ...draft, points: [p(1, 10), p(2, 20), p(2, 15)] });
    expect(e.getDraft()).toBeNull();
    const all = e.getDrawings();
    expect(all).toHaveLength(1);
    expect(all[0].points).toHaveLength(3);
    expect(all[0].tool).toBe("ParallelChannel");
  });
});
