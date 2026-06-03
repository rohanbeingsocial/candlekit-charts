# API Reference

Generated descriptions of the public surface. Types are authoritative in the
shipped `.d.ts`; this is the prose companion. Import paths:

- `@getcandlekit/charts` — core (everything below except React components)
- `@getcandlekit/charts/react` — React components/hooks (+ re-exports of core)

---

## Core types (`core/types`)

- `Bar` — `{ ts, open, high, low, close, volume? }`, `ts` in epoch ms.
- `RawBar` — loose bar (nullable OHLC) accepted by `toBars`/`resample`.
- `SeriesType` — `"candlestick" | "ohlc" | "line" | "area"`.
- `Interval` — `{ label, minutes }`.
- `ResampleOptions` — `{ sessionOpenMinutes? }`.
- `ChartTheme` — resolved color palette.
- `Timestamp`, `SymbolId`, `IntervalCode`, `ChartId` — branded aliases.

## Data (`core/data`)

| Function | Signature | Notes |
| --- | --- | --- |
| `toBars(rows)` | `(RawBar[]) => Bar[]` | Validate, sort, dedupe. Drops null/NaN/≤0 OHLC. |
| `resample(rows, minutes, opts?)` | `(RawBar[], number, ResampleOptions?) => Bar[]` | Session-aware OHLCV aggregation. |
| `resampleInterval(rows, interval, opts?)` | — | `resample` by an `Interval`. |
| `floorToBucket(ts, minutes, opts?)` | `=> number` | Bucket start for a ts. |

## Time (`core/time`)

`applyFixedOffset(ts, offsetMinutes)`, `stripFixedOffset(ts, offsetMinutes)`,
`dateOf(ts) → "YYYY-MM-DD"`, `timeOf(ts) → "HH:MM"`.

## Theme (`core/theme`)

`lightTheme`, `darkTheme` constants; `resolveTheme(input) → ChartTheme`
(`input`: `"light" | "dark" | ChartTheme | Partial<ChartTheme>`);
`buildThemeOptions(theme) → object` (lightweight-charts options subset).

## `ChartController` (`chart/ChartController`)

```ts
new ChartController(container: HTMLElement, options?: ChartControllerOptions)
```

`ChartControllerOptions`: `{ theme?, seriesType?, showVolume?, autoFit?, chartOptions? }`.

| Method | Purpose |
| --- | --- |
| `setData(bars)` | Replace the full data set. |
| `updateBar(bar)` | Append or update the last bar (live tick). |
| `setSeriesType(type)` | Swap candlestick/ohlc/line/area. |
| `setTheme(input)` | Re-theme. |
| `use(plugin)` / `remove(id)` | Add/remove a `ChartPlugin`. |
| `getChart()` / `getSeries()` / `getBars()` / `getTheme()` | Accessors. |
| `fitContent()` | Fit the time scale. |
| `destroy()` | Tear down chart + plugins + bus. |
| `bus` | The `EventBus<ChartEventMap>`. |

## `EventBus` (`events/eventBus`)

`on(event, fn) → off`, `once(event, fn)`, `emit(event, payload)`,
`clear(event?)`. `ChartEventMap` events: `data`, `theme`, `rangeChange`,
`crosshairMove`, `drawingChange`, `replayCursor`.

## Plugins (`plugins/types`)

```ts
interface ChartPlugin {
  readonly id: string;
  init(ctx: PluginContext): void;
  onThemeChange?(theme): void;
  onData?(bars): void;
  destroy(): void;
}
interface PluginContext { chart; series; bus; theme; getBars(): readonly Bar[]; }
```

## Drawing

- `DrawingController(opts?)` — `ChartPlugin`. `opts`: `{ engine?, storageKey?, kv?, hitTolerance? }`.
  Exposes `.engine`.
- `DrawingEngine` — model + state + events: `startTool(id)`, `stopTool()`,
  `getActiveTool()`, `getDrawings()`, `getById()`, `setPoints()`, `setStyle()`,
  `setDefaultStyle()`, `select()`, `getSelectedId()`, `removeSelected()`,
  `remove(id)`, `removeAll()`, `setLocked()`, `isLocked()`, `export()`,
  `import()`, `onChange(cb)`.
- `DrawingPrimitive` — the `ISeriesPrimitive` that renders the model.
- `Drawing`, `DrawingPoint`, `DrawingStyle`, `DrawingToolId`, `TOOL_POINTS`, `FIB_LEVELS`, `DEFAULT_STYLE`.
- geometry: `distToSegment`, `distToLine`, `distToRay`, `distToRectEdges`, `distToEllipse`, `pointInRect`.
- `saveDrawings/loadDrawings`, `localStorageKV`, `KVStore`.

## Indicators

- `IndicatorRegistry` — `register(def)`, `registerAll(defs)`, `get`, `has`, `list`,
  `byCategory()`.
- `IndicatorController(registry, { onChange? })` — `ChartPlugin`. `add(name, params?)`,
  `remove(name)`, `toggle(name)`, `activeNames()`, `available()`.
- `createBuiltinRegistry(into?)` — registry pre-loaded with `BUILTIN_INDICATORS`
  (SMA, EMA, WMA, VWAP, Bollinger, RSI, MACD, ATR, Stochastic).
- `defFromRaw(name, raw)` — adapt an externally-shaped indicator def.
- `IndicatorDef` — `{ name, title, shortTitle, category, calculate, defaultInputs, inputConfig, plotConfig, hlineConfig }`.

## Measurement

- `MeasurementController(opts?)` — `ChartPlugin`. `opts`: `{ modifier?, colors?, onMeasure? }`.
  `clear()`.
- `RulerPrimitive(colors?)` — lightweight-charts series primitive.
- `resolvePoint`, `computeMeasurement`, `computeRiskReward`.
- `MeasurementResult` — `{ start, end, priceDiff, pricePct, barCount, timeDiffSeconds, direction }`.

## Replay

- `createReplayController(options?) → ReplayController`.
- `ReplayController` — `load(manifest)`, `unload()`, `play()`, `pause()`,
  `step(±1)`, `seek(ts)`, `setSpeed(x)`, `getState()`, `subscribe(cb)`,
  `onBar(cb)`, `getBarsUpToCursor(symbol, interval)`, `ensureSeries(symbol, interval)`.
- `ReplayManifest` — `{ id, series, start, end, source: ReplayDataSource }`.

## Sync

- `createSyncEngine() → SyncEngine`.
- `SyncEngine` — `createGroup`, `deleteGroup`, `setFlags`, `listGroups`,
  `getGroup`, `attach(groupId, member) → off`, `broadcast(groupId, event)`,
  `subscribeMembership(cb)`.
- `SyncFlag` — `"timeRange" | "crosshair" | "interval" | "cursor" | "symbol" | "date"`.

## Data sources (`data-source/types`)

`BarDataSource { fetchBars }`, `StreamingDataSource extends + subscribe`,
`ReplayDataSource { fetchDay, listDatesBefore, listDatesAfter }`.

## React (`/react`)

- `<ChartView data … />` — props: `data`, `resampleMinutes?`, `resampleOptions?`,
  `seriesType?`, `theme?`, `showVolume?`, `autoFit?`, `chartOptions?`, `drawing?`,
  `indicators?`, `measurement?`, `onReady?`, `className?`, `style?`, `children`.
- `<DrawingToolbar />`, `<IndicatorPicker />` — read the enclosing `ChartView` via context.
- `<ReplayControls controller={…} />`.
- `useChartController(options) → { containerRef, controller }`.
- `useChartApi()` / `useChartApiOptional()` — access `{ controller, drawing, indicators, measurement }`.
