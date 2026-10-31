# Changelog

All notable changes to `@getcandlekit/charts` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/) and this project adheres
to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Drawing drag stability** — body movement now translates anchors through
  logical chart coordinates instead of adding raw timestamps, so drawings stay
  visible across market gaps and preserve their geometry after pan/scale
  changes. `DrawingController` also exposes an optional `onDiagnostic` sink for
  pointer and coordinate-conversion troubleshooting.
- **Whitespace drawing anchors** — drawings can now be placed, rendered, and
  hit-tested between or just beyond loaded candles using continuous logical
  coordinates. The implementation does not add placeholder bars or a series,
  so drawing objects remain independent of chart autoscaling.
- **Replay tail truncation** — `ChartController.truncateData(length)` updates
  the price and volume series without invoking indicator/plugin `onData`
  callbacks, allowing hosts to move the replay cursor backward without a full
  indicator refresh.

## [0.2.1] — 2026-10-20

### Fixed

- **Replay: a series with no bars on the picked day no longer drags the cursor
  back.** With several series in a manifest, one that has nothing at or after
  `manifest.start` used to vote with its own fallback (the open of *its* latest
  cached day), so the min parked the initial cursor before every cached day of
  the series that do have the date and they sliced to nothing. Only series
  with a bar at or after the start now vote; when none has one (a non-session
  date) the fallback takes the latest cached day across series, not the
  earliest.
- **`<ChartContextMenu>` stays inside the viewport.** Opened near the bottom or
  right edge, or made tall by many `extraItems`, the menu used to hang
  off-screen; it is now clamped 4px inside its window.

## [0.2.0] — 2026-09-25

First npm release since 0.1.0 (the `v0.1.1` git tag was never published; its
changes are included here).

### Added

