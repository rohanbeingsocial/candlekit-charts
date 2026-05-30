# Replay System

Deterministic playback over historical bars. The **cursor timestamp is the only
source of truth** — wall-clock is consulted solely to pace UI emission, so a run
is reproducible regardless of machine speed.

## Concepts

- **Manifest** — what to replay: series, `[start, end]` window, and a
  `ReplayDataSource`.
- **Cursor** — `{ ts, seq }`. `seq` increments every advance; `ts` only moves to
  real bar timestamps.
- **Window** — earliest/latest ts currently cached (drives the seek slider).
- **Per-day LRU cache** — bars are fetched a day at a time, with backward prefetch
  on load and forward prefetch as the cursor nears the tail of the current day.

## Implement a data source

```ts
import type { ReplayDataSource } from "@candlekit/charts";

const source: ReplayDataSource = {
  async fetchDay(symbol, interval, date) {
    // return Bar[] for that calendar day (epoch-ms ts)
    return api.bars(symbol, interval, date);
  },
  async listDatesBefore(symbol, interval, date, n) {
    return api.tradingDatesBefore(symbol, interval, date, n); // nearest first
  },
  async listDatesAfter(symbol, interval, date, n) {
    return api.tradingDatesAfter(symbol, interval, date, n);
  },
};
```

You own holiday/gap logic — the engine just walks the dates you return.

## Drive a chart

```ts
import { ChartController, createReplayController } from "@candlekit/charts";

const chart = new ChartController(el);
const replay = createReplayController({
  cacheDays: 8,
  prefetchBackwardDays: 2,
  prefetchForwardOnTailPct: 0.15,
});

// Pipe replayed bars into the chart.
replay.onBar((e) => chart.updateBar(e.bar));

// Seed the visible history each time the cache changes / cursor jumps.
replay.subscribe((state) => {
  if (state.status === "ready") {
    chart.setData(replay.getBarsUpToCursor("AAPL", "1m"));
  }
});

await replay.load({
  id: "session-1",
  series: [{ symbol: "AAPL", interval: "1m" }],
  start: Date.parse("2024-01-02T14:30:00Z"),
  end: Date.parse("2024-01-03T21:00:00Z"),
  source,
});

replay.setSpeed(8);
replay.play();
```

## Transport controls

| Call | Effect |
| --- | --- |
| `play()` / `pause()` | Start/stop the tick loop. |
| `step(1)` / `step(-1)` | Advance/retreat one bar (auto-pauses). |
| `seek(ts)` | Jump to a timestamp (fetches that day if needed). |
| `setSpeed(x)` | Clamp to `[0.1, 64]`; pacing ≈ `1000 / x` ms per bar. |
| `unload()` | Reset to idle, clear cache. |

React:

```tsx
import { ReplayControls } from "@candlekit/charts/react";
<ReplayControls controller={replay} speeds={[1, 2, 4, 8, 16]} />
```

## Event hooks

- `subscribe(state => …)` — full state on every transition (status, cursor,
  playing, speed, window, activeSeries, dataVersion).
- `onBar(event => …)` — fired for each newly-landed bar (`{ ts, seq, symbol,
  interval, bar }`), on forward **and** backward steps.

## Multi-timeframe / multi-symbol

`ensureSeries(symbol, interval)` materializes another series mid-session (fetches
the cursor day + backward prefetch) so switching timeframe during replay slices
from cache instead of resampling. The cursor advances across the **union** of all
active series' bar timestamps.

## Determinism guarantees

- No `Date.now()` in state math — only `setTimeout` pacing.
- Same manifest + same source ⇒ identical cursor sequence and emitted bars.
- `getBarsUpToCursor` is inclusive of the cursor bar (binary-search sliced).
