import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../src/events/eventBus";

interface Events {
  tick: { n: number };
  done: void;
  [key: string]: unknown;
}

describe("EventBus", () => {
  it("fans out to all listeners", () => {
    const bus = new EventBus<Events>();
    const a = vi.fn();
    const b = vi.fn();
    bus.on("tick", a);
    bus.on("tick", b);
    bus.emit("tick", { n: 1 });
    expect(a).toHaveBeenCalledWith({ n: 1 });
    expect(b).toHaveBeenCalledWith({ n: 1 });
  });

  it("unsubscribe stops delivery", () => {
    const bus = new EventBus<Events>();
    const a = vi.fn();
    const off = bus.on("tick", a);
    off();
    bus.emit("tick", { n: 1 });
    expect(a).not.toHaveBeenCalled();
  });

  it("once fires a single time", () => {
    const bus = new EventBus<Events>();
    const a = vi.fn();
    bus.once("tick", a);
    bus.emit("tick", { n: 1 });
    bus.emit("tick", { n: 2 });
    expect(a).toHaveBeenCalledTimes(1);
  });

  it("isolates listener errors", () => {
    const bus = new EventBus<Events>();
    const bad = vi.fn(() => {
      throw new Error("boom");
    });
    const good = vi.fn();
    bus.on("tick", bad);
    bus.on("tick", good);
    expect(() => bus.emit("tick", { n: 1 })).not.toThrow();
    expect(good).toHaveBeenCalled();
  });

  it("clear removes listeners", () => {
    const bus = new EventBus<Events>();
    const a = vi.fn();
    bus.on("tick", a);
    bus.clear("tick");
    bus.emit("tick", { n: 1 });
    expect(a).not.toHaveBeenCalled();
  });
});