- **Lab — Sketch Search + Echoes** (experimental pattern-similarity analytics).
  Pure, dependency-free math (`zNormalize`, `findSimilar`, `buildEchoScan`,
  `resampleStroke`) computed on z-normalized closes. **Echoes** ("market déjà
  vu") finds historical look-alikes of the recent window, bands them, and
  projects the median aftermath forward; **Sketch Search** matches a freehand
  stroke against history. Ships as chart plugins (`EchoesController`,
  `SketchSearchController`) with shared overlay primitives, plus React
  `<EchoesPanel>` / `<SketchSearchButton>` and `sketch` / `echoes` props on
  `<ChartView>`. New `examples/lab` demo (additive API).
- **Per-plot indicator colors** — `ActiveIndicator` gains a `colors` map (overrides
  keyed by `PlotConfig.id`); new `IndicatorController.setColors(name, colors)`
  re-styles live series in place without recomputing. The React `<IndicatorPicker>`
  shows a color swatch per plot for active indicators (minor — additive API).
- **Live-edge follower** — `attachLiveEdgeFollower(chart, series, opts)` plus the
  pure `liveEdgeFollowRange` / `liveGutterBars` keep the newest bar in frame as
  live bars append, without ever pulling a user who scrolled into history
  forward. Append-only, at-the-edge-only, shift-relative (zoom and gutter are
  preserved bar-for-bar); a jump larger than `maxAppendSlots` is treated as a
  data reload and ignored. Wired through the new `<ChartView followLiveEdge>`
  prop. `ChartController`'s default `rightOffset` moves 5 → 10 so a forming
  candle is never flush against the price axis.
- **`liveBucketMs(tickMs, intervalMinutes, opts)`** — buckets a live tick to the
  start of the candle its interval owns, honouring `sessionOpenMinutes`. Using a
  plain minute floor on a 5m/15m chart spawns a new one-minute bar every minute
  instead of growing the bucket that is forming.
- **Replay: driver series, injectable scheduler, load progress.** A coarse
  intraday series now also materializes a finer driver series
  (`minuteDrivers` / `driverInterval`, default `1m`), so the cursor advances one
  driver bar at a time and `getBarsUpToCursor` returns the newest coarse bar
  *forming* rather than printed complete. `ReplayEngineOptions.scheduler`
  (`ReplayScheduler`) replaces the built-in timers, so a background-throttled
  document cannot slow playback. `ReplayState.loading` gains an optional
  `progress { startedAt, done, total, step }`, surfaced by `<ReplayControls>`.
  Also fixed: an in-flight day fetch is now *joined* rather than dropped;
  playback awaits one forward-prefetch pass before declaring the end (it used to
  halt at day boundaries at high speed); a manifest start with no bars falls back
  to the open of the latest cached day instead of parking at the end of the data;
  Play at the cached tail restarts the session instead of no-oping; the two
  "no bars" failures now report distinguishable messages. **Behaviour change:**
  `setSpeed` clamps to `[0.1, 100]` (was `[0.1, 64]`).
- **Sticky measurement ruler.** A press-and-release *click* now leaves the ruler
  armed and tracking the pointer with the button up (releasing the modifier no
  longer cancels it); the next click freezes it, a further click dismisses it. A
  *drag* still finishes on release. `MeasurementOptions` gains `onArmedChange`
  and `sticky` (default `true`, pass `false` for the old drag-only behaviour),
  `MeasurementController.isArmed()`, and a `measureArmed` chart-bus event.
  `<ChartView>` locks the drawing engine while armed so the click that finalises
  a ruler cannot grab a drawing underneath it.
- **`CrosshairMarkerPrimitive`** — a vertical guide for mirroring a crosshair
  across linked charts. Unlike `setCrosshairPosition` it renders regardless of
  the receiving chart's data coverage, and its x is interpolated gap-aware
  between bracketing bars (exported separately as `interpolateCoordinate`) so it
  stays correct across charts of different bar densities.
- **Point marker: fractional placement.** `SyncEvent<"pointMarker">` gains
  `frac` (0 = left plot edge, 1 = right), `PointMarkerController.setPoint`
  accepts `{ frac }`, `onCatch` reports it, and `getFraction()` reads it back —
  so linked charts show the caught instant at the same *screen position*, not
  merely centred.
- **Indicator legend + value scanning.** `IndicatorController` gains
  `legendEntries()`, `valuesAt(tsMs | null)` (resolved from its own plot series,
  so it works for a programmatically-positioned crosshair, which
  lightweight-charts reports no series values for) and `subscribe()`. New React
  `<IndicatorLegend>` renders the readout, writing per-bar numbers straight to
  the DOM off the crosshair path. Also new: `lineToIndicatorBars()` to run
  close-sourced indicators over a plain value line, and `paneKeyRegistry`
  (`indicatorPaneKeys`, `PRIMARY_PANE_KEY`, `paneKeyOf`) mapping an oscillator
  series to its pane.
- **Indicator persistence** — `IndicatorControllerOptions` gains
  `storageKey` / `kv`, mirroring `DrawingController`: the active set is restored
  on `init` and saved on every mutation. Unknown names and corrupt payloads
  degrade to an empty set.
- **`<ChartContextMenu>`** — right-click menu acting on what is under the cursor:
  clone / restyle / delete the selected drawing, remove an active indicator, plus
  caller-supplied `extraItems` so a host can add its own actions without the
  library knowing what they are. Opens only when it has something to offer.
- **Multi-window (detached panel) support.** New `ownerWindowOf` /
  `ownerDocumentOf`; every window-level listener in the package
  (`DrawingController`, `MeasurementController`, `PointMarkerController`,
  `SketchSearchController`, `SplitPane`, `IndicatorPicker`) now binds to the
  chart's *own* window instead of the module-scope one, so a chart rendered into
  a second browser window no longer goes deaf to `mouseup` / `keydown`. In
  `/react/workspace`: `PanelWindowProvider` + `usePanelWindow` /
  `usePanelDocument` / `usePortalContainer` / `useIsDetachedPanel`, the
  `detachLayout` helpers (`WORKSPACE_GLOBAL_ATTRS`, `TAB_MULTI_WINDOW_ATTRS`,
  `stampTabAttributes`, `withWorkspaceGlobals`, `splitSubLayouts`,
  `withSubLayouts`), and a `FlexLayoutAdapter` `DetachApi`
  (`detachPanel` / `reattachAll` / `pendingDetachedCount` / `restoreDetached`)
  behind `supportsDetach` / `detachUrl` / `onDetachApi`. Detached windows are
  parked out of the hydrated model — rehydrating them means a synchronous
  `window.open`, which popup blockers reject outside a gesture — and merged back
  into every save so the arrangement is never silently lost.
- **`PanelDefinition.hidden`** — keeps a legacy `kind` alias resolvable by the
  panel factory while leaving it out of the Add-Panel menu.
- **`useChartTheme(overrides?)`** — the resolved `ChartTheme` for the document's
  current light/dark mode, so several chart hosts on one page cannot drift apart.
- **`<IndicatorPicker iconOnly>`** for tight chrome. Its numeric param inputs now
  keep local text state, so clearing a field or typing `0.` on the way to `0.5`
  is no longer reverted by the NaN guard, and `min` / `max` / `step` from
  `InputConfig` are honoured.
- `KVStore` / `localStorageKV` moved to `dom/kv` so the indicator controller can
  share the drawing backend. Both are still re-exported from their original
  module — no change to the public surface.

### Changed

- `ReplayController.setSpeed` now clamps to **100x** (was 64x). Widening only —
  every previously accepted speed still behaves identically. The higher ceiling
  matches the playback loop the coalescing back-pressure rewrite was measured
  against, where the cursor holds until the previous read settles and skipped
  steps are counted rather than queued, so the controller no longer degrades
  into an unbounded fetch backlog at high speed.

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
