# Migration Notes

For maintainers of the original dashboard who want to consume `@candlekit/charts`
instead of the in-tree chart code, and a record of what changed during extraction.

## What moved where

| Original (in-app) | Library import |
| --- | --- |
| `components/chart/ChartCanvas.tsx` | `ChartController` + `<ChartView>` (`@candlekit/charts` / `/react`) |
| `components/chart/chartData.ts` | `toBars`, `resample`, `floorToBucket`, `applyFixedOffset`, `dateOf`, `timeOf` |
| `components/chart/engine/DrawingEngine.ts` | `DrawingEngine` + `DrawingPlugin` + `createLineToolsDrawingPlugin` (`/drawing-linetools`) |
| `components/chart/indicators/*` | `IndicatorRegistry`, `IndicatorController`, `createOakscriptRegistry` (`/indicators-oakscript`), `<IndicatorPicker>` |
| `components/chart/measurement/*` | `MeasurementController`, `RulerPrimitive`, `computeMeasurement`, `computeRiskReward` |
| `packages/replay-engine` | `createReplayController`, `ReplayController*` types |
| `packages/sync-engine` | `createSyncEngine`, `SyncEngine*` types |
| `packages/chart-engine` (contracts) | `core/types`, `plugins/types`, `data-source/types` |
| `DrawingToolbar`, `DrawingManager`, keyboard glue | `<DrawingToolbar>` + `DrawingEngine` events |

## Breaking changes vs. the original

1. **Time unit.** Public API is **epoch ms**. The app's "fake-UTC" trick (adding
   the IST offset at the wire boundary) is now an explicit, optional step:
   `bars.map(b => ({ ...b, ts: applyFixedOffset(b.ts, 330) }))`. The library does
   not assume IST.
2. **Resampler anchor.** The hard-coded NSE 09:15 open is now
   `resample(rows, n, { sessionOpenMinutes: 9*60 + 15 })`. Default is `0` (UTC
   midnight). Weekly/monthly are **not** produced by client resampling — supply
   them pre-aggregated from your CAGGs/source (same constraint as before, now
   explicit).
3. **Drawing runtime injected.** `ChartCanvas` imported the difurious classes
   directly. Now you either use `createLineToolsDrawingPlugin()` (which lazy-loads
   them) or implement `LineToolsRuntime`. The engine no longer hard-depends on the
   MPL packages.
4. **Indicators decoupled from `oakscriptjs`.** The registry takes any
   `IndicatorDef`. Use `createOakscriptRegistry()` for the old bundled catalog.
5. **No shadcn/Radix/lucide.** Toolbar/picker/controls are dependency-light and
   styled via `.ck-*` CSS. Wire your own UI if you prefer (the controllers are the
   real API).
6. **Sync `expiry` flag removed.** The options-specific `expiry` sync kind is gone.
   Generic flags remain: `timeRange | crosshair | interval | cursor | symbol |
   date`. If you need expiry-sync, broadcast it as `date` or a custom channel.
7. **No data fetching.** The library never calls your API. Implement
   `BarDataSource` / `StreamingDataSource` / `ReplayDataSource` to bridge your
   existing endpoints.

## Drop-in equivalents

Old (app):
```tsx
<ChartCanvas chartId="x" rawData={rows} interval={iv} onIntervalChange={...}
             drawingStorageKey="drawings.x" />
```

New:
```tsx
const drawing = await createLineToolsDrawingPlugin({ storageKey: "drawings.x" });
<ChartView data={rows} resampleMinutes={iv.minutes}
           resampleOptions={{ sessionOpenMinutes: 9*60 + 15 }}
           drawing={drawing}>
  <DrawingToolbar />
</ChartView>
```

## Behaviour preserved

- Autoscale fits once on first non-empty paint; later updates keep pan/zoom.
- `toBars` still drops null/NaN/≤0 OHLC and sorts/dedupes (LWC ascending-time
  requirement).
- Replay determinism, LRU/prefetch, and sync re-entrancy guards are byte-for-byte
  the same algorithms.
- The measurement ruler renders identically (same canvas primitive, colors
  configurable).

## Recommended adoption path

1. Replace `chartData` imports with the library's data utilities first (pure,
   low-risk).
2. Swap `ChartCanvas` for `ChartView` on one standalone player page.
3. Move drawing/indicators to the plugin form.
4. Keep the options-analytics charts in-app — they were intentionally not
   extracted (see [excluded-files.md](./excluded-files.md)).
