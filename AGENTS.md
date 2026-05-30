# AGENTS.md

Guidance for AI coding agents (and humans) working in `@candlekit/charts`. Read
this before editing. It encodes the architecture, the rules that keep the public
API stable, and how to extend the library without breaking tree-shaking.

## Project architecture

`@candlekit/charts` is a thin, opinionated layer over
[lightweight-charts](https://github.com/tradingview/lightweight-charts). Two
rings:

1. **Core (framework-agnostic)** — `src/` minus `src/react/`. No React, no DOM
   framework, no network. Imperative `ChartController` + engines (drawing,
   indicators, measurement, replay, sync) + pure data/theme/time utilities.
2. **React bindings** — `src/react/`. Declarative `ChartView` + overlay
   components + hooks. A thin wrapper over the core; never put core logic here.

Cross-cutting concerns are **plugins** (`ChartPlugin`) and a typed **event bus**.
Optional third-party runtimes (drawing tools, indicator catalog) are **lazy
`import()`ed** from dedicated subpath entries so they never enter the core bundle.

```
data source ─► core/data (resample/normalize) ─► ChartController ─► lightweight-charts
                                                      │  ▲
                                  plugins (drawing/indicators/measurement/custom)
                                                      │
                                                  EventBus  ◄── replay / sync emit
```

## Folder responsibilities

| Path | Responsibility | May import |
| --- | --- | --- |
| `src/core/` | Pure types, data normalize/resample, theme, time. No runtime deps. | nothing (except `lightweight-charts` *types* in theme is avoided — theme returns plain objects) |
| `src/events/` | Typed `EventBus`. | nothing |
| `src/plugins/` | `ChartPlugin` + `PluginContext` + `ChartEventMap`. | `lightweight-charts` (types), `core`, `events` |
| `src/chart/` | `ChartController` — the imperative chart wrapper. | `lightweight-charts`, `core`, `events`, `plugins` |
| `src/data-source/` | `BarDataSource` / `StreamingDataSource` / `ReplayDataSource` contracts. | `core` |
| `src/drawing/` | `DrawingEngine` facade + `DrawingPlugin`; `lineToolsAdapter` is the only file touching the MPL packages. | `core`, `plugins`, `lightweight-charts` (types) |
| `src/measurement/` | Ruler primitive + `MeasurementController`. | `lightweight-charts`, `fancy-canvas` (types), `core`, `plugins` |
| `src/indicators/` | `IndicatorRegistry` + `IndicatorController`; `oakscript.ts` is the only file touching `lightweight-charts-indicators`. | `lightweight-charts`, `core`, `plugins` |
| `src/replay/` | Deterministic `ReplayController`. | `core`, `data-source` |
| `src/sync/` | Multi-chart `SyncEngine`. | `core` |
| `src/react/` | React components + hooks. | everything in core + `react` |

Dependency direction is **downward only**: `react → chart/plugins/engines → core`.
Never import `react` from core. Never import an engine from `core`.

## Coding standards

- TypeScript strict. No `any` in public signatures (internal `any` only with an
  `eslint-disable-next-line` and a comment why; see `RulerPrimitive`).
- Public API uses **epoch milliseconds**. Convert to lightweight-charts'
  epoch-seconds only at the `ChartController` boundary.
- Pure functions in `core/` — no globals, no DOM, fully unit-testable.
- Comments explain **why**, not what. Match the surrounding density.
- Prettier (`.prettierrc`) + ESLint flat config are authoritative. Run `npm run format && npm run lint`.

## Extension points

- **New indicator** → `registry.register(def)` with an `IndicatorDef`. No core
  change. See README "Indicator Examples".
- **New drawing runtime** → implement `LineToolsRuntime` (structural) and build a
  `DrawingPlugin` with your `createRuntime`. The MPL adapter is one example.
- **New data source** → implement `BarDataSource` / `StreamingDataSource` /
  `ReplayDataSource`.
- **New behavior** → write a `ChartPlugin` and `controller.use(plugin)`. It gets
  the chart, series, theme, bus, and current bars via `PluginContext`.
- **New framework binding** → mirror `src/react/` in a sibling dir + add a tsup
  entry + an `exports` subpath. Do not fold framework code into core.

## Public API rules

1. The barrels (`src/index.ts`, `src/react/index.ts`) define the public surface.
   Anything not re-exported there is internal and may change without notice.
2. Adding exports is a minor version; changing/removing them is a major.
3. Keep optional runtimes out of `src/index.ts`. They live only in their subpath
   entries (`drawing-linetools`, `indicators-oakscript`) and load via dynamic
   `import()` with a **non-literal specifier** (so `tsc`/build pass without them).
4. Every tsup `entry` must have a matching `exports` map key in `package.json`.
5. `sideEffects` is `["**/*.css"]` only — keep modules side-effect free so
   tree-shaking works.

## Release process

1. `npm run typecheck && npm run lint && npm run test && npm run build` (this is
   `prepublishOnly`).
2. Update `CHANGELOG.md`; bump `version` (semver per the API rules above).
3. `npm publish` (publishes `dist/`, `styles.css`, `LICENSE`, `NOTICE`,
   `README.md` per the `files` array).
4. Tag `vX.Y.Z`; CI runs on push/PR across Node 18/20/22.

## Testing requirements

- Pure logic (`core`, `replay`, `sync`, `events`) must have unit tests in
  `tests/`. Aim to cover branch logic (resample bucketing, replay cursor math,
  sync re-entrancy/gating).
- DOM-dependent pieces (`ChartController`, React components) are validated via the
  examples + manual run; do not add jsdom canvas mocks unless a regression needs
  one.
- A change to data/resample/replay/sync **must** ship with a test.
- `npm run test` must be green before publish.
