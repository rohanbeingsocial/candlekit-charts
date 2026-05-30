# @candlekit/charts

> Tree-shakeable financial charting toolkit for the web — candlestick/OHLC/line/area/volume, drawing tools, pluggable indicators, measurement tools, and a deterministic replay engine. Framework-agnostic core with optional React bindings. Built on [Lightweight Charts™](https://github.com/tradingview/lightweight-charts).

<p align="center">
  <em>A clean, extensible layer over lightweight-charts — the orchestration you keep rewriting, packaged once.</em>
</p>

[![CI](https://github.com/candlekit/charts/actions/workflows/ci.yml/badge.svg)](https://github.com/candlekit/charts/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

---

## Overview

`@candlekit/charts` wraps lightweight-charts with the pieces a real trading UI
needs but the base library leaves to you: a stable chart controller, a
runtime-agnostic drawing engine, an extensible indicator framework, a Shift-drag
measurement ruler, multi-chart sync, and a deterministic historical replay
engine. The **core is framework-agnostic** (no React, no DOM framework); the
optional **`/react` entry** adds components and hooks.

It is **plugin-first**: drawing, indicators, and measurement are all `ChartPlugin`s,
and the optional third-party runtimes (drawing tools, indicator catalog) are
**lazy-loaded** so the core bundle never pays for what you don't use.

## Features

- **Core charting** — candlestick, OHLC bars, line, area, volume; multiple
  timeframes via a session-aware resampler; responsive auto-resize; light/dark
  themes with full color override.
- **Drawing tools** — trend line, ray, extended line, horizontal/vertical line,
  arrow, cross-line, rectangle, circle, Fibonacci retracement, with selection,
  locking, magnet-snap, and persistence. (Text/brush available through the
  pluggable runtime.)
- **Indicators** — extensible registry; the bundled set (via
  `lightweight-charts-indicators`) includes SMA, EMA, WMA, VWAP, RSI, MACD,
  Bollinger Bands, ATR, Stochastic, and more. Register your own with one call.
- **Measurement** — price, percentage, bar-distance, time-delta, and
  risk/reward, painted as a canvas ruler.
- **Replay** — deterministic playback over historical bars: play/pause, step
  ±1, speed control, seek/jump, per-bar event hooks, per-day LRU cache with
  pre-fetch.
- **Architecture** — TypeScript, fully typed public API, tree-shakeable ESM +
  CJS, event system, plugin system, and extensible data-source / indicator /
  drawing frameworks.

## Screenshots

<!-- Replace these placeholders with real captures from examples/ -->
| Candles + indicators | Drawing tools | Replay |
| --- | --- | --- |
| _![candles](docs/assets/screenshot-candles.png)_ | _![drawing](docs/assets/screenshot-drawing.png)_ | _![replay](docs/assets/screenshot-replay.png)_ |

## Installation

```bash
npm install @candlekit/charts lightweight-charts
# React bindings (optional):
npm install react react-dom
```

Optional runtimes (lazy-loaded; install only if you use them):

```bash
# Bundled indicator catalog
npm install lightweight-charts-indicators oakscriptjs

# Drawing tools (MPL-2.0, git-hosted — not on npm)
npm install \
  github:difurious/lightweight-charts-line-tools-core \
  github:difurious/lightweight-charts-line-tools-lines \
  github:difurious/lightweight-charts-line-tools-rectangle \
  github:difurious/lightweight-charts-line-tools-circle \
  github:difurious/lightweight-charts-line-tools-fib-retracement
```

## Quick Start

### Vanilla JS / TypeScript

```ts
import { ChartController, toBars } from "@candlekit/charts";

const el = document.getElementById("chart")!;
const chart = new ChartController(el, { theme: "dark", seriesType: "candlestick" });

chart.setData(toBars(myRows)); // myRows: { ts, open, high, low, close, volume }[]
```

### React

```tsx
import { ChartView } from "@candlekit/charts/react";
import "@candlekit/charts/styles.css";

export function App({ bars }) {
  return (
    <div style={{ height: 480 }}>
      <ChartView data={bars} seriesType="candlestick" theme="dark" />
    </div>
  );
}
```

## Basic Examples

**Switch series type and timeframe:**

```ts
chart.setSeriesType("area");       // candlestick | ohlc | line | area
chart.setData(resample(rows, 5));  // 5-minute candles from 1-minute rows
chart.setTheme("light");
```

**Live updates:**

```ts
ws.onBar((bar) => chart.updateBar(bar)); // appends or replaces the last bar
```

## Advanced Examples

**Session-aware resampling** (align buckets to a 09:30 market open instead of UTC midnight):

```ts
import { resample } from "@candlekit/charts";
const candles = resample(rows, 15, { sessionOpenMinutes: 9 * 60 + 30 });
```

**Fixed-offset exchange time** (render an always-UTC+5:30 market in wall-clock):

```ts
import { applyFixedOffset } from "@candlekit/charts";
const shifted = rows.map((r) => ({ ...r, ts: applyFixedOffset(r.ts, 330) }));
```

## Replay Examples

```ts
import { createReplayController } from "@candlekit/charts";

const replay = createReplayController();
replay.onBar((e) => chart.updateBar(e.bar));
await replay.load({
  id: "demo",
  series: [{ symbol: "AAPL", interval: "1m" }],
  start: Date.parse("2024-01-02T14:30:00Z"),
  end: Date.parse("2024-01-03T21:00:00Z"),
  source: myReplayDataSource, // implements ReplayDataSource
});
replay.setSpeed(8);
replay.play();
```

React transport bar:

```tsx
import { ReplayControls } from "@candlekit/charts/react";
<ReplayControls controller={replay} />
```

## Drawing Tool Examples

```tsx
import { ChartView, DrawingToolbar } from "@candlekit/charts/react";
import { createLineToolsDrawingPlugin } from "@candlekit/charts/drawing-linetools";

const drawing = await createLineToolsDrawingPlugin({ storageKey: "drawings:AAPL" });

<ChartView data={bars} drawing={drawing}>
  <DrawingToolbar />
</ChartView>;
```

## Indicator Examples

```tsx
import { ChartView, IndicatorPicker, IndicatorController } from "@candlekit/charts/react";
import { createOakscriptRegistry } from "@candlekit/charts/indicators-oakscript";

const registry = await createOakscriptRegistry();
const indicators = new IndicatorController(registry);
indicators.add("RSI", { length: 14 });

<ChartView data={bars} indicators={indicators}>
  <IndicatorPicker />
</ChartView>;
```

Register a **custom indicator** (the extension point):

```ts
import { IndicatorRegistry } from "@candlekit/charts";

const registry = new IndicatorRegistry().register({
  name: "PriceMid",
  title: "HL/2",
  shortTitle: "MID",
  category: "overlay",
  defaultInputs: {},
  inputConfig: [],
  plotConfig: [{ id: "mid", color: "#f59e0b" }],
  hlineConfig: [],
  calculate: (bars) => ({
    plots: { mid: bars.map((b) => ({ time: b.time, value: (b.high + b.low) / 2 })) },
  }),
});
```

## Plugin Examples

```ts
import type { ChartPlugin } from "@candlekit/charts";

const lastPriceLabel: ChartPlugin = {
  id: "last-price-label",
  init(ctx) {
    ctx.bus.on("data", ({ bars }) => {
      const last = bars[bars.length - 1];
      if (last) console.log("last close", last.close);
    });
  },
  destroy() {},
};

chart.use(lastPriceLabel);
```

## API Overview

| Export | Kind | Purpose |
| --- | --- | --- |
| `ChartController` | class | Imperative chart wrapper (data, series type, theme, plugins, events). |
| `toBars`, `resample`, `floorToBucket` | fn | Pure data normalization + session-aware resampling. |
| `resolveTheme`, `lightTheme`, `darkTheme` | fn/const | Theme presets + resolution. |
| `EventBus` | class | Typed sync event bus. |
| `DrawingEngine`, `DrawingPlugin` | class | Runtime-agnostic drawing facade + plugin. |
| `IndicatorRegistry`, `IndicatorController` | class | Extensible indicator framework. |
| `MeasurementController`, `RulerPrimitive` | class | Shift-drag measurement. |
| `createReplayController` | fn | Deterministic replay. |
| `createSyncEngine` | fn | Multi-chart sync. |
| `ChartView` *(/react)* | component | Declarative chart + plugin host. |

Full reference: [docs/api-reference.md](docs/api-reference.md).

## Performance Notes

- Single offset conversion at the data boundary; drawings/replay stay in one
  coordinate domain (no per-render timezone math).
- `setData` autoscale fits once on the first non-empty paint; later updates
  preserve user pan/zoom.
- Replay uses a per-day LRU cache with backward/forward pre-fetch; the cursor
  drives everything (no wall-clock coupling).
- Tree-shakeable subpath entries — vanilla bundles never pull React; drawing /
  indicator runtimes are lazy `import()`ed only when enabled.

## Browser Support

Evergreen browsers (Chrome, Edge, Firefox, Safari) with Canvas + ResizeObserver.
ESM and CJS builds are shipped; `target: es2020`.

## Roadmap

- [ ] First-class text & freehand/brush drawing components
- [ ] Indicator settings UI (param editing) in the React picker
- [ ] Crosshair tooltip component
- [ ] Vue / Svelte bindings
- [ ] Screenshot/export helper

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [AGENTS.md](./AGENTS.md). In short:
`npm install`, `npm run typecheck && npm run lint && npm run test && npm run build`.

## License

MIT — see [LICENSE](./LICENSE). Third-party attributions in [NOTICE](./NOTICE).
"Lightweight Charts™" is a trademark of TradingView, Inc.; this project is not
affiliated with TradingView.
