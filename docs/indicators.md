# Indicators

Indicators are a registry of pure `calculate` functions plus render metadata. The
`IndicatorController` is a `ChartPlugin` that reconciles active indicators into
lightweight-charts series, panes, price lines, and markers.

## The model

```ts
interface IndicatorDef {
  name: string;            // unique id
  title: string;           // display name
  shortTitle: string;
  category: "overlay" | "oscillator" | "pattern";
  calculate(bars: IndicatorBar[], inputs?): IndicatorResult;
  defaultInputs: Record<string, unknown>;
  inputConfig: InputConfig[];
  plotConfig: PlotConfig[];   // one entry per plotted line/histogram
  hlineConfig: HLineConfig[]; // horizontal guide lines
}
```

- **overlay** → drawn on the price pane (e.g. SMA, EMA, VWAP, Bollinger).
- **oscillator** → drawn in a new sub-pane (e.g. RSI, MACD, Stochastic).
- **pattern** → emits markers, no plotted line.

`IndicatorBar.time` is epoch **seconds** (lightweight-charts unit); the controller
converts your ms bars automatically.

## Using the bundled set

```ts
import { IndicatorController } from "@candlekit/charts";
import { createOakscriptRegistry } from "@candlekit/charts/indicators-oakscript";

const registry = await createOakscriptRegistry(); // SMA, EMA, WMA, VWAP, RSI,
                                                  // MACD, Bollinger, ATR, Stoch, …
const indicators = new IndicatorController(registry);
chart.use(indicators);

indicators.add("RSI", { length: 14 });
indicators.add("EMA", { length: 21 });
indicators.toggle("MACD");
console.log(indicators.activeNames());
```

> Requires `npm i lightweight-charts-indicators oakscriptjs`. These are MIT and
> on npm. The exact catalog is whatever that package version exports — the
> registry auto-discovers every compatible definition.

## React

```tsx
import { ChartView, IndicatorPicker } from "@candlekit/charts/react";

<ChartView data={bars} indicators={indicators}>
  <IndicatorPicker />
</ChartView>;
```

The picker lists `indicators.available()` grouped by category and toggles via the
controller.

## Writing a custom indicator

Any object matching `IndicatorDef` registers — this is the extension point:

```ts
import { IndicatorRegistry } from "@candlekit/charts";

const donchian: IndicatorDef = {
  name: "Donchian",
  title: "Donchian Channels",
  shortTitle: "DC",
  category: "overlay",
  defaultInputs: { length: 20 },
  inputConfig: [{ name: "length", type: "int", defval: 20 }],
  plotConfig: [
    { id: "upper", color: "#26a69a" },
    { id: "lower", color: "#ef5350" },
  ],
  hlineConfig: [],
  calculate(bars, inputs) {
    const n = Number(inputs?.length ?? 20);
    const upper: { time: number; value: number }[] = [];
    const lower: { time: number; value: number }[] = [];
    for (let i = n - 1; i < bars.length; i++) {
      const w = bars.slice(i - n + 1, i + 1);
      upper.push({ time: bars[i].time, value: Math.max(...w.map((b) => b.high)) });
      lower.push({ time: bars[i].time, value: Math.min(...w.map((b) => b.low)) });
    }
    return { plots: { upper, lower } };
  },
};

const registry = new IndicatorRegistry().register(donchian);
```

Mix custom + bundled:

```ts
const registry = await createOakscriptRegistry();
registry.register(donchian);
```

## Histograms, price lines, markers

- A `plotConfig` entry with `style: "histogram"` (or `"columns"`) renders as a
  histogram; per-point `color` is honored.
- `hlineConfig` entries become price lines on the first plot (e.g. RSI 30/70).
- For `category: "pattern"`, return `markers: MarkerDef[]` from `calculate`; the
  controller renders them via the series-markers plugin.

## Lifecycle notes

- `add`/`remove`/`toggle` trigger a reconcile that diff-updates existing series
  and adds/removes only what changed.
- On `setSeriesType` the controller's plugins are re-initialized, so indicators
  survive a candlestick→line switch.
- `calculate` runs on the current bars (already at the active interval); throwing
  is caught and that indicator is skipped, never crashing the chart.
