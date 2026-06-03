# Examples

Six standalone Vite apps that exercise `@candlekit/charts`. Each consumes the
library straight from `../../src` via a Vite alias (see `shared/vite.shared.ts`),
so **no build of the library is required** — just run an example.

| Folder | Demonstrates | Stack |
| --- | --- | --- |
| `workspace/` | **the unified workspace** (deployed to Pages) — FlexLayout splits/syncs chart panes; each pane owns drawing tools + indicator picker + measurement ruler + per-pane replay | React |
| `vanilla/` | `ChartController`, series types, theme toggle | Vanilla TS |
| `react/` | `<ChartView>`, series + timeframe + theme | React |
| `indicators/` | built-in indicator catalog + `<IndicatorPicker>` | React |
| `drawing/` | drawing tools + `<DrawingToolbar>` + measurement | React |
| `replay/` | deterministic replay + `<ReplayControls>` | React |

Every example needs only `lightweight-charts` (+ `react` for the React ones).
Drawing and indicators are built into `@candlekit/charts` — no extra installs.
The `workspace/` app additionally pulls `flexlayout-react` (the pane splitter)
and the `lightweight-charts-indicators` catalog.

## Run one

```bash
cd examples/react      # or vanilla | indicators | drawing | replay
npm install
npm run dev            # Vite dev server → http://localhost:5173
```

## Note on `generateBars`

All demos use `shared/sampleData.ts`, a synthetic random walk — no network and no
production data. Swap it for your own `BarDataSource` / `ReplayDataSource` to wire
real data.
