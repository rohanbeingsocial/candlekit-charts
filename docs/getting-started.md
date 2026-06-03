# Getting Started

This guide takes you from install to a working chart with data, a theme, an
indicator, drawing tools, and replay.

## 1. Install

```bash
npm install @getcandlekit/charts lightweight-charts
# React (optional):
npm install react react-dom
```

`lightweight-charts` is a **peer dependency** — you control its version. React is
an optional peer; only needed for `@getcandlekit/charts/react`.

## 2. Your data shape

Bars are plain objects with epoch-**millisecond** timestamps:

```ts
interface Bar {
  ts: number;        // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}
```

Raw rows may carry `null`/`NaN` — `toBars()` cleans, sorts, and dedupes them.

## 3. Vanilla chart

```ts
import { ChartController, toBars } from "@getcandlekit/charts";

const chart = new ChartController(document.getElementById("chart")!, {
  theme: "dark",
  seriesType: "candlestick",
  showVolume: true,
});

chart.setData(toBars(rows));
```

The container should have a height (the chart auto-sizes to it).

## 4. React chart

```tsx
import { ChartView } from "@getcandlekit/charts/react";
import "@getcandlekit/charts/styles.css"; // only if you use the overlay components

function Chart({ bars }) {
  return (
    <div style={{ height: 480 }}>
      <ChartView data={bars} seriesType="candlestick" theme="dark" />
    </div>
  );
}
```

## 5. Timeframes

Resample 1-minute rows on the fly:

```ts
import { resample } from "@getcandlekit/charts";
chart.setData(resample(rows, 15)); // 15-minute candles
```

Or in React: `<ChartView data={rows} resampleMinutes={15} />`.

For exchanges with a session open other than midnight UTC, pass
`{ sessionOpenMinutes }` so buckets align to the open (see
[replay-system.md](./replay-system.md) and the API reference).

## 6. Add an indicator

```ts
import { IndicatorController, createBuiltinRegistry } from "@getcandlekit/charts";

const indicators = new IndicatorController(createBuiltinRegistry());
chart.use(indicators);
indicators.add("EMA", { length: 21 });
```

Built-in catalog: SMA, EMA, WMA, VWAP, Bollinger, RSI, MACD, ATR, Stochastic —
plus your own. See [indicators.md](./indicators.md).

## 7. Add drawing tools

```ts
import { DrawingController } from "@getcandlekit/charts";

const drawing = new DrawingController({ storageKey: "drawings:demo" });
chart.use(drawing);
drawing.engine.startTool("TrendLine");
```

Built in — nothing extra to install. See [drawing-tools.md](./drawing-tools.md).

## 8. Replay

See [replay-system.md](./replay-system.md) for the full walkthrough.

## Next

- [Architecture](./architecture.md)
- [API Reference](./api-reference.md)
- [Plugin development](./plugin-development.md)
