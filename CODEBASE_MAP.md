# Codebase Map

A tour of the repository for contributors and agents: directory structure, core
modules, the dependency graph, and how data + events flow.

## Directory structure

```
chart-lib/
├── src/
│   ├── index.ts                  Core barrel (framework-agnostic public API)
│   ├── core/
│   │   ├── types.ts              Bar, Interval, SeriesType, ChartTheme, …
│   │   ├── data.ts               toBars, resample, floorToBucket  (pure)
│   │   ├── time.ts               fixed-offset helpers, dateOf/timeOf
│   │   └── theme.ts              light/dark presets, resolveTheme, buildThemeOptions
│   ├── events/eventBus.ts        Typed EventBus
│   ├── plugins/types.ts          ChartPlugin, PluginContext, ChartEventMap
│   ├── chart/ChartController.ts  Imperative LWC wrapper (the hub)
│   ├── data-source/types.ts      BarDataSource / StreamingDataSource / ReplayDataSource
│   ├── drawing/                  Original engine — no third-party runtime
│   │   ├── types.ts              Drawing model, DrawingToolId, TOOL_POINTS, FIB_LEVELS
│   │   ├── geometry.ts           Pixel-space hit-test helpers
│   │   ├── DrawingEngine.ts       Pure model + state + events + export/import
│   │   ├── DrawingPrimitive.ts    ISeriesPrimitive renderer (all tools + handles)
│   │   ├── DrawingController.ts   ChartPlugin: pointer/keyboard interaction
│   │   └── persistence.ts         KVStore + localStorage adapter
│   ├── measurement/
│   │   ├── types.ts               MeasurementPoint/Result, RiskReward
│   │   ├── ChartCoordinateUtils.ts resolvePoint, computeMeasurement, computeRiskReward
│   │   ├── RulerPrimitive.ts       Canvas series primitive
│   │   └── MeasurementController.ts Shift-drag plugin
│   ├── indicators/               Original catalog — no third-party runtime
│   │   ├── types.ts               IndicatorDef/Result/Bar
│   │   ├── registry.ts            IndicatorRegistry + defFromRaw
│   │   ├── builtin.ts             BUILTIN_INDICATORS + createBuiltinRegistry
│   │   └── IndicatorController.ts  Series/pane/marker lifecycle plugin
│   ├── replay/
│   │   ├── types.ts               ReplayManifest/State/Controller
│   │   └── ReplayController.ts     Deterministic cursor engine + LRU cache
│   ├── sync/
│   │   ├── types.ts               SyncEvent/Flag/Group/Member
│   │   └── SyncEngine.ts          Multi-group, re-entrancy-guarded broadcaster
│   ├── feed/                      Broker-agnostic data layer (in core entry)
│   │   ├── types.ts               MarketDataProvider/RealtimeFeed/HistoricalFeed/BrokerProvider
│   │   ├── aggregator.ts          TickAggregator (tick→OHLC)
│   │   ├── reconnect.ts           withReconnect (backoff + resubscribe)
│   │   └── MockFeed.ts            Synthetic provider for dev/tests
│   ├── ml/
│   │   └── types.ts               MLPlugin/FeatureGenerator/SignalProvider/PredictionOverlay
│   ├── lab/                       Pattern-similarity analytics (in core entry)
│   │   ├── types.ts               SimilarityMatch/EchoResult/EchoScan/StrokePoint
│   │   ├── similarity.ts          zNormalize, findSimilar, buildEchoScan, resampleStroke (pure)
│   │   ├── MatchHighlightPrimitive.ts  window bands (ISeriesPrimitive, shared)
│   │   ├── SketchStrokePrimitive.ts    live freehand stroke (pixel-space)
│   │   ├── SketchSearchController.ts    ChartPlugin: draw → search → highlight
│   │   └── EchoesController.ts          ChartPlugin: déjà-vu scan + forward projection
│   ├── indicators-tv/             Optional entry (peer: lightweight-charts-indicators)
│   │   └── index.ts               registerTradingViewIndicators / createFullIndicatorRegistry
│   └── react/                     React bindings (second build entry)
│       ├── index.ts               React barrel (re-exports core + components)
│       ├── ChartView.tsx          Declarative chart + plugin host
│       ├── context.ts             ChartContext / useChartApi
│       ├── DrawingToolbar.tsx
│       ├── IndicatorPicker.tsx
│       ├── ReplayControls.tsx
│       ├── SketchSearchButton.tsx  Lab: sketch toggle + match badge
│       ├── EchoesPanel.tsx         Lab: scan controls + stats + sparklines
│       ├── SplitPane.tsx          Resizable two-pane split (nest for grids)
│       ├── hooks/useChartController.ts
│       └── hooks/usePageTheme.ts  Reflect <html data-theme> into React
├── tests/                        Vitest unit tests (data, replay, sync, events)
├── examples/                     Standalone Vite demo apps
├── docs/                         Long-form documentation
├── reports/                      OSS-readiness / licensing / migration reports
├── styles.css                    Optional overlay-component styles
└── (config) package.json · tsconfig.json · tsup.config.ts · vitest.config.ts · eslint.config.js
```

