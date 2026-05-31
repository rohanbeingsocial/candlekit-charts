# @candlekit/charts — Project Reference

## What This Is

Framework-agnostic financial charting toolkit, a thin opinionated layer over
[lightweight-charts](https://github.com/tradingview/lightweight-charts) v5.
Candlestick / OHLC / line / area / volume; original drawing tools, pluggable
indicators, measurement ruler, deterministic replay, multi-chart sync. Core is
React-free; optional React bindings ship at `@candlekit/charts/react`.

Extracted and generalized from a production trading dashboard into a standalone,
public-ready library. **No proprietary material, no backend, no transport** — data
enters via consumer-implemented `*DataSource` interfaces.

Repo: `github.com/rohanbeingsocial/candlekit-charts` (private for now). License: MIT.

**Read [AGENTS.md](./AGENTS.md) and [CODEBASE_MAP.md](./CODEBASE_MAP.md) before
editing** — they hold the full architecture, folder import rules, and extension
points. This file is the short operational reference + the hard invariants.

---

## The one external runtime

`lightweight-charts` (Apache-2.0) is the **only** external runtime dependency, a
peer dep, the rendering engine. It is credited (NOTICE + README) with trademark
acknowledgement and non-affiliation. It cannot be absorbed or renamed — legal floor.

`react` / `react-dom` are optional peers (only for `/react`). `fancy-canvas`
(MIT) is types-only, transitive via lightweight-charts.

Drawing tools and indicators are **original MIT code** — no third-party drawing or
indicator runtime. Do not reintroduce one.

---

## Layout

```
src/
  core/         types, data (toBars/resample/floorToBucket), time (applyFixedOffset), theme. Pure, no runtime deps.
  events/       typed EventBus
  plugins/      ChartPlugin + PluginContext + ChartEventMap
  chart/        ChartController — imperative chart wrapper (the ms↔seconds boundary)
  data-source/  BarDataSource / StreamingDataSource / ReplayDataSource contracts
  drawing/      DrawingEngine (model) + DrawingPrimitive (canvas render) + DrawingController (plugin) + geometry + persistence
  measurement/  MeasurementController + RulerPrimitive + ChartCoordinateUtils
  indicators/   IndicatorRegistry + IndicatorController + builtin.ts (createBuiltinRegistry)
  replay/       deterministic ReplayController (per-day LRU + prefetch)
  sync/         multi-group SyncEngine
  react/        ChartView + overlay components + hooks (thin wrapper over core)
tests/          vitest unit tests (pure logic only)
examples/       react | vanilla | drawing | indicators | replay — standalone Vite apps, consume src via alias
docs/           getting-started, architecture, api-reference, drawing-tools, indicators, replay-system, plugin-development, contributing
reports/        OSS-readiness audit, licensing-attribution, excluded-files, migration-notes, launch-and-marketing
```

Barrels define the public surface: [src/index.ts](src/index.ts) (core),
`src/react/index.ts` (React). Anything not re-exported there is internal.

Build: tsup, **2 entries** (`.` core, `./react`) → ESM + CJS + `.d.ts`. Each tsup
entry must have a matching `exports` key in `package.json`.

---

## Commands

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm run test        # vitest run
npm run build       # tsup → dist/ (ESM+CJS+dts, both entries)
npm run format      # prettier --write .
npm run dev         # tsup --watch
```

`prepublishOnly` = typecheck + lint + test + build (all four must be green).
CI runs the same across Node 18/20/22 on push/PR to `main`.

Examples: `cd examples/<name> && npm install && npm run dev` (or `npm run build`
to verify imports resolve through the `src/` alias).

---

## Key invariants (don't break)

1. **Public API time unit = epoch milliseconds.** Convert to lightweight-charts'
   epoch-seconds **only** at the `ChartController` boundary. Fixed-offset exchanges
   use `applyFixedOffset(ts, minutes)` explicitly — the library never assumes a tz.
2. **Dependency direction is downward only:** `react → chart/plugins/engines → core`.
   Never import `react` from core; never import an engine from `core`.
3. **`lightweight-charts` is the only runtime dep.** Do not add runtime deps for
   drawing or indicators — they are self-contained MIT. (`lightningcss`/MPL in the
   lockfile is a dev-only optional-peer of Vite/Vitest — never shipped.)
4. **Barrels are the contract.** Adding exports = minor; changing/removing = major.
5. **`sideEffects: ["**/*.css"]` only** — keep modules side-effect-free so
   tree-shaking works.
6. **Pure functions in `core/`** — no globals, no DOM, fully unit-testable.
7. **Resampler anchor is a parameter** (`sessionOpenMinutes`, default 0 = UTC
   midnight). No hard-coded market open. Weekly/monthly are not produced by client
   resampling — supply pre-aggregated.
8. **No quant/business/market-domain logic.** This is a generic charting library;
   options/analytics math stayed in the origin app (see
   [reports/excluded-files.md](reports/excluded-files.md)).
9. **Drawing model is serializable** → persists for free. A new tool needs: id in
   `TOOL_POINTS`, a render `case` in `DrawingPrimitive`, a hit-test `case` in
   `DrawingController.bodyHit`.

---

## Extension points (quick)

- **Indicator** → `registry.register(def)` or extend `createBuiltinRegistry()`.
  `defFromRaw()` adapts an externally-shaped def. No core change.
- **Drawing tool** → see invariant 9.
- **Data source** → implement a `*DataSource` contract.
- **Behavior** → write a `ChartPlugin`, `controller.use(plugin)`; gets chart,
  series, theme, bus, current bars via `PluginContext`.
- **Framework binding** → mirror `src/react/` in a sibling dir + tsup entry +
  `exports` key. Never fold framework code into core.

---

## Testing

Pure logic (`core`, `replay`, `sync`, `events`, indicators math) must have unit
tests in `tests/`. A change to data/resample/replay/sync **must** ship a test.
DOM-dependent pieces (`ChartController`, React components, render primitives) are
validated via `examples/` + manual run — no jsdom canvas mocks unless a regression
needs one.

---

## Demo site & assets

- **`npm run build:site`** (`scripts/build-site.mjs`) builds every example into
  `site/<name>/` with base `/<repo>/<name>/`, then drops the landing page +
  `scripts/site-assets/*` (incl. `drawing.gif` / `indicators.gif` / `replay.gif`)
  at the site root. Override base for a local root preview: `SITE_BASE=/ npm run
  build:site`. `site/` is gitignored.
- **GitHub Pages** is published by `.github/workflows/deploy-pages.yml` on push
  to `main`. One-time enable: repo **Settings → Pages → Source = GitHub Actions**.
  URL: `https://rohanbeingsocial.github.io/candlekit-charts/`.
- **Showcase GIFs** (`scripts/site-assets/{drawing,indicators,replay}.gif`) are
  regenerated by `scripts/capture-demo.mjs` — Playwright drives the deployed (or
  local) demos (system Chrome via `channel:"chrome"`), screenshots frames while
  performing the interaction, encodes with `gifenc` (no ffmpeg). Run with
  `playwright-core gifenc pngjs` resolvable: `SCENE=all node scripts/capture-demo.mjs`
  (env: `SCENE BASE WIDTH HEIGHT DELAY_MS MAXFRAMES`). README references them
  by raw GitHub URL so they render on github.com + npm once public.

## Release

1. `npm run typecheck && npm run lint && npm run test && npm run build`.
2. Update `CHANGELOG.md`; bump `version` (semver per barrel rules).
3. **npm prerequisites (manual, one-time):** `npm login` (interactive + 2FA), and
   the **`@candlekit` org must exist** on npmjs.com (create it free for public
   packages) — or rename the scope. `publishConfig.access` is already `public`.
   Verify the tarball with `npm publish --dry-run` (runs `prepublishOnly`).
4. `npm publish` (ships `dist/`, `styles.css`, `LICENSE`, `NOTICE`, `README.md`
   per the `files` allowlist). **Publishing is effectively permanent** — names
   can't be reused after unpublish.
5. Tag `vX.Y.Z`.
