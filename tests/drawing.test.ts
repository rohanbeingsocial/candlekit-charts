import { describe, it, expect } from "vitest";
import { DrawingEngine } from "../src/drawing/DrawingEngine";
import { DRAWING_TOOL_GROUPS, DRAWING_TOOL_ICONS } from "../src/drawing/icons";
import { DEFAULT_TOOL_STYLES, FIB_LEVELS, TOOL_POINTS } from "../src/drawing/types";

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
    expect(TOOL_POINTS.FibChannel).toBe(3);
    expect(TOOL_POINTS.Pitchfork).toBe(3);
    expect(TOOL_POINTS.RotatedRectangle).toBe(3);
    expect(TOOL_POINTS.XABCDPattern).toBe(5);
    expect(TOOL_POINTS.Text).toBe(1);
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

  it("supports the new one-point annotation tools without changing the model", () => {
    const e = new DrawingEngine();
    e.startTool("Text");
    e.beginDraft("Text", p(1, 10));
    e.commit({
      id: e.newDrawingId(),
      tool: "Text",
      points: [p(1, 10)],
      style: e.getDefaultStyle(),
      text: { value: "Note" },
    });

    expect(e.getById(e.getSelectedId()!)?.text?.value).toBe("Note");
    expect(e.export()).toContain('"value":"Note"');
  });

  it("duplicates a drawing with a new id and an explicit offset", () => {
    const e = new DrawingEngine();
    e.commit({
      id: e.newDrawingId(),
      tool: "TrendLine",
      points: [p(1, 10), p(2, 20)],
      style: e.getDefaultStyle("TrendLine"),
    });

    const original = e.getDrawings()[0];
    const copy = e.duplicate(original.id, { timeOffset: 5, priceOffset: 2 });

    expect(copy).not.toBeNull();
    expect(copy?.id).not.toBe(original.id);
    expect(copy?.points).toEqual([p(6, 12), p(7, 22)]);
    expect(e.getSelectedId()).toBe(copy?.id);
  });

  it("increments the selection revision when the selected drawing is clicked again", () => {
    const e = new DrawingEngine();
    e.commit({
      id: e.newDrawingId(),
      tool: "TrendLine",
      points: [p(1, 10), p(2, 20)],
      style: e.getDefaultStyle("TrendLine"),
    });

    const id = e.getSelectedId()!;
    const firstRevision = e.getSelectionRevision();
    e.select(id);

    expect(e.getSelectedId()).toBe(id);
    expect(e.getSelectionRevision()).toBe(firstRevision + 1);
  });
});

describe("drawing style defaults", () => {
  it("uses the OpenAlgo-style color ladder for Fibonacci retracements", () => {
    const e = new DrawingEngine();
    const style = e.getDefaultStyle("FibRetracement");

    expect(style.color).toBe("#787b86");
    expect(style.width).toBe(1);
    expect(style.levels?.map((level) => level.ratio)).toEqual(FIB_LEVELS);
    expect(style.levels?.map((level) => level.color)).toEqual([
      "#787b86",
      "#f23645",
      "#ff9800",
      "#4caf50",
      "#089981",
      "#00bcd4",
      "#787b86",
    ]);
  });

  it("does not share mutable level objects between new drawings", () => {
    const e = new DrawingEngine();
    const first = e.getDefaultStyle("FibRetracement");
    const second = e.getDefaultStyle("FibRetracement");

    first.levels![0]!.color = "#ffffff";
    expect(second.levels![0]!.color).toBe("#787b86");
    expect(DEFAULT_TOOL_STYLES.FibRetracement?.levels?.[0]?.color).toBe("#787b86");
  });
});

describe("drawing toolbar icon registry", () => {
  it("provides a CandleKit icon for every grouped tool", () => {
    for (const group of DRAWING_TOOL_GROUPS) {
      expect(DRAWING_TOOL_ICONS[group.icon]?.path).toBeTruthy();
      for (const section of group.sections) {
        for (const tool of section.tools) {
          expect(DRAWING_TOOL_ICONS[tool.id]?.path, `${group.id}/${tool.id}`).toBeTruthy();
        }
      }
    }
  });
});
