# Changelog

All notable changes to `@candlekit/charts` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/) and this project adheres
to [Semantic Versioning](https://semver.org/).

## [0.1.0] — Unreleased

Initial public release. Extracted and generalized from a production trading
dashboard into a standalone, framework-agnostic charting toolkit.

### Added

- **Core charting** — `ChartController` over lightweight-charts: candlestick,
  OHLC bars, line, area, and volume series; light/dark themes with full color
  override; responsive auto-sizing; live `updateBar`.
- **Data utilities** — pure `toBars`, `resample`, `floorToBucket` with
  session-aware bucket alignment (`sessionOpenMinutes`); fixed-offset time helpers.
- **Drawing framework** — runtime-agnostic `DrawingEngine` + `DrawingPlugin`;
  optional MPL line-tools adapter (`/drawing-linetools`) with trend line, ray,
  extended line, horizontal/vertical line, arrow, cross-line, rectangle, circle,
  Fibonacci retracement; selection, lock, magnet-snap, persistence.
- **Indicator framework** — `IndicatorRegistry` + `IndicatorController`; optional
  bundled catalog (`/indicators-oakscript`: SMA, EMA, WMA, VWAP, RSI, MACD,
  Bollinger Bands, ATR, Stochastic, …); custom indicators via `register`.
- **Measurement** — Shift-drag `MeasurementController` + `RulerPrimitive` (price,
  percentage, bar-distance, time-delta, risk/reward helper).
- **Replay** — deterministic `ReplayController` with per-day LRU cache,
  prefetch, play/pause/step/seek/speed, and per-bar event hooks.
- **Sync** — multi-group `SyncEngine` (time range, crosshair, interval, cursor,
  symbol, date).
- **Plugin + event system** — `ChartPlugin` / `PluginContext` / typed `EventBus`.
- **React bindings** (`/react`) — `ChartView`, `DrawingToolbar`,
  `IndicatorPicker`, `ReplayControls`, `useChartController`, `useChartApi`.
- ESM + CJS builds with type declarations; tree-shakeable subpath entries.

[0.1.0]: https://github.com/candlekit/charts/releases/tag/v0.1.0
