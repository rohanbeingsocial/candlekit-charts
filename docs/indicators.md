# Indicators

Indicators are a registry of pure `calculate` functions plus render metadata. The
`IndicatorController` is a `ChartPlugin` that reconciles active indicators into
lightweight-charts series, panes, price lines, and markers. The built-in catalog
is original MIT code — no third-party indicator runtime.

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

- **overlay** → drawn on the price pane (SMA, EMA, WMA, VWAP, Bollinger).
- **oscillator** → drawn in a new sub-pane (RSI, MACD, ATR, Stochastic).
- **pattern** → emits markers, no plotted line.

`IndicatorBar.time` is epoch **seconds** (lightweight-charts unit); the controller
converts your ms bars automatically.

## Built-in catalog

`createBuiltinRegistry()` returns a registry pre-loaded with: **SMA, EMA, WMA,
VWAP, Bollinger Bands, RSI, MACD, ATR, Stochastic** (`BUILTIN_INDICATORS`).

```ts
import { IndicatorController, createBuiltinRegistry } from "@getcandlekit/charts";

const registry = createBuiltinRegistry();
const indicators = new IndicatorController(registry);
chart.use(indicators);

indicators.add("RSI", { length: 14 });
indicators.add("EMA", { length: 21 });
indicators.toggle("MACD");
console.log(indicators.activeNames());
```

## React

```tsx
import { ChartView, IndicatorPicker } from "@getcandlekit/charts/react";

<ChartView data={bars} indicators={indicators}>
  <IndicatorPicker />
</ChartView>;
```

The picker lists `indicators.available()` grouped by category and toggles via the
controller.

## Writing a custom indicator

Any object matching `IndicatorDef` registers — this is the extension point:

```ts
import { createBuiltinRegistry } from "@getcandlekit/charts";

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

// Mix built-in + custom:
const registry = createBuiltinRegistry().register(donchian);
```

Adapting definitions shaped like other libraries' indicators? `defFromRaw(name,
raw)` converts a `{ calculate, metadata, plotConfig, ... }` object into an
`IndicatorDef`.

## Histograms, price lines, markers

- A `plotConfig` entry with `style: "histogram"` (or `"columns"`) renders as a
  histogram; per-point `color` is honored (MACD does this).
- `hlineConfig` entries become price lines on the first plot (RSI 30/70,
  Stochastic 20/80, MACD 0).
- For `category: "pattern"`, return `markers: MarkerDef[]` from `calculate`.

## Lifecycle notes

- `add`/`remove`/`toggle` trigger a reconcile that diff-updates existing series
  and adds/removes only what changed.
- On `setSeriesType` the controller's plugins are re-initialized, so indicators
  survive a candlestick→line switch.
- `calculate` runs on the current bars (already at the active interval); if it
  throws, that indicator is skipped — the chart never crashes.