Four build entries (`index`, `react/index`, `react/workspace/index`,
`indicators-tv/index`), each with a `package.json` `exports` key. The feed + ml
layers ship inside the core `index` entry (pure, dependency-free).

## Core modules

- **`ChartController`** — owns the lightweight-charts instance, the main series,
  the volume series, the theme, and the plugin set. Everything imperative funnels
  through it. Converts ms↔seconds at the boundary.
- **`EventBus`** — synchronous, typed, error-isolated. The shared `ChartEventMap`
  is how plugins observe data/theme/range/crosshair/drawing/replay changes.
- **Engines** — `DrawingController`, `IndicatorController`, `MeasurementController`,
  `ReplayController`, `SyncEngine`. Each is independent and testable; the first
  three are `ChartPlugin`s, the last two are standalone.
- **`core/data`** — the only place bars are normalized/resampled; pure, no chart.

## Dependency graph

```
            ┌────────────┐
            │  src/core  │  (types, data, time, theme)  ← no deps
            └─────▲──────┘
        ┌─────────┼───────────┬───────────────┐
   events      data-source   plugins        (pure engines: replay→data-source, sync→core)
        │          │           │
        └────►  chart/ChartController  ◄── plugins (drawing, indicators, measurement)
                        ▲
                  src/react (ChartView, hooks, components)
```

Rule: imports flow **downward** only. `react` may import anything; `core` imports
nothing internal. The only external runtime is `lightweight-charts` (peer);
drawing and indicators are self-contained.

## Data flow

```
raw rows ──► core/data.resample/toBars ──► Bar[] ──► ChartController.setData
   │                                                     │
   │                                              series.setData (ms→s)
   │                                                     │
   └──► (live) ChartController.updateBar(bar) ───────────┘
                                                          │
                                          bus.emit("data") ─► plugins.onData()
```

Replay swaps the source: `ReplayController` reads days from a `ReplayDataSource`,
advances a cursor, and emits `ReplayBarEvent`s the host pipes into
`ChartController.updateBar`.

## Event flow

```
user pans/zooms ─► LWC timeScale ─► ChartController ─► bus.emit("rangeChange")
user moves mouse ─► LWC crosshair ─► ChartController ─► bus.emit("crosshairMove")
drawing edited   ─► DrawingController ─► bus.emit("drawingChange") + persist
indicator toggled─► IndicatorController.add/remove ─► reconcile series/panes
replay tick      ─► ReplayController.subscribe/onBar ─► host updates chart
multi-chart      ─► SyncEngine.broadcast(event) ─► members.apply(event)
```

`SyncEngine` is intentionally decoupled from `ChartController`: a host wires a
chart's viewport into a `SyncMember` and chooses which flags
(`timeRange | crosshair | interval | cursor | symbol | date`) a group mirrors.
