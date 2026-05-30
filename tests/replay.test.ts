import { describe, it, expect, beforeEach } from "vitest";
import { ReplayControllerImpl } from "../src/replay/ReplayController";
import type { ReplayDataSource } from "../src/data-source/types";
import type { Bar } from "../src/core/types";

const MIN = 60_000;

/** Build a day's worth of 1-minute bars. */
function day(date: string, count: number): Bar[] {
  const start = Date.parse(`${date}T09:30:00Z`);
  return Array.from({ length: count }, (_, i) => ({
    ts: start + i * MIN,
    open: 100 + i,
    high: 100 + i + 1,
    low: 100 + i - 1,
    close: 100 + i,
    volume: 1,
  }));
}

const DAYS: Record<string, Bar[]> = {
  "2024-01-02": day("2024-01-02", 5),
  "2024-01-03": day("2024-01-03", 5),
};
const ORDER = ["2024-01-02", "2024-01-03"];

const source: ReplayDataSource = {
  async fetchDay(_s, _i, date) {
    return DAYS[date] ?? [];
  },
  async listDatesBefore(_s, _i, date, n) {
    const idx = ORDER.indexOf(date);
    return ORDER.slice(Math.max(0, idx - n), idx).reverse();
  },
  async listDatesAfter(_s, _i, date, n) {
    const idx = ORDER.indexOf(date);
    return idx < 0 ? [] : ORDER.slice(idx + 1, idx + 1 + n);
  },
};

describe("ReplayControllerImpl", () => {
  let rc: ReplayControllerImpl;

  beforeEach(async () => {
    rc = new ReplayControllerImpl();
    await rc.load({
      id: "t",
      series: [{ symbol: "X", interval: "1m" }],
      start: Date.parse("2024-01-02T09:30:00Z"),
      end: Date.parse("2024-01-03T09:34:00Z"),
      source,
    });
  });

  it("loads to ready at the first bar", () => {
    const s = rc.getState();
    expect(s.status).toBe("ready");
    if (s.status !== "ready") return;
    expect(s.cursor.ts).toBe(Date.parse("2024-01-02T09:30:00Z"));
  });

  it("steps forward and back deterministically", () => {
    const bars: number[] = [];
    rc.onBar((e) => bars.push(e.bar.close));
    rc.step(1);
    rc.step(1);
    rc.step(-1);
    const s = rc.getState();
    if (s.status !== "ready") throw new Error("not ready");
    // forward to idx 1 (101), forward to idx 2 (102), back to idx 1 (101).
    // emitBarsAt fires on every landing bar regardless of direction.
    expect(s.cursor.ts).toBe(Date.parse("2024-01-02T09:31:00Z"));
    expect(bars).toEqual([101, 102, 101]);
  });

  it("getBarsUpToCursor includes the cursor bar", () => {
    rc.step(1);
    rc.step(1);
    const upto = rc.getBarsUpToCursor("X", "1m");
    expect(upto).toHaveLength(3); // bars 0,1,2
    expect(upto[upto.length - 1].close).toBe(102);
  });

  it("clamps speed to [0.1, 64]", () => {
    rc.setSpeed(1000);
    let s = rc.getState();
    if (s.status === "ready") expect(s.speed).toBe(64);
    rc.setSpeed(0);
    s = rc.getState();
    if (s.status === "ready") expect(s.speed).toBe(0.1);
  });

  it("seek jumps the cursor", async () => {
    const target = Date.parse("2024-01-02T09:33:00Z");
    rc.seek(target);
    await new Promise((r) => setTimeout(r, 0));
    const s = rc.getState();
    if (s.status === "ready") expect(s.cursor.ts).toBe(target);
  });
});
