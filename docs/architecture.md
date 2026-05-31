# Architecture

## Design goals

1. **Framework-agnostic core.** All chart logic works without React. The React
   layer is a thin, optional wrapper.
2. **Plugin-first.** Drawing, indicators, and measurement are plugins; you add
   your own the same way.
3. **Tree-shakeable.** Vanilla users never pull React; side-effect-free modules
   let consumers who skip drawing or indicators drop that code at bundle time.
4. **One time domain.** Public API is epoch-ms; the only conversion to
   lightweight-charts' epoch-seconds happens inside `ChartController`.
5. **Deterministic replay.** The cursor — not wall-clock — drives replayed state.

## Layers

```
┌──────────────────────────────────────────────────────────────┐
│  React bindings  (src/react)   — ChartView, hooks, overlays    │  optional
├──────────────────────────────────────────────────────────────┤
│  Plugins  — DrawingController · IndicatorController · Measurement │
│            · your ChartPlugin                                  │
├──────────────────────────────────────────────────────────────┤
│  ChartController  (src/chart)  — owns lightweight-charts + bus │  the hub
├──────────────────────────────────────────────────────────────┤
│  Engines  — ReplayController · SyncEngine  (standalone)        │
├──────────────────────────────────────────────────────────────┤
│  Core  (src/core, events, plugins/types, data-source/types)    │  no runtime deps
└──────────────────────────────────────────────────────────────┘
                         ▼ resolves at consumer
              lightweight-charts (peer) — the only runtime dependency
```

## The hub: ChartController

`ChartController` is the single imperative surface:

- Creates the chart, the main series (per `seriesType`), and the volume series.
- Owns the resolved `Charttheme` and re-applies it on `setTheme`.
- Holds the plugin set; `use()`/`remove()` manage lifecycle. On `setSeriesType`
  it re-creates the main series and re-inits plugins that hold a series ref.
- Bridges lightweight-charts events to the typed `EventBus`
  (`rangeChange`, `crosshairMove`) and emits `data` / `theme`.
- Converts epoch-ms ↔ epoch-seconds at this boundary and nowhere else.

## Plugins + event bus

A `ChartPlugin` receives a `PluginContext` (`chart`, `series`, `bus`, `theme`,
`getBars()`). Plugins read state from the bus and contribute events back. The bus
is synchronous and error-isolated: a throwing listener never blocks siblings.

This is the seam that keeps the controller small: drawing/indicators/measurement
are not special-cased in the controller — they are plugins like any you write.

## Self-contained drawing & indicators

Drawing tools and indicators are **original implementations** that ship in the
core — no third-party drawing or indicator runtime, nothing extra to install.

- **Drawing** (`src/drawing/*`): a `DrawingController` (pointer/keyboard) over a
  pure `DrawingEngine` (model + events) rendered by a `DrawingPrimitive`
  (`ISeriesPrimitive` on the chart canvas).
- **Indicators** (`src/indicators/*`): an `IndicatorRegistry` + built-in catalog
  (`createBuiltinRegistry`) of pure `calculate` functions, reconciled onto
  lightweight-charts series/panes by `IndicatorController`.

The only external runtime is **`lightweight-charts`** (a peer). `sideEffects` is
limited to CSS, so unused modules tree-shake out and a vanilla bundle never
pulls React.

## Coordinate / time model

- Public timestamps: **epoch ms** everywhere.
- lightweight-charts renders the **UTC components** of a timestamp and has no
  timezone option. To show a fixed-offset exchange in wall-clock, shift each
  bar's `ts` once with `applyFixedOffset(ts, offsetMinutes)` at your data
  boundary. Drawings, replay cursor, and sync all live in that shifted domain and
  stay positionally correct — there is exactly one conversion point.
- The resampler aligns intraday buckets to `sessionOpenMinutes` (default 0 = UTC
  midnight) and collapses day+ buckets per calendar day.

## Why a wrapper at all?

lightweight-charts is excellent but low-level: it gives you series and a canvas.
Drawing tools, an indicator framework, a measurement ruler, multi-chart sync, and
deterministic replay are left to the app — and every trading UI re-implements
them. This library is that layer, extracted and generalized, with a stable typed
API and no backend assumptions.
