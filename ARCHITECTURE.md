# Architecture

How candlekit is put together: layers, data flow, event flow, the rendering
pipeline, and where to extend. Pairs with [CODEBASE_MAP.md](./CODEBASE_MAP.md)
(file tour) and [AGENTS.md](./AGENTS.md) (contributor + agent rules).

## Design goals

1. **One render engine.** `lightweight-charts` is the only runtime dependency.
   Everything else (drawing, indicators, measurement, replay, sync, feed) is
   original, self-contained, tree-shakeable.
2. **Downward-only imports.** `react → chart/engines → contracts → core`. Core
   imports nothing internal, so there are no cycles.
3. **One time unit.** The public API is epoch **milliseconds**; conversion to
   lightweight-charts' epoch-seconds happens only at the `ChartController`
   boundary.
4. **Imperative core, declarative shell.** The compute/render core is plain
   classes (usable from vanilla JS). React is a thin binding that creates a
   controller once and drives it imperatively — bars never flow through React
   state, so live ticks don't re-render components.

## Layer map

```
┌─────────────────────────────────────────────────────────────┐
│ react/            ChartView, hooks, overlays, workspace       │  framework binding
├─────────────────────────────────────────────────────────────┤
│ chart/            ChartController  (the ms↔s boundary, hub)   │  imperative core
│ drawing/ indicators/ measurement/  (ChartPlugins)            │
│ replay/ sync/                       (standalone engines)      │
│ feed/                               (broker-agnostic data)    │
│ lab/                                (pattern-similarity)      │
│ ml/                                 (overlay contracts)       │
├─────────────────────────────────────────────────────────────┤
│ events/ plugins/ data-source/       (contracts + bus)         │  seams
├─────────────────────────────────────────────────────────────┤
│ core/             types, data (toBars/resample), time, theme  │  pure, no deps
└─────────────────────────────────────────────────────────────┘
```

## Data flow

```
raw rows ─► core/data.toBars|resample ─► Bar[] ─► ChartController.setData
                                                        │ (ms→s, one map)
                                                 LWC series.setData
live:  tick ─► feed.TickAggregator.apply ─► Bar ─► ChartController.updateBar
                                                        │
replay: ReplayController.getBarsUpToCursor ─► Bar[] ─► setData
```

- **History**: a `HistoricalFeed`/`BarDataSource` returns `Bar[]`; the host calls
  `setData`. `core/data` is the only place bars are normalized/resampled (pure).
- **Live**: a `RealtimeFeed` emits `FeedMessage`s. `TickAggregator` folds
  tick/trade into the current bar; the host calls `updateBar` (no React, no full
  re-set). Server-OHLC feeds skip the aggregator.
- **Replay**: `ReplayController` owns a per-(symbol,interval) per-day LRU cache;
  a cursor walks bars deterministically. No look-ahead — live and replay share
  the same render path. Two host patterns:
  - **Seek/jump** → `getBarsUpToCursor()` + `setData()` (full window).
  - **Play/step** → subscribe `onBar` and call `updateBar(newBar)` per advance.
    This is **O(1) per tick** vs `setData`'s O(cursor); prefer it for playback to
    avoid O(N²) over a session.

### Performance notes

- **Live ticks** (`updateBar`) update only the last bar and fire the `onBar`
  plugin hook; `IndicatorController.onBar` recomputes but `update()`s just the
  newest plot point, so streaming never re-`setData`s a whole indicator series.
- **Heavy compute** (full indicator recompute, features, backtest) belongs off
  the render thread (Worker/WASM) for large N — the `IndicatorRegistry.calculate`
  and `FeatureGenerator` seams isolate the implementation for that swap.

## Event flow

A single synchronous, error-isolated `EventBus<ChartEventMap>` per chart:

```
LWC timeScale  ─► ChartController ─► bus.emit("rangeChange")  ─► plugins
LWC crosshair  ─► ChartController ─► bus.emit("crosshairMove")─► plugins
drawing edit   ─► DrawingController ─► bus.emit("drawingChange") + persist
data (re)set   ─► ChartController.setData ─► bus.emit("data") ─► plugin.onData()
theme change   ─► ChartController.setTheme ─► bus.emit("theme") ─► plugin.onThemeChange()
```

Cross-chart linking is a separate concern: `SyncEngine` (multi-group,
re-entrancy-guarded) broadcasts `timeRange | crosshair | cursor | …` between
charts a host wires as `SyncMember`s. It is intentionally decoupled from
`ChartController`.

## Rendering pipeline

1. `ChartController` owns the `IChartApi`, the main series, and an optional
   volume series.
2. `setData` maps `Bar[]` → LWC points once (ms→s) and calls `series.setData`.
   `updateBar` calls `series.update` for the live bar only.
3. Plugins paint via lightweight-charts **series primitives**
   (`ISeriesPrimitive`): `DrawingPrimitive`, `RulerPrimitive`, and the lab's
   `MatchHighlightPrimitive` / `SketchStrokePrimitive` project data anchors →
   pixels in `useBitmapCoordinateSpace` and draw to the overlay canvas.
   Indicators add their own LWC series/panes via `IndicatorController`;
   `EchoesController` adds a transient line series for its forward projection.
