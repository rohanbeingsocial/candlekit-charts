/**
 * Adapts a {@link DrawingEngine} into a {@link ChartPlugin}. Wiring a concrete
 * line-tools runtime is deferred to a `createRuntime` factory so this module
 * stays free of the optional MPL packages — see `lineToolsAdapter.ts` for the
 * bundled factory, or supply your own.
 */

import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { ChartPlugin, PluginContext } from "../plugins/types";
import { DrawingEngine } from "./DrawingEngine";
import { loadDrawings, saveDrawings, localStorageKV, type KVStore } from "./persistence";
import type { LineToolsRuntime } from "./types";

export interface DrawingPluginOptions {
  /** Factory producing a line-tools runtime bound to this chart + series. */
  createRuntime: (chart: IChartApi, series: ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area">) => LineToolsRuntime;
  /** Tool ctors to register: `[id, ctor]`. */
  tools?: Array<[string, unknown]>;
  /** Magnet snap threshold in px. Default `0` (off). */
  magnetThreshold?: number;
  /** localStorage/KV key to persist drawings. `null`/omit disables. */
  storageKey?: string | null;
  /** KV backend for persistence. Default localStorage. */
  kv?: KVStore;
}

export class DrawingPlugin implements ChartPlugin {
  readonly id = "drawing";
  private engineRef: DrawingEngine | null = null;
  private offEdit: (() => void) | null = null;

  constructor(private readonly opts: DrawingPluginOptions) {}

  /** The underlying engine — available after `init`. Drives toolbars/UI. */
  get engine(): DrawingEngine | null {
    return this.engineRef;
  }

  init(ctx: PluginContext): void {
    const runtime = this.opts.createRuntime(ctx.chart, ctx.series);
    const engine = new DrawingEngine(runtime);
    this.engineRef = engine;

    if (this.opts.tools?.length) engine.registerTools(this.opts.tools);
    engine.setMagnetThreshold(this.opts.magnetThreshold ?? 0);

    const kv = this.opts.kv ?? localStorageKV;
    if (this.opts.storageKey) loadDrawings(engine, this.opts.storageKey, kv);

    this.offEdit = engine.onAfterEdit(() => {
      if (this.opts.storageKey) saveDrawings(engine, this.opts.storageKey!, kv);
      const count = engine.getSelectedParsed().length;
      ctx.bus.emit("drawingChange", { count });
    });
  }

  destroy(): void {
    this.offEdit?.();
    this.offEdit = null;
    this.engineRef?.destroy();
    this.engineRef = null;
  }
}
