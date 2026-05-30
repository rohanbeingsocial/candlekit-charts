# Examples

Five standalone Vite apps that exercise `@candlekit/charts`. Each consumes the
library straight from `../../src` via a Vite alias (see `shared/vite.shared.ts`),
so **no build of the library is required** — just run an example.

| Folder | Demonstrates | Stack |
| --- | --- | --- |
| `vanilla/` | `ChartController`, series types, theme toggle | Vanilla TS |
| `react/` | `<ChartView>`, series + timeframe + theme | React |
| `indicators/` | bundled indicator catalog + `<IndicatorPicker>` | React |
| `drawing/` | line tools + `<DrawingToolbar>` + measurement | React |
| `replay/` | deterministic replay + `<ReplayControls>` | React |

## Run one

```bash
cd examples/react      # or vanilla | indicators | drawing | replay
npm install
npm run dev            # Vite dev server → http://localhost:5173
```

## Extra install for optional runtimes

- **indicators/** — `npm install` already pulls `lightweight-charts-indicators`
  and `oakscriptjs` (MIT, on npm).
- **drawing/** — pulls the MPL-2.0 line-tools from GitHub (declared in its
  `package.json`). If your environment can't reach GitHub, the demo shows a
  friendly message and the rest of the chart still works.

## Note on `generateBars`

All demos use `shared/sampleData.ts`, a synthetic random walk — no network and no
production data. Swap it for your own `BarDataSource` / `ReplayDataSource` to wire
real data.
