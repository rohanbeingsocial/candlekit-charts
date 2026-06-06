# Changelog

All notable changes to `@getcandlekit/charts` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/) and this project adheres
to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Per-plot indicator colors** — `ActiveIndicator` gains a `colors` map (overrides
  keyed by `PlotConfig.id`); new `IndicatorController.setColors(name, colors)`
  re-styles live series in place without recomputing. The React `<IndicatorPicker>`
  shows a color swatch per plot for active indicators (minor — additive API).

## [0.1.0] — Unreleased

Initial public release. Extracted and generalized from a production trading
dashboard into a standalone, framework-agnostic charting toolkit.

### Added

- **Core charting** — `ChartController` over lightweight-charts: candlestick,
  OHLC bars, line, area, and volume series; light/dark themes with full color
  override; responsive auto-sizing; live `updateBar`.
- **Data utilities** — pure `toBars`, `resample`, `floorToBucket` with
  session-aware bucket alignment (`sessionOpenMinutes`); fixed-offset time helpers.
- **Drawing tools** — original, built-in `DrawingEngine` + `DrawingPrimitive` +
  `DrawingController` (a `ChartPlugin`) on lightweight-charts canvas primitives:
  trend line, ray, extended line, horizontal/vertical line, arrow, rectangle,
  circle, Fibonacci retracement; selection, drag, lock, persistence. No
  third-party drawing runtime.
- **Indicators** — `IndicatorRegistry` + `IndicatorController` with an original
  built-in catalog (`createBuiltinRegistry`: SMA, EMA, WMA, VWAP, RSI, MACD,
  Bollinger Bands, ATR, Stochastic); custom indicators via `register`. No
  third-party indicator runtime.
- **Measurement** — Shift-drag `MeasurementController` + `RulerPrimitive` (price,
  percentage, bar-distance, time-delta, risk/reward helper).
- **Replay** — deterministic `ReplayController` with per-day LRU cache,
  prefetch, play/pause/step/seek/speed, and per-bar event hooks.
- **Sync** — multi-group `SyncEngine` (time range, crosshair, interval, cursor,
  symbol, date).
- **Plugin + event system** — `ChartPlugin` / `PluginContext` / typed `EventBus`.
- **React bindings** (`/react`) — `ChartView`, `DrawingToolbar`,
  `IndicatorPicker`, `ReplayControls`, `useChartController`, `useChartApi`.
- ESM + CJS builds with type declarations for both entries (`.` core and
  `./react`); tree-shakeable. `lightweight-charts` is the only external runtime.

[0.1.0]: https://github.com/rohanbeingsocial/candlekit-charts/releases/tag/v0.1.0