4. React overlays (`DrawingToolbar`, `IndicatorPicker`, `MeasurementOverlay`,
   `ReplayControls`, `EchoesPanel`, `SketchSearchButton`) are absolutely-
   positioned DOM over the canvas; they call the controller/engine imperatively.
   They never render bars.

**Layout & theme (kept deliberately simple).** Multi-chart layouts are just
nested `<SplitPane>`s (a ~110-line resizable split, no docking/persistence) — a
resize changes a flex-basis, so charts autosize without remounting. Theme is one
`data-theme` attribute on `<html>`: it drives the chrome vars, the `.ck-*`
overlay vars (`styles.css`: `:root` = light, `[data-theme="dark"]` = dark), and —
via `usePageTheme()` — each chart's `theme` prop. Toggling re-themes everything
at once with no remount. The `examples/drawing` demo is the canonical example of
this.

## Extension points

| Want to add… | Do this | Touches core? |
|---|---|---|
| Indicator | `registry.register(def)` or extend `createBuiltinRegistry()` | no |
| Drawing tool | id in `TOOL_POINTS` + render `case` in `DrawingPrimitive` + hit-test `case` in `DrawingController` | drawing only |
| Behavior | implement `ChartPlugin`, `controller.use(plugin)` | no |
| Data source | implement `BarDataSource`/`StreamingDataSource`/`ReplayDataSource` | no |
| Multi-chart layout | nest `<SplitPane>` (resizable, dependency-free) — no workspace manager needed | no |
| Global theme | toggle `data-theme` on `<html>`; `usePageTheme()` reflects it into panels | no |
| Broker / live feed | implement `MarketDataProvider` (`HistoricalFeed` + `RealtimeFeed`); wrap with `withReconnect`; aggregate ticks with `TickAggregator` | no |
| ML overlay | implement `MLPlugin` (`run(bars) → MLResult`), offload compute to Worker/WASM | no |
| Framework binding | mirror `src/react/` in a sibling dir + tsup entry + `exports` key | no |

## Feed / broker layer (`src/feed/`)

Transport-free contracts so the chart never depends on a specific broker:

- `MarketDataProvider` = `HistoricalFeed` + `RealtimeFeed` + `FeedCapabilities`.
- `RealtimeFeed` emits a `FeedMessage` union (`tick | trade | quote | ohlc`) with
  per-symbol `subscribe`.
- `withReconnect(factory)` wraps any feed with exponential-backoff reconnect,
  transparent resubscribe, and a unified `FeedStatus` stream.
- `TickAggregator` folds ticks/trades into OHLC bars client-side (session-anchored
  bucketing identical to the resampler).
- `MockFeed` is a zero-dep synthetic provider for demos/tests.

Real adapters (Alpaca, Binance, Dhan, Zerodha, Polygon, …) implement these
interfaces in consumer land or sibling optional packages and bring their own
transport, so `lightweight-charts` stays the only runtime dependency.

## ML layer (`src/ml/`)

Contracts only (no model runtime): `FeatureGenerator` (columnar `FeatureMatrix`,
typed-array friendly for Worker/WASM), `SignalProvider`, `MLPlugin`
(`ChartPlugin` + async `run`), `PredictionOverlay`. Performance + replay
contracts are explicit: heavy compute runs off the render thread, and every
consumer receives cursor-bounded bars (no look-ahead) so live and replay agree.

## Lab layer (`src/lab/`)

Experimental pattern-similarity analytics. Split cleanly into pure math and
chart-coupled wiring:

- **Pure** (`similarity.ts`, `types.ts`) — `zNormalize`, `findSimilar`
  (z-normalized euclidean k-NN over a sliding window, rolling-sum O(n·m)),
  `buildEchoScan` (Echoes), `resampleStroke` (freehand → clean series). No DOM,
  no chart; unit-tested in isolation and usable on any `number[]` / `Bar[]`.
- **Plugins** (`EchoesController`, `SketchSearchController`) — `ChartPlugin`s that
  read `ctx.getBars()`, run the math, and render: shared `MatchHighlightPrimitive`
  (translucent window bands) + `SketchStrokePrimitive` (live freehand). Echoes
  also projects the median aftermath as a transient dashed line series off the
  last bar. Both expose `subscribe()` and emit on the bus (`echoScan` /
  `sketchSearch`).

Similarity is computed on **z-normalized** closes (shape, not level/scale), so
look-alikes match across price regimes. The layer ships in the core entry; the
React panel/toggle live in `src/react/`.

## Build & packaging

`tsup`, three entries (`.` core, `./react`, `./react/workspace`) → ESM + CJS +
`.d.ts`. Each entry has a matching `exports` key in `package.json`.
`sideEffects: ["**/*.css"]` keeps modules tree-shakeable. The feed + ml layers
ship in the core entry (pure, dependency-free).
