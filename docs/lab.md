# Lab — Sketch Search & Echoes

Experimental pattern-similarity analytics. Two tools, one engine: find moments in
history whose **price shape** resembles a query, and study what came next.

> Status: experimental. The math is stable and unit-tested; the surrounding API
> may still change. Pin a version.

- **Echoes** ("market déjà vu") — the query is the most recent *N* closes. It
  finds the most similar non-overlapping windows in the loaded history, highlights
  them, and projects the **median of what happened next** forward from the last
  bar.
- **Sketch Search** — the query is a freehand shape you draw across the chart. It
  is resampled to a clean series and matched against history the same way.

Both compare on **z-normalized** closes (mean 0, unit std), so only the *shape*
matters — look-alikes are found across different price levels and volatility
regimes. Distance is plain euclidean; lower = more similar.

## Quick start (React)

```tsx
import { ChartView, SketchSearchButton, EchoesPanel } from "@getcandlekit/charts/react";
import "@getcandlekit/charts/styles.css";

<ChartView data={bars} sketch echoes={{ windowLen: 30, horizon: 30, k: 8 }}>
  <SketchSearchButton />  {/* toggle, then drag a shape across the chart */}
  <EchoesPanel />         {/* Scan → bands + median projection + stats */}
</ChartView>;
```

`sketch` and `echoes` each accept `true` (defaults), an options object, or are
omitted to disable. `<ChartView>` constructs the plugins, registers them, and
surfaces them on the chart API (`useChartApi().sketch` / `.echoes`).

## Quick start (vanilla)

The plugins are framework-free `ChartPlugin`s — bring your own UI.

```ts
import { ChartController, EchoesController, SketchSearchController } from "@getcandlekit/charts";

const chart = new ChartController(el);
chart.setData(bars);

// Echoes
const echoes = new EchoesController({ windowLen: 30, horizon: 30, k: 8 });
chart.use(echoes);
const off = echoes.subscribe((scan) => {
  if (scan) console.log(scan.stats); // { count, upCount, medianEndPct, bestEndPct, worstEndPct, horizon }
});
echoes.run();

// Sketch Search
const sketch = new SketchSearchController({ onResult: (r) => console.log(r?.matches) });
chart.use(sketch);
sketch.setActive(true); // arm; drag a freehand shape, release to search
```

## Pure math (no chart)

All quant is dependency-free and operates on plain arrays — usable in a worker,
a backtest, or a server.

```ts
import { zNormalize, findSimilar, buildEchoScan, resampleStroke } from "@getcandlekit/charts";

zNormalize([1, 2, 3, 4, 5]);                 // → mean 0, unit std; [] empty, all-zeros if flat

findSimilar(closes, closes.slice(-30), {     // slide a 30-bar query over `closes`
  k: 5,                                       // up to 5 matches, best first
  minGap: 30,                                 // non-overlap (default = query length)
  excludeTail: 30,                            // ignore windows ending in the last 30 bars
  minScore: 0.7,                              // optional gate: drop windows below this correlation
});                                           // → [{ startIndex, endIndex, distance }]

buildEchoScan(bars, /*windowLen*/ 30, /*horizon*/ 30, /*k*/ 8); // → EchoScan | null

resampleStroke(points, 48);                  // freehand {x,y}[] → 48 evenly-spaced values (y inverted)
```

`buildEchoScan` returns `null` when parameters are nonsensical (`windowLen < 2`,
`horizon < 1`, `k < 1`) or there is too little history (`< windowLen * 3`).

## API

### `EchoesController`

| Member | Description |
|---|---|
| `new EchoesController(opts?)` | `opts`: `windowLen` (30), `horizon` (30), `k` (8), `autoRerun` (false), `projectionColor`, `highlightColors`, `onScan`. |
| `run(): EchoScan \| null` | Scan the current bars and render bands + projection. |
| `setConfig({ windowLen?, horizon?, k? })` | Update params; re-runs if a scan is already shown. |
| `clear()` | Remove bands + projection. |
| `subscribe(cb): () => void` | Get scans (fires immediately with the current value). |
| `getScan(): EchoScan \| null` | Latest scan. |

With `autoRerun: true` the scan recomputes on every data change after the first
`run()`.

### `SketchSearchController`

| Member | Description |
|---|---|
| `new SketchSearchController(opts?)` | `opts`: `queryLength` (48, clamped to history), `k` (10), `minScore` (0.7), `minHorizontalProgress` (0.7), `strokeColor`, `highlightColors`, `onResult`. |
| `setActive(active)` | Arm/disarm capture. Disarming clears the stroke + matches. |
| `isActive()` | Current arm state. |
| `clear()` | Wipe stroke + matches. |
| `subscribe(cb): () => void` | Get results (`{ query, matches }` or `null`). |
| `getResult()` | Latest result. |

A `SketchMatch` carries `startIndex` / `endIndex`, `distance`, and `startTime` /
`endTime` (epoch ms) for the matched window.

### React components

- `<SketchSearchButton label? icon? className? style? />` — a toggle that arms
  the controller and shows a match-count badge. Renders nothing if `sketch` is
  not enabled on the chart.
- `<EchoesPanel defaultWindowLen? defaultHorizon? className? style? />` — control
  row (window / horizon / Scan / Clear), an outcome strip (echoes, up-rate,
  median / best / worst), the projected median path, and per-echo aftermath
  sparklines. Renders nothing if `echoes` is not enabled.

Both subscribe to their controller and re-render on results. Style via the
`.ck-lab-*` / `.ck-spark*` classes in `styles.css` (theme-driven `--ck-*` vars).

## Notes & limits

- **Shape, not magnitude.** z-normalization discards level and scale; two windows
  with the same path but different volatility match closely.
- **Sketch strictness.** Sketch Search gates results two ways: `minScore` (default
  0.7) drops windows that don't correlate with the drawn shape, so a shape that
  resembles nothing returns nothing; and `minHorizontalProgress` (default 0.7)
  rejects loops/scribbles that backtrack horizontally (a circle isn't a
  left-to-right price shape). Raise `minScore` for fewer, tighter matches.
- **Not a prediction.** The projection is the empirical median of what followed
  similar pasts — it assumes the future keeps drawing from the same distribution.
  Regime changes and news are invisible to it.
- **The projection extends the time scale.** Echoes adds future-timestamped points
  to a transient line series, so the chart's right edge grows to fit the horizon.
  `shiftVisibleRangeOnNewBar` is off, so it won't yank the viewport.
- **One series, two band sets.** Running Sketch and Echoes at once layers both
  highlight primitives; treat them as separate modes if that's confusing.

See [examples/lab](../examples/lab) for a runnable demo, and
[ARCHITECTURE.md](../ARCHITECTURE.md#lab-layer-srclab) for the design.
