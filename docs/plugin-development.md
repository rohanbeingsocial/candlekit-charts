# Plugin Development

Everything beyond the base chart is a plugin — including the built-in drawing,
indicators, and measurement. Writing your own works the same way.

## The contract

```ts
interface ChartPlugin {
  readonly id: string;                 // unique; dedupes on use()
  init(ctx: PluginContext): void;      // chart + series exist here
  onThemeChange?(theme: ChartTheme): void;
  onData?(bars: readonly Bar[]): void; // data (re)applied
  destroy(): void;                     // release everything you created
}

interface PluginContext {
  chart: IChartApi;                    // lightweight-charts instance
  series: ISeriesApi<…>;               // the main price series
  bus: EventBus<ChartEventMap>;        // shared event bus
  theme: ChartTheme;
  getBars(): readonly Bar[];           // current bars at the active interval
}
```

Register: `controller.use(plugin)`. Remove: `controller.remove(plugin.id)`.
`destroy()` is called on remove and on `controller.destroy()`.

## Example: a custom series overlay

```ts
import { LineSeries, type ISeriesApi, type Time } from "lightweight-charts";
import type { ChartPlugin } from "@candlekit/charts";

export function vwapAnchored(): ChartPlugin {
  let line: ISeriesApi<"Line"> | null = null;

  const recompute = (ctx: { chart: any; getBars: () => any[] }) => {
    let pv = 0, vol = 0;
    const pts = ctx.getBars().map((b: any) => {
      const typical = (b.high + b.low + b.close) / 3;
      pv += typical * (b.volume ?? 0);
      vol += b.volume ?? 0;
      return { time: (b.ts / 1000) as Time, value: vol ? pv / vol : typical };
    });
    line?.setData(pts);
  };

  return {
    id: "vwap-anchored",
    init(ctx) {
      line = ctx.chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 2 });
      recompute(ctx as any);
      ctx.bus.on("data", () => recompute(ctx as any));
    },
    destroy() {
      // controller.destroy removes series; for explicit remove, clean up here.
      line = null;
    },
  };
}

chart.use(vwapAnchored());
```

## Example: react to the event bus

```ts
const crosshairReadout: ChartPlugin = {
  id: "crosshair-readout",
  init(ctx) {
    const off = ctx.bus.on("crosshairMove", (p) => {
      if (p) document.title = `${p.price.toFixed(2)} @ ${new Date(p.ts).toISOString()}`;
    });
    (this as any)._off = off;
  },
  destroy() {
    (this as any)._off?.();
  },
};
```

`ChartEventMap` events you can subscribe to: `data`, `theme`, `rangeChange`,
`crosshairMove`, `drawingChange`, `replayCursor`. You can also emit your own
custom keys (the map has an index signature) for plugin-to-plugin messaging.

## Guidelines

- **Idempotent `id`.** `use()` ignores a duplicate id.
- **Own your teardown.** Remove every series/primitive/listener in `destroy()`.
- **Survive series swaps.** On `setSeriesType` the controller re-inits plugins
  (calls `destroy()` then `init()`), so don't cache a stale `series` ref across
  that boundary — read it from the fresh `ctx`.
- **Stay pure where possible.** Heavy math belongs in a pure helper you can test;
  the plugin just wires it to the chart.
- **Don't fight autoscale.** Add overlay series to the price scale; put separate
  magnitudes on their own `priceScaleId` or a new pane (`chart.addPane()`).

## Packaging a plugin

A plugin can live in your app or ship as its own package depending only on
`@candlekit/charts` (peer) + `lightweight-charts` (peer). Export a factory
(`(options) => ChartPlugin`) for ergonomics — that is the `ChartPluginFactory<O>`
type.
